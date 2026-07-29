import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CreditCard, Wifi, WifiOff, CheckCircle2, XCircle,
  Server, Key, Shield, TestTube, ArrowUpRight, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEngine, ENGINE_API_BASE } from "@/hooks/use-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compte-deriv")({
  head: () => ({ meta: [{ title: "Compte Deriv MT5 — Au Pluriel" }] }),
  component: CompteDerivPage,
});

const SAVED_FIELDS_KEY = "au-pluriel-mt5-form";
// Terminal générique détecté sur cette machine — nécessaire pour éviter que la
// librairie Python s'attache par erreur à un autre terminal MT5 déjà ouvert
// (ex: un terminal d'un autre broker), ce qui cause un timeout IPC.
const DEFAULT_MT5_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe";

function CompteDerivPage() {
  const { status, connected, apiCall, loading } = useEngine();
  const [form, setForm] = useState({
    account_type: "demo",
    login: "10293847",
    password: "",
    server: "Deriv-Demo",
    path: DEFAULT_MT5_PATH,
  });
  const [formLoaded, setFormLoaded] = useState(false);

  // Charge les champs sauvegardés (y compris mot de passe) après le montage côté client.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_FIELDS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setForm((f) => ({
          ...f,
          ...saved,
          path: saved.path || DEFAULT_MT5_PATH,
          password: saved.password || "",
        }));
      }
    } catch {
      // localStorage indisponible ou données corrompues — on garde les valeurs par défaut
    }
    setFormLoaded(true);
  }, []);

  useEffect(() => {
    if (!formLoaded) return;
    const { account_type, login, password, server, path } = form;
    window.localStorage.setItem(
      SAVED_FIELDS_KEY,
      JSON.stringify({ account_type, login, password, server, path }),
    );
  }, [formLoaded, form.account_type, form.login, form.password, form.server, form.path]);

  // "connected" ne veut dire que le backend répond — ça ne prouve pas une vraie
  // session MT5. On ne considère un compte réellement lié qu'en sortant du mode simulation.
  const mt5Live = connected && status ? !status.sim_mode : false;

  const [testResult, setTestResult] = useState<{
    account: boolean;
    balance: boolean;
    instruments: boolean;
    trading: boolean;
    vps: boolean;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    if (!form.password) {
      toast.error("Entrez votre mot de passe MT5 avant de vous connecter.");
      return;
    }
    // Nettoie les artefacts de copier-coller (guillemets, espaces) qui font
    // échouer mt5.initialize() avec "Invalid path argument".
    const cleanPath = form.path.trim().replace(/^["']|["']$/g, "");
    const result = await apiCall("mt5/connect", "POST", {
      login: parseInt(form.login) || 0,
      password: form.password,
      server: form.server.trim(),
      path: cleanPath,
    });
    if (!result) {
      toast.error("Échec de la requête — le moteur (backend) est-il démarré sur le port 8000 ?");
      return;
    }
    if (result.sim_mode) {
      toast.error(
        "Connexion MT5 refusée — repassé en mode simulation. Vérifiez le login, le mot de passe et le nom du serveur.",
      );
    } else {
      toast.success(
        `Connecté à MT5 — compte ${result.account?.login}, solde ${result.account?.balance} ${result.account?.currency}`,
      );
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${ENGINE_API_BASE}/mt5/test`);
      if (res.ok) {
        setTestResult(await res.json());
      } else {
        toast.error("Le diagnostic a échoué — le moteur a répondu une erreur.");
        setTestResult({ account: false, balance: false, instruments: false, trading: false, vps: false });
      }
    } catch {
      toast.error("Le diagnostic a échoué — moteur injoignable.");
      setTestResult({ account: false, balance: false, instruments: false, trading: false, vps: false });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      
      {/* Hero Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 md:p-6 space-y-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 shrink-0">
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-foreground">Connexion Deriv MetaTrader 5</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Liaison directe avec votre compte broker Deriv MT5 pour l'exécution automatique.
              </p>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider relative z-10",
            mt5Live ? "border-success/30 bg-success/15 text-success" : "border-destructive/30 bg-destructive/15 text-destructive"
          )}>
            {mt5Live ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {mt5Live
              ? `MT5 Connecté — ${status?.account.server}`
              : connected
                ? "Moteur en ligne — Simulation (MT5 non connecté)"
                : "Non Connecté"}
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Credentials Form */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Server className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Identifiants Deriv MT5</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type de Compte</label>
              <div className="grid grid-cols-2 gap-2">
                {(["demo", "real"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, account_type: t, server: t === "demo" ? "Deriv-Demo" : "Deriv-Server" })}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold uppercase transition-all border",
                      form.account_type === t
                        ? t === "real" ? "bg-destructive/20 text-destructive border-destructive/40" : "bg-success/20 text-success border-success/40"
                        : "border-border/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t === "demo" ? "🎮 Démo (Virtuel)" : "⚡ Réel (Live)"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ID Compte MT5 (Login)</label>
              <input
                type="text"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                className="w-full h-9 rounded-xl border border-border/50 bg-background/60 px-3 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de Passe MT5 (Investisseur ou Trading)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="off"
                className="w-full h-9 rounded-xl border border-border/50 bg-background/60 px-3 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
              />
              <p className="text-[10px] text-muted-foreground">
                Sauvegardé localement et chiffré dans le backend (.env).
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serveur Deriv</label>
              <input
                type="text"
                list="deriv-servers"
                value={form.server}
                onChange={(e) => setForm({ ...form, server: e.target.value })}
                placeholder="Ex: DerivSVG-Server"
                className="w-full h-9 rounded-xl border border-border/50 bg-background/60 px-3 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary/60"
              />
              <datalist id="deriv-servers">
                <option value="Deriv-Demo" />
                <option value="Deriv-Server" />
                <option value="Deriv-Server-02" />
                <option value="DerivSVG-Server" />
                <option value="DerivBVI-Server" />
                <option value="DerivCorp-Server" />
              </datalist>
              <p className="text-[10px] text-muted-foreground">
                Utilisez le nom exact affiché dans votre terminal MT5 (Fichier → Ouvrir un compte, ou infos du compte).
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chemin Terminal MT5 (optionnel)</label>
              <input
                type="text"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                className="w-full h-9 rounded-xl border border-border/50 bg-background/60 px-3 text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
              />
            </div>

            <Button
              onClick={handleConnect}
              disabled={loading}
              className="w-full text-xs font-bold h-10 bg-primary text-primary-foreground shadow-[var(--shadow-glow-orange)] hover:opacity-90 rounded-xl disabled:opacity-50"
            >
              {loading ? "Connexion en cours..." : "Se Connecter à Deriv MT5"}
            </Button>
          </div>
        </div>

        {/* Diagnostic Checklist */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-success" />
              <h3 className="text-sm font-bold text-foreground">Diagnostic de Connexion</h3>
            </div>
            <Button size="sm" onClick={handleTest} disabled={testing} className="gap-1.5 text-xs font-bold rounded-xl">
              <TestTube className="h-3.5 w-3.5" /> {testing ? "Test..." : "Lancer Diagnostic"}
            </Button>
          </div>

          <div className="space-y-2.5">
            {[
              { key: "account", label: "Authentification Compte MT5" },
              { key: "balance", label: "Récupération du Solde & Equity" },
              { key: "instruments", label: `Cotations ${status?.config?.symbol ?? "instrument configuré"}` },
              { key: "trading", label: "Permission d'Exécution d'Ordres" },
              { key: "vps", label: "Synchro VPS Serveur 24/7" },
            ].map((check) => {
              const passed = testResult ? (testResult as any)[check.key] : null;
              return (
                <div key={check.key} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/50 p-3">
                  <span className="text-xs font-bold text-foreground">{check.label}</span>
                  {passed === null ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">Non testé</span>
                  ) : passed ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-success"><CheckCircle2 className="h-4 w-4" /> OK</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-destructive"><XCircle className="h-4 w-4" /> Échec</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
