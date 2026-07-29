export type UserId = string;

export type ChatUser = {
  id: UserId;
  name: string;
  handle: string;
  avatarColor: string;
  status: "online" | "away" | "offline";
  lastSeen?: string;
};

export type Reaction = { emoji: string; users: UserId[] };

export type Message = {
  id: string;
  chatId: string;
  authorId: UserId;
  text: string;
  createdAt: number; // epoch ms
  editedAt?: number;
  deleted?: boolean;
  replyToId?: string | null;
  reactions?: Reaction[];
  readBy?: UserId[];
};

export type Chat = {
  id: string;
  kind: "dm" | "group";
  title: string;
  memberIds: UserId[];
  avatarColor: string;
  pinned?: boolean;
  muted?: boolean;
  createdAt: number;
};

export const CURRENT_USER: ChatUser = {
  id: "u_me",
  name: "Ludovic",
  handle: "@ludovic",
  avatarColor: "linear-gradient(135deg, oklch(0.72 0.18 55), oklch(0.55 0.22 40))",
  status: "online",
};

export const DEMO_USERS: ChatUser[] = [
  CURRENT_USER,
  { id: "u_sofia", name: "Sofia Meunier", handle: "@sofia", avatarColor: "linear-gradient(135deg, oklch(0.7 0.2 300), oklch(0.5 0.25 320))", status: "online" },
  { id: "u_marc", name: "Marc Delacroix", handle: "@marc.d", avatarColor: "linear-gradient(135deg, oklch(0.75 0.13 190), oklch(0.55 0.15 220))", status: "online" },
  { id: "u_alina", name: "Alina Roux", handle: "@alina", avatarColor: "linear-gradient(135deg, oklch(0.72 0.17 155), oklch(0.55 0.2 160))", status: "away", lastSeen: "il y a 12 min" },
  { id: "u_kenji", name: "Kenji Tanaka", handle: "@kenji", avatarColor: "linear-gradient(135deg, oklch(0.65 0.22 25), oklch(0.5 0.2 15))", status: "offline", lastSeen: "il y a 2 h" },
  { id: "u_nadia", name: "Nadia Cissé", handle: "@nadia", avatarColor: "linear-gradient(135deg, oklch(0.78 0.16 80), oklch(0.6 0.18 70))", status: "online" },
  { id: "u_lucas", name: "Lucas Fournier", handle: "@lucas", avatarColor: "linear-gradient(135deg, oklch(0.65 0.2 260), oklch(0.5 0.2 280))", status: "offline", lastSeen: "hier" },
];

export const DEMO_CHATS: Chat[] = [
  { id: "c_signals", kind: "group", title: "Salle des Signaux", memberIds: ["u_me","u_sofia","u_marc","u_alina","u_kenji","u_nadia","u_lucas"], avatarColor: "linear-gradient(135deg, oklch(0.72 0.18 55), oklch(0.55 0.22 40))", pinned: true, createdAt: Date.now() - 86400000 * 30 },
  { id: "c_sofia", kind: "dm", title: "Sofia Meunier", memberIds: ["u_me","u_sofia"], avatarColor: "linear-gradient(135deg, oklch(0.7 0.2 300), oklch(0.5 0.25 320))", pinned: true, createdAt: Date.now() - 86400000 * 20 },
  { id: "c_quant", kind: "group", title: "Quant Lab · Recherche", memberIds: ["u_me","u_marc","u_kenji","u_lucas"], avatarColor: "linear-gradient(135deg, oklch(0.75 0.13 190), oklch(0.55 0.15 220))", createdAt: Date.now() - 86400000 * 14 },
  { id: "c_marc", kind: "dm", title: "Marc Delacroix", memberIds: ["u_me","u_marc"], avatarColor: "linear-gradient(135deg, oklch(0.75 0.13 190), oklch(0.55 0.15 220))", createdAt: Date.now() - 86400000 * 10 },
  { id: "c_alina", kind: "dm", title: "Alina Roux", memberIds: ["u_me","u_alina"], avatarColor: "linear-gradient(135deg, oklch(0.72 0.17 155), oklch(0.55 0.2 160))", createdAt: Date.now() - 86400000 * 7 },
  { id: "c_risk", kind: "group", title: "Risk & Compliance", memberIds: ["u_me","u_nadia","u_alina"], avatarColor: "linear-gradient(135deg, oklch(0.78 0.16 80), oklch(0.6 0.18 70))", muted: true, createdAt: Date.now() - 86400000 * 5 },
  { id: "c_kenji", kind: "dm", title: "Kenji Tanaka", memberIds: ["u_me","u_kenji"], avatarColor: "linear-gradient(135deg, oklch(0.65 0.22 25), oklch(0.5 0.2 15))", createdAt: Date.now() - 86400000 * 3 },
  { id: "c_nadia", kind: "dm", title: "Nadia Cissé", memberIds: ["u_me","u_nadia"], avatarColor: "linear-gradient(135deg, oklch(0.78 0.16 80), oklch(0.6 0.18 70))", createdAt: Date.now() - 86400000 * 2 },
];

