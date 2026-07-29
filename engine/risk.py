"""
Moteur de risque indépendant.
- Risque max : 0.25% du capital par trade
- Stop-loss obligatoire (1.5 × ATR)
- Limite de pertes quotidiennes : 2%
- Max 3 positions simultanées
- Arrêt après 3 pertes consécutives
- Interdiction de Martingale (doubler la mise après une perte)
- Kill-switch d'urgence
"""

import time
from dataclasses import dataclass, field
from typing import Optional, List
from .config import EngineConfig
from .logger import TradeLogger
from .decision import Decision


@dataclass
class Position:
    """Position ouverte."""
    ticket: int
    symbol: str
    direction: str  # "BUY" ou "SELL"
    volume: float
    entry_price: float
    stop_loss: float
    take_profit: float
    open_time: float
    current_price: float = 0.0
    profit: float = 0.0


@dataclass
class RiskState:
    """État du moteur de risque."""
    balance: float
    equity: float
    open_positions: List[Position] = field(default_factory=list)
    daily_pnl: float = 0.0
    daily_loss: float = 0.0
    consecutive_losses: int = 0
    last_trade_volume: float = 0.0
    last_trade_result: str = ""  # "win", "loss", ""
    trading_halted: bool = False
    halt_reason: str = ""
    day_start: float = field(default_factory=time.time)

    @property
    def open_count(self) -> int:
        return len(self.open_positions)


@dataclass
class RiskCheck:
    """Résultat d'un contrôle de risque."""
    approved: bool
    reason: str
    volume: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    risk_amount: float = 0.0

    def to_dict(self) -> dict:
        return {
            "approved": self.approved,
            "reason": self.reason,
            "volume": round(self.volume, 4),
            "stop_loss": round(self.stop_loss, 4),
            "take_profit": round(self.take_profit, 4),
            "risk_amount": round(self.risk_amount, 2),
        }


