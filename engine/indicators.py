"""
Indicateurs techniques avancés.
ADX, Bollinger Bands, Stochastic, VWAP, Ichimoku Cloud.
Calculs manuels via pandas/numpy — aucune dépendance externe.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class ADXResult:
    adx: float
    plus_di: float
    minus_di: float
    trend_strength: str  # "none", "weak", "moderate", "strong"


@dataclass
class BollingerResult:
    upper: float
    middle: float
    lower: float
    bandwidth: float
    percent_b: float


@dataclass
class StochasticResult:
    k: float
    d: float
    oversold: bool
    overbought: bool


@dataclass
class VWAPResult:
    vwap: float
    deviation: float
    above: bool


@dataclass
class IchimokuResult:
    tenkan: float
    kijun: float
    senkou_a: float
    senkou_b: float
    chikou: float
    cloud_color: str  # "bullish", "bearish", "neutral"
    price_in_cloud: bool


class AdvancedIndicators:
    """Calcule les indicateurs avancés."""

    # ─── ADX ───

    def compute_adx(self, high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> ADXResult:
        """Calcule l'ADX (Average Directional Index) + DI+ et DI-."""
        if len(close) < period * 2:
            return ADXResult(adx=0, plus_di=0, minus_di=0, trend_strength="none")

        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0
        plus_dm[(plus_dm > minus_dm) & (plus_dm > 0)] = plus_dm[(plus_dm > minus_dm) & (plus_dm > 0)]
        plus_dm[plus_dm <= minus_dm] = 0
        minus_dm[(minus_dm > plus_dm) & (minus_dm > 0)] = minus_dm[(minus_dm > plus_dm) & (minus_dm > 0)]
        minus_dm[minus_dm <= plus_dm] = 0

        atr = tr.rolling(window=period, min_periods=period).mean()
        plus_di = 100 * (plus_dm.rolling(window=period, min_periods=period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(window=period, min_periods=period).mean() / atr)

        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, 1)
        adx_val = dx.rolling(window=period, min_periods=period).mean().iloc[-1]

        pd_val = plus_di.iloc[-1] if not plus_di.isna().iloc[-1] else 0
        md_val = minus_di.iloc[-1] if not minus_di.isna().iloc[-1] else 0

        if np.isnan(adx_val):
            adx_val = 0
        adx_val = float(adx_val)

        if adx_val >= 50:
            strength = "strong"
        elif adx_val >= 25:
            strength = "moderate"
        elif adx_val >= 15:
            strength = "weak"
        else:
            strength = "none"

        return ADXResult(
            adx=round(adx_val, 2),
            plus_di=round(float(pd_val), 2),
            minus_di=round(float(md_val), 2),
            trend_strength=strength,
        )

    # ─── Bollinger Bands ───

    def compute_bollinger(self, close: pd.Series, period: int = 20, std_dev: float = 2.0) -> BollingerResult:
        """Calcule les Bollinger Bands."""
        if len(close) < period:
            return BollingerResult(upper=0, middle=0, lower=0, bandwidth=0, percent_b=0)

        sma = close.rolling(window=period).mean()
        std = close.rolling(window=period).std()
        upper = sma + std_dev * std
        lower = sma - std_dev * std

        mid = float(sma.iloc[-1])
        up = float(upper.iloc[-1])
        lo = float(lower.iloc[-1])
        price = float(close.iloc[-1])
        bw = ((up - lo) / mid * 100) if mid > 0 else 0
        pb = ((price - lo) / (up - lo)) if (up - lo) > 0 else 0.5

        return BollingerResult(
            upper=round(up, 6),
            middle=round(mid, 6),
            lower=round(lo, 6),
            bandwidth=round(bw, 2),
            percent_b=round(float(np.clip(pb, 0, 1)), 4),
        )

    # ─── Stochastic ───

    def compute_stochastic(self, high: pd.Series, low: pd.Series, close: pd.Series,
                           k_period: int = 14, d_period: int = 3) -> StochasticResult:
        """Calcule l'oscillateur Stochastic."""
        if len(close) < k_period + d_period:
            return StochasticResult(k=50, d=50, oversold=False, overbought=False)

        lowest = low.rolling(window=k_period).min()
        highest = high.rolling(window=k_period).max()
        k = 100 * (close - lowest) / (highest - lowest).replace(0, np.nan)
        k = k.fillna(50)
        d = k.rolling(window=d_period).mean()

        k_val = float(k.iloc[-1])
        d_val = float(d.iloc[-1])

        return StochasticResult(
            k=round(k_val, 2),
            d=round(d_val, 2),
            oversold=k_val < 20,
            overbought=k_val > 80,
        )

    # ─── VWAP ───

    def compute_vwap(self, high: pd.Series, low: pd.Series, close: pd.Series,
                     volume: pd.Series = None) -> VWAPResult:
        """Calcule le VWAP (Volume Weighted Average Price)."""
        if volume is None:
            volume = pd.Series(1, index=close.index)

        if len(close) < 2:
            return VWAPResult(vwap=float(close.iloc[-1]) if len(close) > 0 else 0, deviation=0, above=True)

        typical = (high + low + close) / 3
        cum_vp = (typical * volume).cumsum()
        cum_v = volume.cumsum()
        vwap = cum_vp / cum_v.replace(0, 1)

        vwap_val = float(vwap.iloc[-1])
        price = float(close.iloc[-1])
        dev = ((price - vwap_val) / vwap_val * 100) if vwap_val > 0 else 0

        return VWAPResult(
            vwap=round(vwap_val, 6),
            deviation=round(dev, 4),
            above=price >= vwap_val,
        )

    # ─── Ichimoku Cloud ───

    def compute_ichimoku(self, high: pd.Series, low: pd.Series, close: pd.Series,
                         tenkan_p: int = 9, kijun_p: int = 26, senkou_b_p: int = 52) -> IchimokuResult:
        """Calcule l'Ichimoku Cloud."""
        if len(close) < senkou_b_p + 26:
            return IchimokuResult(
                tenkan=0, kijun=0, senkou_a=0, senkou_b=0, chikou=0,
                cloud_color="neutral", price_in_cloud=False,
            )

        tenkan = (high.rolling(window=tenkan_p).max() + low.rolling(window=tenkan_p).min()) / 2
        kijun = (high.rolling(window=kijun_p).max() + low.rolling(window=kijun_p).min()) / 2

        senkou_a = (tenkan + kijun) / 2
        senkou_b = (high.rolling(window=senkou_b_p).max() + low.rolling(window=senkou_b_p).min()) / 2

        chikou = close.shift(-26)

        t_val = float(tenkan.iloc[-1]) if not tenkan.isna().iloc[-1] else 0
        k_val = float(kijun.iloc[-1]) if not kijun.isna().iloc[-1] else 0
        sa_val = float(senkou_a.iloc[-1]) if not senkou_a.isna().iloc[-1] else 0
        sb_val = float(senkou_b.iloc[-1]) if not senkou_b.isna().iloc[-1] else 0
        c_val = float(chikou.iloc[-1]) if not chikou.isna().iloc[-1] else float(close.iloc[-1])

        price = float(close.iloc[-1])

        if sa_val > sb_val:
            cloud_color = "bullish"
        elif sa_val < sb_val:
            cloud_color = "bearish"
        else:
            cloud_color = "neutral"

        price_in_cloud = sb_val <= price <= sa_val or sa_val <= price <= sb_val

        return IchimokuResult(
            tenkan=round(t_val, 6),
            kijun=round(k_val, 6),
            senkou_a=round(sa_val, 6),
            senkou_b=round(sb_val, 6),
            chikou=round(c_val, 6),
            cloud_color=cloud_color,
            price_in_cloud=price_in_cloud,
        )
