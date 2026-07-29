import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BookOpen, Filter, Loader2, Search, RefreshCw,
  TrendingUp, TrendingDown, Activity, AlertTriangle, Info,
} from "lucide-react";
import { useEngine, type LogEntry } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal — Au Pluriel" }] }),
  component: JournalPage,
});

// Valeurs réelles émises par engine/logger.py (LogLevel) — toujours en MAJUSCULES.
const LEVEL_ICONS: Record<string, React.ElementType> = {
  INFO: Info,
  WARN: AlertTriangle,
  ERROR: AlertTriangle,
  TRADE: TrendingUp,
  SIGNAL: Activity,
  RISK: AlertTriangle,
};

const LEVEL_COLORS: Record<string, string> = {
  INFO: "text-muted-foreground",
  WARN: "text-amber-400",
  ERROR: "text-destructive",
  TRADE: "text-success",
  SIGNAL: "text-primary",
  RISK: "text-amber-400",
};

function JournalPage() {
  const { logs, connected, refresh } = useEngine();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(
    () => [...new Set(logs.map(l => l.category))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (levelFilter !== "all" && l.level !== levelFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.message.toLowerCase().includes(q) && !l.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, levelFilter, categoryFilter, search]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />
        <div className="flex items-center gap-4 flex-1 relative z-10">
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Journal d'Activité</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Logs en temps réel du bot — {logs.length} entrée{logs.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 text-xs font-bold hover:bg-accent transition-colors relative z-10"
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-primary shrink-0" />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les logs..."
              className="w-full h-9 rounded-xl bg-background/60 border border-border/50 text-xs pl-9 pr-3 text-foreground"
            />
          </div>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-semibold text-foreground">
            <option value="all">Tous niveaux</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warning</option>
            <option value="ERROR">Error</option>
            <option value="TRADE">Trade</option>
            <option value="SIGNAL">Signal</option>
            <option value="RISK">Risk</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 rounded-xl bg-background/60 border border-border/50 text-xs px-3 font-semibold text-foreground">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Logs */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-2">
        {!connected ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Connexion à l'engine en cours...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-semibold">Aucune entrée</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {logs.length === 0 ? "Le journal se remplira quand le bot sera actif." : "Aucun résultat pour ces filtres."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {filtered.map((log, i) => {
              const Icon = LEVEL_ICONS[log.level] ?? Info;
              const color = log.level === "TRADE" && log.message.toLowerCase().includes("loss")
                ? "text-destructive"
                : LEVEL_COLORS[log.level] ?? "text-muted-foreground";
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/30 px-3 py-2.5 hover:bg-muted/20 transition-colors">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{log.category}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">
                        {log.datetime || new Date(log.timestamp * 1000).toLocaleTimeString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 break-words">{log.message}</p>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Détails</summary>
                        <pre className="text-[10px] font-mono text-muted-foreground mt-1 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
