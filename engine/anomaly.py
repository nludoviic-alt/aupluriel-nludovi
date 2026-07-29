"""
Détection d'anomalies et anti-overfitting.
Surveille le win rate, détecte les regime shifts, et met en pause si nécessaire.
"""

import time
from dataclasses import dataclass, field
from typing import List, Optional
from collections import deque
from .config import EngineConfig
from .logger import TradeLogger
from .regime import RegimeDetector, MarketRegime


@dataclass
class AnomalyAlert:
    type: str  # "win_rate_drop", "regime_shift", "excessive_losses", "market_instability"
    severity: str  # "warning", "critical"
    message: str
    timestamp: float
    action: str  # "pause", "reduce_size", "alert_only"


class AnomalyDetector:
    """Détecte les anomalies de performance et de marché."""

    def __init__(self, config: EngineConfig, logger: TradeLogger, regime_detector: RegimeDetector):
        self.config = config
        self.logger = logger
        self.regime_detector = regime_detector

        self._recent_results: deque = deque(maxlen=20)  # "win" / "loss"
        self._recent_pnl: deque = deque(maxlen=20)
        self._alerts: List[AnomalyAlert] = []
        self._paused = False
        self._pause_until: float = 0
        self._baseline_win_rate: float = 50.0
        self._trades_since_baseline: int = 0

    def record_trade(self, result: str, pnl: float):
        """Enregistre un trade pour surveillance."""
        self._recent_results.append(result)
        self._recent_pnl.append(pnl)
        self._trades_since_baseline += 1
        self._check_anomalies()

    def _check_anomalies(self):
        """Vérifie s'il y a des anomalies."""
        if len(self._recent_results) < 10:
            return

        # Win rate sur les 10 derniers trades
        recent_10 = list(self._recent_results)[-10:]
        wins = sum(1 for r in recent_10 if r == "win")
        win_rate = wins / 10 * 100

        # Win rate sur les 20 derniers
        if len(self._recent_results) >= 20:
            recent_20 = list(self._recent_results)
            wins_20 = sum(1 for r in recent_20 if r == "win")
            wr_20 = wins_20 / 20 * 100

            # Chute anormale du win rate
            if wr_20 < self._baseline_win_rate - 20 and self._trades_since_baseline > 20:
                self._add_alert(
                    "win_rate_drop", "critical",
                    f"Win rate chute: {wr_20:.0f}% (baseline: {self._baseline_win_rate:.0f}%)",
                    "pause",
                )
                self._paused = True
                self._pause_until = time.time() + 3600  # Pause 1h
                self.logger.warn(f"ANOMALIE: Win rate critique ({wr_20:.0f}%), pause 1h")

        # Pertes consécutives
        consecutive_losses = 0
        for r in reversed(recent_10):
            if r == "loss":
                consecutive_losses += 1
            else:
                break

        if consecutive_losses >= 5:
            self._add_alert(
                "excessive_losses", "critical",
                f"{consecutive_losses} pertes consécutives",
                "reduce_size",
            )
            self.logger.warn(f"ANOMALIE: {consecutive_losses} pertes consécutives, réduction taille")

        # P&L négatif persistant
        if len(self._recent_pnl) >= 10:
            recent_pnl_sum = sum(list(self._recent_pnl)[-10:])
            if recent_pnl_sum < -self.config.starting_capital * 0.05:
                self._add_alert(
                    "excessive_losses", "warning",
                    f"P&L négatif sur 10 derniers trades: ${recent_pnl_sum:.2f}",
                    "reduce_size",
                )

        # Regime shift
        if self.regime_detector.has_shifted():
            self._add_alert(
                "regime_shift", "warning",
                "Changement de régime de marché détecté",
                "alert_only",
            )
            self.logger.info("ANOMALIE: Regime shift détecté")

    def _add_alert(self, alert_type: str, severity: str, message: str, action: str):
        """Ajoute une alerte."""
        alert = AnomalyAlert(
            type=alert_type,
            severity=severity,
            message=message,
            timestamp=time.time(),
            action=action,
        )
        self._alerts.append(alert)
        if len(self._alerts) > 50:
            self._alerts.pop(0)

    def should_pause(self) -> bool:
        """Vérifie si le trading doit être mis en pause."""
        if self._paused and time.time() < self._pause_until:
            return True
        if self._paused and time.time() >= self._pause_until:
            self._paused = False
            self.logger.info("Pause terminée — reprise du trading")
        return False

    def should_reduce_size(self) -> bool:
        """Vérifie si la taille des positions doit être réduite."""
        if len(self._recent_results) < 5:
            return False
        recent = list(self._recent_results)[-5:]
        losses = sum(1 for r in recent if r == "loss")
        return losses >= 4

    def size_multiplier(self) -> float:
        """Retourne le multiplicateur de taille de position (0.5 si anomalie, 1.0 sinon)."""
        if self.should_pause():
            return 0.0
        if self.should_reduce_size():
            return 0.5
        return 1.0

    def update_baseline(self):
        """Met à jour la baseline de win rate après ajustement."""
        if len(self._recent_results) >= 20:
            recent = list(self._recent_results)[-20:]
            wins = sum(1 for r in recent if r == "win")
            self._baseline_win_rate = wins / 20 * 100
            self._trades_since_baseline = 0
            self.logger.info(f"Baseline win rate mise à jour: {self._baseline_win_rate:.0f}%")

    def status(self) -> dict:
        return {
            "paused": self.should_pause(),
            "pause_remaining_sec": max(0, int(self._pause_until - time.time())) if self._paused else 0,
            "reduce_size": self.should_reduce_size(),
            "size_multiplier": self.size_multiplier(),
            "baseline_win_rate": round(self._baseline_win_rate, 1),
            "recent_alerts": [
                {"type": a.type, "severity": a.severity, "message": a.message, "action": a.action}
                for a in self._alerts[-5:]
            ],
        }
