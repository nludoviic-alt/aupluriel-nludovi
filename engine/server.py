"""
Serveur FastAPI — pont entre le moteur Python et l'interface React.
- REST API pour le statut, configuration et contrôle
- WebSocket pour les mises à jour temps réel
"""

import asyncio
import json
import os
import threading
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import EngineConfig
from .bot import TradingBot
from .logger import TradeLogger
from .backtest import Backtester
from .mt5_connector import MT5Connector
from .config import Timeframe

load_dotenv()


def _default_config() -> EngineConfig:
    """Config par défaut — reprend les identifiants MT5 depuis .env si présent."""
    config = EngineConfig()
    if os.getenv("MT5_LOGIN"):
        config.mt5_login = int(os.getenv("MT5_LOGIN"))
    if os.getenv("MT5_PASSWORD"):
        config.mt5_password = os.getenv("MT5_PASSWORD")
    if os.getenv("MT5_SERVER"):
        config.mt5_server = os.getenv("MT5_SERVER")
    if os.getenv("MT5_PATH"):
        config.mt5_path = os.getenv("MT5_PATH")
    return config


# --- Modèles ---

class ConfigUpdate(BaseModel):
    risk_per_trade_pct: Optional[float] = None
    min_confidence_threshold: Optional[float] = None
    max_concurrent_positions: Optional[int] = None
    max_consecutive_losses: Optional[int] = None
    max_daily_loss_pct: Optional[float] = None
    atr_stop_multiplier: Optional[float] = None
    ia_mode: Optional[str] = None
    max_trades_per_hour: Optional[int] = None
    max_weekly_loss_pct: Optional[float] = None
    min_rr_ratio: Optional[float] = None
    max_total_exposure_pct: Optional[float] = None
    min_balance: Optional[float] = None
    allow_buy: Optional[bool] = None
    allow_sell: Optional[bool] = None


class MT5Credentials(BaseModel):
    login: int
    password: str
    server: str = "Deriv-Demo"
    path: str = ""


class BacktestRequest(BaseModel):
    initial_capital: float = 1000.0
    months: int = 6
    risk_per_trade: float = 0.25
    min_confidence: float = 75.0
    spread_pips: float = 1.0
    commission_per_lot: float = 3.5


# --- App ---

