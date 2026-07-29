"""
Moteur d'analyse technique multi-timeframe.
Indicateurs : RSI, moyennes mobiles (EMA), MACD, ATR, supports/résistances.
Périodes : 5 min, 15 min, 1 h.

Utilise pandas + ta ou calculs manuels pour fonctionner sans MT5 en mode simulation.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
from .config import EngineConfig, Timeframe, SignalDirection


@dataclass
class IndicatorResult:
    """Résultat des indicateurs pour une timeframe donnée."""
    timeframe: str
    rsi: float
    ema_fast: float
    ema_slow: float
    macd_line: float
    macd_signal: float
    macd_histogram: float
    atr: float
    support: float
    resistance: float
    price: float
    trend: SignalDirection  # Tendance déterminée par MA + MACD
    volatility_pct: float   # ATR en % du prix


@dataclass
class AnalysisResult:
    """Résultat consolidé multi-timeframe."""
    symbol: str
    timestamp: float
    price: float
    indicators: dict  # {timeframe: IndicatorResult}
    global_trend: SignalDirection
    trend_alignment: int  # 0-3, nombre de timeframes alignés
    volatility_high: bool  # True si volatilité excessive
    support_nearest: float
    resistance_nearest: float
    signals: list = field(default_factory=list)  # Liste des signaux détectés

    def confidence_score(self) -> float:
        """Calcule un score de confiance préliminaire basé sur l'analyse technique.
        Score 0-100 basé sur :
        - Alignement des timeframes (40 pts max)
        - Force du RSI (20 pts max)
        - MACD histogram (20 pts max)
        - Proximité support/résistance (20 pts max)
        """
        score = 0.0

        # Alignement des timeframes (40 pts)
        score += (self.trend_alignment / 3.0) * 40

        # RSI : force du momentum (20 pts)
        rsi_values = [r.rsi for r in self.indicators.values()]
        avg_rsi = sum(rsi_values) / len(rsi_values) if rsi_values else 50
        if avg_rsi < 30 or avg_rsi > 70:
            score += 20  # Zone de survente/surachat = signal fort
        elif avg_rsi < 40 or avg_rsi > 60:
            score += 10
        else:
            score += 5

        # MACD histogram (20 pts)
        macd_hists = [r.macd_histogram for r in self.indicators.values()]
        macd_aligned = all(h > 0 for h in macd_hists) or all(h < 0 for h in macd_hists)
        if macd_aligned:
            score += 20
        elif any(h > 0 for h in macd_hists) and any(h < 0 for h in macd_hists):
            score += 5
        else:
            score += 10

        # Proximité support/résistance (20 pts)
        price = self.price
        sr_range = self.resistance_nearest - self.support_nearest
        if sr_range > 0:
            dist_to_support = abs(price - self.support_nearest) / sr_range
            dist_to_resistance = abs(price - self.resistance_nearest) / sr_range
            min_dist = min(dist_to_support, dist_to_resistance)
            if min_dist < 0.1:  # Très proche d'un niveau
                score += 20
            elif min_dist < 0.25:
                score += 10
            else:
                score += 5

        return min(score, 100.0)


class AnalysisEngine:
    """Moteur d'analyse technique."""

    def __init__(self, config: EngineConfig):
        self.config = config

    def compute_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calcule le RSI (Relative Strength Index)."""
        if len(prices) < period + 1:
            return 50.0
        delta = prices.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = (-delta).where(delta < 0, 0.0)
        avg_gain = gain.rolling(window=period, min_periods=period).mean().iloc[-1]
        avg_loss = loss.rolling(window=period, min_periods=period).mean().iloc[-1]
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def compute_ema(self, prices: pd.Series, period: int) -> float:
        """Calcule l'EMA (Exponential Moving Average)."""
        if len(prices) < period:
            return prices.iloc[-1] if len(prices) > 0 else 0.0
        return prices.ewm(span=period, adjust=False).mean().iloc[-1]

    def compute_macd(self, prices: pd.Series, fast: int, slow: int, signal: int):
        """Calcule MACD line, signal line et histogram."""
        ema_fast = prices.ewm(span=fast, adjust=False).mean()
        ema_slow = prices.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        macd_signal = macd_line.ewm(span=signal, adjust=False).mean()
        macd_hist = macd_line - macd_signal
        return macd_line.iloc[-1], macd_signal.iloc[-1], macd_hist.iloc[-1]

    def compute_atr(self, high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
        """Calcule l'ATR (Average True Range)."""
        if len(close) < period + 1:
            return 0.0
        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period, min_periods=period).mean().iloc[-1]

    def find_support_resistance(self, high: pd.Series, low: pd.Series, lookback: int = 50):
        """Identifie les niveaux de support et résistance les plus proches."""
        if len(high) < lookback:
            lookback = len(high)
        recent_high = high.tail(lookback)
        recent_low = low.tail(lookback)
        resistance = recent_high.max()
        support = recent_low.min()
        return float(support), float(resistance)

    def analyze_timeframe(self, df: pd.DataFrame, tf: Timeframe) -> IndicatorResult:
        """Analyse une timeframe spécifique."""
        close = df["close"]
        high = df["high"]
        low = df["low"]
        price = float(close.iloc[-1])

        rsi = self.compute_rsi(close, self.config.rsi_period)
        ema_fast = self.compute_ema(close, self.config.ma_fast)
        ema_slow = self.compute_ema(close, self.config.ma_slow)
        macd_line, macd_signal, macd_hist = self.compute_macd(
            close, self.config.macd_fast, self.config.macd_slow, self.config.macd_signal
        )
        atr = self.compute_atr(high, low, close, self.config.atr_period)
        support, resistance = self.find_support_resistance(high, low)

        # Tendance : EMA fast vs slow + MACD
        if ema_fast > ema_slow and macd_hist > 0:
            trend = SignalDirection.BUY
        elif ema_fast < ema_slow and macd_hist < 0:
            trend = SignalDirection.SELL
        else:
            trend = SignalDirection.NEUTRAL

        volatility_pct = (atr / price * 100) if price > 0 else 0

        return IndicatorResult(
            timeframe=tf.value,
            rsi=rsi,
            ema_fast=ema_fast,
            ema_slow=ema_slow,
            macd_line=macd_line,
            macd_signal=macd_signal,
            macd_histogram=macd_hist,
            atr=atr,
            support=support,
            resistance=resistance,
            price=price,
            trend=trend,
            volatility_pct=volatility_pct,
        )

    def analyze(self, data_by_tf: dict) -> AnalysisResult:
        """Analyse multi-timeframe et consolide les résultats.

        Args:
            data_by_tf: {Timeframe: pd.DataFrame} avec colonnes OHLC
        """
        results = {}
        trends = []
        volatilities = []
        supports = []
        resistances = []
        price = 0.0

        for tf, df in data_by_tf.items():
            if df is None or len(df) < 30:
                continue
            r = self.analyze_timeframe(df, tf)
            results[tf.value] = r
            trends.append(r.trend)
            volatilities.append(r.volatility_pct)
            supports.append(r.support)
            resistances.append(r.resistance)
            price = r.price

        # Tendance globale : majorité alignée
        buy_count = sum(1 for t in trends if t == SignalDirection.BUY)
        sell_count = sum(1 for t in trends if t == SignalDirection.SELL)
        if buy_count >= 2:
            global_trend = SignalDirection.BUY
        elif sell_count >= 2:
            global_trend = SignalDirection.SELL
        else:
            global_trend = SignalDirection.NEUTRAL

        trend_alignment = max(buy_count, sell_count)

        # Volatilité excessive : ATR > 2× la moyenne
        avg_vol = np.mean(volatilities) if volatilities else 0
        max_vol = max(volatilities) if volatilities else 0
        volatility_high = max_vol > avg_vol * 2.0 if avg_vol > 0 else False

        # Support/résistance les plus proches du prix
        if supports and resistances and price > 0:
            support_nearest = max(s for s in supports if s < price) if any(s < price for s in supports) else min(supports)
            resistance_nearest = min(r for r in resistances if r > price) if any(r > price for r in resistances) else max(resistances)
        else:
            support_nearest = price * 0.99
            resistance_nearest = price * 1.01

        result = AnalysisResult(
            symbol=self.config.symbol,
            timestamp=time.time() if hasattr(time, 'time') else __import__('time').time(),
            price=price,
            indicators=results,
            global_trend=global_trend,
            trend_alignment=trend_alignment,
            volatility_high=volatility_high,
            support_nearest=support_nearest,
            resistance_nearest=resistance_nearest,
        )

        # Détecte les signaux spécifiques
        result.signals = self._detect_signals(result)
        return result

    def _detect_signals(self, result: AnalysisResult) -> list:
        """Détecte des signaux de trading spécifiques."""
        signals = []
        for tf_name, ind in result.indicators.items():
            # RSI survente/surachat
            if ind.rsi < self.config.rsi_oversold:
                signals.append({
                    "timeframe": tf_name,
                    "type": "RSI_OVERSOLD",
                    "direction": "BUY",
                    "value": round(ind.rsi, 2),
                    "description": f"RSI {ind.rsi:.1f} en zone de survente sur {tf_name}",
                })
            elif ind.rsi > self.config.rsi_overbought:
                signals.append({
                    "timeframe": tf_name,
                    "type": "RSI_OVERBOUGHT",
                    "direction": "SELL",
                    "value": round(ind.rsi, 2),
                    "description": f"RSI {ind.rsi:.1f} en zone de surachat sur {tf_name}",
                })

            # Croisement EMA
            if ind.ema_fast > ind.ema_slow and ind.trend == SignalDirection.BUY:
                signals.append({
                    "timeframe": tf_name,
                    "type": "EMA_BULLISH",
                    "direction": "BUY",
                    "value": round(ind.ema_fast - ind.ema_slow, 4),
                    "description": f"EMA{self.config.ma_fast} > EMA{self.config.ma_slow} sur {tf_name}",
                })
            elif ind.ema_fast < ind.ema_slow and ind.trend == SignalDirection.SELL:
                signals.append({
                    "timeframe": tf_name,
                    "type": "EMA_BEARISH",
                    "direction": "SELL",
                    "value": round(ind.ema_slow - ind.ema_fast, 4),
                    "description": f"EMA{self.config.ma_fast} < EMA{self.config.ma_slow} sur {tf_name}",
                })

            # MACD histogram
            if ind.macd_histogram > 0:
                signals.append({
                    "timeframe": tf_name,
                    "type": "MACD_BULLISH",
                    "direction": "BUY",
                    "value": round(ind.macd_histogram, 6),
                    "description": f"MACD histogram positif sur {tf_name}",
                })
            elif ind.macd_histogram < 0:
                signals.append({
                    "timeframe": tf_name,
                    "type": "MACD_BEARISH",
                    "direction": "SELL",
                    "value": round(ind.macd_histogram, 6),
                    "description": f"MACD histogram négatif sur {tf_name}",
                })

        return signals


import time
