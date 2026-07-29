"""
Moteur de décision.
Calcule un score de confiance pour chaque signal et décide si on trade.
- Score minimum : 75%
- Filtre les périodes trop instables
- Combine règles techniques et score d'analyse
"""

import time
from dataclasses import dataclass
from typing import Optional
from .config import EngineConfig, SignalDirection
from .analysis import AnalysisResult
from .logger import TradeLogger


@dataclass
class Decision:
    """Décision du moteur."""
    action: str  # "BUY", "SELL", "HOLD"
    direction: SignalDirection
    confidence: float  # 0-100
    reason: str
    analysis: AnalysisResult
    timestamp: float
    would_trade: bool  # True si le score dépasse le seuil
    blocked_reasons: list = None  # Raisons de blocage si would_trade=False

    def __post_init__(self):
        if self.blocked_reasons is None:
            self.blocked_reasons = []

    def to_dict(self) -> dict:
        return {
            "action": self.action,
            "direction": self.direction.value,
            "confidence": round(self.confidence, 1),
            "reason": self.reason,
            "timestamp": self.timestamp,
            "would_trade": self.would_trade,
            "blocked_reasons": self.blocked_reasons,
            "price": self.analysis.price,
            "signals": self.analysis.signals,
            "trend_alignment": self.analysis.trend_alignment,
            "volatility_high": self.analysis.volatility_high,
        }


class DecisionEngine:
    """Moteur de décision avec score de confiance."""

    def __init__(self, config: EngineConfig, logger: TradeLogger):
        self.config = config
        self.logger = logger

    def evaluate(self, analysis: AnalysisResult) -> Decision:
        """Évalue l'analyse et produit une décision."""
        blocked_reasons = []

        # Score de base depuis l'analyse technique
        base_score = analysis.confidence_score()

        # Bonus/malus selon les conditions
        score = base_score

        # Malus si volatilité excessive
        if analysis.volatility_high:
            score -= 15
            blocked_reasons.append("Volatilité excessive détectée")

        # Bonus si les 3 timeframes sont alignées
        if analysis.trend_alignment == 3:
            score += 10

        # Malus si tendance neutre
        if analysis.global_trend == SignalDirection.NEUTRAL:
            score -= 20
            blocked_reasons.append("Tendance neutre — pas de direction claire")

        # Vérification du seuil de confiance
        score = max(0, min(100, score))
        would_trade = score >= self.config.min_confidence_threshold

        if not would_trade:
            blocked_reasons.append(
                f"Score {score:.1f}% < seuil {self.config.min_confidence_threshold}%"
            )

        # Détermine l'action
        if would_trade and analysis.global_trend != SignalDirection.NEUTRAL:
            action = analysis.global_trend.value
            direction = analysis.global_trend
            reason = f"Signal {action} à {score:.1f}% de confiance"
        else:
            action = "HOLD"
            direction = SignalDirection.NEUTRAL
            reason = f"Pas de trade — score {score:.1f}%, seuil {self.config.min_confidence_threshold}%"

        decision = Decision(
            action=action,
            direction=direction,
            confidence=score,
            reason=reason,
            analysis=analysis,
            timestamp=time.time(),
            would_trade=would_trade,
            blocked_reasons=blocked_reasons,
        )

        self.logger.signal(
            f"Analyse {analysis.symbol}: {action} @ {score:.1f}%",
            decision.to_dict(),
        )

        return decision
