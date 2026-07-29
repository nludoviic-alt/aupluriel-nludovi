import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Play, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ENGINE_API_BASE } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/backtest")({
  head: () => ({ meta: [{ title: "Backtest — Au Pluriel" }] }),
  component: BacktestPage,
});

interface BacktestResult {
  initial_capital: number;
  final_capital: number;
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  equity_curve: number[];
  trades: Array<{
    entry_time: number;
    exit_time: number;
    direction: string;
    entry_price: number;
    exit_price: number;
    pnl: number;
    result: string;
    confidence: number;
    exit_reason: string;
    slippage?: number;
  }>;
}

function BacktestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [config, setConfig] = useState({
    initial_capital: 1000,
    months: 6,
    risk_per_trade: 0.25,
    min_confidence: 75,
    spread_pips: 1.0,
    commission_per_lot: 3.5,
  });

  const runBacktest = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${ENGINE_API_BASE}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setResult(await res.json());
        setIsDemoResult(false);
      } else {
        toast.error("Backtest réel indisponible — affichage d'un résultat de démonstration.");
        setResult(generateDemoResult(config));
        setIsDemoResult(true);
      }
    } catch {
      toast.error("Moteur injoignable — affichage d'un résultat de démonstration.");
      setResult(generateDemoResult(config));
      setIsDemoResult(true);
    } finally {
      setRunning(false);
    }
  };

  const equityData = result?.equity_curve.map((v, i) => ({ x: i, equity: v })) ?? [];
  const avgSlippage = result?.trades?.length
    ? result.trades.reduce((s, t) => s + (t.slippage ?? 0), 0) / result.trades.length
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-5 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <FlaskConical className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Backtest & Modélisation du Slippage</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Simulation multi-indicateurs avec ratios de Sharpe, Sortino et modèle de slippage dynamique sous volatilité.
              </p>
            </div>
          </div>

          <Button
            onClick={runBacktest}
            disabled={running}
            className="gap-2 rounded-xl px-5 h-11 text-xs font-bold bg-primary text-primary-foreground shadow-[var(--shadow-glow-orange)] hover:opacity-90 relative z-10"
          >
            <Play className="h-4 w-4" /> {running ? "Simulation en cours…" : "Lancer le Backtest"}
          </Button>
        </div>

        {/* Config Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 relative z-10">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Capital Initial ($)</label>
            <input
              type="number"
              value={config.initial_capital}
              onChange={e => setConfig(s => ({ ...s, initial_capital: parseFloat(e.target.value) }))}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Période (Mois)</label>
            <input
              type="number"
              value={config.months}
              onChange={e => setConfig(s => ({ ...s, months: parseInt(e.target.value) }))}
              min={1} max={24}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Risque/Trade (%)</label>
            <input
              type="number"
              value={config.risk_per_trade}
              onChange={e => setConfig(s => ({ ...s, risk_per_trade: parseFloat(e.target.value) }))}
              step={0.05} min={0.05} max={2}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Confiance Min (%)</label>
            <input
              type="number"
              value={config.min_confidence}
              onChange={e => setConfig(s => ({ ...s, min_confidence: parseFloat(e.target.value) }))}
              step={5} min={50} max={100}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Spread (pips)</label>
            <input
              type="number"
              value={config.spread_pips}
              onChange={e => setConfig(s => ({ ...s, spread_pips: parseFloat(e.target.value) }))}
              step={0.1} min={0} max={10}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Commission ($/lot)</label>
            <input
              type="number"
              value={config.commission_per_lot}
              onChange={e => setConfig(s => ({ ...s, commission_per_lot: parseFloat(e.target.value) }))}
              step={0.5} min={0} max={20}
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-5">
          {isDemoResult && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Résultat de démonstration (généré localement) — le moteur de backtest réel n'a pas répondu.
            </div>
          )}
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&L Total</span>
              <p className={cn("text-xl font-black font-mono mt-1", result.total_pnl >= 0 ? "text-success" : "text-destructive")}>
                {result.total_pnl >= 0 ? "+" : ""}${result.total_pnl.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Win Rate</span>
              <p className={cn("text-xl font-black font-mono mt-1", result.win_rate >= 50 ? "text-success" : "text-destructive")}>
                {result.win_rate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max Drawdown</span>
              <p className="text-xl font-black font-mono text-destructive mt-1">
                -{result.max_drawdown_pct.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sharpe Ratio</span>
              <p className="text-xl font-black font-mono text-primary mt-1">
                {result.sharpe_ratio.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sortino Ratio</span>
              <p className="text-xl font-black font-mono text-success mt-1">
                {result.sortino_ratio.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Slippage Moyen</span>
              <p className="text-xl font-black font-mono text-warning mt-1">
                {avgSlippage.toFixed(4)} pts
              </p>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Courbe de Capital (Equity Curve)</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
                  <XAxis dataKey="x" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area type="monotone" dataKey="equity" stroke="var(--primary)" strokeWidth={2} fill="url(#equityGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateDemoResult(cfg: any): BacktestResult {
  const initial = cfg.initial_capital ?? 1000;
  let capital = initial;
  const equity: number[] = [initial];
  const trades = [];
  let wins = 0;
  let peak = initial;
  let maxDd = 0;

  for (let i = 0; i < 80; i++) {
    const isWin = Math.random() > 0.38;
    const slippage = 0.005 + Math.random() * 0.015;
    const pnl = isWin ? (initial * (cfg.risk_per_trade ?? 0.25) * 1.8) / 100 - slippage : -(initial * (cfg.risk_per_trade ?? 0.25)) / 100 - slippage;
    capital += pnl;
    equity.push(capital);
    if (isWin) wins++;
    if (capital > peak) peak = capital;
    const dd = peak - capital;
    if (dd > maxDd) maxDd = dd;

    trades.push({
      entry_time: Date.now() - (80 - i) * 3600000 * 4,
      exit_time: Date.now() - (80 - i) * 3600000 * 3,
      direction: Math.random() > 0.5 ? "BUY" : "SELL",
      entry_price: 500 + Math.random() * 10,
      exit_price: 500 + Math.random() * 10,
      pnl,
      result: isWin ? "win" : "loss",
      confidence: 75 + Math.random() * 20,
      exit_reason: isWin ? "Take profit" : "Stop loss",
      slippage,
    });
  }

  const totalPnl = capital - initial;
  return {
    initial_capital: initial,
    final_capital: capital,
    total_pnl: totalPnl,
    total_trades: 80,
    wins,
    losses: 80 - wins,
    win_rate: (wins / 80) * 100,
    max_drawdown: maxDd,
    max_drawdown_pct: (maxDd / peak) * 100,
    profit_factor: 1.65,
    avg_win: 4.5,
    avg_loss: 2.5,
    sharpe_ratio: 1.42,
    sortino_ratio: 1.88,
    equity_curve: equity,
    trades,
  };
}
