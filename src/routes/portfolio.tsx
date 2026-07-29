import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Briefcase, TrendingUp, TrendingDown, Wallet, PieChart,
  Loader2, Activity,
} from "lucide-react";
import { useEngine } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — Au Pluriel" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { status, connected } = useEngine();

  const account = status?.account;
  const risk = status?.risk;
  const positions = status?.positions ?? [];
  const config = status?.config;

  const balance = account?.balance ?? 0;
  const equity = account?.equity ?? balance;
  const margin = account?.margin ?? 0;
  const freeMargin = account?.margin_free ?? equity - margin;
  const dailyPnl = risk?.daily_pnl ?? 0;
  const isLive = config?.is_live ?? false;

  const totalProfit = positions.reduce((s, p) => s + p.profit, 0);
  const totalVolume = positions.reduce((s, p) => s + p.volume, 0);

  const byDirection = useMemo(() => {
    const buys = positions.filter(p => p.direction === "BUY");
    const sells = positions.filter(p => p.direction === "SELL");
    return { buys: buys.length, sells: sells.length };
  }, [positions]);

  const exposure = totalVolume > 0 && balance > 0 ? (totalVolume / balance) * 100 : 0;
  const maxPositions = config?.max_positions ?? 3;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />
        <div className="flex items-center gap-4 flex-1 relative z-10">
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Portfolio</h2>
            <p className="text-sm text-muted-foreground mt-1">Vue consolidée des positions et exposition</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <span className={cn(
            "rounded-full text-xs font-bold tracking-wider px-3.5 py-1.5 border flex items-center gap-2 uppercase",
            connected ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"
          )}>
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-success" : "bg-destructive")} />
            {connected ? "Connecté" : "Hors ligne"}
          </span>
          <span className={cn(
            "rounded-full text-xs font-bold tracking-wider px-3.5 py-1.5 border uppercase",
            isLive ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-success/15 text-success border-success/30"
          )}>
            {isLive ? "LIVE" : "DEMO"}
          </span>
        </div>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Connexion à l'engine en cours...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PortfolioStat icon={Wallet} label="Balance" value={`$${balance.toFixed(2)}`} />
            <PortfolioStat icon={Activity} label="Equity" value={`$${equity.toFixed(2)}`} />
            <PortfolioStat icon={PieChart} label="Marge Libre" value={`$${freeMargin.toFixed(2)}`} />
            <PortfolioStat icon={dailyPnl >= 0 ? TrendingUp : TrendingDown} label="P&L Journalier" value={`${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)}`} isWin={dailyPnl >= 0} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Positions Ouvertes</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/40 bg-background/50 p-3 text-center">
                  <p className="text-2xl font-black text-foreground">{positions.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Total</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
                  <p className="text-2xl font-black text-success">{byDirection.buys}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Achat</p>
                </div>
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
                  <p className="text-2xl font-black text-destructive">{byDirection.sells}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Vente</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">P&L latent total</span>
                <span className={cn("font-bold font-mono", totalProfit >= 0 ? "text-success" : "text-destructive")}>
                  {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Exposition</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Volume total</span>
                    <span className="font-mono font-bold text-foreground">{totalVolume.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.min(exposure, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Marge utilisée</span>
                    <span className="font-mono font-bold text-foreground">${margin.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-amber-500/60 rounded-full transition-all" style={{ width: `${balance > 0 ? Math.min((margin / balance) * 100, 100) : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Limite positions</span>
                    <span className="font-mono font-bold text-foreground">{positions.length} / {maxPositions}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-cyan-500/60 rounded-full transition-all" style={{ width: `${maxPositions > 0 ? (positions.length / maxPositions) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Indicateurs de Risque</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <RiskIndicator label="Kill Switch" value={risk?.kill_switch ? "ACTIVÉ" : "Inactif"} danger={risk?.kill_switch} />
              <RiskIndicator label="Trading Halted" value={risk?.trading_halted ? "SUSPENDU" : "Actif"} danger={risk?.trading_halted} />
              <RiskIndicator label="Pertes Consécutives" value={`${risk?.consecutive_losses ?? 0} / ${risk?.max_consecutive_losses ?? 3}`} danger={(risk?.consecutive_losses ?? 0) >= (risk?.max_consecutive_losses ?? 3)} />
              <RiskIndicator label="Perte Journalière" value={`$${Math.abs(risk?.daily_loss ?? 0).toFixed(2)} / $${risk?.daily_loss_limit ?? 0}`} danger={Math.abs(risk?.daily_loss ?? 0) >= (risk?.daily_loss_limit ?? 1)} />
            </div>
          </div>

          {positions.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Détail des Positions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/50 uppercase tracking-wider text-[10px]">
                      <th className="text-left py-3 px-3 font-bold">Ticket</th>
                      <th className="text-left py-3 px-3 font-bold">Direction</th>
                      <th className="text-right py-3 px-3 font-bold">Volume</th>
                      <th className="text-right py-3 px-3 font-bold">Entrée</th>
                      <th className="text-right py-3 px-3 font-bold">Actuel</th>
                      <th className="text-right py-3 px-3 font-bold">SL</th>
                      <th className="text-right py-3 px-3 font-bold">TP</th>
                      <th className="text-right py-3 px-3 font-bold">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.ticket} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-mono text-muted-foreground">#{p.ticket}</td>
                        <td className="py-3 px-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            p.direction === "BUY" ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"
                          )}>{p.direction}</span>
                        </td>
                        <td className="text-right py-3 px-3 font-mono">{p.volume.toFixed(2)}</td>
                        <td className="text-right py-3 px-3 font-mono">{p.entry.toFixed(2)}</td>
                        <td className="text-right py-3 px-3 font-mono">{p.current.toFixed(2)}</td>
                        <td className="text-right py-3 px-3 font-mono text-destructive/70">{p.sl.toFixed(2)}</td>
                        <td className="text-right py-3 px-3 font-mono text-success/70">{p.tp.toFixed(2)}</td>
                        <td className={cn("text-right py-3 px-3 font-mono font-black", p.profit >= 0 ? "text-success" : "text-destructive")}>
                          {p.profit >= 0 ? "+" : ""}${p.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PortfolioStat({ icon: Icon, label, value, isWin }: { icon: React.ElementType; label: string; value: string; isWin?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isWin === true ? "text-success" : isWin === false ? "text-destructive" : "text-primary")} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-lg font-black font-mono", isWin === true ? "text-success" : isWin === false ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}

function RiskIndicator({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3 space-y-1", danger ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-background/50")}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className={cn("text-sm font-bold", danger ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}
