"""
Ensemble de stratégies de trading.
Le bot sélectionne automatiquement la meilleure stratégie selon le régime de marché.
"""

from dataclasses import dataclass
from typing import Optional, List
from .config import EngineConfig, SignalDirection
from .analysis import AnalysisResult
from .indicators import AdvancedIndicators, ADXResult, BollingerResult, StochasticResult
from .regime import RegimeResult, MarketRegime
from .patterns import PatternDetector
import pandas as pd


@dataclass
class StrategySignal:
    strategy: str
    direction: SignalDirection
    confidence: float  # 0-100
    reason: str
    entry_price: float
    stop_loss: float
    take_profit: float
    indicators_used: List[str]


class BaseStrategy:
    """Classe de base pour toutes les stratégies."""

    name = "base"

    def __init__(self, config: EngineConfig):
        self.config = config
        self.indicators = AdvancedIndicators()
        self.patterns = PatternDetector()

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        raise NotImplementedError


class TrendFollowingStrategy(BaseStrategy):
    """Suivi de tendance : EMA crossover + MACD + ADX fort."""

    name = "trend_following"

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        if regime.regime != MarketRegime.TRENDING:
            return None

        high, low, close = df["high"], df["low"], df["close"]
        adx_r = self.indicators.compute_adx(high, low, close)

        if adx_r.adx < 20:
            return None

        score = 0
        reasons = []

        if analysis.trend_alignment >= 2:
            score += 30
            reasons.append(f"{analysis.trend_alignment}/3 timeframes alignées")

        if adx_r.adx >= 25:
            score += 25
            reasons.append(f"ADX {adx_r.adx:.0f} (tendance forte)")

        macd_hists = [ind.macd_histogram for ind in analysis.indicators.values()]
        if all(h > 0 for h in macd_hists):
            score += 20
            reasons.append("MACD haussier sur tous TF")
        elif all(h < 0 for h in macd_hists):
            score += 20
            reasons.append("MACD baissier sur tous TF")

        pat = self.patterns.latest_signals(df)
        if pat["signal"] == "bullish" and analysis.global_trend == SignalDirection.BUY:
            score += 15
            reasons.append("Pattern haussier détecté")
        elif pat["signal"] == "bearish" and analysis.global_trend == SignalDirection.SELL:
            score += 15
            reasons.append("Pattern baissier détecté")

        if score < 40:
            return None

        direction = analysis.global_trend
        price = analysis.price
        atr = next((ind.atr for ind in analysis.indicators.values()), price * 0.01)

        if direction == SignalDirection.BUY:
            sl = price - atr * self.config.atr_stop_multiplier
            tp = price + atr * self.config.atr_stop_multiplier * self.config.min_rr_ratio
        else:
            sl = price + atr * self.config.atr_stop_multiplier
            tp = price - atr * self.config.atr_stop_multiplier * self.config.min_rr_ratio

        return StrategySignal(
            strategy=self.name,
            direction=direction,
            confidence=min(score, 100),
            reason=" | ".join(reasons),
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            indicators_used=["EMA", "MACD", "ADX", "Patterns"],
        )


class MeanReversionStrategy(BaseStrategy):
    """Retour à la moyenne : RSI extrêmes + Bollinger Bands."""

    name = "mean_reversion"

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        if regime.regime != MarketRegime.RANGING:
            return None

        high, low, close = df["high"], df["low"], df["close"]
        bb = self.indicators.compute_bollinger(close)
        stoch = self.indicators.compute_stochastic(high, low, close)

        score = 0
        reasons = []
        direction = SignalDirection.NEUTRAL

        rsi_values = [ind.rsi for ind in analysis.indicators.values()]
        avg_rsi = sum(rsi_values) / len(rsi_values) if rsi_values else 50

        if avg_rsi < 30:
            direction = SignalDirection.BUY
            score += 30
            reasons.append(f"RSI {avg_rsi:.0f} survente")
        elif avg_rsi > 70:
            direction = SignalDirection.SELL
            score += 30
            reasons.append(f"RSI {avg_rsi:.0f} surachat")

        if stoch.oversold:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.BUY
            score += 25
            reasons.append(f"Stoch {stoch.k:.0f} survente")
        elif stoch.overbought:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.SELL
            score += 25
            reasons.append(f"Stoch {stoch.k:.0f} surachat")

        if bb.percent_b < 0.1:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.BUY
            score += 20
            reasons.append("Prix sur bande inférieure Bollinger")
        elif bb.percent_b > 0.9:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.SELL
            score += 20
            reasons.append("Prix sur bande supérieure Bollinger")

        if direction == SignalDirection.NEUTRAL or score < 40:
            return None

        price = analysis.price
        atr = next((ind.atr for ind in analysis.indicators.values()), price * 0.01)

        if direction == SignalDirection.BUY:
            sl = price - atr * 1.0
            tp = bb.middle
        else:
            sl = price + atr * 1.0
            tp = bb.middle

        return StrategySignal(
            strategy=self.name,
            direction=direction,
            confidence=min(score, 100),
            reason=" | ".join(reasons),
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            indicators_used=["RSI", "Bollinger", "Stochastic"],
        )


