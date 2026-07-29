import { type LucideIcon, ArrowUpRight, Check } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  features,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[var(--shadow-glow-orange)]">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-warning/15 text-warning text-[11px] font-bold tracking-wider px-4 py-2 border border-warning/30 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning pulse-dot" />
            EN PRÉPARATION
          </span>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <div
            key={f}
            className="group rounded-2xl border border-border/50 bg-card/60 p-5 hover:border-primary/40 transition-all duration-200 cursor-default"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 group-hover:border-primary/30 transition-colors">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">{f}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/70 transition-colors shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Status footer */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">Module en préparation</p>
            <p className="text-xs text-muted-foreground">Données de démonstration · Bientôt disponible</p>
          </div>
        </div>
        <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground/60">
          AU PLURIEL · v1.0
        </span>
      </div>
    </div>
  );
}