app = FastAPI(title="Au Pluriel Trading Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:8080", "http://127.0.0.1:8081"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(8080|8081)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bot global
bot: Optional[TradingBot] = None
ws_clients: list = []


def get_bot() -> TradingBot:
    global bot
    if bot is None:
        config = _default_config()
        bot = TradingBot(config)
        bot.connect()
        bot._ws_broadcast = broadcast  # type: ignore
        bot.add_callback(lambda event, data: asyncio.run_coroutine_threadsafe(
            broadcast({"event": event, **data}), loop
        ) if loop else None)
    return bot


# Event loop reference for callbacks
loop: Optional[asyncio.AbstractEventLoop] = None


async def broadcast(message: dict):
    """Envoie un message à tous les clients WebSocket."""
    dead = []
    for i, ws in enumerate(ws_clients):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(i)
    for i in reversed(dead):
        ws_clients.pop(i)


# --- Routes REST ---

@app.on_event("startup")
async def startup():
    global loop
    loop = asyncio.get_event_loop()
    b = get_bot()
    b.logger.info("FastAPI démarré — engine prêt")


@app.get("/api/status")
async def status():
    """Retourne l'état complet du bot."""
    return get_bot().status()


@app.get("/api/logs")
async def logs(n: int = 50):
    """Retourne les dernières entrées du journal."""
    return get_bot().logger.recent(n)


@app.post("/api/start")
async def start_bot():
    """Démarre le bot."""
    b = get_bot()
    b.start()
    return {"running": True}


@app.post("/api/stop")
async def stop_bot():
    """Arrête le bot."""
    b = get_bot()
    b.stop()
    return {"running": False}


@app.post("/api/kill-switch")
async def kill_switch():
    """Active le kill-switch."""
    b = get_bot()
    b.kill_switch()
    return {"kill_switch": True}


@app.post("/api/resume")
async def resume_trading():
    """Désactive le kill-switch et reprend."""
    b = get_bot()
    b.resume_trading()
    return {"kill_switch": False}


@app.post("/api/close-all")
async def close_all():
    """Ferme toutes les positions."""
    b = get_bot()
    count = b.mt5.close_all_positions()
    return {"closed": count}


@app.post("/api/config")
async def update_config(cfg: ConfigUpdate):
    """Met à jour la configuration du bot."""
    b = get_bot()
    b.update_config(cfg.dict(exclude_none=True))
    return {"config": b.status()["config"]}


@app.post("/api/mt5/connect")
async def connect_mt5(creds: MT5Credentials):
    """Connecte à MT5 avec des identifiants."""
    global bot
    if bot:
        bot.stop()
        bot.mt5.disconnect()
    config = EngineConfig(
        mt5_login=creds.login,
        mt5_password=creds.password,
        mt5_server=creds.server,
        mt5_path=creds.path,
    )
    bot = TradingBot(config)
    bot.connect()
    bot.add_callback(lambda event, data: asyncio.run_coroutine_threadsafe(
        broadcast({"event": event, **data}), loop
    ) if loop else None)
    return bot.status()


@app.get("/api/positions")
async def positions():
    """Retourne les positions ouvertes."""
    b = get_bot()
    pos = b.mt5.get_positions()
    return [
        {
            "ticket": p.ticket,
            "direction": p.direction,
            "volume": p.volume,
            "entry": p.entry_price,
            "current": p.current_price,
            "sl": p.stop_loss,
            "tp": p.take_profit,
            "profit": round(p.profit, 2),
        }
        for p in pos
    ]


@app.post("/api/positions/{ticket}/close")
async def close_position(ticket: int):
    """Ferme une position spécifique."""
    b = get_bot()
    success = b.mt5.close_position(ticket)
    return {"success": success, "ticket": ticket}


@app.get("/api/mt5/test")
async def test_mt5_connection():
    """Teste la connexion MT5 sur tous les points."""
    b = get_bot()
    result = {
        "account": False,
        "balance": False,
        "instruments": False,
        "trading": False,
        "vps": False,
    }
    try:
        info = b.mt5.get_account_info()
        if info and info.get("balance", 0) > 0:
            result["account"] = True
            result["balance"] = True
        # Test instruments
        df = b.mt5.get_candles(None, 10)
        if df is not None and len(df) > 0:
            result["instruments"] = True
        # Test trading permission
        if not b.risk.kill_switch:
            result["trading"] = True
        # VPS communication (simulated — if we got here, the bridge works)
        result["vps"] = b.mt5._sim_mode or (info is not None)
    except Exception as e:
        b.logger.error(f"MT5 test failed: {e}")
    return result


# --- Nouveaux endpoints IA ---

@app.get("/api/regime")
async def get_regime():
    """Retourne le régime de marché actuel."""
    b = get_bot()
    if b._last_regime:
        return b._last_regime.to_dict()
    return {"regime": "unknown", "description": "Pas encore analysé"}


@app.get("/api/strategies")
async def get_strategies():
    """Retourne tous les signaux de stratégies évalués."""
    b = get_bot()
    if not b._last_analysis or not b._last_regime:
        return {"signals": [], "best": None}
    primary_df = None
    for tf in b.config.timeframes:
        df = b.mt5.get_candles(tf, 200)
        if df is not None:
            primary_df = df
            break
    if primary_df is None or not b.strategy_ensemble:
        return {"signals": [], "best": None}
    all_sigs = b.strategy_ensemble.all_signals(primary_df, b._last_analysis, b._last_regime)
    return {
        "signals": [
            {
                "strategy": s.strategy,
                "direction": s.direction.value,
                "confidence": s.confidence,
                "reason": s.reason,
                "entry": s.entry_price,
                "sl": s.stop_loss,
                "tp": s.take_profit,
            }
            for s in all_sigs
        ],
        "best": {
            "strategy": b._last_strategy_signal.strategy,
            "direction": b._last_strategy_signal.direction.value,
            "confidence": b._last_strategy_signal.confidence,
            "reason": b._last_strategy_signal.reason,
        } if b._last_strategy_signal else None,
    }


@app.get("/api/adaptive")
async def get_adaptive():
    """Retourne les insights d'apprentissage adaptatif."""
    b = get_bot()
    if b.adaptive:
        return b.adaptive.status()
    return {"error": "Adaptive learning disabled"}


@app.get("/api/anomaly")
async def get_anomaly():
    """Retourne l'état de détection d'anomalies."""
    b = get_bot()
    if b.anomaly:
        return b.anomaly.status()
    return {"error": "Anomaly detection disabled"}


@app.get("/api/calendar")
async def get_calendar():
    """Retourne le calendrier économique."""
    b = get_bot()
    if b.calendar:
        return b.calendar.status()
    return {"error": "Economic calendar disabled"}


@app.get("/api/position-management")
async def get_position_management():
    """Retourne l'état de gestion des positions."""
    b = get_bot()
    if b.position_manager:
        return {"positions": b.position_manager.status()}
    return {"error": "Position management disabled"}


@app.post("/api/anomaly/reset")
async def reset_anomaly():
    """Réinitialise l'état d'anomalie (reprend le trading)."""
    b = get_bot()
    if b.anomaly:
        b.anomaly._paused = False
        b.anomaly._pause_until = 0
        b.anomaly._alerts.clear()
        b.logger.info("Anomalie réinitialisée manuellement")
        return {"reset": True}
    return {"error": "Anomaly detection disabled"}


@app.post("/api/anomaly/update-baseline")
async def update_baseline():
    """Met à jour la baseline de win rate."""
    b = get_bot()
    if b.anomaly:
        b.anomaly.update_baseline()
        return {"updated": True, "baseline": b.anomaly._baseline_win_rate}
    return {"error": "Anomaly detection disabled"}


# --- WebSocket ---

@app.post("/api/backtest")
async def run_backtest(req: BacktestRequest):
    """Lance un backtest sur données simulées."""
    config = EngineConfig(
        starting_capital=req.initial_capital,
        risk_per_trade_pct=req.risk_per_trade,
        min_confidence_threshold=req.min_confidence,
    )
    bt = Backtester(config)

    # Génère des données simulées pour le backtest
    mt5 = MT5Connector(config, bt.logger)
    mt5._enable_simulation()

    data_by_tf = {}
    for tf in config.timeframes:
        df = mt5.get_candles(tf, max(req.months * 30 * 24 * 12, 500))
        if df is not None:
            data_by_tf[tf] = df

    result = bt.run(data_by_tf, initial_capital=req.initial_capital)
    return result.to_dict()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket pour les mises à jour temps réel."""
    await ws.accept()
    ws_clients.append(ws)
    try:
        # Envoie l'état initial
        await ws.send_json({"event": "status", **get_bot().status()})
        while True:
            # Garde la connexion ouverte
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_clients.remove(ws)
    except Exception:
        if ws in ws_clients:
            ws_clients.remove(ws)


# --- Main ---

def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Lance le serveur."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
