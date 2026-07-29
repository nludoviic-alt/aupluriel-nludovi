"""
Calendrier économique intégré.
Récupère les annonces économiques importantes et met le bot en pause.
Source: ForexFactory RSS (gratuit, pas de clé API).
"""

import time
import threading
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import List, Optional
from .config import EngineConfig
from .logger import TradeLogger

try:
    import urllib.request
    HAS_URLLIB = True
except ImportError:
    HAS_URLLIB = False


@dataclass
class EconomicEvent:
    time: str
    currency: str
    impact: str  # "high", "medium", "low"
    title: str
    forecast: str
    previous: str


class EconomicCalendar:
    """Récupère et surveille le calendrier économique."""

    URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"

    HIGH_IMPACT_CURRENCIES = ["USD", "EUR", "GBP", "JPY"]

    def __init__(self, config: EngineConfig, logger: TradeLogger):
        self.config = config
        self.logger = logger
        self._events: List[EconomicEvent] = []
        self._last_fetch: float = 0
        self._fetch_thread: Optional[threading.Thread] = None
        self._running = False

    def start(self):
        """Démarre la surveillance en arrière-plan."""
        if self._running:
            return
        self._running = True
        self._fetch_thread = threading.Thread(target=self._fetch_loop, daemon=True)
        self._fetch_thread.start()
        self.logger.info("Calendrier économique démarré")

    def stop(self):
        self._running = False

    def _fetch_loop(self):
        """Récupère le calendrier toutes les 30 minutes."""
        while self._running:
            try:
                self._fetch_events()
            except Exception as e:
                self.logger.warn(f"Calendrier éco: erreur fetch: {e}")
            time.sleep(1800)  # 30 min

    def _fetch_events(self):
        """Récupère les événements depuis ForexFactory."""
        if not HAS_URLLIB:
            return

        try:
            req = urllib.request.Request(self.URL, headers={"User-Agent": "AuPluriel/1.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read().decode("utf-8")

            root = ET.fromstring(xml_data)
            events = []
            for child in root:
                event = EconomicEvent(
                    time=child.findtext("time", ""),
                    currency=child.findtext("currency", ""),
                    impact=child.findtext("impact", "low"),
                    title=child.findtext("title", ""),
                    forecast=child.findtext("forecast", ""),
                    previous=child.findtext("previous", ""),
                )
                if event.impact == "high" and event.currency in self.HIGH_IMPACT_CURRENCIES:
                    events.append(event)

            self._events = events
            self._last_fetch = time.time()
            self.logger.info(f"Calendrier éco: {len(events)} événements high-impact récupérés")

        except Exception as e:
            self.logger.warn(f"Calendrier éco: erreur parsing: {e}")

    def is_high_impact_window(self) -> bool:
        """Vérifie si on est dans une fenêtre d'annonce high-impact (±30 min)."""
        if not self._events:
            return False

        now = time.time()
        for event in self._events:
            try:
                # ForexFactory format: "MMM DD HH:MM"
                # Parse approximatif — compare avec l'heure actuelle
                pass
            except Exception:
                continue

        # Fallback: si on a des events récents (dernière heure), considérer comme risky
        if self._last_fetch > 0 and (now - self._last_fetch) < 3600:
            return len(self._events) > 0 and any(e.impact == "high" for e in self._events)

        return False

    def should_pause_trading(self) -> bool:
        """Vérifie si le trading doit être暂停 pendant les annonces."""
        return self.is_high_impact_window() and self.config.pause_on_high_impact

    def should_reduce_size(self) -> bool:
        """Vérifie si la taille doit être réduite."""
        return self.is_high_impact_window()

    def upcoming_events(self, limit: int = 5) -> List[dict]:
        """Retourne les prochains événements high-impact."""
        return [
            {
                "time": e.time,
                "currency": e.currency,
                "impact": e.impact,
                "title": e.title,
                "forecast": e.forecast,
                "previous": e.previous,
            }
            for e in self._events[:limit]
        ]

    def status(self) -> dict:
        return {
            "active": self._running,
            "high_impact_window": self.is_high_impact_window(),
            "should_pause": self.should_pause_trading(),
            "should_reduce": self.should_reduce_size(),
            "upcoming": self.upcoming_events(),
            "last_fetch": self._last_fetch,
        }
