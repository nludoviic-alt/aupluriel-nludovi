"""
Backtest engine — Phase 2.
Simule la stratégie sur données historiques avec métriques avancées (Sharpe, Sortino, Slippage dynamique).
"""

import time
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Optional
from .config import EngineConfig, Timeframe, SignalDirection
from .analysis import AnalysisEngine
from .decision import DecisionEngine
from .logger import TradeLogger


@dataclass
class BacktestTrade:
    """Trade simulé."""
    entry_time: float
    exit_time: float
    direction: str
    entry_price: float
    exit_price: float
    volume: float
    stop_loss: float
    take_profit: float
    pnl: float
    result: str  # "win" or "loss"
    confidence: float
    exit_reason: str  # "tp", "sl", "timeout"
    slippage: float = 0.0


@dataclass
class BacktestResult:
    """Résultats du backtest."""
    trades: List[BacktestTrade] = field(default_factory=list)
    initial_capital: float = 1000.0
    final_capital: float = 1000.0
    total_pnl: float = 0.0
    total_trades: int = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    profit_factor: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    equity_curve: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "initial_capital": round(self.initial_capital, 2),
            "final_capital": round(self.final_capital, 2),
            "total_pnl": round(self.total_pnl, 2),
            "total_trades": self.total_trades,
            "wins": self.wins,
            "losses": self.losses,
            "win_rate": round(self.win_rate, 1),
            "max_drawdown": round(self.max_drawdown, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 1),
            "profit_factor": round(self.profit_factor, 2),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "sharpe_ratio": round(self.sharpe_ratio, 2),
            "sortino_ratio": round(self.sortino_ratio, 2),
            "equity_curve": self.equity_curve,
            "trades": [
                {
                    "entry_time": t.entry_time,
                    "exit_time": t.exit_time,
                    "direction": t.direction,
                    "entry_price": round(t.entry_price, 4),
                    "exit_price": round(t.exit_price, 4),
                    "pnl": round(t.pnl, 2),
                    "result": t.result,
                    "confidence": round(t.confidence, 1),
                    "exit_reason": t.exit_reason,
                    "slippage": round(t.slippage, 4),
                }
                for t in self.trades
            ],
        }


