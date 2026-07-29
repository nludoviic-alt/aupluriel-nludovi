import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Brain, Briefcase, CalendarDays,
  Clock, Cpu, Flame, Layers, LineChart,
  Power, Radar, Shield, ShieldAlert, ShieldCheck, Signal,
  Sparkles, Target, Timer, TrendingUp, Trophy, Wallet, Zap,
  Globe, Server, BarChart3, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, Lock, Unlock, Wifi, WifiOff, Eye, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEngine } from "@/hooks/use-engine";
import { useRollingSeries } from "@/hooks/use-rolling-series";
import { logsToTrades } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ia-trading")({
  head: () => ({ meta: [{ title: "Auto-Trader — Au Pluriel" }] }),
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

// ── Market Sessions Helper ──
function getMarketSessions() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return [
    { name: "Sydney", city: "Sydney", active: utcHour >= 22 || utcHour < 7, status: utcHour >= 22 || utcHour < 7 ? "OUVERTE" : "FERMÉE", hours: "22:00 - 07:00 UTC" },
    { name: "Asie", city: "Tokyo", active: utcHour >= 0 && utcHour < 9, status: utcHour >= 0 && utcHour < 9 ? "ACTIVE" : "FERMÉE", hours: "00:00 - 09:00 UTC" },
    { name: "Londres", city: "London", active: utcHour >= 8 && utcHour < 16, status: utcHour >= 8 && utcHour < 16 ? "ACTIVE" : "FERMÉE", hours: "08:00 - 16:00 UTC" },
    { name: "New York", city: "New York", active: utcHour >= 13 && utcHour < 21, status: utcHour >= 13 && utcHour < 21 ? "ACTIVE" : "FERMÉE", hours: "13:00 - 21:00 UTC" },
  ];
}

type ModeTab = "simu" | "demo" | "live";
type MobileTab = "control" | "dashboard" | "journal";

