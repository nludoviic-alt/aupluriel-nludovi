import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useEngine } from "@/hooks/use-engine";
import { useRollingSeries } from "@/hooks/use-rolling-series";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marches")({
  head: () => ({ meta: [{ title: "Marchés — Au Pluriel" }] }),
  component: MarketsPage,
});

const TIMEFRAMES = [
  { key: "5min", label: "5 min" },
  { key: "15min", label: "15 min" },
  { key: "1h", label: "1h" },
] as const;

const CHART_STYLE = {
  background: "oklch(0.20 0.035 260)",
  border: "1px solid oklch(1 0 0 / 0.08)",
  borderRadius: 8,
  fontSize: 12,
};

function MarketsPage() {
  const { status, connected } = useEngine();
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]["key"]>("15min");

  const analysis = status?.last_analysis;
  const signals = analysis?.signals ?? [];
  const indicators = analysis?.indicators?.[tf] ?? null;

  const priceSeries = useRollingSeries(analysis?.price, 60);
  const rsiSeries = useRollingSeries(indicators?.rsi, 60);

  const priceData = useMemo(() => priceSeries.map((price, i) => ({ x: i, price })), [priceSeries]);
  const rsiData = useMemo(() => rsiSeries.map((rsi, i) => ({ x: i, rsi })), [rsiSeries]);

  const firstPrice = priceSeries[0] ?? null;
  const lastPrice = priceSeries[priceSeries.length - 1] ?? null;
  const priceChange = firstPrice ? ((lastPrice! - firstPrice) / firstPrice) * 100 : null;

  const tfSignals = signals.filter((s) => s.timeframe === tf);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Marchés</h1>
          <p className="text-sm text-muted-foreground">
            {analysis?.symbol ?? status?.config?.symbol ?? "—"} · analyse technique en direct du moteur
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card/40 p-1 text-xs">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTf(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                tf === t.key
                  ? "bg-[color:var(--brand-cyan)]/15 text-[color:var(--brand-cyan)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!connected ? (
        <div className="glass-panel rounded-xl p-12 text-center text-sm text-muted-foreground">
          Moteur hors ligne — aucune donnée de marché disponible.
        </div>
      ) : !analysis ? (
        <div className="glass-panel rounded-xl p-12 text-center text-sm text-muted-foreground">
          En attente de la première analyse du moteur (le bot doit être actif).
        </div>
      ) : (
        <>
          {/* Price stats bar */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Prix</span>
              <div className="font-bold text-foreground text-lg font-mono">{analysis.price.toFixed(2)}</div>
            </div>
            {priceChange !== null && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider">Variation (session)</span>
                <div className={cn("font-semibold", priceChange >= 0 ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]")}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </div>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Tendance globale</span>
              <div className={cn(
                "font-semibold",
                analysis.global_trend === "BUY" ? "text-[color:var(--bull)]" : analysis.global_trend === "SELL" ? "text-[color:var(--bear)]" : "text-muted-foreground"
              )}>
                {analysis.global_trend} ({analysis.trend_alignment}/3 MTF)
              </div>
            </div>
            {indicators && (
              <>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Support</span>
                  <div className="font-medium font-mono">{indicators.support.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Résistance</span>
                  <div className="font-medium font-mono">{indicators.resistance.toFixed(2)}</div>
                </div>
              </>
            )}
          </div>

          {/* Price chart (échantillons réels accumulés) */}
          <div className="glass-panel rounded-xl p-4">
            <h2 className="text-base font-semibold mb-3">Prix en direct</h2>
            <div className="h-[320px]">
              {priceData.length < 2 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">En attente de données réelles...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="marchesPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-cyan)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="x" hide />
                    <YAxis domain={["auto", "auto"]} stroke="oklch(0.7 0.03 255 / 0.5)" fontSize={11} width={70} tickFormatter={(v) => v.toFixed(2)} />
                    <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [Number(v).toFixed(2), "Prix"]} />
                    <Area type="monotone" dataKey="price" stroke="var(--brand-cyan)" strokeWidth={1.6} fill="url(#marchesPriceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Indicators for selected timeframe */}
          {indicators && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold">RSI (14) — {tf}</h3>
                  <span className={cn(
                    "text-xs font-semibold rounded-md px-2 py-0.5",
                    indicators.rsi > 70
                      ? "bg-[color:var(--bear)]/10 text-[color:var(--bear)]"
                      : indicators.rsi < 30
                        ? "bg-[color:var(--bull)]/10 text-[color:var(--bull)]"
                        : "bg-muted/40 text-muted-foreground"
                  )}>
                    {indicators.rsi.toFixed(1)}
                    {indicators.rsi > 70 ? " Suracheté" : indicators.rsi < 30 ? " Survendu" : ""}
                  </span>
                </div>
                <div className="h-40">
                  {rsiData.length < 2 ? (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">En attente de données réelles...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rsiData}>
                        <XAxis dataKey="x" hide />
                        <YAxis domain={[0, 100]} stroke="oklch(0.7 0.03 255 / 0.5)" fontSize={11} width={40} ticks={[0, 30, 50, 70, 100]} />
                        <Tooltip contentStyle={CHART_STYLE} />
                        <Area type="monotone" dataKey="rsi" stroke="var(--brand-cyan)" strokeWidth={1.5} fill="none" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Autres indicateurs — {tf}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">EMA rapide / lente</span>
                    <div className="font-mono font-medium">{indicators.ema_fast.toFixed(2)} / {indicators.ema_slow.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">MACD histogram</span>
                    <div className={cn("font-mono font-medium", indicators.macd_histogram >= 0 ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]")}>
                      {indicators.macd_histogram.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">ATR</span>
                    <div className="font-mono font-medium">{indicators.atr.toFixed(4)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Volatilité</span>
                    <div className="font-mono font-medium">{indicators.volatility_pct.toFixed(2)}%</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Tendance ({tf})</span>
                    <div className={cn(
                      "font-semibold",
                      indicators.trend === "BUY" ? "text-[color:var(--bull)]" : indicators.trend === "SELL" ? "text-[color:var(--bear)]" : "text-muted-foreground"
                    )}>
                      {indicators.trend}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signals for selected timeframe */}
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Signaux détectés — {tf}</h3>
            {tfSignals.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">Aucun signal sur cette timeframe</div>
            ) : (
              <div className="space-y-2">
                {tfSignals.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded font-bold uppercase",
                        s.direction === "BUY" ? "bg-[color:var(--bull)]/15 text-[color:var(--bull)]" : "bg-[color:var(--bear)]/15 text-[color:var(--bear)]"
                      )}>
                        {s.direction}
                      </span>
                      <span className="text-foreground">{s.type.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-muted-foreground">{s.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
