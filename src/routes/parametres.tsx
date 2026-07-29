import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CheckCircle2, CreditCard, Eye, EyeOff, FlaskConical, KeyRound, Loader2, LogOut, Shield, ShieldAlert, TestTube, UserCircle, Wifi, WifiOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { loadDefaultStake, saveDefaultStake } from "@/lib/stake";
import { AutoBacktestStatus } from "@/components/auto-backtest-status";
import { CollapsibleSection } from "@/components/collapsible-section";
import { HelpBubble } from "@/components/help-bubble";
import { getExistingPushSubscription, isIosNonSafari, isIosNonStandalone, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { AvatarPicker } from "@/components/avatar-picker";
import { useAuth } from "@/hooks/use-auth";
import { useEngine, ENGINE_API_BASE } from "@/hooks/use-engine";

export const Route = createFileRoute("/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Au Pluriel" }] }),
  component: SettingsPage,
});

const KEYS = {
  token: "lio23.deriv_token",
  account: "lio23.account_type",
  riskPerTrade: "lio23.risk_per_trade",
  maxDrawdown: "lio23.max_drawdown",
};

const MT5_KEY = "au-pluriel-mt5-form";

function SettingsPage() {
  const { user, refresh: refreshAuth } = useAuth();
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<"online" | "offline">(user?.online_status ?? "online");
  const [statusSaving, setStatusSaving] = useState(false);
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [account, setAccount] = useState<"demo" | "live">("demo");
  const [risk, setRisk] = useState(2);
  const [maxDd, setMaxDd] = useState(5);
  const [stake, setStake] = useState(5);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ id?: string; balance?: number; currency?: string } | null>(null);
  const [autoBacktestEnabled, setAutoBacktestEnabled] = useState(false);
  const [autoBacktestSaving, setAutoBacktestSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushChecked, setPushChecked] = useState(false);
  // Broker enable/disable toggles
  const [enableDeriv, setEnableDeriv] = useState(true);
  const [mt5Form, setMt5Form] = useState({ account_type: "demo", login: "6222926", password: "", server: "Deriv-Demo", path: "C:\\Program Files\\MetaTrader 5\\terminal64.exe" });
  const [mt5Show, setMt5Show] = useState(false);
  const [mt5TestResult, setMt5TestResult] = useState<{ account: boolean; balance: boolean; instruments: boolean; trading: boolean; vps: boolean } | null>(null);
  const [mt5Testing, setMt5Testing] = useState(false);
  const { status: engineStatus, connected: engineConnected, apiCall: engineApiCall, loading: engineLoading } = useEngine();
  const { confirmState, confirm } = useConfirm();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Load from localStorage as immediate fallback
    setToken(localStorage.getItem(KEYS.token) ?? "");
    setAccount((localStorage.getItem(KEYS.account) as "demo" | "live") ?? "demo");
    setRisk(Number(localStorage.getItem(KEYS.riskPerTrade) ?? 2));
    setMaxDd(Number(localStorage.getItem(KEYS.maxDrawdown) ?? 5));
    setStake(loadDefaultStake());
    // Load MT5 credentials from localStorage
    try {
      const raw = localStorage.getItem(MT5_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setMt5Form({
          account_type: saved.account_type ?? "demo",
          login: saved.login ?? "6222926",
          password: saved.password ?? "",
          server: saved.server ?? "Deriv-Demo",
          path: saved.path ?? "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
        });
      }
    } catch { /* ignore */ }
    // Then hydrate from server
    api.get<Record<string, unknown>>("/api/settings").then((s) => {
      if (s.deriv_token) setToken(s.deriv_token as string);
      if (s.account_type) setAccount(s.account_type as "demo" | "live");
      if (s.risk_per_trade) setRisk(s.risk_per_trade as number);
      if (s.max_drawdown) setMaxDd(s.max_drawdown as number);
      if (s.default_stake_usd) { setStake(s.default_stake_usd as number); saveDefaultStake(s.default_stake_usd as number); }
      if (s.avatar) setAvatar(s.avatar as string);
      if (s.online_status) setOnlineStatus(s.online_status as "online" | "offline");
      // Load broker toggles from bot config
      if (s.bot_config) {
        try {
          const cfg = typeof s.bot_config === "string" ? JSON.parse(s.bot_config) : s.bot_config;
          if (cfg.enableDeriv !== undefined) setEnableDeriv(cfg.enableDeriv);
        } catch { /* ignore */ }
      }
      setAutoBacktestEnabled(!!s.auto_backtest_enabled);
    }).catch(() => {});
    // Reflects the browser's actual subscription, not a saved preference —
    // permission can be revoked (iOS Settings, site data cleared) outside
    // the app, and the toggle should always show the real current state.
    getExistingPushSubscription()
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => {})
      .finally(() => setPushChecked(true));
  }, []);

  async function handleAvatarSelect(newAvatar: string) {
    setAvatar(newAvatar);
    setAvatarSaving(true);
    try {
      await api.put("/api/settings", { avatar: newAvatar });
      await refreshAuth();
      toast.success("Avatar mis à jour");
    } catch {
      toast.error("Échec de la mise à jour de l'avatar");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function toggleStatus(v: boolean) {
    const newStatus = v ? "online" : "offline";
    setOnlineStatus(newStatus);
    setStatusSaving(true);
    try {
      await api.put("/api/settings", { online_status: newStatus });
      await refreshAuth();
      toast.success(v ? "Vous êtes maintenant en ligne" : "Vous êtes maintenant hors ligne");
    } catch {
      setOnlineStatus(onlineStatus); // revert
      toast.error("Échec de la mise à jour du statut");
    } finally {
      setStatusSaving(false);
    }
  }

  async function togglePush(v: boolean) {
    setPushSaving(true);
    try {
      if (v) {
        await subscribeToPush();
        toast.success("Notifications push activées");
      } else {
        await unsubscribeFromPush();
        toast.info("Notifications push désactivées");
      }
      setPushEnabled(v);
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'activation des notifications");
    } finally {
      setPushSaving(false);
    }
  }

  async function toggleAutoBacktest(v: boolean) {
    setAutoBacktestSaving(true);
    setAutoBacktestEnabled(v);
    try {
      await api.put("/api/settings", { auto_backtest_enabled: v });
      toast.success(v ? "Backtest automatique activé" : "Backtest automatique désactivé");
    } catch {
      setAutoBacktestEnabled(!v);
      toast.error("Échec de l'enregistrement");
    } finally {
      setAutoBacktestSaving(false);
    }
  }

  async function toggleBroker(broker: "enableDeriv", value: boolean) {
    setEnableDeriv(value);
    try {
      await api.put("/api/settings", { [broker]: value });
    } catch {
      setEnableDeriv(!value);
      toast.error("Échec du changement de broker");
    }
  }

  async function handleMt5Connect() {
    if (!mt5Form.password) {
      toast.error("Entrez votre mot de passe MT5 avant de vous connecter.");
      return;
    }
    const result = await engineApiCall("mt5/connect", "POST", {
      login: parseInt(mt5Form.login) || 0,
      password: mt5Form.password,
      server: mt5Form.server.trim(),
      path: mt5Form.path.trim().replace(/^["']|["']$/g, ""),
    });
    if (!result) {
      toast.error("Échec de la requête — le moteur (backend) est-il démarré ?");
      return;
    }
    if (result.sim_mode) {
      toast.error("Connexion MT5 refusée — repassé en mode simulation. Vérifiez le login, le mot de passe et le serveur.");
    } else {
      toast.success(`Connecté à MT5 — compte ${result.account?.login}, solde ${result.account?.balance} ${result.account?.currency}`);
    }
  }

  async function handleMt5Test() {
    setMt5Testing(true);
    setMt5TestResult(null);
    try {
      const res = await fetch(`${ENGINE_API_BASE}/mt5/test`);
      if (res.ok) {
        setMt5TestResult(await res.json());
      } else {
        toast.error("Le diagnostic a échoué — le moteur a répondu une erreur.");
        setMt5TestResult({ account: false, balance: false, instruments: false, trading: false, vps: false });
      }
    } catch {
      toast.error("Le diagnostic a échoué — moteur injoignable.");
      setMt5TestResult({ account: false, balance: false, instruments: false, trading: false, vps: false });
    } finally {
      setMt5Testing(false);
    }
  }

  async function saveLocal() {
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.account, account);
    localStorage.setItem(KEYS.riskPerTrade, String(risk));
    localStorage.setItem(KEYS.maxDrawdown, String(maxDd));
    localStorage.setItem(MT5_KEY, JSON.stringify(mt5Form));
    saveDefaultStake(stake);
    await api.put("/api/settings", {
      deriv_token: token || null,
      account_type: account,
      risk_per_trade: risk,
      max_drawdown: maxDd,
    }).catch(() => {});
    toast.success("Paramètres enregistrés");
  }

  async function testConnection() {
    if (!token) {
      toast.error("Entre un token API d'abord");
      return;
    }
    setLoading(true);
    try {
      await saveLocal();
      const res = await api.post<{
        wsUrl?: string;
        loginId?: string;
        balance?: number;
        currency?: string;
        accountType?: string;
        error?: string;
      }>("/api/deriv-session", { token, account_type: account });
      if (res.error || !res.wsUrl) throw new Error(res.error ?? "Connexion échouée");
      setInfo({ id: res.loginId, balance: res.balance, currency: res.currency });
      toast.success(`Connecté: ${res.loginId} (${res.accountType})`);
    } catch (e) {
      toast.error(`Échec: ${(e as Error).message}`);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-12 space-y-6 max-w-[1400px] mx-auto pb-24">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 bg-white/[0.01] border border-white/5 p-4.5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-white to-white/75 bg-clip-text text-transparent">
            Paramètres
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Connexion Deriv MT5, backtest et notifications.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { clearToken(); window.location.href = "/login"; }}
          className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 h-10 text-xs md:text-sm rounded-xl transition-all duration-300 px-4"
        >
          <LogOut className="mr-1.5 h-4 w-4" /> Déconnexion
        </Button>
      </div>

      {/* MT5 Account — pleine largeur */}
      <CollapsibleSection
        icon={<CreditCard className="mt-1 h-5.5 w-5.5 text-emerald-400 shrink-0" />}
        title="Compte Deriv MT5"
        help="Identifiants de connexion au terminal MetaTrader 5 Deriv. Sauvegardés localement et dans le backend (.env)."
        defaultOpen
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche : Identifiants */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-neutral-300">Type de Compte</span>
                <div className="flex bg-neutral-950/80 p-1.5 rounded-xl border border-white/5 gap-1.5">
                  {(["demo", "real"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMt5Form({ ...mt5Form, account_type: t, server: t === "demo" ? "Deriv-Demo" : "Deriv-Server" })}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all text-center",
                        mt5Form.account_type === t
                          ? t === "demo"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/15 text-red-400 border border-red-500/20"
                          : "text-muted-foreground hover:text-foreground border border-transparent"
                      )}
                    >
                      {t === "demo" ? "Démo" : "Réel"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-neutral-300">Serveur</span>
                <input
                  type="text"
                  list="deriv-servers-settings"
                  value={mt5Form.server}
                  onChange={(e) => setMt5Form({ ...mt5Form, server: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs md:text-sm font-mono text-foreground focus:ring-1 focus:ring-emerald-500/50 outline-none"
                />
                <datalist id="deriv-servers-settings">
                  <option value="Deriv-Demo" />
                  <option value="Deriv-Server" />
                  <option value="Deriv-Server-02" />
                  <option value="DerivSVG-Server" />
                  <option value="DerivBVI-Server" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-neutral-300">ID Compte MT5 (Login)</span>
                <input
                  type="text"
                  value={mt5Form.login}
                  onChange={(e) => setMt5Form({ ...mt5Form, login: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs md:text-sm font-mono font-bold text-foreground focus:ring-1 focus:ring-emerald-500/50 outline-none"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-neutral-300">Mot de Passe MT5</span>
                <div className="relative">
                  <input
                    type={mt5Show ? "text" : "password"}
                    value={mt5Form.password}
                    onChange={(e) => setMt5Form({ ...mt5Form, password: e.target.value })}
                    autoComplete="off"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-xs md:text-sm font-mono font-bold text-foreground focus:ring-1 focus:ring-emerald-500/50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMt5Show((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {mt5Show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-neutral-300">Chemin Terminal MT5 (optionnel)</span>
              <input
                type="text"
                value={mt5Form.path}
                onChange={(e) => setMt5Form({ ...mt5Form, path: e.target.value })}
                placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs md:text-sm font-mono text-foreground focus:ring-1 focus:ring-emerald-500/50 outline-none"
              />
              <p className="text-[10px] text-muted-foreground">
                Sauvegardé localement et dans le backend (.env). Cliquez "Enregistrer" pour appliquer.
              </p>
            </div>

            {/* Statut + bouton connexion */}
            <div className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider",
              engineConnected && engineStatus && !engineStatus.sim_mode
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : engineConnected
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
            )}>
              {engineConnected && engineStatus && !engineStatus.sim_mode ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {engineConnected && engineStatus && !engineStatus.sim_mode
                ? `MT5 Connecté — ${engineStatus.account?.server}`
                : engineConnected
                  ? "Simulation (MT5 non connecté)"
                  : "Moteur injoignable"}
            </div>

            <Button
              onClick={handleMt5Connect}
              disabled={engineLoading}
              className="w-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/35 hover:to-cyan-500/35 text-emerald-400 border border-emerald-500/30 font-bold h-10 text-xs rounded-xl transition-all"
            >
              {engineLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wifi className="mr-1.5 h-4 w-4" />}
              Se Connecter à Deriv MT5
            </Button>
          </div>

          {/* Colonne droite : Diagnostic */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-foreground">Diagnostic de Connexion</span>
              </div>
              <Button size="sm" onClick={handleMt5Test} disabled={mt5Testing} className="gap-1.5 text-xs font-bold rounded-xl">
                <TestTube className="h-3.5 w-3.5" /> {mt5Testing ? "Test..." : "Diagnostic"}
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { key: "account", label: "Authentification Compte MT5" },
                { key: "balance", label: "Récupération du Solde & Equity" },
                { key: "instruments", label: `Cotations ${engineStatus?.config?.symbol ?? "instrument"}` },
                { key: "trading", label: "Permission d'Exécution d'Ordres" },
                { key: "vps", label: "Synchro VPS Serveur 24/7" },
              ].map((check) => {
                const passed = mt5TestResult ? (mt5TestResult as any)[check.key] : null;
                return (
                  <div key={check.key} className="flex items-center justify-between rounded-lg border border-white/5 bg-background/50 px-3 py-2">
                    <span className="text-[11px] font-bold text-foreground">{check.label}</span>
                    {passed === null ? (
                      <span className="text-[11px] font-bold text-muted-foreground">Non testé</span>
                    ) : passed ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-400"><XCircle className="h-3.5 w-3.5" /> Échec</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Notifications push — pleine largeur */}
      <CollapsibleSection
          icon={<Bell className="mt-1 h-5.5 w-5.5 text-amber-400 shrink-0" />}
          title="Notifications push"
          help="Alertes de trade et de pause risque envoyées même téléphone verrouillé."
        >
          {isIosNonSafari() ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400 leading-relaxed">
              Sur iPhone, Chrome ne peut pas activer les notifications — c'est une restriction d'Apple, même en l'ajoutant à l'écran d'accueil ça ne marchera pas depuis Chrome. Ouvre <span className="font-bold">aupluriel.com dans Safari</span>, puis Partager → « Sur l'écran d'accueil ».
            </div>
          ) : !isPushSupported() ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.005] p-3.5 text-xs text-muted-foreground leading-relaxed">
              Notifications push non supportées par ce navigateur.
            </div>
          ) : isIosNonStandalone() ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-400 leading-relaxed">
              Sur iPhone, ajoute Au Pluriel à l'écran d'accueil (Partager → « Sur l'écran d'accueil ») pour activer les notifications — un onglet Safari classique ne peut pas les recevoir téléphone verrouillé.
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                pushEnabled ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.005] border-white/5",
              )}
            >
              <div>
                <h4 className="text-xs md:text-sm text-neutral-200 font-bold">Activer les notifications</h4>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                  Trade clôturé, bot en pause (protection de risque).
                </p>
              </div>
              <Switch checked={pushEnabled} disabled={pushSaving || !pushChecked} onCheckedChange={togglePush} />
            </div>
          )}
        </CollapsibleSection>

      {/* Global Unified Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        <p className="text-[11px] md:text-xs text-muted-foreground leading-normal max-w-2xl text-center sm:text-left">
          Avertissement : Au Pluriel est un outil d'analyse. Le trading de Crypto et Forex comporte un risque important
          de perte en capital. Les performances passées ne préjugent pas des performances futures.
        </p>
        <Button
          onClick={saveLocal}
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-400 to-violet-500 hover:opacity-90 text-background font-bold text-xs md:text-sm rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-300 h-11"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Enregistrer toutes les modifications
        </Button>
      </div>
      <ConfirmDialog state={confirmState} />
    </div>
  );
}