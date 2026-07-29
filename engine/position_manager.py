"""
Gestion avancée des positions.
Trailing stop dynamique, fermeture partielle, break-even automatique.
"""

from dataclasses import dataclass, field
from typing import Optional, List
from .risk import Position
from .config import EngineConfig


@dataclass
class PositionManagement:
    ticket: int
    original_sl: float
    original_tp: float
    current_sl: float
    current_tp: float
    original_volume: float
    remaining_volume: float
    partial_closes: list = field(default_factory=list)  # [{"level": 1, "volume": 0.5, "price": x}]
    break_even_triggered: bool = False
    trailing_active: bool = False
    max_favorable_excursion: float = 0.0  # Meilleur prix atteint


class PositionManager:
    """Gère le trailing stop, break-even et fermeture partielle."""

    def __init__(self, config: EngineConfig):
        self.config = config
        self._managed: dict = {}  # ticket -> PositionManagement

    def register(self, pos: Position):
        """Enregistre une nouvelle position pour gestion."""
        if pos.ticket not in self._managed:
            self._managed[pos.ticket] = PositionManagement(
                ticket=pos.ticket,
                original_sl=pos.stop_loss,
                original_tp=pos.take_profit,
                current_sl=pos.stop_loss,
                current_tp=pos.take_profit,
                original_volume=pos.volume,
                remaining_volume=pos.volume,
            )

    def update(self, pos: Position, current_price: float, atr: float) -> dict:
        """Met à jour la gestion d'une position. Retourne les actions à effectuer."""
        if pos.ticket not in self._managed:
            self.register(pos)

        mgmt = self._managed[pos.ticket]
        actions = {"modify_sl": None, "partial_close": None, "close_all": False}
        is_buy = pos.direction == "BUY"

        # Calcul du meilleur prix atteint (Maximum Favorable Excursion)
        if is_buy:
            mfe = max(mgmt.max_favorable_excursion, current_price - pos.entry_price)
        else:
            mfe = max(mgmt.max_favorable_excursion, pos.entry_price - current_price)
        mgmt.max_favorable_excursion = mfe

        # ─── 0. Micro-scalping dynamique & Verrouillage de gain ───
        micro_target = getattr(self.config, 'micro_tp_dollars', 0.50)
        
        # 1. Break-even automatique ultra-rapide (Risque 0$ dès +0.2 pts)
        break_even_pips = self.config.break_even_pips
        if not mgmt.break_even_triggered and mfe >= break_even_pips:
            new_sl = pos.entry_price
            if (is_buy and new_sl > mgmt.current_sl) or (not is_buy and new_sl < mgmt.current_sl):
                mgmt.current_sl = new_sl
                mgmt.break_even_triggered = True
                actions["modify_sl"] = new_sl

        # 2. Sécurisation du gain minimal à +$0.50 + Trailing pour laisser courir les gros spikes
        if pos.profit >= micro_target:
            mgmt.trailing_active = True
            trail_distance = max(0.2, atr * self.config.trailing_atr_multiplier)
            if is_buy:
                new_sl = current_price - trail_distance
                if new_sl > mgmt.current_sl:
                    mgmt.current_sl = new_sl
                    actions["modify_sl"] = new_sl
            else:
                new_sl = current_price + trail_distance
                if new_sl < mgmt.current_sl:
                    mgmt.current_sl = new_sl
                    actions["modify_sl"] = new_sl

        # ─── 2. Trailing stop dynamique (ATR) ───
        if mgmt.break_even_triggered or mfe >= atr * 1.5:
            mgmt.trailing_active = True
            trail_distance = atr * self.config.trailing_atr_multiplier

            if is_buy:
                new_sl = current_price - trail_distance
                if new_sl > mgmt.current_sl:
                    mgmt.current_sl = new_sl
                    actions["modify_sl"] = new_sl
            else:
                new_sl = current_price + trail_distance
                if new_sl < mgmt.current_sl:
                    mgmt.current_sl = new_sl
                    actions["modify_sl"] = new_sl

        # ─── 3. Fermeture partielle (TP1, TP2, TP3) ───
        if self.config.enable_partial_close and mgmt.remaining_volume > 0:
            for level, (threshold_pct, close_pct) in enumerate([
                (self.config.tp1_threshold, self.config.tp1_close_pct),
                (self.config.tp2_threshold, self.config.tp2_close_pct),
            ], 1):
                already_done = any(pc["level"] == level for pc in mgmt.partial_closes)
                if not already_done and mfe >= atr * threshold_pct:
                    close_vol = mgmt.original_volume * close_pct
                    if close_vol < mgmt.remaining_volume:
                        actions["partial_close"] = {
                            "level": level,
                            "volume": close_vol,
                            "price": current_price,
                        }
                        mgmt.partial_closes.append({"level": level, "volume": close_vol, "price": current_price})
                        mgmt.remaining_volume -= close_vol

        return actions

    def cleanup(self, ticket: int):
        """Supprime une position fermée de la gestion."""
        self._managed.pop(ticket, None)

    def status(self) -> list:
        """Retourne l'état de toutes les positions gérées."""
        result = []
        for ticket, mgmt in self._managed.items():
            result.append({
                "ticket": ticket,
                "current_sl": round(mgmt.current_sl, 4),
                "original_sl": round(mgmt.original_sl, 4),
                "remaining_volume": round(mgmt.remaining_volume, 2),
                "original_volume": round(mgmt.original_volume, 2),
                "break_even": mgmt.break_even_triggered,
                "trailing": mgmt.trailing_active,
                "mfe": round(mgmt.max_favorable_excursion, 4),
                "partial_closes": mgmt.partial_closes,
            })
        return result