const now = Date.now();
const m = (id: string, chatId: string, authorId: UserId, text: string, minutesAgo: number, extra: Partial<Message> = {}): Message => ({
  id, chatId, authorId, text, createdAt: now - minutesAgo * 60000, readBy: ["u_me", authorId], ...extra,
});

export const DEMO_MESSAGES: Record<string, Message[]> = {
  c_signals: [
    m("m1", "c_signals", "u_marc", "Bonjour l'équipe ☕", 60 * 26),
    m("m2", "c_signals", "u_sofia", "Nouveau signal BTC en préparation, RSI diverge sur H1.", 60 * 25),
    m("m3", "c_signals", "u_me", "Bien reçu Sofia, je regarde le carnet d'ordres.", 60 * 24),
    m("m4", "c_signals", "u_alina", "Attention au news US 14h30 (CPI).", 60 * 4, { reactions: [{ emoji: "👀", users: ["u_me","u_marc","u_sofia"] }] }),
    m("m5", "c_signals", "u_sofia", "Signal ETH publié : long 1893 → TP 1930 / SL 1878", 45, { reactions: [{ emoji: "🔥", users: ["u_me","u_kenji","u_nadia"] }, { emoji: "🚀", users: ["u_lucas"] }] }),
    m("m6", "c_signals", "u_me", "Position ouverte, 0.5% du portefeuille.", 42),
    m("m7", "c_signals", "u_kenji", "Volume anormal sur Volatility 100 les 15 dernières minutes.", 8),
    m("m8", "c_signals", "u_nadia", "Je confirme, spike de +12% du turnover.", 3),
  ],
  c_sofia: [
    m("s1", "c_sofia", "u_sofia", "Salut Ludovic, tu as vu la config sur EUR/USD ?", 60 * 3),
    m("s2", "c_sofia", "u_me", "Oui, hammer sur H4 + support 1.1400. Joli setup.", 60 * 3 - 5),
    m("s3", "c_sofia", "u_sofia", "Je pense entrer petit, target 1.1470.", 60 * 2),
    m("s4", "c_sofia", "u_me", "Go, je te suis avec la moitié de la size.", 60),
    m("s5", "c_sofia", "u_sofia", "🚀🚀", 20, { reactions: [{ emoji: "❤️", users: ["u_me"] }] }),
    m("s6", "c_sofia", "u_sofia", "Tu es dispo ce soir pour la revue hebdo ?", 5),
  ],
  c_quant: [
    m("q1", "c_quant", "u_lucas", "J'ai reproduit le backtest 2019-2024, Sharpe 1.72.", 60 * 8),
    m("q2", "c_quant", "u_marc", "Impressionnant. Drawdown max ?", 60 * 7),
    m("q3", "c_quant", "u_lucas", "-9.4% en mars 2020, sinon très stable.", 60 * 7 - 10),
    m("q4", "c_quant", "u_me", "On peut lancer un walk-forward sur les 12 derniers mois ?", 60 * 2),
    m("q5", "c_quant", "u_kenji", "Je m'en occupe cet après-midi.", 30),
  ],
  c_marc: [
    m("mm1", "c_marc", "u_marc", "Salut chef, journée chargée ?", 60 * 5),
    m("mm2", "c_marc", "u_me", "Grosse revue de risque avec Nadia, je te reviens.", 60 * 4),
    m("mm3", "c_marc", "u_marc", "Pas de souci 👍", 60 * 4 - 2),
  ],
  c_alina: [
    m("aa1", "c_alina", "u_alina", "Le rapport de risque hebdo est prêt.", 60 * 20),
    m("aa2", "c_alina", "u_me", "Super, j'ouvre ça ce soir.", 60 * 19),
  ],
  c_risk: [
    m("r1", "c_risk", "u_nadia", "Exposition FX en hausse cette semaine, à surveiller.", 60 * 30),
    m("r2", "c_risk", "u_alina", "Je propose un cap à 25% du NAV.", 60 * 29),
  ],
  c_kenji: [
    m("k1", "c_kenji", "u_kenji", "こんにちは! Prête pour la session asiatique ?", 60 * 12),
  ],
  c_nadia: [
    m("n1", "c_nadia", "u_nadia", "N'oublie pas la conf-call de 17h.", 60 * 6),
    m("n2", "c_nadia", "u_me", "Noté, merci Nadia.", 60 * 5),
  ],
};

const STORAGE_KEY = "aupluriel.messenger.v1";

export type MessengerState = {
  chats: Chat[];
  messages: Record<string, Message[]>;
};

export function loadState(): MessengerState {
  if (typeof window === "undefined") {
    return { chats: DEMO_CHATS, messages: DEMO_MESSAGES };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MessengerState;
  } catch {}
  return { chats: DEMO_CHATS, messages: DEMO_MESSAGES };
}

export function saveState(state: MessengerState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function userById(id: UserId): ChatUser {
  return DEMO_USERS.find((u) => u.id === id) ?? CURRENT_USER;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatChatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return formatTime(ts);
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  const diff = (today.getTime() - ts) / (86400000);
  if (diff < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Aujourd'hui";
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}
