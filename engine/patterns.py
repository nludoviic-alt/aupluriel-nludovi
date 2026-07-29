"""
Détection de patterns de chandeliers japonais.
Reconnaît les principaux patterns d'inversion et de continuation.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List


@dataclass
class CandlePattern:
    name: str
    type: str  # "bullish", "bearish", "neutral"
    position: int
    strength: str  # "strong", "moderate", "weak"
    description: str


class PatternDetector:
    """Détecte les patterns de chandeliers japonais."""

    def __init__(self):
        self.body_ratio_threshold = 0.05
        self.shadow_ratio_threshold = 2.0

    def detect_all(self, df: pd.DataFrame, lookback: int = 10) -> List[CandlePattern]:
        """Détecte tous les patterns sur les dernières N bougies."""
        if len(df) < 3:
            return []

        patterns: List[CandlePattern] = []
        recent = df.tail(lookback)

        for i in range(len(recent)):
            row = recent.iloc[i]
            o, h, l, c = float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"])
            body = abs(c - o)
            range_val = h - l
            if range_val == 0:
                continue

            upper_shadow = h - max(o, c)
            lower_shadow = min(o, c) - l
            body_pct = body / range_val

            if body_pct < self.body_ratio_threshold:
                patterns.append(CandlePattern("Doji", "neutral", i, "moderate", "Indécision — corps très petit"))
                continue

            is_bullish = c > o
            is_bearish = c < o

            if lower_shadow > body * self.shadow_ratio_threshold and upper_shadow < body * 0.3:
                if i > 0 and float(recent.iloc[i-1]["close"]) < float(recent.iloc[i-1]["open"]):
                    patterns.append(CandlePattern("Hammer", "bullish", i, "strong", "Inversion haussière — longue mèche basse après baisse"))

            if upper_shadow > body * self.shadow_ratio_threshold and lower_shadow < body * 0.3:
                if i > 0 and float(recent.iloc[i-1]["close"]) > float(recent.iloc[i-1]["open"]):
                    patterns.append(CandlePattern("Shooting Star", "bearish", i, "strong", "Inversion baissière — longue mèche haute après hausse"))

            if i > 0:
                prev = recent.iloc[i-1]
                prev_o, prev_c = float(prev["open"]), float(prev["close"])
                prev_body = abs(prev_c - prev_o)

                if prev_c < prev_o and is_bullish and o <= prev_c and c >= prev_o and body > prev_body:
                    patterns.append(CandlePattern("Bullish Engulfing", "bullish", i, "strong", "Inversion haussière — bougie verte englobe la rouge"))

                if prev_c > prev_o and is_bearish and o >= prev_c and c <= prev_o and body > prev_body:
                    patterns.append(CandlePattern("Bearish Engulfing", "bearish", i, "strong", "Inversion baissière — bougie rouge englobe la verte"))

            if i >= 2:
                p1 = recent.iloc[i-2]
                p2 = recent.iloc[i-1]
                p1_bearish = float(p1["close"]) < float(p1["open"])
                p2_small = abs(float(p2["close"]) - float(p2["open"])) < float(p1["open"]) * 0.01
                if p1_bearish and p2_small and is_bullish and c > float(p1["open"]):
                    patterns.append(CandlePattern("Morning Star", "bullish", i, "strong", "Inversion haussière — étoile du matin"))
                p1_bullish = float(p1["close"]) > float(p1["open"])
                if p1_bullish and p2_small and is_bearish and c < float(p1["open"]):
                    patterns.append(CandlePattern("Evening Star", "bearish", i, "strong", "Inversion baissière — étoile du soir"))

            if body_pct > 0.9:
                if is_bullish:
                    patterns.append(CandlePattern("Bullish Marubozu", "bullish", i, "moderate", "Forte pression acheteuse — corps plein"))
                else:
                    patterns.append(CandlePattern("Bearish Marubozu", "bearish", i, "moderate", "Forte pression vendeuse — corps plein"))

            if i > 0:
                prev = recent.iloc[i-1]
                prev_o, prev_c = float(prev["open"]), float(prev["close"])
                prev_body = abs(prev_c - prev_o)
                if prev_body > body * 1.8:
                    if float(prev_c) < float(prev_o) and is_bullish:
                        patterns.append(CandlePattern("Bullish Harami", "bullish", i, "moderate", "Inversion haussière — petite bougie dans la précédente"))
                    elif float(prev_c) > float(prev_o) and is_bearish:
                        patterns.append(CandlePattern("Bearish Harami", "bearish", i, "moderate", "Inversion baissière — petite bougie dans la précédente"))

        return patterns

    def latest_signals(self, df: pd.DataFrame) -> dict:
        """Retourne les signaux de la dernière bougie."""
        patterns = self.detect_all(df, lookback=3)
        if not patterns:
            return {"patterns": [], "bullish_count": 0, "bearish_count": 0, "signal": "none"}

        bullish = sum(1 for p in patterns if p.type == "bullish")
        bearish = sum(1 for p in patterns if p.type == "bearish")

        signal = "none"
        if bullish > bearish and bullish > 0:
            signal = "bullish"
        elif bearish > bullish and bearish > 0:
            signal = "bearish"

        return {
            "patterns": [{"name": p.name, "type": p.type, "strength": p.strength, "description": p.description} for p in patterns],
            "bullish_count": bullish,
            "bearish_count": bearish,
            "signal": signal,
        }
