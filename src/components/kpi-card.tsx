import React from "react";

const toneMap: Record<string, string> = {
  cyan: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
  amber: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  bull: "text-[color:var(--bull)] border-[color:var(--bull)]/20 bg-[color:var(--bull)]/5",
  bear: "text-[color:var(--bear)] border-[color:var(--bear)]/20 bg-[color:var(--bear)]/5",
  default: "text-muted-foreground border-border/50 bg-card/60",
};

export function KpiCard({
  title,
  label,
  value,
  sub,
  delta,
  icon,
  tone,
}: {
  title?: string;
  label?: string;
  value: React.ReactNode;
  sub?: string;
  delta?: string;
  icon?: React.ReactNode | React.ElementType;
  tone?: string;
}) {
  const displayLabel = label ?? title;
  const isComponent = typeof icon === "function";

  return (
    <div className={`rounded-2xl border p-4 space-y-1 ${tone ? (toneMap[tone] ?? toneMap.default) : "border-border/50 bg-card/60"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{displayLabel}</span>
        {isComponent && icon ? React.createElement(icon as React.ElementType, { className: "h-4 w-4" }) : icon}
      </div>
      <div className="text-xl font-black font-mono text-foreground">{value}</div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      {delta && <p className="text-[10px] text-muted-foreground">{delta}</p>}
    </div>
  );
}