class RiskEngine:
    """Moteur de risque indépendant — valide chaque trade avant exécution."""

    def __init__(self, config: EngineConfig, logger: TradeLogger):
        self.config = config
        self.logger = logger
        self.state = RiskState(
            balance=config.starting_capital,
            equity=config.starting_capital,
        )

    def update_state(self, balance: float, equity: float, positions: List[Position], daily_pnl: float):
        """Met à jour l'état du moteur depuis MT5."""
        self.state.balance = balance
        self.state.equity = equity
        self.state.open_positions = positions
        self.state.daily_pnl = daily_pnl
        self.state.daily_loss = abs(min(0, daily_pnl))

        # Réinitialise le compteur quotidien
        now = time.time()
        if now - self.state.day_start > 86400:
            self.state.day_start = now
            self.state.daily_pnl = 0.0
            self.state.daily_loss = 0.0

    def record_trade_result(self, result: str, volume: float):
        """Enregistre le résultat du dernier trade pour anti-Martingale."""
        if result == "loss":
            self.state.consecutive_losses += 1
            if self.state.consecutive_losses >= self.config.max_consecutive_losses:
                self.state.trading_halted = True
                self.state.halt_reason = (
                    f"Arrêt automatique — {self.state.consecutive_losses} pertes consécutives"
                )
                self.logger.risk(self.state.halt_reason)
        elif result == "win":
            self.state.consecutive_losses = 0

        self.state.last_trade_result = result
        self.state.last_trade_volume = volume

    def check(self, decision: Decision, atr: float, price: float) -> RiskCheck:
        """Vérifie si un trade est autorisé selon toutes les règles de risque."""
        reasons = []

        # 1. Kill-switch
        if self.config.kill_switch_active:
            return RiskCheck(approved=False, reason="KILL SWITCH ACTIF — arrêt d'urgence")

        # 2. Trading halté (pertes consécutives)
        if self.state.trading_halted:
            return RiskCheck(approved=False, reason=f"TRADING ARRÊTÉ — {self.state.halt_reason}")

        # 3. Limite de pertes quotidiennes
        daily_limit = self.config.daily_loss_limit(self.state.balance)
        if self.state.daily_loss >= daily_limit:
            return RiskCheck(
                approved=False,
                reason=f"LIMITE PERTE QUOTIDIENNE ATTEINTE — {self.state.daily_loss:.2f} / {daily_limit:.2f}",
            )

        # 4. Maximum de positions simultanées
        if self.state.open_count >= self.config.max_concurrent_positions:
            reasons.append(
                f"Max positions atteint ({self.state.open_count}/{self.config.max_concurrent_positions})"
            )

        # 5. Anti-Martingale : interdiction de doubler la mise après une perte
        risk_amount = self.config.risk_amount(self.state.balance)
        volume = self._calculate_volume(risk_amount, atr, price)

        if self.config.no_martingale and self.state.last_trade_result == "loss":
            if volume > self.state.last_trade_volume:
                max_vol = self.state.last_trade_volume  # Ne pas augmenter
                volume = min(volume, max_vol)
                reasons.append("Anti-Martingale : volume limité au trade précédent")

        # 6. Stop-loss obligatoire
        if decision.direction.value == "BUY":
            stop_loss = price - (self.config.atr_stop_multiplier * atr)
            take_profit = price + (self.config.atr_stop_multiplier * atr * 2)  # RR 1:2
        else:
            stop_loss = price + (self.config.atr_stop_multiplier * atr)
            take_profit = price - (self.config.atr_stop_multiplier * atr * 2)

        # 7. Vérification que le risque correspond bien à 0.25%
        actual_risk = abs(price - stop_loss) * volume
        if actual_risk > risk_amount * 1.1:  # Tolérance 10%
            volume = risk_amount / abs(price - stop_loss) if abs(price - stop_loss) > 0 else 0
            reasons.append("Volume ajusté pour respecter le risque max")

        if volume <= 0:
            return RiskCheck(approved=False, reason="Volume calculé = 0 — risque trop faible")

        # Si des raisons de blocage existent
        if reasons and any("Max positions" in r for r in reasons):
            return RiskCheck(approved=False, reason="; ".join(reasons))

        check = RiskCheck(
            approved=True,
            reason="Trade autorisé",
            volume=volume,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_amount=risk_amount,
        )

        self.logger.risk(
            f"Trade approuvé — vol={volume:.4f}, SL={stop_loss:.4f}, TP={take_profit:.4f}, risque={risk_amount:.2f}",
            check.to_dict(),
        )

        return check

    def _calculate_volume(self, risk_amount: float, atr: float, price: float) -> float:
        """Calcule la taille de lot basée sur le risque et l'ATR."""
        if atr <= 0 or price <= 0:
            return 0.0
        stop_distance = self.config.atr_stop_multiplier * atr
        # volume = risque / distance_stop (simplifié, à ajuster selon specs MT5)
        volume = risk_amount / stop_distance
        # Arrondi à 0.01 minimum
        return max(round(volume, 2), 0.01)

    def activate_kill_switch(self):
        """Active le bouton d'arrêt d'urgence."""
        self.config.kill_switch_active = True
        self.state.trading_halted = True
        self.state.halt_reason = "KILL SWITCH — arrêt d'urgence manuel"
        self.logger.risk("KILL SWITCH ACTIVÉ — arrêt immédiat de toutes les opérations")

    def deactivate_kill_switch(self):
        """Désactive le kill-switch."""
        self.config.kill_switch_active = False
        self.state.trading_halted = False
        self.state.halt_reason = ""
        self.state.consecutive_losses = 0
        self.logger.risk("Kill switch désactivé — trading repris")

    def status(self) -> dict:
        """Retourne l'état complet du moteur de risque."""
        return {
            "balance": round(self.state.balance, 2),
            "equity": round(self.state.equity, 2),
            "open_positions": self.state.open_count,
            "max_positions": self.config.max_concurrent_positions,
            "daily_pnl": round(self.state.daily_pnl, 2),
            "daily_loss": round(self.state.daily_loss, 2),
            "daily_loss_limit": round(self.config.daily_loss_limit(self.state.balance), 2),
            "consecutive_losses": self.state.consecutive_losses,
            "max_consecutive_losses": self.config.max_consecutive_losses,
            "trading_halted": self.state.trading_halted,
            "halt_reason": self.state.halt_reason,
            "kill_switch": self.config.kill_switch_active,
            "risk_per_trade_pct": self.config.risk_per_trade_pct,
            "risk_amount": round(self.config.risk_amount(self.state.balance), 2),
            "no_martingale": self.config.no_martingale,
        }
