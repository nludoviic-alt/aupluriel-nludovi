"""
Configuration globale du moteur de trading.
Instrument : Boom 1000 Index (Deriv MT5)
Capital démo : $1 000
Risque max : 0.25% par trade
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Timeframe(Enum):
    M5 = "5min"
    M15 = "15min"
    H1 = "1h"


class SignalDirection(Enum):
    BUY = "BUY"
    SELL = "SELL"
    NEUTRAL = "NEUTRAL"


class IAMode(Enum):
    OBSERVATION = "observation"
    SEMI_AUTO = "semi-auto"
    AUTOMATIC = "automatic"


@dataclass
class EngineConfig:
    # --- Connexion MT5 ---
    mt5_login: int = 0
    mt5_password: str = ""
    mt5_server: str = "Deriv-Demo"
    mt5_path: str = ""
    mt5_bridge_url: str = ""
    mt5_bridge_key: str = ""

    # --- Instrument ---
    symbol: str = "Boom 1000 Index"
    symbol_mt5: str = "BOOM1000"
    allowed_markets: list = field(default_factory=lambda: ["Boom 1000 Index"])

    # --- Capital ---
    starting_capital: float = 1000.0
    min_balance: float = 100.0  # Solde minimum avant arrêt

    # --- Risque ---
    risk_per_trade_pct: float = 0.25
    max_daily_loss_pct: float = 2.0
    max_weekly_loss_pct: float = 5.0
    max_concurrent_positions: int = 3
    max_consecutive_losses: int = 3
    max_total_exposure_pct: float = 5.0  # Exposition totale max du capital
    max_leverage: float = 100.0
    min_rr_ratio: float = 1.5  # Rapport gain/risque minimum
    no_martingale: bool = True

    # --- Décision ---
    min_confidence_threshold: float = 75.0
    timeframes: list = field(default_factory=lambda: [Timeframe.M5, Timeframe.M15, Timeframe.H1])

    # --- IA Mode ---
    ia_mode: str = "observation"  # observation, semi-auto, automatic
    max_trades_per_hour: int = 5
    max_position_duration_min: int = 240  # 4h max par position
    allow_buy: bool = True
    allow_sell: bool = True
    trading_hours_start: str = "00:00"
    trading_hours_end: str = "23:59"
    forced_stop_hour: str = "23:30"  # Arrêt obligatoire
    active_strategies: list = field(default_factory=lambda: ["trend_following"])

    # --- Indicateurs ---
    rsi_period: int = 14
    rsi_oversold: float = 30.0
    rsi_overbought: float = 70.0

    ma_fast: int = 9
    ma_slow: int = 21

    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9

    atr_period: int = 14
    atr_stop_multiplier: float = 1.5

    # --- Exécution ---
    max_spread_points: float = 5.0
    slippage_points: float = 3.0
    commission_per_lot: float = 0.0

    # --- Kill switch ---
    kill_switch_active: bool = False

    # --- Mode ---
    is_live: bool = False

    # ─── Régime de marché ───
    enable_regime_detection: bool = True

    # ─── Patterns de chandeliers ───
    enable_pattern_detection: bool = True

    # ─── Ensemble de stratégies ───
    enable_ensemble: bool = True
    ensemble_strategies: list = field(default_factory=lambda: [
        "trend_following", "mean_reversion", "breakout", "momentum"
    ])

    # ─── Trailing stop et gestion avancée ───
    enable_trailing_stop: bool = True
    trailing_atr_multiplier: float = 2.0
    break_even_pips: float = 0.5  # En pips (ou points selon l'instrument)
    enable_partial_close: bool = True
    tp1_threshold: float = 1.0  # ATR multiples pour TP1
    tp1_close_pct: float = 0.5  # Fermer 50% à TP1
    tp2_threshold: float = 2.0  # ATR multiples pour TP2
    tp2_close_pct: float = 0.3  # Fermer 30% à TP2

    # ─── Apprentissage adaptatif ───
    enable_adaptive: bool = True
    adaptive_adjust_confidence: bool = True
    adaptive_adjust_interval: int = 10  # Ajuster tous les N trades

    # ─── Détection d'anomalies ───
    enable_anomaly_detection: bool = True
    anomaly_pause_duration_sec: int = 3600  # 1h
    anomaly_reduce_threshold: int = 4  # Pertes sur 5 derniers → réduire

    # ─── Calendrier économique ───
    enable_economic_calendar: bool = True
    pause_on_high_impact: bool = True
    high_impact_window_min: int = 30  # ±30 min autour de l'annonce

    # ─── Multi-instrument ───
    enable_multi_instrument: bool = False
    instrument_scan_interval: int = 300  # 5 min entre scans
    max_instruments: int = 3

    def risk_amount(self, balance: float) -> float:
        """Calcule le montant risqué par trade."""
        return balance * (self.risk_per_trade_pct / 100.0)

    def daily_loss_limit(self, balance: float) -> float:
        """Calcule la limite de perte quotidienne en montant."""
        return balance * (self.max_daily_loss_pct / 100.0)


# Configuration par défaut
DEFAULT_CONFIG = EngineConfig()
