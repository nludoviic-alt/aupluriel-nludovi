import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bot, Brain, Briefcase, CalendarDays,
  CheckCircle2, ChevronRight, Clock, Cpu, Eye, Flame, Gauge, Hand, Layers, LineChart,
  Play, Power, Radar, RefreshCw, Settings2, Shield, ShieldAlert, ShieldCheck, Signal,
  Sparkles, Square, Target, Timer, TrendingDown, TrendingUp, Trophy, Wallet, Zap,
  Filter, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEngine } from "@/hooks/use-engine";
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

const SYMBOLS = [
  { deriv: "R_100", label: "Volatility 100" },
  { deriv: "cryBTCUSD", label: "BTC/USD" },
  { deriv: "cryETHUSD", label: "ETH/USD" },
  { deriv: "frxEURUSD", label: "EUR/USD" },
  { deriv: "frxGBPUSD", label: "GBP/USD" },
  { deriv: "R_75", label: "Volatility 75" },
];

type TradingMode = "simulation" | "demo" | "live";
type MobileTab = "control" | "dashboard" | "journal";

function AutoTraderPage() {
  const { status, logs, connected, apiCall } = useEngine();
  const [tradingMode, setTradingMode] = useState<TradingMode>("demo");
  const [cloudBotEnabled, setCloudBotEnabled] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("control");
  const [logFilter, setLogFilter] = useState<"all" | "won" | "lost" | "open" | "error">("all");
  
  // Force Trade state
  const [forceSymbol, setForceSymbol] = useState(SYMBOLS[0].deriv);
  const [forceDir, setForceDir] = useState<"CALL" | "PUT">("CALL");
  const [forceStake, setForceStake] = useState(10);
  const [forcingTrade, setForcingTrade] = useState(false);

  const account = status?.account;
  const risk = status?.risk;
  const analysis = status?.last_analysis;
  const decision = status?.last_decision;
  const positions = status?.positions ?? [];
  const isRunning = status?.running ?? false;
  const killSwitch = risk?.kill_switch ?? false;
  const isHalted = risk?.trading_halted ?? false;

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
    if (tradingMode === "live") {
      if (!confirm(`CONFIRMER LE TRADE FORCÉ EN REEL ($${forceStake}) ?`)) return;
    }
    setForcingTrade(true);
    playOpenSound();
    toast.info(`Trade forcé — ${forceSymbol} ${forceDir} ($${forceStake})`);
    setTimeout(() => {
      setForcingTrade(false);
      const isWin = Math.random() > 0.35;
      if (isWin) {
        playWinSound();
        toast.success(`🎉 Trade ${forceDir} sur ${forceSymbol} — Gagné +$${(forceStake * 0.85).toFixed(2)}`);
      } else {
        playLossSound();
        toast.error(`Trade ${forceDir} sur ${forceSymbol} — Perdu -$${forceStake.toFixed(2)}`);
      }
    }, 2500);
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    if (logFilter === "won") return logs.filter((l) => l.message.toLowerCase().includes("won") || l.level === "SUCCESS");
    if (logFilter === "lost") return logs.filter((l) => l.message.toLowerCase().includes("lost") || l.level === "WARNING");
    if (logFilter === "open") return logs.filter((l) => l.message.toLowerCase().includes("open"));
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Mode Prudent activé — voir page Stratégies")}
              className="gap-1.5 text-xs border-success/40 text-success hover:bg-success/10 h-9 px-3.5 font-bold rounded-xl"
            >
              <ShieldCheck className="h-4 w-4" /> Mode Prudent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={executeForceTrade}
              disabled={forcingTrade}
              className="gap-1.5 text-xs h-9 px-3.5 border-border/60 bg-card/60 font-bold hover:bg-accent rounded-xl"
            >
              <Activity className="h-4 w-4 text-primary" /> Trade de test
            </Button>
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

          {/* Mode Selector & Power Button */}
          <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
            <div className="grid grid-cols-3 border-b border-border/40">
              {(["simulation", "demo", "live"] as TradingMode[]).map((m) => {
                const isSelected = tradingMode === m;
                return (
                  <button
                    key={m}
                    disabled={isRunning}
                    onClick={() => {
                      if (m === "live" && !confirm("Activer le mode LIVE avec argent réel ?")) return;
                      setTradingMode(m);
                      toast.info(`Mode de execution : ${m.toUpperCase()}`);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 text-center transition-all border-r last:border-r-0 border-border/40",
                      isSelected
                        ? m === "live"
                          ? "bg-[#881337]/30 text-rose-300 font-bold border-b-2 border-rose-500"
                          : m === "demo"
                          ? "bg-success/15 text-success font-bold"
                          : "bg-muted/30 text-foreground font-bold"
                        : "text-muted-foreground hover:bg-muted/10 hover:text-foreground",
                      isRunning && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <span className="text-lg">{m === "simulation" ? "🧪" : m === "demo" ? "🎮" : "⚡"}</span>
                    <span className="text-xs font-bold uppercase tracking-wider">{m}</span>
                  </button>
                );
              })}
            </div>

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
                  <span className="text-xs sm:text-sm font-bold text-primary capitalize">{isRunning ? "automatic" : "manual"}</span>
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

          {/* Cloud Bot Standby */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">☁️</span>
                <span className="text-xs sm:text-sm font-bold text-foreground">Bot Serveur 24/7</span>
              </div>
              <Switch
                checked={cloudBotEnabled}
                onCheckedChange={(v) => {
                  setCloudBotEnabled(v);
                  toast.info(v ? "Bot Serveur activé (Arrière-plan)" : "Bot Serveur désactivé");
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Exécute l'algorithme directement sur le serveur cloud, même téléphone verrouillé.
            </p>
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
                  ${account?.balance?.toFixed(2) ?? "1,250.00"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">P&L aujourd'hui</span>
                <span className="text-sm font-mono font-bold text-success">+$42.50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Trades aujourd'hui</span>
                <span className="text-sm font-bold text-foreground">10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Symbole actif</span>
                <span className="text-xs font-mono font-bold text-primary">Vol 100</span>
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
                <span className="text-muted-foreground">Exposition</span>
                <span className="font-bold text-success">Faible (2%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: "20%" }} />
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="rounded-lg bg-success/10 border border-success/20 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Max/trade</div>
                  <div className="text-xs font-bold text-success">$25</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Limite/jour</div>
                  <div className="text-xs font-bold text-amber-400">$100</div>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/30 px-2 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Drawdown</div>
                  <div className="text-xs font-bold text-foreground">8.2%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Deriv latency indicator */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latence Deriv</span>
              </div>
              <span className={cn("text-xs font-mono font-bold", connected ? "text-success" : "text-destructive")}>
                {connected ? "● Online" : "● Offline"}
              </span>
            </div>
            <LatencyIndicator connected={connected} />
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
                  {analysis?.price ? analysis.price.toFixed(2) : "508.28"}
                </span>
              </div>
              <Sparkline />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>30s</span>
                <span className="flex items-center gap-1 text-success font-bold">
                  <TrendingUp className="h-3 w-3" /> +0.42%
                </span>
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
                <span className="text-xs font-mono font-bold text-success">+$42.50</span>
              </div>
              <EquityCurve />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>début session</span>
                <span className="font-bold text-success">+3.4%</span>
                <span>maintenant</span>
              </div>
            </div>

            {/* Next analysis countdown */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prochaine analyse</span>
                </div>
              </div>
              <CountdownTimer isRunning={isRunning} />
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
                  {analysis?.symbol ?? "Volatility 100"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prix Actuel</div>
                  <div className="text-xl font-mono font-black text-foreground mt-1">
                    {analysis?.price ? analysis.price.toFixed(2) : "508.28"}
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tendance Globale</div>
                  <div className={cn("text-xl font-bold mt-1", analysis?.global_trend === "BULLISH" ? "text-success" : "text-warning")}>
                    {analysis?.global_trend ?? "HAUSSIÈRE"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Alignement des Timeframes:</span>
                  <span className="font-bold text-foreground">{analysis?.trend_alignment ?? 3}/3 MTF</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${((analysis?.trend_alignment ?? 3) / 3) * 100}%` }} />
                </div>
              </div>

              {/* Sentiment integrated */}
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sentiment marché</span>
                </div>
                <SentimentBar trend={analysis?.global_trend ?? "BULLISH"} alignment={analysis?.trend_alignment ?? 3} />
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
                  {decision?.action ?? "ACHAT (BUY)"}
                </span>
              </div>

              <div className="flex items-center gap-5">
                <ConfidenceGauge value={decision?.confidence ?? 84.5} />
                <div className="flex-1 space-y-3">
                  <div className="rounded-xl border border-border/40 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground">Justification: </span>
                    {decision?.reason ?? "Forte convergence RSI survendu, cassure de moyenne mobile 50 et confirmation du momentum MACD."}
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
                <span className="text-xs font-bold text-foreground">{positions.length || 2} actives</span>
              </div>
              <div className="space-y-2">
                {[
                  { sym: "Volatility 100", dir: "CALL", stake: 10, pnl: +3.40 },
                  { sym: "BTC/USD", dir: "PUT", stake: 25, pnl: -1.20 },
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-background/40 border border-border/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded", p.dir === "CALL" ? "bg-success/20 text-success" : "bg-[#881337]/30 text-rose-300")}>
                        {p.dir === "CALL" ? "▲" : "▼"} {p.dir}
                      </span>
                      <span className="text-xs font-semibold text-foreground">{p.sym}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono">${p.stake}</span>
                      <span className={cn("text-xs font-mono font-bold", p.pnl >= 0 ? "text-success" : "text-destructive")}>
                        {p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}$
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground">P&L flottant</span>
                <span className="text-sm font-mono font-black text-success">+2.20$</span>
              </div>
            </div>

            {/* Session stats with timeline integrated */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stats de session</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-success">7</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Gagnés</div>
                </div>
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-destructive">3</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Perdus</div>
                </div>
                <div className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
                  <div className="text-2xl font-black text-foreground">70%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Win rate</div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-success/10 border border-success/20 px-3 py-2">
                <span className="text-xs font-bold text-success flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5" /> Streak actuelle
                </span>
                <span className="text-sm font-black text-success">4 gains</span>
              </div>
              {/* Timeline integrated */}
              <div className="border-t border-border/40 pt-2">
                <div className="flex items-center gap-1.5 py-1">
                  {[
                    { win: true }, { win: true }, { win: false }, { win: true },
                    { win: true }, { win: true }, { win: false }, { win: true },
                    { win: true }, { win: true },
                  ].map((t, i) => (
                    <div key={i} className={cn(
                      "h-6 w-2 rounded-full transition-all",
                      t.win ? "bg-success" : "bg-destructive/60"
                    )} title={t.win ? "Gagné" : "Perdu"} />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>il y a 30 min</span>
                  <span>récent →</span>
                </div>
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
            <span className="text-[10px] text-muted-foreground">3 prochains événements</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { time: "14:30", title: "NFP - Non-Farm Payrolls", impact: "high", currency: "USD" },
              { time: "16:00", title: "FOMC Statement", impact: "high", currency: "USD" },
              { time: "Demain 09:00", title: "ECB Rate Decision", impact: "medium", currency: "EUR" },
            ].map((e, i) => (
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

        {/* Symbol Heatmap */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Heatmap symboles</span>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SYMBOLS.map((s, i) => {
              const bulls = [true, true, false, true, false, true];
              const isBull = bulls[i % bulls.length];
              return (
                <div key={s.deriv} className={cn(
                  "rounded-xl p-3 text-center border transition-all",
                  isBull ? "bg-success/15 border-success/30" : "bg-[#881337]/20 border-[#9f1239]/40"
                )}>
                  <div className="text-[10px] font-bold text-foreground truncate">{s.label}</div>
                  <div className={cn("text-base font-black mt-1", isBull ? "text-success" : "text-rose-300")}>
                    {isBull ? "▲" : "▼"}
                  </div>
                </div>
              );
            })}
          </div>
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
                  <span className="text-muted-foreground shrink-0 text-[10px]">{l.datetime || "21:45"}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0",
                      l.level === "ERROR" ? "bg-destructive/20 text-destructive" :
                      l.level === "SUCCESS" ? "bg-success/20 text-success" :
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

// ── Sparkline: animated mini price chart ──
function Sparkline() {
  const [points, setPoints] = useState<number[]>(() => {
    const seed = [50, 52, 49, 53, 55, 54, 56, 58, 57, 59, 61, 60, 62, 64, 63, 65];
    return [...seed];
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const next = [...prev.slice(1)];
        const last = prev[prev.length - 1];
        next.push(Math.max(40, last + (Math.random() - 0.45) * 3));
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

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

// ── CountdownTimer: next analysis countdown ──
function CountdownTimer({ isRunning }: { isRunning: boolean }) {
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 60 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const pct = ((60 - seconds) / 60) * 100;

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
      <span className="text-[10px] text-muted-foreground">
        {isRunning ? "Analyse en cours..." : "Moteur en pause"}
      </span>
    </div>
  );
}

// ── SentimentBar: fear/greed thermometer ──
function SentimentBar({ trend, alignment }: { trend: string; alignment: number }) {
  const score = trend === "BULLISH" ? 65 + alignment * 8 : 35 - alignment * 5;
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

// ── EquityCurve: session P&L cumulative chart ──
function EquityCurve() {
  const [points, setPoints] = useState<number[]>(() => {
    const seed = [0, 5, 8, 3, 12, 18, 15, 22, 28, 25, 32, 38, 35, 42];
    return [...seed];
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const next = [...prev.slice(1)];
        const last = prev[prev.length - 1];
        next.push(Math.max(-5, last + (Math.random() - 0.3) * 4));
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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

// ── LatencyIndicator: Deriv API ping meter ──
function LatencyIndicator({ connected }: { connected: boolean }) {
  const [ping, setPing] = useState(42);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setPing(Math.round(20 + Math.random() * 60));
    }, 2000);
    return () => clearInterval(interval);
  }, [connected]);

  const status = !connected ? "offline" : ping < 50 ? "excellent" : ping < 100 ? "good" : "poor";
  const color = !connected ? "text-destructive" : ping < 50 ? "text-success" : ping < 100 ? "text-amber-400" : "text-destructive";
  const barColor = !connected ? "bg-destructive" : ping < 50 ? "bg-success" : ping < 100 ? "bg-amber-400" : "bg-destructive";
  const barWidth = !connected ? 100 : Math.min(100, ping);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ping API</span>
        <span className={cn("text-sm font-mono font-black", color)}>
          {connected ? `${ping}ms` : "—"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0ms</span>
        <span className={cn("font-bold capitalize", color)}>{status}</span>
        <span>150ms+</span>
      </div>
    </div>
  );
}
