"""
Connecteur MetaTrader 5 + exécution des ordres.
- Connexion au terminal MT5 (Deriv-Demo)
- Récupération des données OHLC multi-timeframe
- Vérification du solde, spread, taille du lot
- Placement, modification et fermeture des positions
- Journalisation complète

En mode simulation (sans MT5 installé), utilise des données générées.
"""

import time
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional, List, Dict
from .config import EngineConfig, Timeframe
from .logger import TradeLogger
from .risk import Position, RiskEngine

# Mapping timeframe → constante MT5
MT5_TIMEFRAMES = {
    Timeframe.M5: None,   # Rempli dynamiquement
    Timeframe.M15: None,
    Timeframe.H1: None,
}


@dataclass
class OrderResult:
    """Résultat d'un ordre envoyé à MT5."""
    success: bool
    ticket: int = 0
    message: str = ""
    price: float = 0.0
    volume: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0


class MT5Connector:
    """Connecteur MetaTrader 5 avec fallback simulation."""

    def __init__(self, config: EngineConfig, logger: TradeLogger):
        self.config = config
        self.logger = logger
        self.mt5 = None
        self.connected = False
        self._sim_mode = False
        self._sim_prices = {}
        self._sim_positions = []
        self._sim_ticket = 100000

    def connect(self) -> bool:
        """Tente de se connecter à MT5. Bascule en simulation si indisponible."""
        try:
            import MetaTrader5 as mt5
            self.mt5 = mt5

            # Mapping des timeframes
            MT5_TIMEFRAMES[Timeframe.M5] = mt5.TIMEFRAME_M5
            MT5_TIMEFRAMES[Timeframe.M15] = mt5.TIMEFRAME_M15
            MT5_TIMEFRAMES[Timeframe.H1] = mt5.TIMEFRAME_H1

            init_kwargs = {
                "login": self.config.mt5_login,
                "password": self.config.mt5_password,
                "server": self.config.mt5_server,
            }
            if self.config.mt5_path:
                init_kwargs["path"] = self.config.mt5_path

            if not mt5.initialize(**init_kwargs):
                self.logger.warn(f"MT5 initialize échoué: {mt5.last_error()}")
                self._enable_simulation()
                return True  # Simulation active

            info = mt5.account_info()
            if info is None:
                self.logger.warn("MT5 account_info = None, bascule simulation")
                self._enable_simulation()
                return True

            self.connected = True
            self.logger.info(
                f"MT5 connecté — compte {info.login}, balance {info.balance} {info.currency}",
                {"login": info.login, "balance": info.balance, "currency": info.currency},
            )
            return True

        except ImportError:
            self.logger.warn("MetaTrader5 non installé — mode simulation activé")
            self._enable_simulation()
            return True
        except Exception as e:
            self.logger.error(f"Erreur connexion MT5: {e}")
            self._enable_simulation()
            return True

    def _enable_simulation(self):
        """Active le mode simulation avec données générées."""
        self._sim_mode = True
        self._sim_prices = {self.config.symbol: 508.28}
        self.logger.info(
            f"Mode SIMULATION — {self.config.symbol}, capital démo {self.config.starting_capital}",
        )

    def disconnect(self):
        if self.mt5 and self.connected:
            self.mt5.shutdown()
            self.logger.info("MT5 déconnecté")

    # --- Données ---

    def get_candles(self, timeframe: Timeframe, count: int = 200) -> Optional[pd.DataFrame]:
        """Récupère les bougies OHLC pour une timeframe."""
        if self._sim_mode:
            return self._generate_candles(timeframe, count)

        tf_const = MT5_TIMEFRAMES.get(timeframe)
        if tf_const is None:
            return None

        rates = self.mt5.copy_rates_from_pos(self.config.symbol_mt5, tf_const, 0, count)
        if rates is None or len(rates) == 0:
            self.logger.warn(f"Pas de données pour {self.config.symbol_mt5} {timeframe.value}")
            return None

        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        df = df.rename(columns={
            "open": "open", "high": "high", "low": "low",
            "close": "close", "tick_volume": "volume",
        })
        return df[["time", "open", "high", "low", "close", "volume"]]

    def _generate_candles(self, timeframe: Timeframe, count: int = 200) -> pd.DataFrame:
        """Génère des bougies simulées (marche aléatoire avec drift)."""
        base_price = self._sim_prices.get(self.config.symbol, 508.28)
        # Volatilité selon la timeframe
        vol_map = {Timeframe.M5: 0.15, Timeframe.M15: 0.25, Timeframe.H1: 0.50}
        vol = vol_map.get(timeframe, 0.20)

        # Intervalle en minutes
        interval_map = {Timeframe.M5: 5, Timeframe.M15: 15, Timeframe.H1: 60}
        interval = interval_map.get(timeframe, 5)

        now = time.time()
        timestamps = [now - (count - i) * interval * 60 for i in range(count)]

        prices = [base_price]
        for i in range(1, count):
            # Léger drift + bruit
            drift = np.sin(i * 0.05) * 0.08
            noise = np.random.randn() * vol
            prices.append(max(prices[-1] + drift + noise, 1.0))

        # Met à jour le prix courant
        self._sim_prices[self.config.symbol] = prices[-1]

        # Construit OHLC
        opens = prices[:-1] if len(prices) > count else prices
        closes = prices[1:] if len(prices) > count else prices
        if len(opens) < count:
            opens = prices
            closes = prices

        # Ajuste les longueurs
        n = min(len(opens), len(closes), count)
        opens = opens[-n:]
        closes = closes[-n:]
        timestamps = timestamps[-n:]

        highs = [max(o, c) + abs(np.random.randn()) * vol * 0.5 for o, c in zip(opens, closes)]
        lows = [min(o, c) - abs(np.random.randn()) * vol * 0.5 for o, c in zip(opens, closes)]
        volumes = [int(np.random.randint(100, 1000)) for _ in range(n)]

        return pd.DataFrame({
            "time": pd.to_datetime(timestamps, unit="s"),
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": volumes,
        })

    # --- Compte & positions ---

    def get_account_info(self) -> dict:
        """Récupère les infos du compte (balance, equity, marge)."""
        if self._sim_mode:
            balance = self.config.starting_capital
            # Simule l'équité avec les positions virtuelles
            equity = balance + sum(p.profit for p in self._sim_positions)
            return {
                "balance": balance,
                "equity": equity,
                "margin": 0.0,
                "margin_free": equity,
                "currency": "USD",
                "login": 0,
                "server": "SIMULATION",
            }

        info = self.mt5.account_info()
        if info is None:
            return {}
        return {
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "margin_free": info.margin_free,
            "currency": info.currency,
            "login": info.login,
            "server": info.server,
        }

    def get_positions(self) -> List[Position]:
        """Récupère les positions ouvertes."""
        if self._sim_mode:
            # Met à jour les profits simulés
            current_price = self._sim_prices.get(self.config.symbol, 508.28)
            for p in self._sim_positions:
                p.current_price = current_price
                if p.direction == "BUY":
                    p.profit = (current_price - p.entry_price) * p.volume * 100
                else:
                    p.profit = (p.entry_price - current_price) * p.volume * 100
            return list(self._sim_positions)

        positions = self.mt5.positions_get(symbol=self.config.symbol_mt5)
        if positions is None:
            return []

        result = []
        for pos in positions:
            result.append(Position(
                ticket=pos.ticket,
                symbol=pos.symbol,
                direction="BUY" if pos.type == 0 else "SELL",
                volume=pos.volume,
                entry_price=pos.price_open,
                stop_loss=pos.sl,
                take_profit=pos.tp,
                open_time=pos.time,
                current_price=pos.price_current,
                profit=pos.profit,
            ))
        return result

    def get_symbol_info(self) -> dict:
        """Récupère les infos du symbole (spread, point, contract size)."""
        if self._sim_mode:
            return {
                "spread": 2,
                "point": 0.001,
                "digits": 3,
                "volume_min": 0.01,
                "volume_max": 100.0,
                "volume_step": 0.01,
                "bid": self._sim_prices.get(self.config.symbol, 508.28),
                "ask": self._sim_prices.get(self.config.symbol, 508.28) + 0.002,
            }

        info = self.mt5.symbol_info(self.config.symbol_mt5)
        if info is None:
            return {}
        return {
            "spread": info.spread,
            "point": info.point,
            "digits": info.digits,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "bid": info.bid,
            "ask": info.ask,
        }

    def get_current_price(self) -> float:
        """Récupère le prix courant."""
        if self._sim_mode:
            return self._sim_prices.get(self.config.symbol, 508.28)

        tick = self.mt5.symbol_info_tick(self.config.symbol_mt5)
        if tick is None:
            return 0.0
        return (tick.bid + tick.ask) / 2

    def get_spread(self) -> float:
        """Récupère le spread actuel en points."""
        if self._sim_mode:
            return 2.0
        info = self.mt5.symbol_info(self.config.symbol_mt5)
        return float(info.spread) if info else 999.0

    # --- Exécution ---

    def check_order(self, direction: str, volume: float, price: float,
                    stop_loss: float, take_profit: float) -> tuple:
        """Vérifie l'ordre avant envoi (spread, solde, taille lot).
        Retourne (ok: bool, reason: str).
        """
        # Vérifie le spread
        spread = self.get_spread()
        if spread > self.config.max_spread_points:
            return False, f"Spread trop élevé: {spread} > {self.config.max_spread_points}"

        # Vérifie la taille du lot
        sym = self.get_symbol_info()
        vol_min = sym.get("volume_min", 0.01)
        vol_max = sym.get("volume_max", 100.0)
        vol_step = sym.get("volume_step", 0.01)

        if volume < vol_min:
            return False, f"Volume {volume} < minimum {vol_min}"
        if volume > vol_max:
            return False, f"Volume {volume} > maximum {vol_max}"

        # Arrondit au step le plus proche
        volume = round(volume / vol_step) * vol_step

        # Vérifie le solde
        account = self.get_account_info()
        if account.get("balance", 0) <= 0:
            return False, "Solde insuffisant"

        return True, "Ordre validé"

    def send_order(self, direction: str, volume: float, stop_loss: float,
                   take_profit: float) -> OrderResult:
        """Envoie un ordre au marché avec SL/TP."""
        price = self.get_current_price()

        # Vérification préalable
        ok, reason = self.check_order(direction, volume, price, stop_loss, take_profit)
        if not ok:
            self.logger.trade(f"Ordre REJETÉ — {reason}")
            return OrderResult(success=False, message=reason)

        if self._sim_mode:
            return self._sim_send_order(direction, volume, price, stop_loss, take_profit)

        # MT5 réel
        mt5 = self.mt5
        if direction == "BUY":
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": self.config.symbol_mt5,
                "volume": float(volume),
                "type": mt5.ORDER_TYPE_BUY,
                "price": price,
                "sl": stop_loss,
                "tp": take_profit,
                "deviation": int(self.config.slippage_points),
                "magic": 234000,
                "comment": "Au Pluriel Engine",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
        else:
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": self.config.symbol_mt5,
                "volume": float(volume),
                "type": mt5.ORDER_TYPE_SELL,
                "price": price,
                "sl": stop_loss,
                "tp": take_profit,
                "deviation": int(self.config.slippage_points),
                "magic": 234000,
                "comment": "Au Pluriel Engine",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }

        result = mt5.order_send(request)
        if result is None:
            return OrderResult(success=False, message="order_send retourné None")

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            self.logger.trade(
                f"Ordre échoué — retcode {result.retcode}",
                {"retcode": result.retcode, "comment": result.comment},
            )
            return OrderResult(
                success=False,
                message=f"retcode={result.retcode}, comment={result.comment}",
            )

        self.logger.trade(
            f"Ordre exécuté — {direction} {volume} @ {result.price}, ticket {result.order}",
            {"ticket": result.order, "price": result.price, "volume": volume,
             "direction": direction, "sl": stop_loss, "tp": take_profit},
        )

        return OrderResult(
            success=True,
            ticket=result.order,
            message="Ordre exécuté",
            price=result.price,
            volume=volume,
            stop_loss=stop_loss,
            take_profit=take_profit,
        )

    def _sim_send_order(self, direction: str, volume: float, price: float,
                        stop_loss: float, take_profit: float) -> OrderResult:
        """Simule l'envoi d'un ordre."""
        self._sim_ticket += 1
        pos = Position(
            ticket=self._sim_ticket,
            symbol=self.config.symbol,
            direction=direction,
            volume=volume,
            entry_price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            open_time=time.time(),
            current_price=price,
            profit=0.0,
        )
        self._sim_positions.append(pos)

        self.logger.trade(
            f"[SIM] Ordre exécuté — {direction} {volume} @ {price:.4f}, ticket {pos.ticket}",
            {"ticket": pos.ticket, "price": price, "volume": volume,
             "direction": direction, "sl": stop_loss, "tp": take_profit, "sim": True},
        )

        return OrderResult(
            success=True,
            ticket=pos.ticket,
            message="[SIM] Ordre exécuté",
            price=price,
            volume=volume,
            stop_loss=stop_loss,
            take_profit=take_profit,
        )

    def close_position(self, ticket: int) -> bool:
        """Ferme une position par son ticket."""
        if self._sim_mode:
            before = len(self._sim_positions)
            self._sim_positions = [p for p in self._sim_positions if p.ticket != ticket]
            closed = len(self._sim_positions) < before
            if closed:
                self.logger.trade(f"[SIM] Position {ticket} fermée")
            return closed

        positions = self.mt5.positions_get(ticket=ticket)
        if not positions:
            return False

        pos = positions[0]
        mt5 = self.mt5
        is_buy = pos.type == 0
        price = self.mt5.symbol_info_tick(pos.symbol).bid if is_buy else self.mt5.symbol_info_tick(pos.symbol).ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
            "position": ticket,
            "price": price,
            "deviation": int(self.config.slippage_points),
            "magic": 234000,
            "comment": "Au Pluriel — fermeture",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            self.logger.trade(f"Position {ticket} fermée à {price}")
            return True
        return False

    def close_all_positions(self) -> int:
        """Ferme toutes les positions — utilisé par le kill-switch."""
        if self._sim_mode:
            count = len(self._sim_positions)
            self._sim_positions.clear()
            self.logger.trade(f"[SIM] {count} positions fermées (close all)")
            return count

        positions = self.get_positions()
        closed = 0
        for p in positions:
            if self.close_position(p.ticket):
                closed += 1
        self.logger.trade(f"{closed}/{len(positions)} positions fermées")
        return closed

    def modify_position(self, ticket: int, stop_loss: float, take_profit: float) -> bool:
        """Modifie le SL/TP d'une position ouverte."""
        if self._sim_mode:
            for p in self._sim_positions:
                if p.ticket == ticket:
                    p.stop_loss = stop_loss
                    p.take_profit = take_profit
                    return True
            return False

        mt5 = self.mt5
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": self.config.symbol_mt5,
            "position": ticket,
            "sl": stop_loss,
            "tp": take_profit,
        }
        result = mt5.order_send(request)
        return result and result.retcode == mt5.TRADE_RETCODE_DONE

    def get_deal_profit(self, ticket: int) -> float:
        """Récupère le profit net (profit + commission + swap) d'une position fermée,
        via l'historique des deals MT5. Utilisé pour détecter le résultat d'une
        position fermée par le broker (SL/TP touché, ou fermeture manuelle)."""
        if self._sim_mode:
            return 0.0

        deals = self.mt5.history_deals_get(position=ticket)
        if not deals:
            return 0.0
        return sum(d.profit + d.commission + d.swap for d in deals)
