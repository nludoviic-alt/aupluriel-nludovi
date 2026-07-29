"""
Orchestrateur principal du bot de trading.
Cycle : Analyse → Décision → Risque → Exécution
"""

import time
import threading
from typing import Optional, Callable, List, Dict
from .config import EngineConfig, Timeframe, SignalDirection
from .logger import TradeLogger
from .analysis import AnalysisEngine, AnalysisResult
from .decision import DecisionEngine, Decision
from .risk import RiskEngine, Position
from .mt5_connector import MT5Connector, OrderResult
from .regime import RegimeDetector, RegimeResult, MarketRegime
from .patterns import PatternDetector
from .strategies import StrategyEnsemble, StrategySignal
from .position_manager import PositionManager
from .adaptive import AdaptiveLearner
from .anomaly import AnomalyDetector
from .calendar import EconomicCalendar


class TradingBot:
    """Bot de trading — Phase 1 : simulation."""

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()
        self.logger = TradeLogger()
        self.mt5 = MT5Connector(self.config, self.logger)
        self.analysis = AnalysisEngine(self.config)
        self.decision = DecisionEngine(self.config, self.logger)
        self.risk = RiskEngine(self.config, self.logger)

        self.regime_detector = RegimeDetector()
        self.pattern_detector = PatternDetector()
        self.strategy_ensemble = StrategyEnsemble(self.config) if self.config.enable_ensemble else None
        self.position_manager = PositionManager(self.config) if self.config.enable_trailing_stop else None
        self.adaptive = AdaptiveLearner(self.config, self.logger) if self.config.enable_adaptive else None
        self.anomaly = AnomalyDetector(self.config, self.logger, self.regime_detector) if self.config.enable_anomaly_detection else None
        self.calendar = EconomicCalendar(self.config, self.logger) if self.config.enable_economic_calendar else None

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._cycle_count = 0
        self._last_analysis: Optional[AnalysisResult] = None
        self._last_decision: Optional[Decision] = None
        self._last_regime: Optional[RegimeResult] = None
        self._last_strategy_signal: Optional[StrategySignal] = None
        self._callbacks: List[Callable] = []
        self._known_tickets: set = set()
        self._tracked_positions: Dict[int, Position] = {}
        self._manual_tickets: set = set()

    def add_callback(self, cb: Callable):
        """Ajoute un callback appelé à chaque cycle (pour WebSocket/API)."""
        self._callbacks.append(cb)

    def _notify(self, event: str, data: dict):
        for cb in self._callbacks:
            try:
                cb(event, data)
            except Exception:
                pass

    def connect(self) -> bool:
        """Connecte au broker MT5."""
        return self.mt5.connect()

    def start(self):
        """Démarre le bot en arrière-plan."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        if self.calendar:
            self.calendar.start()
        self.logger.info("Bot démarré")

    def stop(self):
        """Arrête le bot."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        if self.calendar:
            self.calendar.stop()
        self.logger.info("Bot arrêté")

    def kill_switch(self):
        """Active le kill-switch et ferme toutes les positions."""
        self.risk.activate_kill_switch()
        self.mt5.close_all_positions()
        self._notify("kill_switch", {"active": True})

    def resume_trading(self):
        """Désactive le kill-switch et reprend le trading."""
        self.risk.deactivate_kill_switch()
        self._notify("kill_switch", {"active": False})

    def _loop(self):
        """Boucle principale du bot."""
        while self._running:
            try:
                self._cycle()
            except Exception as e:
                self.logger.error(f"Erreur cycle: {e}")
            time.sleep(5)  # Cycle toutes les 5 secondes

    def _cycle(self):
        """Exécute un cycle complet : analyse → régime → stratégies → risque → exécution → gestion."""
        self._cycle_count += 1

        # 1. Récupère les données multi-timeframe
        data = {}
        for tf in self.config.timeframes:
            df = self.mt5.get_candles(tf, 200)
            if df is not None:
                data[tf] = df

        if not data:
            self.logger.warn("Pas de données disponibles")
            return

        # 2. Analyse technique
        analysis = self.analysis.analyze(data)
        self._last_analysis = analysis

        # 3. Détection de régime de marché
        regime = None
        if self.config.enable_regime_detection:
            primary_df = data.get(Timeframe.M15, list(data.values())[0])
            regime = self.regime_detector.detect(primary_df, analysis)
            self._last_regime = regime
            if regime.regime == MarketRegime.TRANSITION:
                self.logger.info(f"Régime: {regime.description}")

        # 4. Détection de patterns
        pattern_signals = None
        if self.config.enable_pattern_detection:
            primary_df = data.get(Timeframe.M5, list(data.values())[0])
            pattern_signals = self.pattern_detector.latest_signals(primary_df)

        # 5. Décision classique
        decision = self.decision.evaluate(analysis)
        self._last_decision = decision

        # 6. Évaluation des stratégies (ensemble)
        strategy_signal = None
        if self.strategy_ensemble and regime:
            primary_df = data.get(Timeframe.M15, list(data.values())[0])
            strategy_signal = self.strategy_ensemble.evaluate(primary_df, analysis, regime)
            self._last_strategy_signal = strategy_signal

        # 7. Vérifications de sécurité (anomalies + calendrier)
        should_pause = False
        size_multiplier = 1.0

        if self.anomaly:
            if self.anomaly.should_pause():
                should_pause = True
                self.logger.warn("Trading en pause — anomalie détectée")
            size_multiplier *= self.anomaly.size_multiplier()

        if self.calendar and self.calendar.should_pause_trading():
            should_pause = True
            self.logger.info("Trading en pause — événement économique high-impact")
        elif self.calendar and self.calendar.should_reduce_size():
            size_multiplier *= 0.5

        # 8. Met à jour l'état du risque
        account = self.mt5.get_account_info()
        positions = self.mt5.get_positions()
        floating_pnl = sum(p.profit for p in positions)
        realized_pnl = getattr(self.mt5, '_sim_realized_pnl', 0.0) if self.mt5._sim_mode else 0.0
        daily_pnl = floating_pnl + realized_pnl
        self.risk.update_state(
            balance=account.get("balance", self.config.starting_capital),
            equity=account.get("equity", self.config.starting_capital),
            positions=positions,
            daily_pnl=daily_pnl,
        )

        # 9. Exécution — utilise le signal stratégie si disponible, sinon décision classique
        order_result = None
        can_trade = (decision.would_trade or strategy_signal) and not self.risk.state.trading_halted and not should_pause

        if can_trade:
            m15_ind = analysis.indicators.get(Timeframe.M15.value)
            atr = m15_ind.atr if m15_ind else analysis.price * 0.01

            if strategy_signal and strategy_signal.confidence >= self.config.min_confidence_threshold:
                direction = strategy_signal.direction
                sl = strategy_signal.stop_loss
                tp = strategy_signal.take_profit
                confidence = strategy_signal.confidence
                strategy_name = strategy_signal.strategy
            else:
                direction = decision.direction
                risk_check = self.risk.check(decision, atr, analysis.price)
                if not risk_check.approved:
                    direction = SignalDirection.NEUTRAL
                sl = risk_check.stop_loss if direction != SignalDirection.NEUTRAL else 0
                tp = risk_check.take_profit if direction != SignalDirection.NEUTRAL else 0
                confidence = decision.confidence
                strategy_name = "trend_following"

            if direction != SignalDirection.NEUTRAL:
                # Dimensionne le volume sur la distance RÉELLE du stop (sl) qui sera
                # effectivement envoyé à l'ordre — sinon le risque réel diverge du
                # risque annoncé quand une stratégie utilise un stop différent de l'ATR par défaut.
                risk_check = self.risk.check(
                    type("D", (), {"direction": direction, "confidence": confidence})(),
                    atr, analysis.price,
                    stop_loss_price=sl,
                )
                if risk_check.approved:
                    volume = risk_check.volume * size_multiplier
                    if volume > 0:
                        order_result = self.mt5.send_order(
                            direction=direction.value,
                            volume=volume,
                            stop_loss=sl,
                            take_profit=tp,
                        )
                        if order_result.success:
                            self.risk.state.last_trade_volume = volume
                            if self.position_manager:
                                self.position_manager.register(
                                    type("P", (), {
                                        "ticket": order_result.ticket,
                                        "direction": direction.value,
                                        "volume": volume,
                                        "entry_price": order_result.price,
                                        "stop_loss": sl,
                                        "take_profit": tp,
                                    })()
                                )
                            self.logger.info(
                                f"Ordre {direction.value} exécuté — stratégie: {strategy_name}, "
                                f"confiance: {confidence:.1f}%, volume: {volume}, SL: {sl:.2f}, TP: {tp:.2f}"
                            )

        # 10. Gestion des positions (trailing stop, break-even, fermeture partielle)
        if self.position_manager and positions:
            current_price = self.mt5.get_current_price()
            m15_ind = analysis.indicators.get(Timeframe.M15.value)
            atr = m15_ind.atr if m15_ind else current_price * 0.01
            for pos in positions:
                actions = self.position_manager.update(pos, current_price, atr)
                if actions.get("close_all"):
                    self.logger.trade(f"Fermeture micro-scalp — gain sécurisé: +${pos.profit:.2f} sur ticket #{pos.ticket}")
                    self.mt5.close_position(pos.ticket)
                elif actions["modify_sl"] is not None:
                    self.logger.info(f"Position {pos.ticket}: SL ajusté à {actions['modify_sl']:.4f}")
                if actions.get("partial_close"):
                    pc = actions["partial_close"]
                    self.logger.info(f"Position {pos.ticket}: fermeture partielle niveau {pc['level']} — {pc['volume']} lots à {pc['price']:.4f}")

        # 11. Vérifie les positions pour SL/TP
        self._check_positions(positions)

        # 12. Notifie les callbacks
        self._notify("cycle", {
            "cycle": self._cycle_count,
            "analysis": self._analysis_to_dict(analysis),
            "decision": decision.to_dict(),
            "risk": self.risk.status(),
            "account": account,
            "order": order_result.__dict__ if order_result else None,
            "regime": regime.to_dict() if regime else None,
            "patterns": pattern_signals,
            "strategy_signal": {
                "strategy": strategy_signal.strategy,
                "direction": strategy_signal.direction.value,
                "confidence": strategy_signal.confidence,
                "reason": strategy_signal.reason,
            } if strategy_signal else None,
            "anomaly": self.anomaly.status() if self.anomaly else None,
            "calendar": self.calendar.status() if self.calendar else None,
            "adaptive": self.adaptive.status() if self.adaptive else None,
            "position_management": self.position_manager.status() if self.position_manager else None,
        })

    def _check_positions(self, positions: List[Position]):
        """Vérifie si des positions ont été fermées (SL/TP ou par le broker) et enregistre les résultats."""
        current_tickets = {p.ticket for p in positions}

        if self.mt5._sim_mode:
            # En simulation, c'est le bot lui-même qui décide de fermer sur SL/TP.
            current_price = self.mt5.get_current_price()
            for pos in positions:
                if pos.direction == "BUY":
                    if current_price <= pos.stop_loss:
                        self._close_and_record(pos, "loss")
                    elif current_price >= pos.take_profit:
                        self._close_and_record(pos, "win")
                else:
                    if current_price >= pos.stop_loss:
                        self._close_and_record(pos, "loss")
                    elif current_price <= pos.take_profit:
                        self._close_and_record(pos, "win")
        else:
            # En réel, le broker ferme lui-même sur SL/TP — on détecte la fermeture en
            # comparant les positions ouvertes d'un cycle à l'autre, et on récupère le
            # résultat net via l'historique des deals MT5.
            closed_tickets = self._known_tickets - current_tickets
            for ticket in closed_tickets:
                pos = self._tracked_positions.get(ticket)
                if pos is None:
                    continue
                profit = self.mt5.get_deal_profit(ticket)
                pos.profit = profit
                result = "win" if profit >= 0 else "loss"
                self._record_trade_result(pos, result, already_closed=True)

        self._known_tickets = current_tickets
        self._tracked_positions = {p.ticket: p for p in positions}

    def _close_and_record(self, pos: Position, result: str):
        """Ferme une position (mode simulation) et enregistre le résultat."""
        self.mt5.close_position(pos.ticket)
        self._record_trade_result(pos, result)

    def force_trade(self, direction: str, risk_pct: Optional[float] = None) -> dict:
        """Ouvre une position manuellement (hors cycle de décision automatique).

        Réutilise le moteur de risque exactement comme le cycle automatique
        (kill-switch, arrêt sur pertes, positions max, perte quotidienne) —
        seul le seuil de confiance est court-circuité, puisque c'est un humain
        qui décide ici. Toujours étiqueté stratégie "manual" : ne doit jamais
        être confondu avec les stats d'une vraie stratégie automatique.
        """
        try:
            sig_dir = SignalDirection(direction.upper())
        except ValueError:
            return {"success": False, "reason": f"Direction invalide: {direction}"}
        if sig_dir == SignalDirection.NEUTRAL:
            return {"success": False, "reason": "Direction NEUTRAL non autorisée pour un trade forcé"}

        analysis = self._last_analysis
        if analysis is None:
            data = {}
            for tf in self.config.timeframes:
                candles = self.mt5.get_candles(tf, 200)
                if candles is not None:
                    data[tf.value] = candles
            if not data:
                return {"success": False, "reason": "Pas de données marché disponibles"}
            analysis = self.analysis.analyze(data)
        m15_ind = analysis.indicators.get(Timeframe.M15.value)
        atr = m15_ind.atr if m15_ind else analysis.price * 0.01
        price = analysis.price

        fake_decision = type("D", (), {"direction": sig_dir, "confidence": 100})()
        risk_check = self.risk.check(fake_decision, atr, price, risk_pct_override=risk_pct)
        if not risk_check.approved:
            return {"success": False, "reason": risk_check.reason}

        volume = risk_check.volume
        if volume <= 0:
            return {"success": False, "reason": "Volume calculé = 0"}

        order_result = self.mt5.send_order(
            direction=sig_dir.value, volume=volume,
            stop_loss=risk_check.stop_loss, take_profit=risk_check.take_profit,
        )
        if not order_result.success:
            return {"success": False, "reason": order_result.message}

        self.risk.state.last_trade_volume = volume
        self._manual_tickets.add(order_result.ticket)
        if self.position_manager:
            self.position_manager.register(type("P", (), {
                "ticket": order_result.ticket, "direction": sig_dir.value, "volume": volume,
                "entry_price": order_result.price, "stop_loss": risk_check.stop_loss,
                "take_profit": risk_check.take_profit,
            })())
        self.logger.info(
            f"Trade FORCÉ {sig_dir.value} exécuté — volume: {volume}, "
            f"SL: {risk_check.stop_loss:.2f}, TP: {risk_check.take_profit:.2f}"
        )
        return {
            "success": True, "ticket": order_result.ticket, "volume": volume,
            "stop_loss": risk_check.stop_loss, "take_profit": risk_check.take_profit,
            "price": order_result.price,
        }

    def _record_trade_result(self, pos: Position, result: str, already_closed: bool = False):
        """Enregistre le résultat d'une position fermée pour le risque, l'adaptation et l'anomalie."""
        self.risk.record_trade_result(result, pos.volume)
        if pos.ticket in self._manual_tickets:
            self._manual_tickets.discard(pos.ticket)
            strategy_name = "manual"
            confidence = 100.0
        else:
            strategy_name = self._last_strategy_signal.strategy if self._last_strategy_signal else "trend_following"
            confidence = self._last_decision.confidence if self._last_decision else 50
        exit_price = pos.current_price if already_closed else self.mt5.get_current_price()
        self.logger.trade(
            f"Position {pos.ticket} fermée — {result.upper()}, P&L: {pos.profit:.2f}",
            {
                "ticket": pos.ticket, "result": result, "profit": pos.profit, "volume": pos.volume,
                "symbol": pos.symbol, "direction": pos.direction,
                "entry_price": pos.entry_price, "exit_price": exit_price,
                "strategy": strategy_name, "confidence": confidence,
            },
        )

        # Alimente l'apprentissage adaptatif
        if self.adaptive:
            regime_name = self._last_regime.regime.value if self._last_regime else "unknown"
            indicators = {}
            if self._last_analysis:
                for tf, ind in self._last_analysis.indicators.items():
                    indicators[f"{tf}_rsi"] = ind.rsi
                    indicators[f"{tf}_macd"] = ind.macd_histogram
            self.adaptive.record_trade(
                strategy=strategy_name,
                direction=pos.direction,
                confidence=confidence,
                result=result,
                pnl=pos.profit,
                volume=pos.volume,
                regime=regime_name,
                indicators=indicators,
                entry_price=pos.entry_price,
                exit_price=exit_price,
            )

        # Alimente le détecteur d'anomalies
        if self.anomaly:
            self.anomaly.record_trade(result, pos.profit)

        # Nettoie le gestionnaire de position
        if self.position_manager:
            self.position_manager.cleanup(pos.ticket)

    def _analysis_to_dict(self, a: AnalysisResult) -> dict:
        return {
            "symbol": a.symbol,
            "price": a.price,
            "global_trend": a.global_trend.value,
            "trend_alignment": a.trend_alignment,
            "volatility_high": a.volatility_high,
            "support": a.support_nearest,
            "resistance": a.resistance_nearest,
            "signals": a.signals,
            "indicators": {
                tf: {
                    "rsi": round(ind.rsi, 2),
                    "ema_fast": round(ind.ema_fast, 4),
                    "ema_slow": round(ind.ema_slow, 4),
                    "macd_histogram": round(ind.macd_histogram, 6),
                    "atr": round(ind.atr, 4),
                    "volatility_pct": round(ind.volatility_pct, 2),
                    "trend": ind.trend.value,
                    "support": round(ind.support, 4),
                    "resistance": round(ind.resistance, 4),
                }
                for tf, ind in a.indicators.items()
            },
        }

    def status(self) -> dict:
        """Retourne l'état complet du bot."""
        account = self.mt5.get_account_info()
        positions = self.mt5.get_positions()
        return {
            "running": self._running,
            "sim_mode": self.mt5._sim_mode,
            "cycle": self._cycle_count,
            "account": account,
            "positions": [
                {
                    "ticket": p.ticket,
                    "direction": p.direction,
                    "volume": p.volume,
                    "entry": p.entry_price,
                    "current": p.current_price,
                    "sl": p.stop_loss,
                    "tp": p.take_profit,
                    "profit": round(p.profit, 2),
                }
                for p in positions
            ],
            "risk": self.risk.status(),
            "last_analysis": self._analysis_to_dict(self._last_analysis) if self._last_analysis else None,
            "last_decision": self._last_decision.to_dict() if self._last_decision else None,
            "regime": self._last_regime.to_dict() if self._last_regime else None,
            "strategy_signal": {
                "strategy": self._last_strategy_signal.strategy,
                "direction": self._last_strategy_signal.direction.value,
                "confidence": self._last_strategy_signal.confidence,
                "reason": self._last_strategy_signal.reason,
            } if self._last_strategy_signal else None,
            "anomaly": self.anomaly.status() if self.anomaly else None,
            "calendar": self.calendar.status() if self.calendar else None,
            "adaptive": self.adaptive.status() if self.adaptive else None,
            "position_management": self.position_manager.status() if self.position_manager else None,
            "config": {
                "symbol": self.config.symbol,
                "risk_per_trade_pct": self.config.risk_per_trade_pct,
                "min_confidence": self.config.min_confidence_threshold,
                "max_positions": self.config.max_concurrent_positions,
                "max_consecutive_losses": self.config.max_consecutive_losses,
                "daily_loss_limit_pct": self.config.max_daily_loss_pct,
                "is_live": self.config.is_live,
                "ia_mode": self.config.ia_mode,
                "max_trades_per_hour": self.config.max_trades_per_hour,
                "allow_buy": self.config.allow_buy,
                "allow_sell": self.config.allow_sell,
                "max_weekly_loss_pct": self.config.max_weekly_loss_pct,
                "min_rr_ratio": self.config.min_rr_ratio,
                "max_total_exposure_pct": self.config.max_total_exposure_pct,
                "min_balance": self.config.min_balance,
            },
        }

    def update_config(self, updates: dict):
        """Met à jour la configuration en temps réel."""
        if "risk_per_trade_pct" in updates:
            self.config.risk_per_trade_pct = float(updates["risk_per_trade_pct"])
        if "min_confidence_threshold" in updates:
            self.config.min_confidence_threshold = float(updates["min_confidence_threshold"])
        if "max_concurrent_positions" in updates:
            self.config.max_concurrent_positions = int(updates["max_concurrent_positions"])
        if "max_consecutive_losses" in updates:
            self.config.max_consecutive_losses = int(updates["max_consecutive_losses"])
        if "max_daily_loss_pct" in updates:
            self.config.max_daily_loss_pct = float(updates["max_daily_loss_pct"])
        if "atr_stop_multiplier" in updates:
            self.config.atr_stop_multiplier = float(updates["atr_stop_multiplier"])
        if "ia_mode" in updates:
            self.config.ia_mode = str(updates["ia_mode"])
        if "max_trades_per_hour" in updates:
            self.config.max_trades_per_hour = int(updates["max_trades_per_hour"])
        if "max_weekly_loss_pct" in updates:
            self.config.max_weekly_loss_pct = float(updates["max_weekly_loss_pct"])
        if "min_rr_ratio" in updates:
            self.config.min_rr_ratio = float(updates["min_rr_ratio"])
        if "max_total_exposure_pct" in updates:
            self.config.max_total_exposure_pct = float(updates["max_total_exposure_pct"])
        if "min_balance" in updates:
            self.config.min_balance = float(updates["min_balance"])
        if "allow_buy" in updates:
            self.config.allow_buy = bool(updates["allow_buy"])
        if "allow_sell" in updates:
            self.config.allow_sell = bool(updates["allow_sell"])
        self.logger.info(f"Configuration mise à jour: {updates}")