class BreakoutStrategy(BaseStrategy):
    """Cassure : Support/Résistance + volume + volatilité."""

    name = "breakout"

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        if regime.regime not in (MarketRegime.VOLATILE, MarketRegime.TRANSITION):
            return None

        close = df["close"]
        high = df["high"]
        low = df["low"]
        bb = self.indicators.compute_bollinger(close)

        score = 0
        reasons = []
        direction = SignalDirection.NEUTRAL
        price = analysis.price

        if price > analysis.resistance_nearest * 0.999:
            direction = SignalDirection.BUY
            score += 35
            reasons.append(f"Cassure résistance {analysis.resistance_nearest:.2f}")
        elif price < analysis.support_nearest * 1.001:
            direction = SignalDirection.SELL
            score += 35
            reasons.append(f"Cassure support {analysis.support_nearest:.2f}")

        if bb.bandwidth > 5 and bb.percent_b > 0.9:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.BUY
            score += 20
            reasons.append("Expansion Bollinger + cassure haute")
        elif bb.bandwidth > 5 and bb.percent_b < 0.1:
            if direction == SignalDirection.NEUTRAL:
                direction = SignalDirection.SELL
            score += 20
            reasons.append("Expansion Bollinger + cassure basse")

        pat = self.patterns.latest_signals(df)
        if pat["signal"] == "bullish" and direction == SignalDirection.BUY:
            score += 15
            reasons.append("Pattern haussier confirmant la cassure")
        elif pat["signal"] == "bearish" and direction == SignalDirection.SELL:
            score += 15
            reasons.append("Pattern baissier confirmant la cassure")

        if direction == SignalDirection.NEUTRAL or score < 40:
            return None

        atr = next((ind.atr for ind in analysis.indicators.values()), price * 0.01)

        if direction == SignalDirection.BUY:
            sl = analysis.support_nearest
            tp = price + atr * self.config.atr_stop_multiplier * 2
        else:
            sl = analysis.resistance_nearest
            tp = price - atr * self.config.atr_stop_multiplier * 2

        return StrategySignal(
            strategy=self.name,
            direction=direction,
            confidence=min(score, 100),
            reason=" | ".join(reasons),
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            indicators_used=["Support/Resistance", "Bollinger", "Patterns"],
        )


class MomentumStrategy(BaseStrategy):
    """Momentum : MACD fort + ADX + Stochastic."""

    name = "momentum"

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        if regime.regime not in (MarketRegime.TRENDING, MarketRegime.VOLATILE):
            return None

        high, low, close = df["high"], df["low"], df["close"]
        adx_r = self.indicators.compute_adx(high, low, close)
        stoch = self.indicators.compute_stochastic(high, low, close)

        score = 0
        reasons = []
        direction = SignalDirection.NEUTRAL

        macd_hists = [ind.macd_histogram for ind in analysis.indicators.values()]
        avg_macd = sum(macd_hists) / len(macd_hists) if macd_hists else 0

        if avg_macd > 0 and adx_r.plus_di > adx_r.minus_di:
            direction = SignalDirection.BUY
            score += 30
            reasons.append("MACD+ avec DI+ dominant")
        elif avg_macd < 0 and adx_r.minus_di > adx_r.plus_di:
            direction = SignalDirection.SELL
            score += 30
            reasons.append("MACD- avec DI- dominant")

        if adx_r.adx >= 30:
            score += 25
            reasons.append(f"ADX {adx_r.adx:.0f} momentum fort")

        if stoch.k > stoch.d and stoch.k < 80 and direction == SignalDirection.BUY:
            score += 20
            reasons.append("Stochastic croise haussier")
        elif stoch.k < stoch.d and stoch.k > 20 and direction == SignalDirection.SELL:
            score += 20
            reasons.append("Stochastic croise baissier")

        if direction == SignalDirection.NEUTRAL or score < 40:
            return None

        price = analysis.price
        atr = next((ind.atr for ind in analysis.indicators.values()), price * 0.01)

        if direction == SignalDirection.BUY:
            sl = price - atr * self.config.atr_stop_multiplier * 1.5
            tp = price + atr * self.config.atr_stop_multiplier * self.config.min_rr_ratio * 1.5
        else:
            sl = price + atr * self.config.atr_stop_multiplier * 1.5
            tp = price - atr * self.config.atr_stop_multiplier * self.config.min_rr_ratio * 1.5

        return StrategySignal(
            strategy=self.name,
            direction=direction,
            confidence=min(score, 100),
            reason=" | ".join(reasons),
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            indicators_used=["MACD", "ADX", "Stochastic"],
        )


class StrategyEnsemble:
    """Sélectionne la meilleure stratégie selon le régime de marché."""

    def __init__(self, config: EngineConfig):
        self.config = config
        self.strategies: List[BaseStrategy] = [
            TrendFollowingStrategy(config),
            MeanReversionStrategy(config),
            BreakoutStrategy(config),
            MomentumStrategy(config),
        ]
        self._last_signals: dict = {}

    def evaluate(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> Optional[StrategySignal]:
        """Évalue toutes les stratégies compatibles et retourne le meilleur signal."""
        signals = []

        for strat in self.strategies:
            sig = strat.evaluate(df, analysis, regime)
            if sig is not None:
                signals.append(sig)

        if not signals:
            return None

        # Priorise la stratégie recommandée par le régime
        recommended = regime.recommended_strategy
        recommended_signals = [s for s in signals if s.strategy == recommended]
        if recommended_signals:
            best = max(recommended_signals, key=lambda s: s.confidence)
        else:
            best = max(signals, key=lambda s: s.confidence)

        self._last_signals[best.strategy] = best
        return best

    def all_signals(self, df: pd.DataFrame, analysis: AnalysisResult, regime: RegimeResult) -> List[StrategySignal]:
        """Retourne tous les signaux (pour debug/UI)."""
        signals = []
        for strat in self.strategies:
            sig = strat.evaluate(df, analysis, regime)
            if sig is not None:
                signals.append(sig)
        return signals
