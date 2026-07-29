"""
Journalisation complète de chaque décision du bot avec dispatch Telegram.
Toutes les actions sont tracées : signaux, décisions, ordres, positions, erreurs.
"""

import json
import os
import time
import urllib.request
import urllib.parse
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from typing import Optional, Callable, List
import threading


class LogLevel(Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    TRADE = "TRADE"
    SIGNAL = "SIGNAL"
    RISK = "RISK"


@dataclass
class LogEntry:
    timestamp: float
    level: str
    category: str
    message: str
    data: Optional[dict] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["datetime"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.timestamp))
        return d


def send_telegram_notification(message: str, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
    """Envoie une notification Telegram en arrière-plan."""
    token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
    cid = chat_id or os.getenv("TELEGRAM_CHAT_ID")
    if not token or not cid:
        return

    def _send():
        try:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = json.dumps({"chat_id": cid, "text": message, "parse_mode": "HTML"}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                pass
        except Exception as e:
            print(f"[Telegram Notification Error] {e}")

    threading.Thread(target=_send, daemon=True).start()


class TradeLogger:
    """Logger structuré avec persistance fichier + callbacks temps réel + Telegram Push."""

    def __init__(self, log_dir: str = "engine/logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.entries: List[LogEntry] = []
        self._callbacks: List[Callable[[LogEntry], None]] = []
        self._file = self.log_dir / f"trades_{int(time.time())}.jsonl"

    def add_callback(self, cb: Callable[[LogEntry], None]):
        """Ajoute un callback appelé à chaque nouvelle entrée (pour WebSocket)."""
        self._callbacks.append(cb)

    def log(self, level: LogLevel, category: str, message: str, data: Optional[dict] = None):
        entry = LogEntry(
            timestamp=time.time(),
            level=level.value,
            category=category,
            message=message,
            data=data,
        )
        self.entries.append(entry)
        self._persist(entry)

        # Immediate Telegram push for TRADE or RISK alerts
        if level in (LogLevel.TRADE, LogLevel.RISK, LogLevel.ERROR):
            emoji = "⚡" if level == LogLevel.TRADE else "⚠️" if level == LogLevel.RISK else "🔴"
            tg_msg = f"<b>Au Pluriel Quant Engine</b>\n{emoji} <b>[{level.value}]</b> {message}"
            send_telegram_notification(tg_msg)

        for cb in self._callbacks:
            try:
                cb(entry)
            except Exception:
                pass

    def info(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.INFO, "engine", msg, data)

    def warn(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.WARN, "engine", msg, data)

    def error(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.ERROR, "engine", msg, data)

    def signal(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.SIGNAL, "signal", msg, data)

    def trade(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.TRADE, "execution", msg, data)

    def risk(self, msg: str, data: Optional[dict] = None):
        self.log(LogLevel.RISK, "risk", msg, data)

    def _persist(self, entry: LogEntry):
        with open(self._file, "a") as f:
            f.write(json.dumps(entry.to_dict()) + "\n")

    def recent(self, n: int = 50) -> List[dict]:
        return [e.to_dict() for e in self.entries[-n:]]

    def clear(self):
        self.entries.clear()
