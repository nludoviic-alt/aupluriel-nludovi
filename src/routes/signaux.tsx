import { createFileRoute } from "@tanstack/react-router";
import {
  Radar, TrendingUp, TrendingDown, Activity, Gauge,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Sparkles, CheckCircle2,
} from "lucide-react";
import { useEngine } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signaux")({
  head: () => ({ meta: [{ title: "Signaux — Au Pluriel" }] }),
  component: SignalsPage,
});

function SignalsPage() {
  const { status, connected } = useEngine();
  const analysis = status?.last_analysis;
  const decision = status?.last_decision;

  const signals = analysis?.signals ?? [];
  const indicators = analysis ? Object.entries(analysis.indicators) : [];

  const trendIcon = (trend: string) =>
    trend === "BUY" ? <TrendingUp className="h-4 w-4 text-success" /> :
    trend === "SELL" ? <TrendingDown className="h-4 w-4 text-destructive" /> :
    <Minus className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex items-center gap-4 flex-1 relative z-10">
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Radar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Signaux en temps réel</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Analyse technique multi-indicateurs — {analysis?.symbol ?? "Volatility 100 Index"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <span className={cn(
            "rounded-full text-xs font-bold tracking-wider px-3.5 py-1.5 border flex items-center gap-2 uppercase",
            connected
              ? "bg-success/15 text-success border-success/30"
              : "bg-destructive/15 text-destructive border-destructive/30"
          )}>
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-success pulse-dot" : "bg-destructive")} />
            {connected ? "TEMPS RÉEL" : "ENGINE HORS LIGNE"}
          </span>
          {analysis && (
            <span className="text-2xl font-black font-mono text-foreground">
              {analysis.price.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Global trend + confidence */}
      {decision && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tendance globale
            </p>
            <div className="flex items-center gap-3">
              {trendIcon(decision.action)}
              <span className="text-2xl font-black text-foreground">{decision.action}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {analysis?.trend_alignment ?? 0}/3 timeframes alignées
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Score de confiance
            </p>
            <p className={cn("text-2xl font-black font-mono", decision.confidence >= 75 ? "text-success" : "text-muted-foreground")}>
              {decision.confidence.toFixed(1)}%
            </p>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", decision.confidence >= 75 ? "bg-success" : "bg-warning")}
                style={{ width: `${decision.confidence}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Volatilité marché
            </p>
            <div className="flex items-center gap-3">
              <Activity className={cn("h-5 w-5", analysis?.volatility_high ? "text-warning" : "text-success")} />
              <span className="text-2xl font-black text-foreground">
                {analysis?.volatility_high ? "ÉLEVÉE" : "NORMALE"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {analysis?.volatility_high ? "Période instable — prudence" : "Conditions de marché stables"}
            </p>
          </div>
        </div>
      )}

      {/* Multi-timeframe indicators */}
      {indicators.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Indicateurs Multi-Timeframe
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {indicators.map(([tf, ind]) => (
              <div key={tf} className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-foreground">{tf}</span>
                  {trendIcon(ind.trend)}
                </div>

                {/* RSI */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">RSI</span>
                    <span className={cn(
                      "font-mono font-bold",
                      ind.rsi < 30 ? "text-success" : ind.rsi > 70 ? "text-destructive" : "text-foreground"
                    )}>{ind.rsi.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden relative">
                    <div className="absolute inset-y-0 left-[30%] w-px bg-border" />
                    <div className="absolute inset-y-0 left-[70%] w-px bg-border" />
                    <div
                      className={cn("h-full rounded-full transition-all", ind.rsi > 70 ? "bg-destructive" : ind.rsi < 30 ? "bg-success" : "bg-primary")}
                      style={{ width: `${ind.rsi}%` }}
                    />
                  </div>
                </div>

                {/* EMA */}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">EMA 9/21</span>
                  <span className={cn("font-mono font-semibold", ind.ema_fast > ind.ema_slow ? "text-success" : "text-destructive")}>
                    {ind.ema_fast.toFixed(2)} / {ind.ema_slow.toFixed(2)}
                  </span>
                </div>

                {/* MACD */}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">MACD Histogram</span>
                  <span className={cn("font-mono font-semibold", ind.macd_histogram > 0 ? "text-success" : "text-destructive")}>
                    {ind.macd_histogram > 0 ? "+" : ""}{ind.macd_histogram.toFixed(6)}
                  </span>
                </div>

                {/* ATR */}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">ATR</span>
                  <span className="font-mono text-foreground">{ind.atr.toFixed(4)}</span>
                </div>

                {/* Support / Resistance */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-success/10 border border-success/20 px-2 py-1.5">
                    <p className="text-[10px] text-success font-bold uppercase">Support</p>
                    <p className="text-xs font-mono text-foreground">{ind.support.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-2 py-1.5">
                    <p className="text-[10px] text-destructive font-bold uppercase">Résistance</p>
                    <p className="text-xs font-mono text-foreground">{ind.resistance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals list */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Signaux détectés
          </p>
          <span className="text-xs font-mono font-bold text-primary">{signals.length} actifs</span>
        </div>

        {signals.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {connected ? "Aucun signal actif — en attente de la prochaine itération..." : "Engine hors ligne"}
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((sig, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-3">
                <div className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                  sig.direction === "BUY" ? "bg-success/15 border-success/30 text-success" : "bg-destructive/15 border-destructive/30 text-destructive"
                )}>
                  {sig.direction === "BUY" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{sig.type}</span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{sig.timeframe}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{sig.description}</p>
                </div>
                <span className={cn("text-xs font-mono font-bold shrink-0", sig.direction === "BUY" ? "text-success" : "text-destructive")}>
                  {sig.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No data state */}
      {!analysis && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-12 text-center">
          <Gauge className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {connected
              ? "En attente de la première analyse du moteur..."
              : "Démarrez le moteur Python pour recevoir les signaux en temps réel."}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 border border-border/40 rounded-full px-4 py-2">
            <Zap className="h-3 w-3 text-primary" />
            python -m engine.server
          </div>
        </div>
      )}
    </div>
  );
}
