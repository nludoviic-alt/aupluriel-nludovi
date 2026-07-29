import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  History, Filter, TrendingUp, TrendingDown,
  Clock, Target, Cpu, Download, ArrowUpRight, ArrowDownRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEngine } from "@/hooks/use-engine";
import { logsToTrades, type TradeRecord } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historique")({
  head: () => ({ meta: [{ title: "Historique — Au Pluriel" }] }),
  component: HistoriquePage,
});

function tradesToCsv(trades: TradeRecord[]): string {
  const header = ["Horodatage", "Instrument", "Stratégie", "Direction", "Confiance", "Entrée", "Sortie", "P&L", "Résultat"];
  const rows = trades.map((t) => [
    t.time, t.instrument, t.strategy, t.direction,
    t.confidence.toFixed(0), t.entry_price.toFixed(2), t.exit_price.toFixed(2),
    t.pnl.toFixed(2), t.result,
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function HistoriquePage() {
  const { logs, connected } = useEngine();
  const [filters, setFilters] = useState({
    instrument: "all",
    strategy: "all",
    result: "all",
  });
  const [selected, setSelected] = useState<TradeRecord | null>(null);

  const trades = useMemo(() => logsToTrades(logs), [logs]);

  const instruments = useMemo(() => [...new Set(trades.map(t => t.instrument))], [trades]);
  const strategies = useMemo(() => [...new Set(trades.map(t => t.strategy))], [trades]);

  const filtered = trades.filter(t =>
    (filters.instrument === "all" || t.instrument === filters.instrument) &&
    (filters.strategy === "all" || t.strategy === filters.strategy) &&
    (filters.result === "all" || t.result === filters.result)
  );

  const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const wins = filtered.filter(t => t.result === "win").length;
  const winRate = filtered.length > 0 ? (wins / filtered.length * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero + stats */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-5 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Historique des Transactions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Journal complet des exécutions, résultats et justifications d'ordres.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() => downloadCsv(tradesToCsv(filtered), `historique-trades-${Date.now()}.csv`)}
            className="rounded-xl h-10 border-border/50 bg-card/60 text-xs font-bold gap-2 relative z-10"
          >
            <Download className="h-4 w-4" /> Exporter CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <HistStat label="Total Trades" value={`${filtered.length}`} />
          <HistStat label="Win Rate" value={`${winRate.toFixed(1)}%`} isWin={winRate >= 50} />
          <HistStat label="P&L Cumulé" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} isWin={totalPnl >= 0} />
          <HistStat label="Gagnants / Perdants" value={`${wins} W / ${filtered.length - wins} L`} />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <Filter className="h-4 w-4 text-primary shrink-0" />
          <select value={filters.instrument} onChange={e => setFilters(s => ({ ...s, instrument: e.target.value }))}
            className="h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-semibold text-foreground">
            <option value="all">Tous instruments</option>
            {instruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
          </select>
          <select value={filters.strategy} onChange={e => setFilters(s => ({ ...s, strategy: e.target.value }))}
            className="h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-semibold text-foreground">
            <option value="all">Toutes stratégies</option>
            {strategies.map(strat => <option key={strat} value={strat}>{strat}</option>)}
          </select>
          <select value={filters.result} onChange={e => setFilters(s => ({ ...s, result: e.target.value }))}
            className="h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-semibold text-foreground">
            <option value="all">Tous résultats</option>
            <option value="win">Gagnants</option>
            <option value="loss">Perdants</option>
          </select>
        </div>
      </div>

      {/* Trades table */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {connected ? (
              <>
                <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-semibold">Aucun trade dans l'historique</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Les transactions apparaîtront ici une fois le bot actif.</p>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Connexion à l'engine en cours...</p>
              </>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50 uppercase tracking-wider text-[10px]">
                <th className="text-left py-3 px-3 font-bold">Horodatage</th>
                <th className="text-left py-3 px-3 font-bold">Instrument</th>
                <th className="text-left py-3 px-3 font-bold">Direction</th>
                <th className="text-right py-3 px-3 font-bold">Entrée</th>
                <th className="text-right py-3 px-3 font-bold">Sortie</th>
                <th className="text-right py-3 px-3 font-bold">Confiance</th>
                <th className="text-right py-3 px-3 font-bold">Profit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-muted-foreground">{t.time}</td>
                  <td className="py-3 px-3 font-bold text-foreground">{t.instrument}</td>
                  <td className="py-3 px-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      t.direction === "BUY" ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"
                    )}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 font-mono">{t.entry_price.toFixed(2)}</td>
                  <td className="text-right py-3 px-3 font-mono">{t.exit_price.toFixed(2)}</td>
                  <td className="text-right py-3 px-3 font-mono font-bold text-primary">{t.confidence.toFixed(0)}%</td>
                  <td className={cn("text-right py-3 px-3 font-mono font-black", t.pnl >= 0 ? "text-success" : "text-destructive")}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function HistStat({ label, value, isWin }: { label: string; value: string; isWin?: boolean }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className={cn("text-base font-bold mt-0.5", isWin === true ? "text-success" : isWin === false ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