class Backtester:
    """Moteur de backtest avec gestion du Sortino ratio et du slippage dynamique."""

    def __init__(self, config: EngineConfig):
        self.config = config
        self.logger = TradeLogger(log_dir="engine/logs/backtest")
        self.analysis = AnalysisEngine(config)
        self.decision = DecisionEngine(config, self.logger)

    def run(self, data_by_tf: dict, initial_capital: float = 1000.0,
            max_bars: int = 1000) -> BacktestResult:
        """Lance le backtest sur les données historiques.

        Args:
            data_by_tf: {Timeframe: pd.DataFrame} avec OHLC
            initial_capital: Capital de départ
            max_bars: Nombre max de bougies à simuler
        """
        result = BacktestResult(initial_capital=initial_capital)
        capital = initial_capital
        equity_curve = [capital]

        m5_df = data_by_tf.get(Timeframe.M5)
        if m5_df is None or len(m5_df) < 50:
            return result

        m15_df = data_by_tf.get(Timeframe.M15, m5_df)
        h1_df = data_by_tf.get(Timeframe.H1, m5_df)

        window_size = 200
        total_bars = min(len(m5_df) - window_size, max_bars)

        consecutive_losses = 0
        daily_pnl = 0.0
        daily_loss_limit = capital * (self.config.max_daily_loss_pct / 100)
        current_positions = []

        for i in range(total_bars):
            bar_idx = window_size + i
            current_bar = m5_df.iloc[bar_idx]
            current_price = float(current_bar["close"])
            current_time = float(current_bar["time"].timestamp()) if hasattr(current_bar["time"], "timestamp") else time.time()

            # Vérifie les positions ouvertes pour SL/TP
            still_open = []
            for pos in current_positions:
                hit_sl = (pos["direction"] == "BUY" and current_price <= pos["sl"]) or \
                         (pos["direction"] == "SELL" and current_price >= pos["sl"])
                hit_tp = (pos["direction"] == "BUY" and current_price >= pos["tp"]) or \
                         (pos["direction"] == "SELL" and current_price <= pos["tp"])

                if hit_sl or hit_tp:
                    # Prix de sortie avec slippage simulé
                    exit_slippage = pos.get("slippage", 0.01)
                    exit_price = current_price - exit_slippage if pos["direction"] == "BUY" else current_price + exit_slippage

                    if pos["direction"] == "BUY":
                        pnl = (exit_price - pos["entry"]) * pos["volume"] * 100
                    else:
                        pnl = (pos["entry"] - exit_price) * pos["volume"] * 100
                    pnl -= getattr(self.config, "commission_per_lot", 0.0) * pos["volume"]

                    trade = BacktestTrade(
                        entry_time=pos["time"],
                        exit_time=current_time,
                        direction=pos["direction"],
                        entry_price=pos["entry"],
                        exit_price=exit_price,
                        volume=pos["volume"],
                        stop_loss=pos["sl"],
                        take_profit=pos["tp"],
                        pnl=pnl,
                        result="win" if pnl > 0 else "loss",
                        confidence=pos["confidence"],
                        exit_reason="tp" if hit_tp else "sl",
                        slippage=exit_slippage,
                    )
                    result.trades.append(trade)
                    capital += pnl
                    daily_pnl += pnl

                    if pnl > 0:
                        consecutive_losses = 0
                    else:
                        consecutive_losses += 1
                else:
                    still_open.append(pos)
            current_positions = still_open

            # Vérifie les limites de risque
            if consecutive_losses >= self.config.max_consecutive_losses:
                continue
            if abs(min(0, daily_pnl)) >= daily_loss_limit:
                continue
            if len(current_positions) >= self.config.max_concurrent_positions:
                continue

            # Analyse sur la fenêtre glissante
            m5_window = m5_df.iloc[bar_idx - window_size:bar_idx]
            m15_window = m15_df.iloc[max(0, bar_idx - window_size):bar_idx] if m15_df is not m5_df else m5_window
            h1_window = h1_df.iloc[max(0, bar_idx - window_size):bar_idx] if h1_df is not m5_df else m5_window

            analysis_data = {Timeframe.M5: m5_window, Timeframe.M15: m15_window, Timeframe.H1: h1_window}
            analysis = self.analysis.analyze(analysis_data)
            decision = self.decision.evaluate(analysis)

            if decision.would_trade and decision.direction != SignalDirection.NEUTRAL:
                m15_ind = analysis.indicators.get(Timeframe.M15.value)
                atr = m15_ind.atr if m15_ind else current_price * 0.001
                
                # Dynamic Slippage Model based on ATR and Volatility
                slippage_val = (atr * 0.05) + (getattr(self.config, 'spread_pips', 1.0) * 0.0001)
                execution_price = current_price + slippage_val if decision.direction.value == "BUY" else current_price - slippage_val

                risk_amount = capital * (self.config.risk_per_trade_pct / 100)
                stop_distance = self.config.atr_stop_multiplier * atr

                if decision.direction.value == "BUY":
                    sl = execution_price - stop_distance
                    tp = execution_price + stop_distance * 2
                else:
                    sl = execution_price + stop_distance
                    tp = execution_price - stop_distance * 2

                volume = risk_amount / stop_distance if stop_distance > 0 else 0
                volume = max(round(volume, 2), 0.01)

                current_positions.append({
                    "direction": decision.direction.value,
                    "entry": execution_price,
                    "sl": sl,
                    "tp": tp,
                    "volume": volume,
                    "time": current_time,
                    "confidence": decision.confidence,
                    "slippage": slippage_val,
                })

            equity_curve.append(round(capital, 2))

        # Métriques globales
        result.final_capital = capital
        result.total_pnl = capital - initial_capital
        result.total_trades = len(result.trades)
        result.wins = sum(1 for t in result.trades if t.result == "win")
        result.losses = sum(1 for t in result.trades if t.result == "loss")
        result.win_rate = (result.wins / result.total_trades * 100) if result.total_trades > 0 else 0

        gross_profit = sum(t.pnl for t in result.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in result.trades if t.pnl < 0))
        result.profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        result.avg_win = gross_profit / result.wins if result.wins > 0 else 0
        result.avg_loss = gross_loss / result.losses if result.losses > 0 else 0

        peak = initial_capital
        max_dd = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = peak - eq
            if dd > max_dd:
                max_dd = dd
        result.max_drawdown = max_dd
        result.max_drawdown_pct = (max_dd / peak * 100) if peak > 0 else 0

        # Sharpe & Sortino Ratios
        if len(equity_curve) > 1:
            returns = np.diff(equity_curve) / equity_curve[:-1]
            returns_std = np.std(returns)
            if returns_std > 0:
                result.sharpe_ratio = float((np.mean(returns) / returns_std) * np.sqrt(252))

            downside_returns = returns[returns < 0]
            downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0
            if downside_std > 0:
                result.sortino_ratio = float((np.mean(returns) / downside_std) * np.sqrt(252))

        result.equity_curve = equity_curve
        return result
