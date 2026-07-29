import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Brain, Briefcase, CalendarDays,
  Clock, Cpu, Flame, Layers, LineChart,
  Power, Radar, Shield, ShieldAlert, ShieldCheck, Signal,
  Sparkles, Target, Timer, TrendingUp, Trophy, Wallet, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEngine } from "@/hooks/use-engine";
import { useRollingSeries } from "@/hooks/use-rolling-series";
import { logsToTrades } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ia-trading")({
  head: () => ({ meta: [{ title: "IA Trading — Au Pluriel" }] }),
  component: AutoTraderPage,
});

// ── Web Audio Synthesizer ──
let sharedAudioCtx: AudioContext | null = null;

function initAudio() {
  if (sharedAudioCtx) return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const activeCtx = new Ctx() as AudioContext;
    sharedAudioCtx = activeCtx;
    const buffer = activeCtx.createBuffer(1, 1, 22050);
    const node = activeCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(activeCtx.destination);
    node.start(0);
  } catch (e) {
    console.error("Audio initialization failed:", e);
  }
}

if (typeof window !== "undefined") {
  const resumeAudio = () => {
    initAudio();
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().then(() => {
        window.removeEventListener("click", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
        window.removeEventListener("touchstart", resumeAudio);
      });
    }
  };
  window.addEventListener("click", resumeAudio);
  window.addEventListener("keydown", resumeAudio);
  window.addEventListener("touchstart", resumeAudio);
}

function playWinSound() {
  try {
    initAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const notes = [
      { freq: 523.25, delay: 0, dur: 0.4 },
      { freq: 659.25, delay: 0.08, dur: 0.4 },
      { freq: 783.99, delay: 0.16, dur: 0.4 },
      { freq: 1046.50, delay: 0.24, dur: 0.6 },
    ];
    notes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  } catch {}
}

function playLossSound() {
  try {
    initAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const notes = [
      { freq: 392.00, delay: 0, dur: 0.3 },
      { freq: 329.63, delay: 0.1, dur: 0.3 },
      { freq: 261.63, delay: 0.2, dur: 0.5 },
    ];
    notes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  } catch {}
}

function playOpenSound() {
  try {
    initAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const notes = [
      { freq: 880.00, delay: 0, dur: 0.15 },
      { freq: 1318.51, delay: 0.05, dur: 0.25 }
    ];
    notes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  } catch {}
}

type MobileTab = "control" | "dashboard" | "journal";

