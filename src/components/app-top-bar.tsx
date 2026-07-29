import { useRouterState, Link, useNavigate } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";
import {
  LayoutDashboard, Wallet, Bell, AlertTriangle,
  TrendingUp, TrendingDown, Wifi, WifiOff, Zap,
} from "lucide-react";
import { useEngine } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Tableau de bord", subtitle: "VUE D'ENSEMBLE" },
  "/positions": { title: "Positions", subtitle: "POSITIONS OUVERTES" },
  "/ia-trading": { title: "Auto-Trader", subtitle: "CENTRE DE CONTRÔLE" },
  "/strategies": { title: "Stratégies", subtitle: "MOTEURS QUANTITATIFS" },
  "/backtest": { title: "Backtests", subtitle: "SIMULATION DE STRATÉGIES" },
  "/historique": { title: "Historique", subtitle: "JOURNAL DES TRADES" },
  "/parametres": { title: "Paramètres", subtitle: "PRÉFÉRENCES" },
  "/messagerie": { title: "Messagerie", subtitle: "AU PLURIEL COMMUNITY" },
  "/administration": { title: "Administration", subtitle: "GESTION UTILISATEURS" },
};

export function AppTopBar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { status, connected, apiCall } = useEngine();
  const { open, toggleSidebar } = useSidebar();
  const meta = pageMeta[pathname] ?? pageMeta["/"];

  const balance = status?.account?.balance ?? 1250.50;
  const dailyPnl = status?.risk?.daily_pnl ?? 14.20;
  const isRunning = status?.running ?? false;

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 md:h-20 items-center justify-between gap-3 px-3 sm:px-6">
        
        {/* Left side: Sidebar Toggle & Page Title */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {/* Hamburger 3 traits */}
          <button
            type="button"
            onClick={() => toggleSidebar()}
            className="group flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-xl border border-border/50 bg-card/60 hover:bg-accent hover:border-amber-500/30 transition-colors cursor-pointer"
            title={open ? "Réduire la sidebar" : "Ouvrir la sidebar"}
            aria-label="Toggle Sidebar"
          >
            <span className="h-0.5 w-5 rounded-full bg-foreground/70 group-hover:bg-amber-500 transition-colors" />
            <span className="h-0.5 w-5 rounded-full bg-foreground/70 group-hover:bg-amber-500 transition-colors" />
            <span className="h-0.5 w-5 rounded-full bg-foreground/70 group-hover:bg-amber-500 transition-colors" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="hidden sm:flex h-9 w-9 md:h-11 md:w-11 rounded-xl bg-card border border-border/50 items-center justify-center shrink-0">
              <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-black leading-tight truncate text-foreground">{meta.title}</h1>
              <div className="hidden xs:flex items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground font-semibold tracking-[0.15em] uppercase truncate">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", connected ? "bg-success pulse-dot" : "bg-destructive")} />
                {meta.subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Balance & Status Badges */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Mobile Balance pill */}
          <div className="flex sm:hidden items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-bold font-mono">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span>${balance.toFixed(2)}</span>
          </div>

          {/* Desktop Balance badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-bold font-mono">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-foreground">${balance.toFixed(2)}</span>
            <span className="text-[10px] text-muted-foreground font-sans uppercase">USD</span>
          </div>

          {/* Desktop Daily PnL badge */}
          <div className={cn(
            "hidden md:flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-mono font-bold",
            dailyPnl >= 0 ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
          )}>
            {dailyPnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>{dailyPnl >= 0 ? "+" : ""}${dailyPnl.toFixed(2)}</span>
          </div>

          {/* Connection badge */}
          <div className={cn(
            "hidden lg:flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider",
            connected ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
          )}>
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{connected ? "Deriv Live" : "Hors ligne"}</span>
          </div>
        </div>

      </div>
    </header>
  );
}
