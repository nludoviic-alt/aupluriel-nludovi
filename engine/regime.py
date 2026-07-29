"""
Détection de régime de marché.
Classifie le marché en : TENDANCE, RANGE, TRANSITION.
Utilise ADX, Bollinger bandwidth, et Ichimoku cloud.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional
from .indicators import AdvancedIndicators, ADXResult, BollingerResult, IchimokuResult
from .analysis import AnalysisResult
import pandas as pd


class MarketRegime(Enum):
    TRENDING = "trending"
    RANGING = "ranging"
    TRANSITION = "transition"
    VOLATILE = "volatile"


@dataclass
class RegimeResult:
    regime: MarketRegime
    confidence: float  # 0-100
    adx: float
    bollinger_bandwidth: float
    ichimoku_cloud: str
    description: str
    recommended_strategy: str  # "trend_following", "mean_reversion", "breakout", "momentum", "cautious"

    def to_dict(self) -> dict:
        return {
            "regime": self.regime.value,
            "confidence": round(self.confidence, 1),
            "adx": self.adx,
            "bollinger_bandwidth": self.bollinger_bandwidth,
            "ichimoku_cloud": self.ichimoku_cloud,
            "description": self.description,
            "recommended_strategy": self.recommended_strategy,
        }


class RegimeDetector:
    """Détecte le régime de marché actuel."""

    def __init__(self):
        self.indicators = AdvancedIndicators()
        self._history: list = []
        self._max_history = 20

    def detect(self, df: pd.DataFrame, analysis: Optional[AnalysisResult] = None) -> RegimeResult:
        """Détecte le régime à partir des données OHLC."""
        if df is None or len(df) < 60:
            return RegimeResult(
                regime=MarketRegime.TRANSITION,
                confidence=0,
                adx=0,
                bollinger_bandwidth=0,
                ichimoku_cloud="neutral",
                description="Données insuffisantes",
                recommended_strategy="cautious",
            )

        high = df["high"]
        low = df["low"]
        close = df["close"]

        adx_r = self.indicators.compute_adx(high, low, close)
        bb_r = self.indicators.compute_bollinger(close)
        ichi_r = self.indicators.compute_ichimoku(high, low, close)

        # Score de tendance : ADX + Ichimoku
        trend_score = 0
        if adx_r.adx >= 25:
            trend_score += 40
        elif adx_r.adx >= 15:
            trend_score += 20

        if ichi_r.cloud_color == "bullish" and not ichi_r.price_in_cloud:
            trend_score += 30
        elif ichi_r.cloud_color == "bearish" and not ichi_r.price_in_cloud:
            trend_score += 30
        elif ichi_r.price_in_cloud:
            trend_score -= 20

        # Score de range : Bollinger bandwidth faible
        range_score = 0
        if bb_r.bandwidth < 2.0:
            range_score += 40
        elif bb_r.bandwidth < 5.0:
            range_score += 20

        if adx_r.adx < 15:
            range_score += 30
        elif adx_r.adx < 20:
            range_score += 15

        # Score de volatilité
        vol_score = 0
        if bb_r.bandwidth > 10:
            vol_score += 40
        if adx_r.adx > 40 and bb_r.bandwidth > 8:
            vol_score += 30

        # Détermine le régime
        scores = {
            MarketRegime.TRENDING: trend_score,
            MarketRegime.RANGING: range_score,
            MarketRegime.VOLATILE: vol_score,
        }
        best_regime = max(scores, key=scores.get)
        best_score = scores[best_regime]

        # Si aucun score dominant → transition
        if best_score < 30:
            regime = MarketRegime.TRANSITION
            confidence = 50 - best_score
            strategy = "cautious"
            desc = "Marché en transition — conditions mixtes"
        else:
            regime = best_regime
            confidence = min(best_score, 100)
            if regime == MarketRegime.TRENDING:
                strategy = "trend_following"
                direction = "haussière" if adx_r.plus_di > adx_r.minus_di else "baissière"
                desc = f"Tendance {direction} (ADX {adx_r.adx:.0f}) — suivre la tendance"
            elif regime == MarketRegime.RANGING:
                strategy = "mean_reversion"
                desc = f"Marché en range (BB bw {bb_r.bandwidth:.1f}%) — retour à la moyenne"
            elif regime == MarketRegime.VOLATILE:
                strategy = "breakout"
                desc = f"Marché volatil (BB bw {bb_r.bandwidth:.1f}%) — jouer les cassures"
            else:
                strategy = "cautious"
                desc = "Conditions incertaines"

        result = RegimeResult(
            regime=regime,
            confidence=confidence,
            adx=adx_r.adx,
            bollinger_bandwidth=bb_r.bandwidth,
            ichimoku_cloud=ichi_r.cloud_color,
            description=desc,
            recommended_strategy=strategy,
        )

        self._history.append(result)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        return result

    def has_shifted(self) -> bool:
        """Détecte un changement de régime récent."""
        if len(self._history) < 4:
            return False
        recent = self._history[-2:]
        older = self._history[-4:-2]
        recent_regimes = {r.regime for r in recent}
        older_regimes = {r.regime for r in older}
        return recent_regimes != older_regimes and len(recent_regimes) == 1
