"""
Multi-instrument : scanne plusieurs marchés et sélectionne le meilleur.
"""

import time
import threading
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from .config import EngineConfig, Timeframe
from .analysis import AnalysisEngine, AnalysisResult
from .regime import RegimeDetector, MarketRegime, RegimeResult
from .mt5_connector import MT5Connector
from .logger import TradeLogger


@dataclass
class InstrumentScore:
    symbol: str
    score: float
    regime: str
    trend_alignment: int
    volatility_pct: float
    recommended: bool
    reason: str


AVAILABLE_INSTRUMENTS = [
    {"symbol": "Volatility 100 Index", "mt5_symbol": "VOL100"},
    {"symbol": "Volatility 75 Index", "mt5_symbol": "VOL75"},
    {"symbol": "Volatility 50 Index", "mt5_symbol": "VOL50"},
    {"symbol": "Volatility 25 Index", "mt5_symbol": "VOL25"},
    {"symbol": "Volatility 10 Index", "mt5_symbol": "VOL10"},
    {"symbol": "Boom 1000 Index", "mt5_symbol": "BOOM1000"},
    {"symbol": "Crash 1000 Index", "mt5_symbol": "CRASH1000"},
    {"symbol": "Step Index", "mt5_symbol": "STEP"},
]


class MultiInstrumentScanner:
    """Scanne plusieurs instruments et sélectionne les plus opportuns."""

    def __init__(self, config: EngineConfig, logger: TradeLogger):
        self.config = config
        self.logger = logger
        self.analysis = AnalysisEngine(config)
        self.regime_detector = RegimeDetector()
        self._scores: List[InstrumentScore] = []
        self._last_scan: float = 0
        self._scan_thread: Optional[threading.Thread] = None
        self._running = False

    def start(self, mt5: MT5Connector):
        """Démarre le scan en arrière-plan."""
        if self._running:
            return
        self._running = True
        self._mt5 = mt5
        self._scan_thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._scan_thread.start()
        self.logger.info("Scanner multi-instrument démarré")

    def stop(self):
        self._running = False

    def _scan_loop(self):
        """Boucle de scan périodique."""
        while self._running:
            try:
                self._scan_all()
            except Exception as e:
                self.logger.warn(f"Scanner erreur: {e}")
            time.sleep(self.config.instrument_scan_interval)

    def _scan_all(self):
        """Scanne tous les instruments disponibles."""
        scores = []
        original_symbol = self.config.symbol
        original_mt5 = self.config.symbol_mt5

        for instr in AVAILABLE_INSTRUMENTS:
            try:
                self.config.symbol = instr["symbol"]
                self.config.symbol_mt5 = instr["mt5_symbol"]

                data = {}
                for tf in self.config.timeframes:
                    df = self._mt5.get_candles(tf, 200)
                    if df is not None:
                        data[tf] = df

                if not data:
                    continue

                analysis = self.analysis.analyze(data)
                primary_df = data.get(Timeframe.M15, list(data.values())[0])
                regime = self.regime_detector.detect(primary_df, analysis)

                # Score : tendance + confiance + volatilité
                score = 0
                if regime.regime == MarketRegime.TRENDING:
                    score += 40
                elif regime.regime == MarketRegime.VOLATILE:
                    score += 25
                elif regime.regime == MarketRegime.RANGING:
                    score += 15

                score += analysis.trend_alignment * 10

                if not analysis.volatility_high:
                    score += 15

                avg_vol = sum(
                    ind.volatility_pct for ind in analysis.indicators.values()
                ) / len(analysis.indicators) if analysis.indicators else 0

                scores.append(InstrumentScore(
                    symbol=instr["symbol"],
                    score=score,
                    regime=regime.regime.value,
                    trend_alignment=analysis.trend_alignment,
                    volatility_pct=round(avg_vol, 2),
                    recommended=False,
                    reason=regime.description,
                ))

            except Exception as e:
                self.logger.warn(f"Scanner: erreur sur {instr['symbol']}: {e}")

        # Restore original symbol
        self.config.symbol = original_symbol
        self.config.symbol_mt5 = original_mt5

        # Trie par score et marque les meilleurs
        scores.sort(key=lambda s: s.score, reverse=True)
        for i, s in enumerate(scores[:self.config.max_instruments]):
            s.recommended = True

        self._scores = scores
        self._last_scan = time.time()
        self.logger.info(f"Scanner: {len(scores)} instruments scannés, meilleur: {scores[0].symbol if scores else 'none'}")

    def best_instruments(self, limit: int = 3) -> List[dict]:
        """Retourne les meilleurs instruments."""
        return [
            {
                "symbol": s.symbol,
                "score": s.score,
                "regime": s.regime,
                "trend_alignment": s.trend_alignment,
                "volatility_pct": s.volatility_pct,
                "recommended": s.recommended,
                "reason": s.reason,
            }
            for s in self._scores[:limit]
        ]

    def status(self) -> dict:
        return {
            "active": self._running,
            "last_scan": self._last_scan,
            "instruments_scanned": len(self._scores),
            "best": self.best_instruments(),
        }
