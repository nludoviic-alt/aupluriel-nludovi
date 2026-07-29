"""
Apprentissage adaptatif (self-learning).
Analyse l'historique des trades pour ajuster automatiquement les paramètres.
"""

import json
import os
import time
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from collections import defaultdict
from .config import EngineConfig
from .logger import TradeLogger


@dataclass
class TradeRecord:
    timestamp: float
    strategy: str
    direction: str
    confidence: float
    result: str  # "win" or "loss"
    pnl: float
    volume: float
    regime: str
    hour: int
    indicators: Dict[str, float]
    entry_price: float
    exit_price: float
    duration_min: float


@dataclass
class AdaptiveInsights:
    best_hours: List[int]
    worst_hours: List[int]
    best_strategy: str
    worst_strategy: str
    best_regime: str
    optimal_confidence: float
    optimal_volume_pct: float
    win_rate_by_strategy: Dict[str, float]
    win_rate_by_hour: Dict[int, float]
    win_rate_by_regime: Dict[str, float]
    total_trades: int
    total_wins: int
    total_pnl: float
    recommendations: List[str]


class AdaptiveLearner:
    """Apprend de l'historique des trades pour optimiser les paramètres."""

    def __init__(self, config: EngineConfig, logger: TradeLogger, data_file: str = "engine/logs/trades.json"):
        self.config = config
        self.logger = logger
        self.data_file = data_file
        self._trades: List[TradeRecord] = []
        self._load()

    def _load(self):
        """Charge l'historique depuis le fichier."""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, "r") as f:
                    data = json.load(f)
                    self._trades = [TradeRecord(**t) for t in data]
        except Exception as e:
            self.logger.warn(f"AdaptiveLearner: erreur chargement: {e}")

    def _save(self):
        """Sauvegarde l'historique."""
        try:
            os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
            with open(self.data_file, "w") as f:
                json.dump([t.__dict__ for t in self._trades], f, indent=2)
        except Exception as e:
            self.logger.warn(f"AdaptiveLearner: erreur sauvegarde: {e}")

    def record_trade(self, strategy: str, direction: str, confidence: float,
                     result: str, pnl: float, volume: float, regime: str,
                     indicators: Dict[str, float], entry_price: float, exit_price: float,
                     duration_min: float = 0):
        """Enregistre un trade fermé."""
        trade = TradeRecord(
            timestamp=time.time(),
            strategy=strategy,
            direction=direction,
            confidence=confidence,
            result=result,
            pnl=pnl,
            volume=volume,
            regime=regime,
            hour=int(time.strftime("%H")),
            indicators=indicators,
            entry_price=entry_price,
            exit_price=exit_price,
            duration_min=duration_min,
        )
        self._trades.append(trade)
        self._save()

        if len(self._trades) % 10 == 0:
            insights = self.analyze()
            self._apply_insights(insights)

    def analyze(self) -> AdaptiveInsights:
        """Analyse l'historique et produit des insights."""
        if len(self._trades) < 5:
            wins = [t for t in self._trades if t.result == "win"]
            return AdaptiveInsights(
                best_hours=[], worst_hours=[],
                best_strategy="", worst_strategy="",
                best_regime="", optimal_confidence=self.config.min_confidence_threshold,
                optimal_volume_pct=self.config.risk_per_trade_pct,
                win_rate_by_strategy={}, win_rate_by_hour={}, win_rate_by_regime={},
                total_trades=len(self._trades), total_wins=len(wins),
                total_pnl=round(sum(t.pnl for t in self._trades), 2),
                recommendations=["Pas assez de trades pour l'analyse (minimum 5)"],
            )

        wins = [t for t in self._trades if t.result == "win"]
        losses = [t for t in self._trades if t.result == "loss"]

        # Win rate par stratégie
        by_strategy = defaultdict(lambda: {"wins": 0, "total": 0, "pnl": 0})
        for t in self._trades:
            by_strategy[t.strategy]["total"] += 1
            if t.result == "win":
                by_strategy[t.strategy]["wins"] += 1
            by_strategy[t.strategy]["pnl"] += t.pnl

        wr_strategy = {s: (d["wins"] / d["total"] * 100) for s, d in by_strategy.items()}
        best_strategy = max(wr_strategy, key=wr_strategy.get) if wr_strategy else ""
        worst_strategy = min(wr_strategy, key=wr_strategy.get) if wr_strategy else ""

        # Win rate par heure
        by_hour = defaultdict(lambda: {"wins": 0, "total": 0, "pnl": 0})
        for t in self._trades:
            by_hour[t.hour]["total"] += 1
            if t.result == "win":
                by_hour[t.hour]["wins"] += 1
            by_hour[t.hour]["pnl"] += t.pnl

        wr_hour = {h: (d["wins"] / d["total"] * 100) for h, d in by_hour.items() if d["total"] >= 2}
        best_hours = sorted(wr_hour, key=wr_hour.get, reverse=True)[:3]
        worst_hours = sorted(wr_hour, key=wr_hour.get)[:3]

        # Win rate par régime
        by_regime = defaultdict(lambda: {"wins": 0, "total": 0})
        for t in self._trades:
            by_regime[t.regime]["total"] += 1
            if t.result == "win":
                by_regime[t.regime]["wins"] += 1

        wr_regime = {r: (d["wins"] / d["total"] * 100) for r, d in by_regime.items()}
        best_regime = max(wr_regime, key=wr_regime.get) if wr_regime else ""

        # Confiance optimale
        win_confidences = [t.confidence for t in wins]
        loss_confidences = [t.confidence for t in losses]
        if win_confidences and loss_confidences:
            avg_win = sum(win_confidences) / len(win_confidences)
            avg_loss = sum(loss_confidences) / len(loss_confidences)
            optimal_confidence = (avg_win + avg_loss) / 2
        else:
            optimal_confidence = self.config.min_confidence_threshold

        # Volume optimal
        win_volumes = [t.volume for t in wins]
        loss_volumes = [t.volume for t in losses]
        if win_volumes and loss_volumes:
            avg_win_vol = sum(win_volumes) / len(win_volumes)
            avg_loss_vol = sum(loss_volumes) / len(loss_volumes)
            optimal_volume = avg_win_vol if avg_win_vol > avg_loss_vol else self.config.risk_per_trade_pct
        else:
            optimal_volume = self.config.risk_per_trade_pct

        # Recommandations
        recommendations = []
        if best_strategy and wr_strategy.get(best_strategy, 0) > 60:
            recommendations.append(f"Stratégie '{best_strategy}' performe le mieux ({wr_strategy[best_strategy]:.0f}% win rate)")
        if worst_strategy and wr_strategy.get(worst_strategy, 0) < 40:
            recommendations.append(f"Éviter '{worst_strategy}' ({wr_strategy[worst_strategy]:.0f}% win rate)")
        if best_hours:
            recommendations.append(f"Meilleures heures: {', '.join(f'{h}h' for h in best_hours)}")
        if worst_hours:
            recommendations.append(f"Éviter les heures: {', '.join(f'{h}h' for h in worst_hours)}")
        if optimal_confidence > self.config.min_confidence_threshold + 5:
            recommendations.append(f"Augmenter le seuil de confiance à {optimal_confidence:.0f}%")
        elif optimal_confidence < self.config.min_confidence_threshold - 5:
            recommendations.append(f"Réduire le seuil de confiance à {optimal_confidence:.0f}%")

        return AdaptiveInsights(
            best_hours=best_hours,
            worst_hours=worst_hours,
            best_strategy=best_strategy,
            worst_strategy=worst_strategy,
            best_regime=best_regime,
            optimal_confidence=round(optimal_confidence, 1),
            optimal_volume_pct=round(optimal_volume, 2),
            win_rate_by_strategy={k: round(v, 1) for k, v in wr_strategy.items()},
            win_rate_by_hour={k: round(v, 1) for k, v in wr_hour.items()},
            win_rate_by_regime={k: round(v, 1) for k, v in wr_regime.items()},
            total_trades=len(self._trades),
            total_wins=len(wins),
            total_pnl=round(sum(t.pnl for t in self._trades), 2),
            recommendations=recommendations,
        )

    def _apply_insights(self, insights: AdaptiveInsights):
        """Applique les ajustements automatiquement."""
        changes = []

        # Ajustement du seuil de confiance
        if abs(insights.optimal_confidence - self.config.min_confidence_threshold) > 5:
            old = self.config.min_confidence_threshold
            self.config.min_confidence_threshold = insights.optimal_confidence
            changes.append(f"Seuil confiance: {old:.0f}% → {insights.optimal_confidence:.0f}%")

        if changes:
            self.logger.info(f"AdaptiveLearner ajustements: {' | '.join(changes)}")

    def status(self) -> dict:
        """Retourne l'état pour l'API."""
        insights = self.analyze()
        return {
            "total_trades": insights.total_trades,
            "total_wins": insights.total_wins,
            "total_pnl": insights.total_pnl,
            "win_rate": round(insights.total_wins / insights.total_trades * 100, 1) if insights.total_trades > 0 else 0,
            "best_strategy": insights.best_strategy,
            "best_hours": insights.best_hours,
            "worst_hours": insights.worst_hours,
            "optimal_confidence": insights.optimal_confidence,
            "win_rate_by_strategy": insights.win_rate_by_strategy,
            "win_rate_by_hour": insights.win_rate_by_hour,
            "win_rate_by_regime": insights.win_rate_by_regime,
            "recommendations": insights.recommendations,
        }