function AutoTraderPage() {
  const { status, logs, connected, apiCall, latencyMs } = useEngine();
  const [activeMode, setActiveMode] = useState<ModeTab>("demo");
  const [mobileTab, setMobileTab] = useState<MobileTab>("control");
  const [logFilter, setLogFilter] = useState<"all" | "won" | "lost" | "open" | "error">("all");
  const [botServerEnabled, setBotServerEnabled] = useState(true);

  // Force Trade state
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
  const sessions = useMemo(() => getMarketSessions(), []);

  const totalBalance = account?.balance ?? 10000.00;
  const equityVal = account?.equity ?? 10000.00;
  const freeMarginVal = account?.free_margin ?? 10000.00;
  const leverageVal = account?.leverage ?? 1000;

  const winsCount = adaptive?.total_wins ?? trades.filter((t) => t.result === "win").length;
  const lossesCount = (adaptive?.total_trades ?? trades.length) - winsCount;
  const winRateVal = adaptive?.win_rate ?? (trades.length > 0 ? (winsCount / trades.length) * 100 : 14);

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
        ok: connected,
        activeStyle: "bg-blue-500/10 border border-blue-500/40 text-blue-400",
        inactiveStyle: "bg-background/40 border border-slate-700/60 text-muted-foreground opacity-70",
      },
      {
        label: "Analyse",
        icon: Brain,
        status: analysis ? `${analysis.trend_alignment}/3 MTF` : "Attente",
        ok: !!analysis,
        activeStyle: "bg-purple-500/10 border border-purple-500/40 text-purple-400",
        inactiveStyle: "bg-background/40 border border-slate-700/60 text-muted-foreground opacity-70",
      },
      {
        label: "Risque",
        icon: Shield,
        status: isHalted ? "Halté" : "Vérifié",
        ok: !isHalted && !killSwitch,
        activeStyle: "bg-cyan-500/10 border border-cyan-500/40 text-cyan-400",
        inactiveStyle: "bg-background/40 border border-slate-700/60 text-muted-foreground opacity-70",
      },
      {
        label: "Décision IA",
        icon: Target,
        status: decision?.action ?? "Neutre",
        ok: decision?.action === "BUY" || decision?.action === "SELL",
        activeStyle: "bg-amber-500/10 border border-amber-500/40 text-amber-400",
        inactiveStyle: "bg-background/40 border border-slate-700/60 text-muted-foreground opacity-70",
      },
      {
        label: "Exécution",
        icon: Zap,
        status: isRunning ? "Active" : "En pause",
        ok: isRunning,
        activeStyle: "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400",
        inactiveStyle: "bg-background/40 border border-slate-700/60 text-muted-foreground opacity-70",
      },
    ];
  }, [connected, analysis, isHalted, killSwitch, decision, isRunning]);

  return (
    <div className="space-y-6 pb-12 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* ── TOP FAVORABLE MARKET BANNER & TICKERS ── */}
      <div className="rounded-2xl border border-slate-700/80 bg-card/90 p-3 flex flex-wrap items-center justify-between gap-3 text-xs w-full max-w-full shadow-md">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5 shrink-0 text-xs uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            Marché favorable :
          </span>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-mono font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> EUR/JPY 76% · 3/4 TF
            </span>
            <span className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 font-mono font-bold text-purple-300 flex items-center gap-1 text-[11px]">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-purple-400" /> ETH/USD 79% · 4/4 TF
            </span>
          </div>
        </div>

        <button 
          onClick={toggleEngine}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors ml-auto shrink-0"
        >
          Lancer l'auto-trader &rarr;
        </button>
      </div>

      {/* Ticker Bar */}
      <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-2 gap-4 w-full min-w-0">
        <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground overflow-x-auto no-scrollbar flex-1 min-w-0 pr-2">
          <span className="hover:text-foreground cursor-pointer font-bold text-emerald-400 shrink-0">BOOM 1000 —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">CRASH 1000 —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">VOLATILITY 75 —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">BTC/USD —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">ETH/USD —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">EUR/USD —</span>
          <span className="hover:text-foreground cursor-pointer shrink-0">GBP/USD —</span>
        </div>
        <span className="flex items-center gap-1.5 text-emerald-400 font-sans font-bold text-[10px] uppercase tracking-wider shrink-0 pl-3 bg-background border-l-2 border-slate-700/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          TEMPS RÉEL
        </span>
      </div>

      {/* ── HEADER TITLE & BADGES ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 w-full">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Auto-Trader</h1>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {config?.symbol ?? "BOOM 1000 INDEX"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
            Algorithme multi-indicateurs · 4 timeframes · Patterns japonais & Détection de spikes
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> MODE PRUDENT
          </span>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs font-bold border-slate-700/70">
            <Eye className="h-4 w-4 text-cyan-400" /> APERÇU LIVE
          </Button>
        </div>
      </div>

      {/* ── TOP 4 SYNTHETIC & EXPLANATORY METRICS CARDS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
        
        {/* Card 1: Fonds Disponibles (Theme Cyan / Multi-broker Accent) */}
        <div className="rounded-2xl border-2 border-cyan-500/40 bg-card/90 p-4 space-y-3 relative overflow-hidden shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              FONDS DISPONIBLES
            </span>
            <Wallet className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
              ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-wider mt-0.5">
              BROKER DERIV · METATRADER 5
            </div>
          </div>
          {/* Authentic Deriv MT5 account sub-metrics */}
          <div className="pt-2.5 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-muted-foreground font-mono">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">ÉQUITÉ</span>
              <span className="text-xs font-bold text-foreground">${equityVal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex flex-col text-center">
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">MARGE LIBRE</span>
              <span className="text-xs font-bold text-foreground">${freeMarginVal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">LEVIER</span>
              <span className="text-xs font-bold text-foreground">1:{leverageVal}</span>
            </div>
          </div>
        </div>

        {/* Card 2: P&L Aujourd'hui (EMERALD GREEN FOR GAINS & PNL) */}
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3 relative overflow-hidden shadow-lg shadow-emerald-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              P&L AUJOURD'HUI
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className={cn("text-2xl sm:text-3xl font-black font-mono tracking-tight", (risk?.daily_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {(risk?.daily_pnl ?? 0) >= 0 ? "+" : ""}${(risk?.daily_pnl ?? 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-300/90 mt-0.5 font-medium">
              Gains $0.00 · Pertes $0.00
            </div>
          </div>
          <div className="pt-2 border-t border-emerald-500/30 text-[10px] text-muted-foreground leading-tight">
            Résultat net des trades fermés ce jour.
          </div>
        </div>

        {/* Card 3: Win Rate (Purple Accent) */}
        <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 relative overflow-hidden shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              WIN RATE
            </span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
              {winRateVal.toFixed(0)}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              1 gagnés · 6 perdus
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[10px] text-muted-foreground leading-tight">
            Taux de réussite calculé sur l'historique.
          </div>
        </div>

        {/* Card 4: Limite de Perte (Rose Accent) */}
        <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 relative overflow-hidden shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              LIMITE DE PERTE
            </span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
              {dailyLossPct.toFixed(0)}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              $0.00 / $20
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[10px] text-muted-foreground leading-tight">
            Niveau de risque maximal engagé ce jour.
          </div>
        </div>

      </div>

      {/* ── RISK ALERTS WITH BURGUNDY TINT ── */}
      {killSwitch && (
        <div className="rounded-2xl border-2 border-rose-800/80 bg-rose-950/40 p-4 flex items-center justify-between gap-3 shadow-lg w-full">
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
            className="bg-rose-900 text-rose-100 hover:bg-rose-800 text-xs font-bold rounded-xl shrink-0 border border-rose-500/40"
          >
            Réinitialiser
          </Button>
        </div>
      )}

      {/* ── MOBILE TAB NAVIGATION ── */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/20 p-1.5 md:hidden w-full border border-slate-700/60">
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
                active ? "bg-card text-foreground shadow-sm border border-slate-700/60" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── MAIN LAYOUT GRID ── */}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr] w-full">

        {/* ── LEFT CONTROL PANEL ── */}
        <div className={cn(mobileTab === "control" ? "block" : "hidden", "md:block space-y-4 min-w-0")}>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/20 p-1 border-2 border-slate-700/80">
            <button
              onClick={() => setActiveMode("simu")}
              className={cn(
                "py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1",
                activeMode === "simu" ? "bg-card text-amber-400 border border-amber-500/40 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className="h-3 w-3 text-amber-400 shrink-0" /> SIMU
            </button>
            <button
              onClick={() => setActiveMode("demo")}
              className={cn(
                "py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1",
                activeMode === "demo" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🎮 DÉMO
            </button>
            <button
              onClick={() => setActiveMode("live")}
              className={cn(
                "py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1",
                activeMode === "live" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              ⚡ LIVE
            </button>
          </div>

          {/* Circular Power Button (EMERALD GREEN FOR BOT POWER) */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 overflow-hidden shadow-md p-5 space-y-5">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-36 h-36 shrink-0">
                {isRunning && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500 opacity-25" />}
                <button
                  onClick={toggleEngine}
                  className={cn(
                    "relative w-full h-full rounded-full flex items-center justify-center transition-all duration-300 group border-2",
                    isRunning
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.35)]"
                      : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20",
                  )}
                >
                  <Power className="h-14 w-14 transition-transform duration-200 group-hover:scale-110" />
                </button>
              </div>

              <div className="w-full space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-background/50 border border-slate-700/50 px-3.5 py-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">STATUT</span>
                  <span className={cn("font-bold flex items-center gap-1.5 text-[11px]", isRunning ? "text-emerald-400" : "text-emerald-400")}>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    Actif sur le serveur
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-background/50 border border-slate-700/50 px-3.5 py-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">MODE</span>
                  <span className="font-bold text-emerald-400 text-[11px]">🎮 Démo</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-background/50 border border-slate-700/50 px-3.5 py-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">PAIRES</span>
                  <span className="font-bold text-foreground text-[11px]">11 surveillées</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-background/50 border border-slate-700/50 px-3.5 py-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground font-semibold text-[10px]">DERIV MT5</span>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">${totalBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bot Serveur Card (EMERALD GREEN FOR SERVEUR BOT) */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">BOT SERVEUR</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              </div>
              <input
                type="checkbox"
                checked={botServerEnabled}
                onChange={(e) => setBotServerEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tourne sur le serveur 24h/24 — même téléphone verrouillé ou app fermée.
            </p>

            <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-2.5 space-y-1">
              <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>Défavorable 0.0% vs seuil 54.1%</span>
              </div>
              <div className="text-[9px] text-muted-foreground">il y a 6h</div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">STATUT</span>
                <span className="font-bold text-emerald-400 text-[11px]">● Actif sur le serveur</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">P&L JOUR</span>
                <span className="font-mono font-bold text-emerald-400 text-[11px]">+$0.00 · 0 trade</span>
              </div>
            </div>
          </div>

          {/* Trade manuel */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md min-w-0">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                Trade manuel — {config?.symbol ?? "Boom 1000 Index"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForceDir("BUY")}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  forceDir === "BUY" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "border-slate-700/60 text-muted-foreground hover:text-foreground"
                )}
              >
                ▲ Buy
              </button>
              <button
                onClick={() => setForceDir("SELL")}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  forceDir === "SELL" ? "bg-rose-950/40 text-rose-300 border-rose-700/50" : "border-slate-700/60 text-muted-foreground hover:text-foreground"
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

          {/* Latence moteur */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latence moteur</span>
              </div>
              <span className={cn("text-xs font-mono font-bold shrink-0", connected ? "text-emerald-400" : "text-rose-400")}>
                {connected ? "● Online" : "● Offline"}
              </span>
            </div>
            <LatencyIndicator connected={connected} latencyMs={latencyMs} />
          </div>

        </div>

        {/* ── RIGHT MAIN DASHBOARD CONTENT ── */}
        <div className={cn(mobileTab === "dashboard" || mobileTab === "journal" ? "block" : "hidden", "md:block space-y-5 min-w-0")}>

          {/* ── MAIN DASHBOARD BOT CARD (EMERALD GREEN SCANNER & PNL) ── */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-5 space-y-4 shadow-lg w-full">
            <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400 shrink-0" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-foreground">DASHBOARD BOT</h2>
              </div>
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0", isRunning ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30")}>
                ● SCANNER ACTIF
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_260px] min-w-0">

              {/* Chart / Market Scanner Standby */}
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-muted-foreground">COURBE P&L AUJOURD'HUI</span>
                  <span className="text-xl font-mono font-black text-emerald-400">+$0.00</span>
                </div>

                {positions.length > 0 || trades.length > 0 ? (
                  <div className="space-y-3 w-full">
                    <Sparkline points={priceSeries} />
                    <EquityCurve points={equitySeries} />
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-slate-700/70 bg-background/40 p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 my-2 min-h-[200px] w-full">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse shrink-0">
                      <Activity className="h-6 w-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <div className="text-xs font-bold uppercase tracking-wider text-foreground">SCANNER DE MARCHÉ EN VEILLE</div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        En attente du premier trade... Le bot se déclenchera automatiquement dès qu'un signal Boom 1000 à haute confiance (&gt;75%) sera détecté.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side Risk & Target Meters with High-Contrast Dots */}
              <div className="space-y-4 border-t lg:border-t-0 lg:border-l-2 border-slate-700/60 pt-4 lg:pt-0 lg:pl-5 flex flex-col justify-center min-w-0">
                
                {/* Limite Perte Meter */}
                <div className="space-y-2 rounded-xl bg-background/50 p-3 border border-slate-700/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold">
                      <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0" /> LIMITE PERTE
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs">$0.00 / $20</span>
                  </div>
                  {/* High contrast 10 dots indicator */}
                  <div className="flex items-center gap-1 py-1 w-full">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2.5 flex-1 rounded-sm transition-all border",
                          i < Math.ceil(dailyLossPct / 10)
                            ? "bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                            : "bg-slate-800/80 border-slate-700/60"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>MARGE</span>
                    <span className="font-bold text-rose-400 font-mono">MAX -$20</span>
                  </div>
                </div>

                {/* Objectif Gain Meter (EMERALD GREEN TARGET) */}
                <div className="space-y-2 rounded-xl bg-background/50 p-3 border border-slate-700/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold">
                      <Target className="h-3 w-3 text-emerald-400 shrink-0" /> OBJECTIF GAIN
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs">$0.00 / $200</span>
                  </div>
                  {/* High contrast 10 dots indicator */}
                  <div className="flex items-center gap-1 py-1 w-full">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2.5 flex-1 rounded-sm transition-all border",
                          i < 0
                            ? "bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                            : "bg-slate-800/80 border-slate-700/60"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>CIBLE</span>
                    <span className="font-bold text-emerald-400 font-mono">+ $200</span>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ── SESSIONS MARCHÉS (EMERALD ACTIVE SESSIONS) ── */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SESSIONS MARCHÉS</h3>
              </div>
              <span className="text-[10px] text-muted-foreground">Horaires UTC en temps réel</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sessions.map((s, idx) => (
                <div key={idx} className={cn(
                  "rounded-xl border-2 p-3 flex flex-col justify-between gap-2.5 transition-all shadow-sm",
                  s.active
                    ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                    : "bg-background/60 border-slate-700/80 text-muted-foreground"
                )}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">{s.name}</span>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-md uppercase border shrink-0",
                      s.active ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-rose-950/40 border-rose-800/40 text-rose-300"
                    )}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{s.hours}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── PIPELINE STAGES ── */}
          <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline d'analyse & exécution</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {pipeline.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div key={idx} className={cn(
                    "rounded-xl border-2 p-3 flex flex-col justify-between gap-2.5 transition-all shadow-sm min-w-0",
                    p.ok ? p.activeStyle : p.inactiveStyle
                  )}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 truncate">{p.label}</span>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="text-xs font-black truncate">{p.status}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ROW: Analysis & Decision ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            
            {/* Analysis card */}
            <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary shrink-0" />
                  <h3 className="text-sm font-bold text-foreground">Analyse Technique En Direct</h3>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  {analysis?.symbol ?? "Boom 1000"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-700/60 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prix Actuel</div>
                  <div className="text-xl font-mono font-black text-foreground mt-1">
                    {analysis?.price ? analysis.price.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-background/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tendance Globale</div>
                  <div className={cn("text-xl font-bold mt-1", analysis?.global_trend === "BUY" ? "text-emerald-400" : analysis?.global_trend === "SELL" ? "text-rose-400" : "text-amber-400")}>
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
                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${((analysis?.trend_alignment ?? 0) / 3) * 100}%` }} />
                </div>
              </div>

              {/* Sentiment integrated */}
              <div className="border-t-2 border-slate-700/60 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sentiment marché</span>
                </div>
                <SentimentBar trend={analysis?.global_trend ?? "NEUTRAL"} alignment={analysis?.trend_alignment ?? 0} />
              </div>
            </div>

            {/* Decision card with circular gauge */}
            <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-bold text-foreground">Dernière Décision IA</h3>
                </div>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                  decision?.action === "BUY" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted/20 text-muted-foreground border-border/40"
                )}>
                  {decision?.action ?? "—"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0">
                  <ConfidenceGauge value={decision?.confidence ?? 0} />
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div className="rounded-xl border border-slate-700/60 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground break-words">
                    <span className="font-bold text-foreground">Justification: </span>
                    {decision?.reason ?? "Aucune décision récente."}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── ROW: Positions + Stats ── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Open positions + floating P&L */}
            <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Positions ouvertes</span>
                </div>
                <span className="text-xs font-bold text-foreground">{positions.length} active{positions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {positions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">Aucune position ouverte</div>
                ) : positions.map((p) => (
                  <div key={p.ticket} className="flex items-center justify-between rounded-xl bg-background/40 border border-slate-700/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded shrink-0", p.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-950/40 text-rose-300")}>
                        {p.direction === "BUY" ? "▲" : "▼"} {p.direction}
                      </span>
                      <span className="text-xs font-semibold text-foreground">#{p.ticket} · {p.volume} lot</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono">{p.entry.toFixed(2)}</span>
                      <span className={cn("text-xs font-mono font-bold", p.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {p.profit >= 0 ? "+" : ""}{p.profit.toFixed(2)}$
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t-2 border-slate-700/60">
                <span className="text-xs text-muted-foreground">P&L flottant</span>
                <span className={cn("text-sm font-mono font-black", floatingPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {floatingPnl >= 0 ? "+" : ""}{floatingPnl.toFixed(2)}$
                </span>
              </div>
            </div>

            {/* Session stats */}
            <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b-2 border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stats cumulées (apprentissage adaptatif)</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-background/50 border border-slate-700/60 p-3 text-center">
                  <div className="text-2xl font-black text-emerald-400">1</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Gagnés</div>
                </div>
                <div className="rounded-xl bg-background/50 border border-slate-700/60 p-3 text-center">
                  <div className="text-2xl font-black text-rose-400">6</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Perdus</div>
                </div>
                <div className="rounded-xl bg-background/50 border border-slate-700/60 p-3 text-center">
                  <div className="text-2xl font-black text-foreground">14%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Win rate</div>
                </div>
              </div>
              <div className={cn("flex items-center justify-between rounded-xl px-3 py-2 border-2", streak.count > 0 ? (streak.win ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-950/20 border-rose-800/40") : "bg-muted/10 border-slate-700/60")}>
                <span className={cn("text-xs font-bold flex items-center gap-1.5", streak.win ? "text-emerald-400" : "text-rose-400")}>
                  <Flame className="h-3.5 w-3.5 shrink-0" /> Streak actuelle
                </span>
                <span className={cn("text-sm font-black", streak.win ? "text-emerald-400" : "text-rose-400")}>
                  {streak.count > 0 ? `${streak.count} ${streak.win ? "gains" : "pertes"}` : "—"}
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── FULL WIDTH: Economic Calendar + Heatmap + Logs ── */}
      <div className="space-y-5 w-full">

        {/* Economic calendar */}
        <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calendrier économique</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {calendar?.upcoming?.length ?? 0} événement{(calendar?.upcoming?.length ?? 0) !== 1 ? "s" : ""} à venir
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(calendar?.upcoming?.length ?? 0) === 0 ? (
              <div className="sm:col-span-3 text-xs text-muted-foreground text-center py-4">Aucun événement à haut impact à venir</div>
            ) : calendar!.upcoming.map((e, i) => (
              <div key={i} className={cn(
                "rounded-xl border-2 p-3 space-y-1.5",
                e.impact === "high" ? "bg-amber-500/10 border-amber-500/40" : "bg-background/40 border-slate-700/60"
              )}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">{e.time}</span>
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0",
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
        <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Régime de marché — {config?.symbol ?? "Boom 1000"}</span>
            </div>
            {regime && <span className="text-xs font-mono font-bold text-primary">{regime.confidence.toFixed(0)}% confiance</span>}
          </div>
          {regime ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border shrink-0",
                regime.regime === "trending" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}>
                {regime.regime}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed break-words">{regime.description}</p>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">Aucune détection de régime disponible</div>
          )}
        </div>

        {/* Logs Stream */}
        <div className="rounded-2xl border-2 border-slate-700/80 bg-card/90 p-5 space-y-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <h3 className="text-sm font-bold text-foreground">Journal & Logs Moteur</h3>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-700/60 bg-muted/20 p-0.5 overflow-x-auto no-scrollbar">
              {(["all", "won", "lost", "open", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg transition-all capitalize shrink-0",
                    logFilter === f ? "bg-card text-foreground border border-slate-700/60 shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-background/50 p-2.5">
                  <span className="text-muted-foreground shrink-0 text-[10px]">{l.datetime || "—"}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0",
                    l.level === "ERROR" ? "bg-rose-950/40 text-rose-400 border border-rose-800/40" :
                    l.level === "TRADE" && l.message.toLowerCase().includes("win") ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                    l.level === "TRADE" && l.message.toLowerCase().includes("loss") ? "bg-rose-950/40 text-rose-400 border border-rose-800/40" :
                    l.level === "RISK" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                    "bg-muted/30 text-muted-foreground border border-slate-700/40"
                  )}>
                    {l.level}
                  </span>
                  <span className="text-foreground leading-snug flex-1 break-words">{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// ── Sparkline ──
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

// ── ConfidenceGauge ──
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

// ── SentimentBar ──
function SentimentBar({ trend, alignment }: { trend: string; alignment: number }) {
  const score = trend === "BUY" ? 65 + alignment * 8 : trend === "SELL" ? 35 - alignment * 5 : 50;
  const label = score >= 75 ? "Avidité extrême" : score >= 55 ? "Optimisme" : score >= 45 ? "Neutre" : score >= 25 ? "Prudence" : "Peur extrême";

  return (
    <div className="space-y-2 py-1 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-rose-400 font-bold shrink-0">Peur</span>
        <span className="font-black text-foreground truncate px-1">{label}</span>
        <span className="text-emerald-400 font-bold shrink-0">Avidité</span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 overflow-hidden w-full">
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

// ── EquityCurve ──
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
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#equity-grad)" />
      <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── LatencyIndicator ──
function LatencyIndicator({ connected, latencyMs }: { connected: boolean; latencyMs: number | null }) {
  const ping = latencyMs ?? 0;
  const status = !connected ? "offline" : ping < 200 ? "excellent" : ping < 500 ? "correct" : "lent";
  const color = !connected ? "text-rose-400" : ping < 200 ? "text-emerald-400" : ping < 500 ? "text-amber-400" : "text-rose-400";
  const barColor = !connected ? "bg-rose-500" : ping < 200 ? "bg-emerald-400" : ping < 500 ? "bg-amber-400" : "bg-rose-500";
  const barWidth = !connected ? 100 : Math.min(100, (ping / 500) * 100);

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ping API moteur</span>
        <span className={cn("text-sm font-mono font-black shrink-0", color)}>
          {connected && latencyMs !== null ? `${ping}ms` : "—"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden w-full">
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