function AutoTraderPage() {
  const { status, logs, connected, apiCall, latencyMs } = useEngine();
  const [mobileTab, setMobileTab] = useState<MobileTab>("control");
  const [logFilter, setLogFilter] = useState<"all" | "won" | "lost" | "open" | "error">("all");

  // Force Trade state — BUY/SELL réel sur l'instrument configuré du moteur
  const [forceDir, setForceDir] = useState<"BUY" | "SELL">("BUY");
  const [forceRiskPct, setForceRiskPct] = useState<number | null>(null);
  const [forcingTrade, setForcingTrade] = useState(false);

  const account = status?.account;
  const risk = status?.risk;
  const config = status?.config;
  const analysis = status?.last_analysis;
  const decision = status?.last_decision;
  const positions = status?.positions ?? [];
  const isRunning = status?.running ?? false;
  const isLive = connected && status ? !status.sim_mode : false;
  const killSwitch = risk?.kill_switch ?? false;
  const isHalted = risk?.trading_halted ?? false;

  const trades = useMemo(() => logsToTrades(logs), [logs]);
  const priceSeries = useRollingSeries(analysis?.price, 30);
  const equitySeries = useRollingSeries(account?.equity, 30);
  const todayStr = new Date().toDateString();
  const tradesToday = trades.filter((t) => new Date(t.timestamp * 1000).toDateString() === todayStr).length;
  const dailyLossPct = risk?.daily_loss_limit ? Math.min(100, (Math.abs(risk.daily_loss) / risk.daily_loss_limit) * 100) : 0;
  const adaptive = status?.adaptive;
  const calendar = status?.calendar;
  const regime = status?.regime;
  const floatingPnl = positions.reduce((s, p) => s + p.profit, 0);
  const recentTrades = trades.slice(0, 10);
  const streak = useMemo(() => {
    if (trades.length === 0) return { count: 0, win: true };
    const first = trades[0].result;
    let count = 0;
    for (const t of trades) {
      if (t.result !== first) break;
      count++;
    }
    return { count, win: first === "win" };
  }, [trades]);

  const toggleEngine = async () => {
    if (isRunning) {
      await apiCall("stop");
      toast.info("Auto-trader mis en pause");
    } else {
      await apiCall("start");
      playOpenSound();
      toast.success("Auto-trader démarré avec succès !");
    }
  };

  const executeForceTrade = async () => {
    if (isLive) {
      if (!confirm(`CONFIRMER LE TRADE FORCÉ ${forceDir} EN RÉEL SUR ${config?.symbol ?? "Boom 1000 Index"} ?`)) return;
    }
    setForcingTrade(true);
    playOpenSound();
    const result = await apiCall("force-trade", "POST", {
      direction: forceDir,
      ...(forceRiskPct !== null ? { risk_pct: forceRiskPct } : {}),
    });
    setForcingTrade(false);
    if (result?.success) {
      playWinSound();
      toast.success(`Trade ${forceDir} exécuté — ticket ${result.ticket}, volume ${result.volume}`);
    } else {
      playLossSound();
      toast.error(`Trade forcé refusé — ${result?.reason ?? "moteur injoignable"}`);
    }
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    if (logFilter === "won") return logs.filter((l) => l.category === "execution" && l.message.toLowerCase().includes("win"));
    if (logFilter === "lost") return logs.filter((l) => l.category === "execution" && l.message.toLowerCase().includes("loss"));
    if (logFilter === "open") return logs.filter((l) => l.message.toLowerCase().includes("exécuté") && l.category !== "execution");
    if (logFilter === "error") return logs.filter((l) => l.level === "ERROR");
    return logs;
  }, [logs, logFilter]);

  const pipeline = useMemo(() => {
    return [
      {
        label: "Marché",
        icon: Radar,
        status: connected ? "Connecté" : "Hors ligne",
        active: connected,
        ok: connected,
        activeStyle: "bg-blue-500/10 border-blue-500/30 text-blue-400",
        inactiveStyle: "bg-blue-500/5 border-border/40 text-muted-foreground opacity-70",
      },
      {
        label: "Analyse",
        icon: Brain,
        status: analysis ? `${analysis.trend_alignment}/3 MTF` : "Attente",
        active: isRunning,
        ok: !!analysis,
        activeStyle: "bg-purple-500/10 border-purple-500/30 text-purple-400",
        inactiveStyle: "bg-purple-500/5 border-border/40 text-muted-foreground opacity-70",
      },
      {
        label: "Risque",
        icon: Shield,
        status: isHalted ? "Halté" : "Vérifié",
        active: isRunning,
        ok: !isHalted,
        // Green when verified, Bordeaux when halted/alert!
        activeStyle: isHalted ? "bg-[#881337]/30 border-[#9f1239]/50 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        inactiveStyle: "bg-emerald-500/5 border-border/40 text-muted-foreground opacity-70",
      },
      {
        label: "Décision",
        icon: Cpu,
        status: decision ? `${decision.direction} (${decision.confidence}%)` : "Attente",
        active: isRunning,
        ok: !!decision,
        activeStyle: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        inactiveStyle: "bg-amber-500/5 border-border/40 text-muted-foreground opacity-70",
      },
      {
        label: "Exécution",
        icon: Zap,
        status: isRunning ? "Prêt" : "Inactif",
        active: isRunning,
        ok: isRunning,
        activeStyle: "bg-orange-500/10 border-orange-500/30 text-orange-400",
        inactiveStyle: "bg-orange-500/5 border-border/40 text-muted-foreground opacity-70",
      },
    ];
  }, [connected, isRunning, analysis, decision, isHalted]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">

      {/* ── HERO HEADER ── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 shrink-0">
              <Cpu className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-foreground">Centre de Contrôle IA</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Algorithme multi-indicateurs · 4 timeframes · Patterns japonais
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 relative z-10">
            <Link to="/strategies">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-success/40 text-success hover:bg-success/10 h-9 px-3.5 font-bold rounded-xl"
              >
                <ShieldCheck className="h-4 w-4" /> Réglages de risque
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── RISK ALERTS WITH BORDEAUX BURGUNDY TINT ── */}
      {killSwitch && (
        <div className="rounded-2xl border border-[#9f1239]/60 bg-[#881337]/25 p-4 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(136,19,55,0.25)]">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldAlert className="h-5 w-5 text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-200 truncate">Kill Switch Actif (Sécurité Moteur)</div>
              <p className="text-[11px] sm:text-xs text-rose-300/80 truncate">Trading automatique verrouillé par le contrôle des limites.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => apiCall("resume")}
            className="bg-[#9f1239] text-rose-100 hover:bg-[#881337] text-xs font-bold rounded-xl shrink-0 border border-rose-500/40"
          >
            Réinitialiser
          </Button>
        </div>
      )}

      {/* ── MOBILE TAB NAVIGATION ── */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/10 p-1.5 md:hidden">
        {([
          { id: "control", label: "Contrôle", icon: Power },
          { id: "dashboard", label: "Dashboard", icon: Activity },
          { id: "journal", label: "Journal", icon: Clock },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = mobileTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMobileTab(t.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wide transition-all",
                active ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── MAIN LAYOUT GRID ── */}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">

        {/* ── LEFT CONTROL PANEL ── */}
        <div className={cn(mobileTab === "control" ? "block" : "hidden", "md:block space-y-4")}>

          {/* Connexion réelle & Power Button */}
          <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {account?.server ?? "Non connecté"}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                status?.sim_mode
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-success/15 text-success border-success/30"
              )}>
                {status?.sim_mode ? "🧪 Simulation" : "MT5 réel"}
              </span>
            </div>
            <p className="px-4 pt-2 text-[10px] text-muted-foreground leading-relaxed">
              Déterminé par les identifiants MT5 configurés sur le moteur (engine/.env) — non modifiable depuis l'interface.
            </p>

            <div className="p-6 flex flex-col items-center gap-5">
              <div className="relative w-32 h-32">
                {isRunning && <span className="absolute inset-0 rounded-full animate-ping bg-success opacity-20" />}
                <button
                  onClick={toggleEngine}
                  className={cn(
                    "relative w-full h-full rounded-full flex items-center justify-center transition-all duration-300 group border",
                    isRunning
                      ? "bg-success/15 border-success/40 text-success shadow-[0_0_40px_rgba(34,197,94,0.3)]"
                      : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20",
                  )}
                >
                  <Power className="h-12 w-12 transition-transform duration-200 group-hover:scale-110" />
                </button>
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-2.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Statut</span>
                  <span className={cn("text-xs sm:text-sm font-bold flex items-center gap-1.5", isRunning ? "text-success" : "text-muted-foreground")}>
                    <span className={cn("h-2 w-2 rounded-full", isRunning ? "bg-success pulse-dot" : "bg-muted-foreground/40")} />
                    {isRunning ? "● Actif" : "○ En pause"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-2.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Mode IA</span>
                  <span className="text-xs sm:text-sm font-bold text-primary capitalize">{config?.ia_mode ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-2.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Engine WS</span>
                  <span className={cn("text-xs sm:text-sm font-bold", connected ? "text-success" : "text-destructive")}>
                    {connected ? "Connecté" : "Hors ligne"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade manuel — BUY/SELL réel sur l'instrument configuré */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Trade manuel — {config?.symbol ?? "Boom 1000 Index"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForceDir("BUY")}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  forceDir === "BUY" ? "bg-success/15 text-success border-success/40" : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                ▲ Buy
              </button>
              <button
                onClick={() => setForceDir("SELL")}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  forceDir === "SELL" ? "bg-[#881337]/30 text-rose-300 border-[#9f1239]/50" : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                ▼ Sell
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Risque ({forceRiskPct ?? config?.risk_per_trade_pct ?? 0.25}%)
              </span>
              <input
                type="range" min="0.1" max="2" step="0.1"
                value={forceRiskPct ?? config?.risk_per_trade_pct ?? 0.25}
                onChange={(e) => setForceRiskPct(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </label>
            <Button
              onClick={executeForceTrade}
              disabled={forcingTrade || !connected || killSwitch}
              className="w-full text-xs font-bold rounded-xl"
            >
              {forcingTrade ? "Envoi..." : `Envoyer ${forceDir}`}
            </Button>
          </div>

          {/* Account summary */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compte</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Solde</span>
                <span className="text-sm font-mono font-black text-foreground">
                  {account?.balance !== undefined ? `$${account.balance.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">P&L du jour</span>
                <span className={cn("text-sm font-mono font-bold", (risk?.daily_pnl ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                  {risk?.daily_pnl !== undefined ? `${risk.daily_pnl >= 0 ? "+" : ""}$${risk.daily_pnl.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Trades aujourd'hui</span>
                <span className="text-sm font-bold text-foreground">{tradesToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Symbole actif</span>
                <span className="text-xs font-mono font-bold text-primary">{config?.symbol ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Risk meter */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Niveau de risque</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Perte du jour utilisée</span>
                <span className="font-bold text-success">{dailyLossPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", dailyLossPct > 75 ? "bg-destructive" : dailyLossPct > 50 ? "bg-amber-400" : "bg-success")} style={{ width: `${Math.min(100, dailyLossPct)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="rounded-lg bg-success/10 border border-success/20 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Max/trade</div>
                  <div className="text-xs font-bold text-success">{risk?.risk_amount !== undefined ? `$${risk.risk_amount.toFixed(2)}` : "—"}</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Limite/jour</div>
                  <div className="text-xs font-bold text-amber-400">{risk?.daily_loss_limit !== undefined ? `$${risk.daily_loss_limit.toFixed(2)}` : "—"}</div>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/30 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pertes conséc.</div>
                  <div className="text-xs font-bold text-foreground">{risk?.consecutive_losses ?? 0}/{risk?.max_consecutive_losses ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Latence moteur */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latence moteur</span>
              </div>
              <span className={cn("text-xs font-mono font-bold", connected ? "text-success" : "text-destructive")}>
                {connected ? "● Online" : "● Offline"}
              </span>
            </div>
            <LatencyIndicator connected={connected} latencyMs={latencyMs} />
          </div>

        </div>

        {/* ── RIGHT MAIN DASHBOARD CONTENT ── */}
        <div className={cn(mobileTab === "dashboard" || mobileTab === "journal" ? "block" : "hidden", "md:block space-y-5 min-w-0")}>

          {/* ── PIPELINE STAGES ── */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline d'analyse & exécution</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {pipeline.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div key={idx} className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all shadow-sm",
                    p.ok ? p.activeStyle : p.inactiveStyle
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">{p.label}</span>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-black truncate">{p.status}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ROW 1: Sparkline + Equity Curve + Countdown ── */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* Sparkline price chart */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix en direct</span>
                </div>
                <span className="text-xs font-mono font-bold text-foreground">
                  {analysis?.price ? analysis.price.toFixed(2) : "—"}
                </span>
              </div>
              <Sparkline points={priceSeries} />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{priceSeries.length} échantillons</span>
                {priceSeries.length >= 2 && (
                  <span className={cn("flex items-center gap-1 font-bold", priceSeries[priceSeries.length - 1] >= priceSeries[0] ? "text-success" : "text-destructive")}>
                    <TrendingUp className="h-3 w-3" />
                    {(((priceSeries[priceSeries.length - 1] - priceSeries[0]) / priceSeries[0]) * 100).toFixed(2)}%
                  </span>
                )}
                <span>maintenant</span>
              </div>
            </div>

            {/* Equity curve */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-success" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Courbe d'équité</span>
                </div>
                <span className="text-xs font-mono font-bold text-success">
                  {account?.equity !== undefined ? `$${account.equity.toFixed(2)}` : "—"}
                </span>
              </div>
              <EquityCurve points={equitySeries} />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{equitySeries.length} échantillons</span>
                {equitySeries.length >= 2 && (
                  <span className={cn("font-bold", equitySeries[equitySeries.length - 1] >= equitySeries[0] ? "text-success" : "text-destructive")}>
                    {(((equitySeries[equitySeries.length - 1] - equitySeries[0]) / equitySeries[0]) * 100).toFixed(2)}%
                  </span>
                )}
                <span>maintenant</span>
              </div>
            </div>

            {/* Next analysis countdown */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prochaine actualisation</span>
                </div>
              </div>
              <CountdownTimer statusTick={status?.cycle ?? 0} />
            </div>

          </div>

          {/* ── ROW 2: Analysis (with sentiment) + Decision (with gauge) ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            
            {/* Analysis card with sentiment integrated */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Analyse Technique En Direct</h3>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  {analysis?.symbol ?? "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prix Actuel</div>
                  <div className="text-xl font-mono font-black text-foreground mt-1">
                    {analysis?.price ? analysis.price.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tendance Globale</div>
                  <div className={cn("text-xl font-bold mt-1", analysis?.global_trend === "BUY" ? "text-success" : analysis?.global_trend === "SELL" ? "text-destructive" : "text-warning")}>
                    {analysis?.global_trend ?? "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Alignement des Timeframes:</span>
                  <span className="font-bold text-foreground">{analysis?.trend_alignment ?? 0}/3 MTF</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${((analysis?.trend_alignment ?? 0) / 3) * 100}%` }} />
                </div>
              </div>

              {/* Sentiment integrated */}
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sentiment marché</span>
                </div>
                <SentimentBar trend={analysis?.global_trend ?? "NEUTRAL"} alignment={analysis?.trend_alignment ?? 0} />
              </div>
            </div>

            {/* Decision card with circular gauge integrated */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-success" />
                  <h3 className="text-sm font-bold text-foreground">Dernière Décision IA</h3>
                </div>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                  decision?.action === "BUY" ? "bg-success/15 text-success border-success/30" : "bg-muted/20 text-muted-foreground border-border/40"
                )}>
                  {decision?.action ?? "—"}
                </span>
              </div>

              <div className="flex items-center gap-5">
                <ConfidenceGauge value={decision?.confidence ?? 0} />
                <div className="flex-1 space-y-3">
                  <div className="rounded-xl border border-border/40 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground">Justification: </span>
                    {decision?.reason ?? "Aucune décision récente."}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── ROW 3: Positions + Stats (with timeline) ── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Open positions + floating P&L */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Positions ouvertes</span>
                </div>
                <span className="text-xs font-bold text-foreground">{positions.length} active{positions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {positions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">Aucune position ouverte</div>
                ) : positions.map((p) => (
                  <div key={p.ticket} className="flex items-center justify-between rounded-xl bg-background/40 border border-border/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded", p.direction === "BUY" ? "bg-success/20 text-success" : "bg-[#881337]/30 text-rose-300")}>
                        {p.direction === "BUY" ? "▲" : "▼"} {p.direction}
                      </span>
                      <span className="text-xs font-semibold text-foreground">#{p.ticket} · {p.volume} lot</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono">{p.entry.toFixed(2)}</span>
                      <span className={cn("text-xs font-mono font-bold", p.profit >= 0 ? "text-success" : "text-destructive")}>
                        {p.profit >= 0 ? "+" : ""}{p.profit.toFixed(2)}$
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground">P&L flottant</span>
                <span className={cn("text-sm font-mono font-black", floatingPnl >= 0 ? "text-success" : "text-destructive")}>
                  {floatingPnl >= 0 ? "+" : ""}{floatingPnl.toFixed(2)}$
                </span>
              </div>
            </div>

            {/* Session stats with timeline integrated */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stats cumulées (apprentissage adaptatif)</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-success">{adaptive?.total_wins ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Gagnés</div>
                </div>
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-destructive">{(adaptive?.total_trades ?? 0) - (adaptive?.total_wins ?? 0)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Perdus</div>
                </div>
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-foreground">{(adaptive?.win_rate ?? 0).toFixed(0)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Win rate</div>
                </div>
              </div>
              <div className={cn("flex items-center justify-between rounded-xl px-3 py-2 border", streak.count > 0 ? (streak.win ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20") : "bg-muted/10 border-border/30")}>
                <span className={cn("text-xs font-bold flex items-center gap-1.5", streak.win ? "text-success" : "text-destructive")}>
                  <Flame className="h-3.5 w-3.5" /> Streak actuelle
                </span>
                <span className={cn("text-sm font-black", streak.win ? "text-success" : "text-destructive")}>
                  {streak.count > 0 ? `${streak.count} ${streak.win ? "gains" : "pertes"}` : "—"}
                </span>
              </div>
              {/* Timeline réelle des derniers trades */}
              <div className="border-t border-border/40 pt-2">
                {recentTrades.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground text-center py-2">Aucun trade récent</div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 py-1">
                      {recentTrades.map((t) => (
                        <div key={t.id} className={cn(
                          "h-6 w-2 rounded-full transition-all",
                          t.result === "win" ? "bg-success" : "bg-destructive/60"
                        )} title={`${t.result === "win" ? "Gagné" : "Perdu"} — ${t.time}`} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{recentTrades[0]?.time}</span>
                      <span>récent →</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── FULL WIDTH: Economic Calendar + Heatmap + Logs ── */}
      <div className="space-y-5">

        {/* Economic calendar */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calendrier économique</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {calendar?.upcoming?.length ?? 0} événement{(calendar?.upcoming?.length ?? 0) !== 1 ? "s" : ""} à venir
              {calendar?.should_pause && " · trading en pause"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(calendar?.upcoming?.length ?? 0) === 0 ? (
              <div className="sm:col-span-3 text-xs text-muted-foreground text-center py-4">Aucun événement à haut impact à venir</div>
            ) : calendar!.upcoming.map((e, i) => (
              <div key={i} className={cn(
                "rounded-xl border p-3 space-y-1.5",
                e.impact === "high" ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/10 border-border/40"
              )}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">{e.time}</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded uppercase",
                    e.impact === "high" ? "bg-amber-500/20 text-amber-400" : "bg-muted/30 text-muted-foreground"
                  )}>{e.impact === "high" ? "★★★ Impact" : "★★ Impact"}</span>
                </div>
                <div className="text-xs font-bold text-foreground leading-tight">{e.title}</div>
                <div className="text-[10px] text-muted-foreground">{e.currency}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Régime de marché */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Régime de marché — {config?.symbol ?? "—"}</span>
            </div>
            {regime && <span className="text-xs font-mono font-bold text-primary">{regime.confidence.toFixed(0)}% confiance</span>}
          </div>
          {regime ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border shrink-0",
                regime.regime === "trending" ? "bg-success/15 text-success border-success/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}>
                {regime.regime}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">{regime.description}</p>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">Aucune détection de régime disponible</div>
          )}
        </div>

        {/* Logs Stream */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Journal & Logs Moteur</h3>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/20 p-0.5">
              {(["all", "won", "lost", "open", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg transition-all capitalize",
                    logFilter === f ? "bg-card text-foreground border border-border/40 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="h-60 overflow-y-auto space-y-2 pr-1 font-mono text-xs scrollbar-thin">
            {filteredLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Aucun log disponible pour le moment.
              </div>
            ) : (
              filteredLogs.map((l, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/40 p-2.5">
                  <span className="text-muted-foreground shrink-0 text-[10px]">{l.datetime || "—"}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0",
                      l.level === "ERROR" ? "bg-destructive/20 text-destructive" :
                      l.level === "TRADE" && l.message.toLowerCase().includes("win") ? "bg-success/20 text-success" :
                      l.level === "TRADE" && l.message.toLowerCase().includes("loss") ? "bg-destructive/20 text-destructive" :
                      l.level === "RISK" ? "bg-amber-500/20 text-amber-400" :
                      "bg-muted/30 text-muted-foreground"
                    )}>
                      {l.level}
                    </span>
                    <span className="text-foreground leading-snug flex-1">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

      </div>

    </div>
  );
}

// ── Sparkline: prix réel accumulé au fil des polls du moteur ──
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="w-full h-16 flex items-center justify-center text-[10px] text-muted-foreground">En attente de données réelles...</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const step = width / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-grad)" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── ConfidenceGauge: circular progress ring ──
function ConfidenceGauge({ value }: { value: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "var(--primary)" : value >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="8" opacity="0.3" />
        <circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground">{value.toFixed(0)}%</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">confiance</span>
      </div>
    </div>
  );
}

// ── CountdownTimer: se recale sur chaque vrai poll du moteur (5s) ──
function CountdownTimer({ statusTick }: { statusTick: number }) {
  const POLL_SECONDS = 5;
  const [seconds, setSeconds] = useState(POLL_SECONDS);

  useEffect(() => {
    setSeconds(POLL_SECONDS);
  }, [statusTick]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const pct = ((POLL_SECONDS - seconds) / POLL_SECONDS) * 100;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="6" opacity="0.3" />
          <circle
            cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={2 * Math.PI * 34 - (pct / 100) * 2 * Math.PI * 34}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-mono font-black text-foreground">{seconds}s</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">Cycle #{statusTick}</span>
    </div>
  );
}

// ── SentimentBar: fear/greed thermometer ──
function SentimentBar({ trend, alignment }: { trend: string; alignment: number }) {
  const score = trend === "BUY" ? 65 + alignment * 8 : trend === "SELL" ? 35 - alignment * 5 : 50;
  const label = score >= 75 ? "Avidité extrême" : score >= 55 ? "Optimisme" : score >= 45 ? "Neutre" : score >= 25 ? "Prudence" : "Peur extrême";

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-destructive font-bold">Peur</span>
        <span className="font-black text-foreground">{label}</span>
        <span className="text-success font-bold">Avidité</span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-destructive via-amber-400 to-success overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full shadow-lg transition-all duration-700"
          style={{ left: `calc(${score}% - 2px)` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span className="font-mono font-bold text-foreground">{score}/100</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ── EquityCurve: équité réelle accumulée au fil des polls du moteur ──
function EquityCurve({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="w-full h-16 flex items-center justify-center text-[10px] text-muted-foreground">En attente de données réelles...</div>;
  }
  const min = Math.min(0, ...points);
  const max = Math.max(...points, 1);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const step = width / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="equity-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#equity-grad)" />
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── LatencyIndicator: round-trip réel du dernier fetch /api/status ──
function LatencyIndicator({ connected, latencyMs }: { connected: boolean; latencyMs: number | null }) {
  const ping = latencyMs ?? 0;
  const status = !connected ? "offline" : ping < 200 ? "excellent" : ping < 500 ? "correct" : "lent";
  const color = !connected ? "text-destructive" : ping < 200 ? "text-success" : ping < 500 ? "text-amber-400" : "text-destructive";
  const barColor = !connected ? "bg-destructive" : ping < 200 ? "bg-success" : ping < 500 ? "bg-amber-400" : "bg-destructive";
  const barWidth = !connected ? 100 : Math.min(100, (ping / 500) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ping API moteur</span>
        <span className={cn("text-sm font-mono font-black", color)}>
          {connected && latencyMs !== null ? `${ping}ms` : "—"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0ms</span>
        <span className={cn("font-bold capitalize", color)}>{status}</span>
        <span>500ms+</span>
      </div>
    </div>
  );
}
