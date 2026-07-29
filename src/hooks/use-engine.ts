import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:8000/api";
const WS_URL = "ws://localhost:8000/ws";

export interface EngineStatus {
  running: boolean;
  sim_mode: boolean;
  cycle: number;
  account: {
    balance: number;
    equity: number;
    margin: number;
    margin_free: number;
    currency: string;
    login: number;
    server: string;
  };
  positions: EnginePosition[];
  risk: {
    balance: number;
    equity: number;
    open_positions: number;
    max_positions: number;
    daily_pnl: number;
    daily_loss: number;
    daily_loss_limit: number;
    consecutive_losses: number;
    max_consecutive_losses: number;
    trading_halted: boolean;
    halt_reason: string;
    kill_switch: boolean;
    risk_per_trade_pct: number;
    risk_amount: number;
    no_martingale: boolean;
  };
  last_analysis: EngineAnalysis | null;
  last_decision: EngineDecision | null;
  config: {
    symbol: string;
    risk_per_trade_pct: number;
    min_confidence: number;
    max_positions: number;
    max_consecutive_losses: number;
    daily_loss_limit_pct: number;
    is_live: boolean;
    ia_mode: string;
    max_trades_per_hour: number;
    allow_buy: boolean;
    allow_sell: boolean;
    max_weekly_loss_pct: number;
    min_rr_ratio: number;
    max_total_exposure_pct: number;
    min_balance: number;
  };
}

export interface EnginePosition {
  ticket: number;
  direction: string;
  volume: number;
  entry: number;
  current: number;
  sl: number;
  tp: number;
  profit: number;
}

export interface EngineAnalysis {
  symbol: string;
  price: number;
  global_trend: string;
  trend_alignment: number;
  volatility_high: boolean;
  support: number;
  resistance: number;
  signals: Array<{
    timeframe: string;
    type: string;
    direction: string;
    value: number;
    description: string;
  }>;
  indicators: Record<string, {
    rsi: number;
    ema_fast: number;
    ema_slow: number;
    macd_histogram: number;
    atr: number;
    volatility_pct: number;
    trend: string;
    support: number;
    resistance: number;
  }>;
}

export interface EngineDecision {
  action: string;
  direction: string;
  confidence: number;
  reason: string;
  timestamp: number;
  would_trade: boolean;
  blocked_reasons: string[];
  price: number;
  signals: Array<Record<string, unknown>>;
  trend_alignment: number;
  volatility_high: boolean;
}

export interface LogEntry {
  timestamp: number;
  datetime: string;
  level: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export function useEngine() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const fetchLogs = useCallback(async (n = 50) => {
    try {
      const res = await fetch(`${API_BASE}/logs?n=${n}`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch {
      // Engine not running
    }
  }, []);

  const apiCall = useCallback(async (endpoint: string, method = "POST", body?: unknown) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        await fetchStatus();
        return data;
      }
    } catch (e) {
      console.error(`API ${endpoint} failed:`, e);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[engine] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "status" || msg.event === "cycle") {
            setStatus(msg);
          } else if (msg.event === "kill_switch") {
            fetchStatus();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log("[engine] WebSocket disconnected, reconnecting in 3s");
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connectWs, 3000);
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchStatus();
    fetchLogs();
    connectWs();

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [fetchStatus, fetchLogs, connectWs]);

  return {
    status,
    logs,
    connected,
    loading,
    apiCall,
    refresh: () => { fetchStatus(); fetchLogs(); },
  };
}
