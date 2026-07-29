import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  ArrowUpRight, Bot, BriefcaseBusiness,
  Wallet, Zap, TrendingUp, TrendingDown,
  BarChart2, BarChart3, Sparkles, Trophy, ChevronRight, Settings2, CalendarDays,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useEngine } from "@/hooks/use-engine";
import { useRollingSeries } from "@/hooks/use-rolling-series";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Au Pluriel" },
      { name: "description", content: "Dashboard de trading Au Pluriel avec données en temps réel." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { status, connected } = useEngine();
  const { user } = useAuth();

  const account = status?.account;
  const risk = status?.risk;
  const config = status?.config;
  const analysis = status?.last_analysis;
  const adaptive = status?.adaptive;
  const calendar = status?.calendar;
  const isRunning = status?.running ?? false;
  const isLive = connected && status ? !status.sim_mode : false;

  const balance = account?.balance;
  const equity = account?.equity;
  const dailyPnl = risk?.daily_pnl;

  const priceSeries = useRollingSeries(analysis?.price, 40);
  const series = priceSeries.map((price, i) => ({ time: `${priceSeries.length - i}`, price }));

  const lastPrice = priceSeries[priceSeries.length - 1] ?? null;
  const firstPrice = priceSeries[0] ?? null;
  const priceChange = firstPrice ? ((lastPrice! - firstPrice) / firstPrice) * 100 : null;

  const signals = analysis?.signals ?? [];

  const balanceDisplay = balance !== undefined ? balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonne nuit";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* ── HERO USER CARD ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{greeting},</p>
              <h1 className="text-2xl font-black tracking-tight text-foreground leading-tight">
                {user?.username ?? "—"}
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                  connected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/20 text-muted-foreground"
                )}>
                  {!connected ? "Engine hors ligne" : isLive ? "MT5 réel" : "Simulation"}
                </span>
                {connected && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot inline-block" />
                    En direct
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            <Link
              to="/ia-trading"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground bg-primary shadow-[var(--shadow-glow-orange)] transition-all hover:opacity-90 hover:scale-[1.02] sm:py-2.5"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden xs:inline">Auto-Trader</span>
              <span className="xs:hidden">Bot</span>
            </Link>
            <Link
              to="/positions"
              className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/80 px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent sm:py-2.5"
            >
              <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
              Positions
            </Link>
          </div>
        </div>
      </div>

      {/* ── BOT STATUS (mobile only) ── */}
      <BotStatusCard isRunning={isRunning} />

      {/* ── KPI PRINCIPALES ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Solde Deriv"
          value={balanceDisplay ? `$${balanceDisplay}` : "—"}
          delta="USD"
          icon={<Wallet className="h-5 w-5" />}
          tone="amber"
        />
        <KpiCard
          label="P&L Aujourd'hui"
          value={dailyPnl !== undefined ? `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)}` : "—"}
          delta={dailyPnl === undefined ? undefined : dailyPnl >= 0 ? "Journée positive" : "Journée négative"}
          icon={(dailyPnl ?? 0) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          tone={dailyPnl === undefined ? "default" : dailyPnl >= 0 ? "bull" : "bear"}
        />
        <KpiCard
          label="Win Rate"
          value={adaptive ? `${adaptive.win_rate.toFixed(1)}%` : "—"}
          delta={adaptive ? `Sur ${adaptive.total_trades} trades` : undefined}
          icon={<Trophy className="h-5 w-5" />}
          tone="bull"
        />
        <KpiCard
          label="Signaux actifs"
          value={signals.length}
          delta={analysis?.symbol ?? "—"}
          icon={<BarChart2 className="h-5 w-5" />}
          tone="cyan"
        />
      </div>

      {/* ── CHART + SESSIONS ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-start md:justify-between md:p-5 md:pb-0">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{analysis?.symbol ?? config?.symbol ?? "—"}</div>
                <div className="font-mono text-3xl font-black text-foreground leading-none">
                  {lastPrice !== null ? lastPrice.toFixed(2) : "—"}
                </div>
              </div>
              {priceChange !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold border mt-1 self-start",
                  priceChange >= 0
                    ? "text-success bg-success/10 border-success/20"
                    : "text-destructive bg-destructive/10 border-destructive/20",
                )}>
                  {priceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          <div className="h-72 px-2 pb-2 pt-4">
            {series.length < 2 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">En attente de données réelles...</div>
            ) : (
              <PriceChart data={series} />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3">
          <div className="hidden md:block rounded-2xl border border-border/50 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-amber-400" />
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calendrier économique</div>
            </div>
            {(calendar?.upcoming?.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground">Aucun événement à haut impact à venir</div>
            ) : (
              <div className="space-y-3">
                {calendar!.upcoming.slice(0, 3).map((e, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground font-medium">{e.title}</span>
                      <span className={cn("text-xs font-bold", e.impact === "high" ? "text-amber-400" : "text-muted-foreground")}>
                        {e.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { to: "/ia-trading", icon: <Zap />, label: "Auto-Trader", color: "violet" },
              { to: "/positions", icon: <BriefcaseBusiness />, label: "Positions", color: "cyan" },
              { to: "/historique", icon: <BarChart3 />, label: "Historique", color: "up" },
              { to: "/parametres", icon: <Settings2 />, label: "Paramètres", color: "amber" },
            ].map(({ to, icon, label, color }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-border/50 bg-card/60 px-3 py-3 text-sm font-semibold transition-all hover:bg-accent sm:py-2.5 sm:text-xs",
                  color === "violet" && "text-primary border-primary/20 bg-primary/5 hover:bg-primary/10",
                  color === "cyan" && "text-info border-info/20 bg-info/5 hover:bg-info/10",
                  color === "up" && "text-success border-success/20 bg-success/5 hover:bg-success/10",
                  color === "amber" && "text-warning border-warning/20 bg-warning/5 hover:bg-warning/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
                  {label}
                </div>
                <ChevronRight className="h-3 w-3 opacity-40" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIVE SIGNALS ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground sm:text-base">Signaux en direct</h2>
            {signals.length > 0 && (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
            )}
          </div>
          <Link to="/ia-trading" className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
            Voir tout <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {signals.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Aucun signal actif pour le moment
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {signals.map((s, i) => <SignalCard key={i} signal={s} />)}
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3">
        <Bot className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Le trading comporte des risques significatifs. Au Pluriel fournit des analyses algorithmiques, pas des conseils financiers réglementés. Toutes les décisions restent sous contrôle humain.
        </p>
      </div>
    </div>
  );
}

// ── Bot status card (mobile only) ──

function BotStatusCard({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="md:hidden rounded-2xl border border-border/50 bg-card/60 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
          isRunning ? "bg-success/15 border-success/30 text-success" : "bg-muted/15 border-border/40 text-muted-foreground",
        )}>
          <Zap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">Bot Auto-Trader</span>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
              isRunning ? "bg-success/15 text-success border-success/30" : "bg-muted/20 text-muted-foreground border-border/40",
            )}>
              {isRunning ? "Actif" : "En pause"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {isRunning ? "Scanning des marchés en direct" : "En attente de démarrage"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/ia-trading"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
        <Link
          to="/ia-trading"
          className="rounded-xl bg-primary/15 border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/25"
        >
          {isRunning ? "Gérer" : "Démarrer"}
        </Link>
      </div>
    </div>
  );
}

// ── KPI Card ──

type Tone = "default" | "bull" | "bear" | "cyan" | "violet" | "amber" | "deriv";

const TONE_STYLES: Record<Tone, { panel: string; value: string; icon: string }> = {
  default: { panel: "border-border/50 bg-card/60",          value: "text-foreground", icon: "text-muted-foreground" },
  bull:    { panel: "border-success/30 bg-success/10",      value: "text-success", icon: "text-success" },
  bear:    { panel: "border-destructive/30 bg-destructive/10", value: "text-destructive", icon: "text-destructive" },
  cyan:    { panel: "border-info/30 bg-info/10",            value: "text-info", icon: "text-info" },
  violet:  { panel: "border-primary/30 bg-primary/10",      value: "text-primary", icon: "text-primary" },
  amber:   { panel: "border-warning/30 bg-warning/10",      value: "text-warning", icon: "text-warning" },
  deriv:   { panel: "border-destructive/25 bg-destructive/5", value: "text-foreground", icon: "text-destructive" },
};

function KpiCard({ label, value, delta, tone = "default", icon, className }: {
  label: string; value: ReactNode; delta?: string; tone?: Tone; icon?: ReactNode; className?: string;
}) {
  const t = TONE_STYLES[tone] || TONE_STYLES.default;
  return (
    <div className={cn("flex h-full flex-col justify-between rounded-2xl border p-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-200", t.panel, className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
        {icon && <span className={cn("shrink-0 opacity-70 group-hover:opacity-100 transition-opacity [&>svg]:h-4 [&>svg]:w-4", t.icon)}>{icon}</span>}
      </div>
      <div>
        <div className={cn("font-mono text-2xl font-black leading-none tracking-tight", t.value)}>{value}</div>
        {delta && <div className="mt-2 text-xs text-muted-foreground">{delta}</div>}
      </div>
    </div>
  );
}

function PriceChart({ data }: { data: { time: string; price: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
        <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderRadius: "0.75rem",
            color: "var(--foreground)",
            fontSize: "12px",
          }}
          formatter={(value: any) => [Number(value).toFixed(2), "Prix"]}
        />
        <Area type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface RealSignal {
  timeframe: string;
  type: string;
  direction: string;
  value: number;
  description: string;
}

function SignalCard({ signal }: { signal: RealSignal }) {
  const isBuy = signal.direction === "BUY";
  const isSell = signal.direction === "SELL";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3 transition-all hover:border-border">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase">{signal.timeframe}</span>
          <h4 className="text-base font-bold text-foreground">{signal.type.replace(/_/g, " ")}</h4>
        </div>
        <span className={cn(
          "px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border",
          isBuy && "bg-success/15 text-success border-success/30",
          isSell && "bg-destructive/15 text-destructive border-destructive/30",
          !isBuy && !isSell && "bg-muted/20 text-muted-foreground border-border/40"
        )}>
          {signal.direction}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{signal.description}</p>
    </div>
  );
}
