import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, X, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEngine } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/positions")({
  head: () => ({ meta: [{ title: "Positions — Au Pluriel" }] }),
  component: PositionsPage,
});

function PositionsPage() {
  const { status, connected, apiCall } = useEngine();
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);

  const positions = status?.positions ?? [];
  const selected = positions.find(p => p.ticket === selectedTicket);

  const closePosition = (ticket: number) => {
    if (confirm("Fermer cette position ?")) {
      apiCall(`positions/${ticket}/close`, "POST");
    }
  };

  const closeAll = () => {
    if (confirm(`Fermer les ${positions.length} position(s) ?`)) {
      apiCall("close-all", "POST");
    }
  };

  const totalProfit = positions.reduce((acc, p) => acc + p.profit, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Positions Ouvertes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {positions.length} position{positions.length !== 1 ? "s" : ""} active{positions.length !== 1 ? "s" : ""} · P&L flottant :{" "}
              <span className={cn("font-mono font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>
                {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
              </span>
            </p>
          </div>
        </div>

        {positions.length > 0 && (
          <Button
            onClick={closeAll}
            variant="outline"
            className="rounded-xl h-10 border-destructive/40 text-destructive hover:bg-destructive/10 px-4 text-xs font-bold gap-2 relative z-10"
          >
            <X className="h-4 w-4" /> Fermer toutes les positions
          </Button>
        )}
      </div>

      {/* Positions table */}
      {positions.length > 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50 uppercase tracking-wider text-[10px]">
                  <th className="text-left py-3 px-3 font-bold">Ticket</th>
                  <th className="text-left py-3 px-3 font-bold">Marché</th>
                  <th className="text-left py-3 px-3 font-bold">Direction</th>
                  <th className="text-right py-3 px-3 font-bold">Entrée</th>
                  <th className="text-right py-3 px-3 font-bold">Prix actuel</th>
                  <th className="text-right py-3 px-3 font-bold">Volume</th>
                  <th className="text-right py-3 px-3 font-bold">Stop-Loss</th>
                  <th className="text-right py-3 px-3 font-bold">Take-Profit</th>
                  <th className="text-right py-3 px-3 font-bold">Résultat</th>
                  <th className="text-center py-3 px-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.ticket}
                    onClick={() => setSelectedTicket(p.ticket)}
                    className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono text-muted-foreground">#{p.ticket}</td>
                    <td className="py-3 px-3 font-bold text-foreground">{status?.config?.symbol ?? "—"}</td>
                    <td className="py-3 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        p.direction === "BUY" ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"
                      )}>
                        {p.direction}
                      </span>
                    </td>
                    <td className="text-right py-3 px-3 font-mono">{p.entry.toFixed(2)}</td>
                    <td className="text-right py-3 px-3 font-mono font-bold text-foreground">{p.current.toFixed(2)}</td>
                    <td className="text-right py-3 px-3 font-mono">{p.volume.toFixed(2)}</td>
                    <td className="text-right py-3 px-3 font-mono text-destructive">{p.sl ? p.sl.toFixed(2) : "—"}</td>
                    <td className="text-right py-3 px-3 font-mono text-success">{p.tp ? p.tp.toFixed(2) : "—"}</td>
                    <td className={cn("text-right py-3 px-3 font-mono font-black", p.profit >= 0 ? "text-success" : "text-destructive")}>
                      {p.profit >= 0 ? "+" : ""}${p.profit.toFixed(2)}
                    </td>
                    <td className="text-center py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedTicket(p.ticket); }}
                          title="Voir les détails (lecture seule)"
                          className="h-8 w-8 rounded-lg border border-border/50 hover:bg-accent flex items-center justify-center transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); closePosition(p.ticket); }}
                          className="h-8 w-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/15 flex items-center justify-center transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Aucune position ouverte actuellement.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {connected ? "L'Auto-Trader surveille les marchés et ouvrira des ordres selon vos critères." : "Le moteur Python est actuellement hors ligne."}
          </p>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Détail du Ticket #{selected.ticket}</h3>
            </div>
            <button onClick={() => setSelectedTicket(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-border/40 bg-background/50 p-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Prix Entrée</span>
              <p className="font-mono text-base font-bold text-foreground mt-0.5">{selected.entry.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/50 p-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Prix Actuel</span>
              <p className="font-mono text-base font-bold text-foreground mt-0.5">{selected.current.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/50 p-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Stop Loss</span>
              <p className="font-mono text-base font-bold text-destructive mt-0.5">{selected.sl ? selected.sl.toFixed(2) : "Non défini"}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/50 p-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Take Profit</span>
              <p className="font-mono text-base font-bold text-success mt-0.5">{selected.tp ? selected.tp.toFixed(2) : "Non défini"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
