import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield, AlertTriangle, CheckCircle2, Lock, Save, Sliders, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEngine } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestion-risque")({
  head: () => ({ meta: [{ title: "Gestion du risque — Au Pluriel" }] }),
  component: RiskManagementPage,
});

function RiskManagementPage() {
  const { status, connected, apiCall } = useEngine();
  const config = status?.config;
  const risk = status?.risk;
  const hasOpenPositions = (status?.positions?.length ?? 0) > 0;

  const [form, setForm] = useState({
    risk_per_trade_pct: config?.risk_per_trade_pct ?? 0.25,
    max_daily_loss_pct: config?.daily_loss_limit_pct ?? 2.0,
    max_weekly_loss_pct: config?.max_weekly_loss_pct ?? 5.0,
    max_concurrent_positions: config?.max_positions ?? 3,
    max_consecutive_losses: config?.max_consecutive_losses ?? 3,
    min_rr_ratio: config?.min_rr_ratio ?? 1.5,
    min_confidence_threshold: config?.min_confidence ?? 75,
    max_total_exposure_pct: config?.max_total_exposure_pct ?? 5.0,
    min_balance: config?.min_balance ?? 100,
  });

  const save = async () => {
    await apiCall("config", "POST", form);
  };

  const dailyLossUsed = Math.abs(risk?.daily_pnl ?? 0);
  const dailyLossLimit = risk?.daily_loss_limit ?? 20;
  const dailyLossPct = dailyLossLimit > 0 ? (dailyLossUsed / dailyLossLimit) * 100 : 0;
  const consecutiveLosses = risk?.consecutive_losses ?? 0;
  const maxConsecutive = config?.max_consecutive_losses ?? 3;
  const consecutivePct = (consecutiveLosses / maxConsecutive) * 100;

  const overallRisk = Math.max(dailyLossPct, consecutivePct);
  const gaugeColor = risk?.kill_switch ? "destructive" : risk?.trading_halted ? "warning" :
    overallRisk > 75 ? "destructive" : overallRisk > 50 ? "warning" : "success";
  const gaugeLabel = risk?.kill_switch ? "Verrouillé" : risk?.trading_halted ? "Trading suspendu" :
    overallRisk > 75 ? "Limite presque atteinte" : overallRisk > 50 ? "Risque modéré" : "Risque faible";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero + gauge */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-5 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Gestion du Risque & Sécurité</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Le moteur de risque contrôle strictement chaque trade indépendamment du générateur de signal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border border-border/40 bg-background/50 rounded-2xl p-4">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Niveau de sécurité</p>
              <p className={cn(
                "text-base font-bold mt-0.5",
                gaugeColor === "success" ? "text-success" : gaugeColor === "warning" ? "text-warning" : "text-destructive"
              )}>{gaugeLabel}</p>
            </div>
            <div className="relative h-12 w-12 flex items-center justify-center">
              {risk?.kill_switch ? <Lock className="h-6 w-6 text-destructive" /> :
               overallRisk > 75 ? <AlertTriangle className="h-6 w-6 text-destructive" /> :
               <CheckCircle2 className="h-6 w-6 text-success" />}
            </div>
          </div>
        </div>

        {/* Quick status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <RiskStatusItem label="Perte du jour" value={`${dailyLossPct.toFixed(0)}% utilisée`} isAlert={dailyLossPct > 75} />
          <RiskStatusItem label="Pertes conséc." value={`${consecutiveLosses}/${maxConsecutive}`} isAlert={consecutiveLosses >= 2} />
          <RiskStatusItem label="Positions actives" value={`${status?.positions?.length ?? 0}/${config?.max_positions ?? 3}`} />
          <RiskStatusItem label="Kill switch" value={risk?.kill_switch ? "ACTIF" : "Inactif"} isAlert={!!risk?.kill_switch} />
        </div>
      </div>

      {/* Parameters */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Paramètres d'exposition & de perte</h3>
          </div>
          <Button size="sm" onClick={save} className="gap-1.5 text-xs font-bold">
            <Save className="h-3.5 w-3.5" /> Sauvegarder
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <RiskParam
            label="Risque par trade" unit="%" value={form.risk_per_trade_pct}
            onChange={v => setForm(s => ({ ...s, risk_per_trade_pct: v }))}
            step={0.05} min={0.05} max={2} locked={hasOpenPositions}
          />
          <RiskParam
            label="Perte quotidienne max" unit="%" value={form.max_daily_loss_pct}
            onChange={v => setForm(s => ({ ...s, max_daily_loss_pct: v }))}
            step={0.5} min={0.5} max={10} locked={hasOpenPositions}
          />
          <RiskParam
            label="Perte hebdomadaire max" unit="%" value={form.max_weekly_loss_pct}
            onChange={v => setForm(s => ({ ...s, max_weekly_loss_pct: v }))}
            step={0.5} min={1} max={20} locked={hasOpenPositions}
          />
          <RiskParam
            label="Positions simultanées max" unit="" value={form.max_concurrent_positions}
            onChange={v => setForm(s => ({ ...s, max_concurrent_positions: v }))}
            step={1} min={1} max={10} locked={hasOpenPositions}
          />
          <RiskParam
            label="Pertes consécutives autorisées" unit="" value={form.max_consecutive_losses}
            onChange={v => setForm(s => ({ ...s, max_consecutive_losses: v }))}
            step={1} min={1} max={10} locked={hasOpenPositions}
          />
          <RiskParam
            label="Rapport Gain/Risque min" unit="" value={form.min_rr_ratio}
            onChange={v => setForm(s => ({ ...s, min_rr_ratio: v }))}
            step={0.1} min={1} max={5} locked={hasOpenPositions}
          />
        </div>
      </div>
    </div>
  );
}

function RiskStatusItem({ label, value, isAlert }: { label: string; value: string; isAlert?: boolean }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className={cn("text-base font-bold mt-0.5", isAlert ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}

function RiskParam({
  label, unit, value, onChange, step, min, max, locked,
}: {
  label: string; unit: string; value: number; onChange: (v: number) => void;
  step: number; min: number; max: number; locked?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{label}</span>
        <span className="font-mono text-sm font-black text-primary">{value}{unit}</span>
      </div>
      <input
        type="range"
        disabled={locked}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-40"
      />
    </div>
  );
}
