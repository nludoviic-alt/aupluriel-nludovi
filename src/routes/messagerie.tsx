import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Pin,
  BellOff,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  Reply,
  Copy,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  Plus,
  Users,
  X,
  Image as ImageIcon,
  FileText,
  MapPin,
  Sticker,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import {
  CURRENT_USER,
  DEMO_USERS,
  DEMO_CHATS,
  DEMO_MESSAGES,
  userById,
  initials,
  formatTime,
  formatChatTime,
  dayLabel,
  loadState,
  saveState,
  type Chat,
  type Message,
  type Reaction,
  type MessengerState,
} from "@/lib/messenger-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messagerie")({
  head: () => ({
    meta: [
      { title: "Messagerie — Au Pluriel" },
      { name: "description", content: "Messagerie interne style Telegram pour l'équipe Au Pluriel." },
    ],
  }),
  component: MessengerPage,
});

const EMOJIS = ["👍","❤️","😂","🔥","🚀","🎉","👀","💡","😢","🙏","👏","💯","✅","❌","😮","🤝"];
const REACT_EMOJIS = ["👍","❤️","😂","🔥","🚀","👀"];

const FILTERS = ["Tous", "Non lus", "Groupes", "Directs"] as const;
type Filter = (typeof FILTERS)[number];

function MessengerPage() {
  const [state, setState] = useState<MessengerState>({ chats: DEMO_CHATS, messages: DEMO_MESSAGES });
  const [activeChatId, setActiveChatId] = useState<string>(state.chats[0]?.id ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Tous");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = loadState();
    setState(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const activeChat = useMemo(
    () => state.chats.find((c) => c.id === activeChatId) ?? state.chats[0],
    [state.chats, activeChatId],
  );

  const messages = useMemo(
    () => (activeChat ? state.messages[activeChat.id] ?? [] : []),
    [state.messages, activeChat],
  );

  // Simulated typing indicator when opening chat
  useEffect(() => {
    if (!activeChat || activeChat.kind === "group") return setTyping(null);
    const other = activeChat.memberIds.find((id) => id !== CURRENT_USER.id);
    if (!other) return;
    const otherUser = userById(other);
    if (otherUser.status !== "online") return;
    const t = setTimeout(() => {
      setTyping(otherUser.name);
      setTimeout(() => setTyping(null), 2400);
    }, 1200);
    return () => clearTimeout(t);
  }, [activeChat]);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeChatId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChatId, editing?.id, replyTo?.id]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let list = state.chats.map((c) => {
      const msgs = state.messages[c.id] ?? [];
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter(
        (m) => m.authorId !== CURRENT_USER.id && !(m.readBy ?? []).includes(CURRENT_USER.id),
      ).length;
      return { chat: c, last, unread };
    });
    if (filter === "Non lus") list = list.filter((x) => x.unread > 0);
    if (filter === "Groupes") list = list.filter((x) => x.chat.kind === "group");
    if (filter === "Directs") list = list.filter((x) => x.chat.kind === "dm");
    if (q) list = list.filter((x) => x.chat.title.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (a.chat.pinned !== b.chat.pinned) return a.chat.pinned ? -1 : 1;
      const at = a.last?.createdAt ?? a.chat.createdAt ?? now;
      const bt = b.last?.createdAt ?? b.chat.createdAt ?? now;
      return bt - at;
    });
  }, [state.chats, state.messages, search, filter]);

  // mark active chat as read
  useEffect(() => {
    if (!activeChat) return;
    setState((prev) => {
      const msgs = prev.messages[activeChat.id];
      if (!msgs) return prev;
      let changed = false;
      const next = msgs.map((m) => {
        if (m.authorId !== CURRENT_USER.id && !(m.readBy ?? []).includes(CURRENT_USER.id)) {
          changed = true;
          return { ...m, readBy: [...(m.readBy ?? []), CURRENT_USER.id] };
        }
        return m;
      });
      if (!changed) return prev;
      return { ...prev, messages: { ...prev.messages, [activeChat.id]: next } };
    });
  }, [activeChatId, activeChat]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeChat) return;

    if (editing) {
      setState((prev) => ({
        ...prev,
        messages: {
          ...prev.messages,
          [activeChat.id]: (prev.messages[activeChat.id] ?? []).map((m) =>
            m.id === editing.id ? { ...m, text, editedAt: Date.now() } : m,
          ),
        },
      }));
      setEditing(null);
      setDraft("");
      return;
    }

    const msg: Message = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      chatId: activeChat.id,
      authorId: CURRENT_USER.id,
      text,
      createdAt: Date.now(),
      replyToId: replyTo?.id ?? null,
      readBy: [CURRENT_USER.id],
    };
    setState((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [activeChat.id]: [...(prev.messages[activeChat.id] ?? []), msg],
      },
    }));
    setDraft("");
    setReplyTo(null);

    // simulate reply
    if (activeChat.kind === "dm") {
      const other = activeChat.memberIds.find((id) => id !== CURRENT_USER.id);
      if (other) {
        const otherUser = userById(other);
        setTimeout(() => setTyping(otherUser.name), 900);
        setTimeout(() => {
          setTyping(null);
          const reply: Message = {
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            chatId: activeChat.id,
            authorId: other,
            text: pickAutoReply(text),
            createdAt: Date.now(),
            readBy: [other, CURRENT_USER.id],
          };
          setState((prev) => ({
            ...prev,
            messages: {
              ...prev.messages,
              [activeChat.id]: [...(prev.messages[activeChat.id] ?? []), reply],
            },
          }));
        }, 2600);
      }
    }
  };

  const deleteMessage = (m: Message) => {
    if (!activeChat) return;
    setState((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [activeChat.id]: (prev.messages[activeChat.id] ?? []).map((x) =>
          x.id === m.id ? { ...x, deleted: true, text: "" } : x,
        ),
      },
    }));
    toast.success("Message supprimé");
  };

  const toggleReaction = (m: Message, emoji: string) => {
    if (!activeChat) return;
    setState((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [activeChat.id]: (prev.messages[activeChat.id] ?? []).map((x) => {
          if (x.id !== m.id) return x;
          const reactions = [...(x.reactions ?? [])];
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx === -1) {
            reactions.push({ emoji, users: [CURRENT_USER.id] });
          } else {
            const r = reactions[idx];
            const has = r.users.includes(CURRENT_USER.id);
            const users = has ? r.users.filter((u) => u !== CURRENT_USER.id) : [...r.users, CURRENT_USER.id];
            if (users.length === 0) reactions.splice(idx, 1);
            else reactions[idx] = { ...r, users };
          }
          return { ...x, reactions };
        }),
      },
    }));
  };

  const togglePin = (chatId: string) => {
    setState((prev) => ({
      ...prev,
      chats: prev.chats.map((c) => (c.id === chatId ? { ...c, pinned: !c.pinned } : c)),
    }));
  };
  const toggleMute = (chatId: string) => {
    setState((prev) => ({
      ...prev,
      chats: prev.chats.map((c) => (c.id === chatId ? { ...c, muted: !c.muted } : c)),
    }));
  };

  const startNewDm = (userId: string) => {
    const existing = state.chats.find(
      (c) => c.kind === "dm" && c.memberIds.length === 2 && c.memberIds.includes(userId) && c.memberIds.includes(CURRENT_USER.id),
    );
    if (existing) {
      setActiveChatId(existing.id);
      return;
    }
    const user = userById(userId);
    const chat: Chat = {
      id: `c_${Date.now()}`,
      kind: "dm",
      title: user.name,
      memberIds: [CURRENT_USER.id, user.id],
      avatarColor: user.avatarColor,
      createdAt: Date.now(),
    };
    setState((prev) => ({ ...prev, chats: [...prev.chats, chat], messages: { ...prev.messages, [chat.id]: [] } }));
    setActiveChatId(chat.id);
  };

  // messages grouped by day
  const grouped = useMemo(() => {
    const groups: { day: string; items: Message[] }[] = [];
    for (const m of messages) {
      const label = dayLabel(m.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === label) last.items.push(m);
      else groups.push({ day: label, items: [m] });
    }
    return groups;
  }, [messages]);

  return (
    <div className="h-[calc(100dvh-5rem-3.5rem)] md:h-[calc(100dvh-5rem)] p-2 md:p-5 bg-background overflow-hidden">
      <div className="h-full flex rounded-2xl border border-border/50 overflow-hidden shadow-[var(--shadow-elevated)] bg-card/40 backdrop-blur-xl">
      {/* CHAT LIST */}

      <aside className={cn(
        "w-full md:w-[340px] shrink-0 border-r border-border/50 flex flex-col bg-sidebar/30 backdrop-blur-xl",
        mobileView === "chat" && "hidden md:flex",
      )}>
        <div className="p-4 md:p-5 space-y-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Messages
            </h2>
            <span className="text-[10px] font-mono text-primary/80">{state.chats.length} threads</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher"
                className="w-full h-10 pl-9 pr-3 rounded-full bg-background/60 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:bg-background"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-[var(--shadow-glow-orange)] hover:opacity-90">
                  <Plus className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground px-2 py-1.5">
                  NOUVELLE CONVERSATION
                </p>
                {DEMO_USERS.filter((u) => u.id !== CURRENT_USER.id).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startNewDm(u.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent text-left"
                  >
                    <Avatar name={u.name} color={u.avatarColor} status={u.status} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.handle}</p>
                    </div>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-1 text-xs font-semibold overflow-x-auto scrollbar-thin">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  "px-3 py-1.5 rounded-full whitespace-nowrap transition-colors " +
                  (filter === f
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent")
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 md:p-3 space-y-1.5">
          {filteredChats.map(({ chat, last, unread }) => {
            const active = chat.id === activeChatId;
            const author = last ? userById(last.authorId) : null;
            const preview = last?.deleted
              ? "Message supprimé"
              : last
              ? `${chat.kind === "group" && author ? (author.id === CURRENT_USER.id ? "Vous" : author.name.split(" ")[0]) + ": " : ""}${last.text}`
              : "Nouvelle conversation";
            return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setMobileView("chat");
                }}
                className={
                  "relative w-full flex items-start gap-3 px-3 py-3.5 rounded-2xl text-left transition-all " +
                  (active
                    ? "bg-accent/60 border border-border/60"
                    : "border border-transparent hover:bg-accent/30")
                }
              >
                {active && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary shadow-[0_0_12px_var(--primary)]" />
                )}
                <Avatar
                  name={chat.title}
                  color={chat.avatarColor}
                  status={chat.kind === "dm" ? userById(chat.memberIds.find((i) => i !== CURRENT_USER.id) ?? "").status : undefined}
                  isGroup={chat.kind === "group"}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={"text-sm truncate flex-1 " + (active ? "font-bold text-foreground" : "font-semibold text-foreground/95")}>
                      {chat.title}
                    </p>
                    {chat.muted && <BellOff className="h-3 w-3 text-muted-foreground" />}
                    {chat.pinned && <Pin className="h-3 w-3 text-primary" />}
                    <span className={"text-[10px] font-mono shrink-0 " + (active ? "text-primary" : "text-muted-foreground")}>
                      {last ? formatChatTime(last.createdAt) : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={"text-xs truncate flex-1 " + (unread ? "text-foreground/90" : "text-muted-foreground")}>
                      {preview}
                    </p>
                    {unread > 0 && (
                      <span className={"shrink-0 rounded-full text-[10px] font-bold h-5 min-w-5 px-1.5 flex items-center justify-center " + (chat.muted ? "bg-muted-foreground/40 text-background" : "bg-primary text-primary-foreground shadow-[var(--shadow-glow-orange)]")}>
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredChats.length === 0 && (
            <div className="p-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/20 grid place-items-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Aucune conversation</p>
            </div>
          )}
        </div>
      </aside>

      {/* CHAT WINDOW */}
      {activeChat ? (
        <section className={cn(
          "flex-1 min-w-0 flex flex-col relative bg-background/20",
          mobileView === "list" && "hidden md:flex",
        )}>
          {/* Header */}
          <header className="h-[72px] shrink-0 flex items-center gap-3 px-4 md:px-5 border-b border-border/40 bg-card/40 backdrop-blur-md">
            <button
              onClick={() => setMobileView("list")}
              className="md:hidden h-9 w-9 rounded-full hover:bg-accent grid place-items-center text-muted-foreground shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setShowInfo((s) => !s)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <Avatar
                name={activeChat.title}
                color={activeChat.avatarColor}
                status={activeChat.kind === "dm" ? userById(activeChat.memberIds.find((i) => i !== CURRENT_USER.id) ?? "").status : undefined}
                isGroup={activeChat.kind === "group"}
                size={44}
              />
              <div className="min-w-0">
                <p className="font-bold truncate leading-tight">{activeChat.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                  {typing ? (
                    <span className="text-primary font-medium">{typing} écrit...</span>
                  ) : activeChat.kind === "group" ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                      <span>{activeChat.memberIds.length} membres · {activeChat.memberIds.filter((id) => userById(id).status === "online").length} en ligne</span>
                    </>
                  ) : (
                    presenceLabel(activeChat)
                  )}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-0.5 md:gap-1">
              <IconBtn label="Appel"><Phone className="h-4 w-4" /></IconBtn>
              <IconBtn label="Visio"><Video className="h-4 w-4" /></IconBtn>
              <span className="hidden md:block"><IconBtn label="Rechercher"><Search className="h-4 w-4" /></IconBtn></span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full hover:bg-accent grid place-items-center text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => togglePin(activeChat.id)}>
                    <Pin className="h-4 w-4" /> {activeChat.pinned ? "Retirer l'épingle" : "Épingler"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleMute(activeChat.id)}>
                    <BellOff className="h-4 w-4" /> {activeChat.muted ? "Réactiver notifications" : "Couper les notifications"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInfo((s) => !s)}>
                    <Users className="h-4 w-4" /> Infos & membres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        messages: { ...prev.messages, [activeChat.id]: [] },
                      }));
                      toast.success("Historique vidé");
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Vider l'historique
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto scrollbar-thin px-3 md:px-8 py-6 space-y-1"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 10%, oklch(0.72 0.18 55 / 6%) 0, transparent 45%), radial-gradient(circle at 80% 90%, oklch(0.75 0.13 190 / 5%) 0, transparent 40%)",
            }}
          >
            {grouped.map((group) => (
              <div key={group.day}>
                <div className="flex justify-center my-4">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground bg-background/70 backdrop-blur border border-border rounded-full px-3 py-1">
                    {group.day}
                  </span>
                </div>
                {group.items.map((m, i) => {
                  const prev = group.items[i - 1];
                  const showAuthor =
                    activeChat.kind === "group" &&
                    m.authorId !== CURRENT_USER.id &&
                    (!prev || prev.authorId !== m.authorId);
                  const mine = m.authorId === CURRENT_USER.id;
                  const author = userById(m.authorId);
                  const replied = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;

                  return (
                    <div
                      key={m.id}
                      className={
                        "group flex items-end gap-2 " + (mine ? "justify-end" : "justify-start") + (i > 0 ? " mt-0.5" : "")
                      }
                    >
                      {!mine && (
                        <div className="w-8 shrink-0 self-end">
                          {(!prev || prev.authorId !== m.authorId) && (
                            <Avatar name={author.name} color={author.avatarColor} size={32} />
                          )}
                        </div>
                      )}
                      <div className={"max-w-[80%] md:max-w-[70%] flex flex-col " + (mine ? "items-end" : "items-start")}>
                        {showAuthor && (
                          <span className="text-[11px] font-bold text-primary mb-0.5 ml-3">{author.name}</span>
                        )}
                        <MessageBubble
                          m={m}
                          mine={mine}
                          replied={replied ?? undefined}
                          onReply={() => setReplyTo(m)}
                          onEdit={() => {
                            setEditing(m);
                            setDraft(m.text);
                          }}
                          onDelete={() => deleteMessage(m)}
                          onReact={(e) => toggleReaction(m, e)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-2 mt-2">
                <div className="w-8 shrink-0" />
                <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Reply / edit preview */}
          {(replyTo || editing) && (
            <div className="mx-3 md:mx-8 mb-2 flex items-center gap-3 bg-card/70 border border-border rounded-xl px-3 py-2 border-l-4 border-l-primary">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  {editing ? "Modifier" : `Répondre à ${userById((replyTo as Message).authorId).name}`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(editing ?? replyTo)?.text}
                </p>
              </div>
              <button
                onClick={() => {
                  setReplyTo(null);
                  if (editing) {
                    setEditing(null);
                    setDraft("");
                  }
                }}
                className="h-7 w-7 rounded-full hover:bg-accent grid place-items-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="p-3 md:p-5 border-t border-border/40 bg-card/40 backdrop-blur-md">
            <div className="flex items-end gap-2 rounded-2xl bg-background/80 border border-border/80 focus-within:border-primary/50 focus-within:shadow-[0_0_24px_-6px_var(--primary)] transition-all px-2 py-2">

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full hover:bg-accent grid place-items-center text-muted-foreground shrink-0 hidden sm:grid">
                    <Paperclip className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => toast("Photo — bientôt")}><ImageIcon className="h-4 w-4" /> Photo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast("Fichier — bientôt")}><FileText className="h-4 w-4" /> Fichier</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast("Sticker — bientôt")}><Sticker className="h-4 w-4" /> Sticker</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast("Localisation — bientôt")}><MapPin className="h-4 w-4" /> Localisation</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Écrire un message..."
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground focus:outline-none max-h-40 min-h-9 scrollbar-thin"
                style={{ height: "auto" }}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-9 w-9 rounded-full hover:bg-accent grid place-items-center text-muted-foreground shrink-0 hidden sm:grid">
                    <Smile className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-wider px-1 py-1">EMOJIS</p>
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setDraft((d) => d + e)}
                        className="h-8 w-8 rounded-md hover:bg-accent text-lg"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {draft.trim() ? (
                <button
                  onClick={sendMessage}
                  className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow-orange)] shrink-0 active:scale-95 transition-transform"
                >
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => toast("Vocal — bientôt")}
                  className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center hover:bg-primary/25 shrink-0"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}

            </div>
          </div>
        </section>
      ) : (
        <section className="flex-1 hidden md:grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/20 grid place-items-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        </section>
      )}

      {/* INFO PANEL */}
      {activeChat && showInfo && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setShowInfo(false)} />
          <aside className="w-full md:w-[320px] shrink-0 border-l border-border/50 bg-sidebar/30 backdrop-blur-xl flex flex-col fixed md:relative inset-y-0 right-0 z-50 md:z-auto">
          <div className="p-4 md:p-5 border-b border-border/50 flex items-center justify-between">
            <p className="font-bold">Informations</p>
            <button onClick={() => setShowInfo(false)} className="h-8 w-8 rounded-full hover:bg-accent grid place-items-center">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6 flex flex-col items-center border-b border-border/50">
            <Avatar name={activeChat.title} color={activeChat.avatarColor} isGroup={activeChat.kind === "group"} size={80} />
            <p className="mt-3 text-lg font-bold">{activeChat.title}</p>
            <p className="text-xs text-muted-foreground">
              {activeChat.kind === "group" ? `${activeChat.memberIds.length} membres` : presenceLabel(activeChat)}
            </p>
          </div>
          {activeChat.kind === "group" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground px-3 py-2">MEMBRES</p>
              {activeChat.memberIds.map((id) => {
                const u = userById(id);
                return (
                  <div key={id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/40">
                    <Avatar name={u.name} color={u.avatarColor} status={u.status} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name} {u.id === CURRENT_USER.id && <span className="text-[10px] text-primary">(vous)</span>}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.status === "online" ? "En ligne" : u.lastSeen ?? "Hors ligne"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
        </>
      )}
      </div>
    </div>
  );

}

function presenceLabel(chat: Chat): string {
  const other = chat.memberIds.find((id) => id !== CURRENT_USER.id);
  if (!other) return "";
  const u = userById(other);
  if (u.status === "online") return "En ligne";
  if (u.status === "away") return "Absent · " + (u.lastSeen ?? "");
  return "Vu " + (u.lastSeen ?? "récemment");
}

function pickAutoReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("?")) return "Bonne question, je regarde et je te reviens.";
  if (t.includes("merci")) return "Avec plaisir 🙌";
  if (t.length < 8) return "👍";
  const options = [
    "Bien reçu !",
    "Ok, noté.",
    "Intéressant, on en reparle.",
    "Je regarde ça tout de suite.",
    "Parfait, merci pour l'info.",
    "🚀",
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button title={label} className="h-9 w-9 rounded-full hover:bg-accent grid place-items-center text-muted-foreground">
      {children}
    </button>
  );
}

function Avatar({
  name,
  color,
  size = 40,
  status,
  isGroup,
}: {
  name: string;
  color: string;
  size?: number;
  status?: "online" | "away" | "offline";
  isGroup?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className="rounded-full grid place-items-center font-bold text-white/95 border border-white/10"
        style={{ background: color, width: size, height: size, fontSize: size * 0.36 }}
      >
        {isGroup ? <Users className="h-1/2 w-1/2" /> : initials(name)}
      </div>
      {status && (
        <span
          className={
            "absolute bottom-0 right-0 rounded-full border-2 border-sidebar " +
            (status === "online" ? "bg-success" : status === "away" ? "bg-warning" : "bg-muted-foreground")
          }
          style={{ height: Math.max(10, size * 0.28), width: Math.max(10, size * 0.28) }}
        />
      )}
    </div>
  );
}

function MessageBubble({
  m,
  mine,
  replied,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  m: Message;
  mine: boolean;
  replied?: Message;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  if (m.deleted) {
    return (
      <div className="italic text-xs text-muted-foreground px-3 py-1.5 rounded-2xl bg-muted/40 border border-border">
        Message supprimé
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={
          "rounded-2xl px-3.5 py-2.5 shadow-sm relative " +
          (mine
            ? "bg-gradient-to-br from-primary to-[oklch(0.62_0.2_45)] text-primary-foreground rounded-br-md"
            : "bg-card border border-border text-foreground rounded-bl-md")
        }
      >
        {replied && (
          <div
            className={
              "mb-1.5 rounded-md px-2 py-1 text-xs border-l-2 " +
              (mine
                ? "bg-primary-foreground/10 border-primary-foreground/60"
                : "bg-muted/60 border-primary")
            }
          >
            <p className={"font-bold text-[10px] " + (mine ? "text-primary-foreground/90" : "text-primary")}>
              {userById(replied.authorId).name}
            </p>
            <p className={"truncate " + (mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {replied.deleted ? "Message supprimé" : replied.text}
            </p>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
        <div className={"flex items-center gap-1 mt-1.5 text-[10px] " + (mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground")}>
          {m.editedAt && <span>modifié ·</span>}
          <span>{formatTime(m.createdAt)}</span>
          {mine && (
            (m.readBy?.length ?? 0) > 1
              ? <CheckCheck className="h-3 w-3" />
              : <Check className="h-3 w-3" />
          )}
        </div>
      </div>

      {/* Reactions */}
      {m.reactions && m.reactions.length > 0 && (
        <div className={"flex gap-1 mt-1 flex-wrap " + (mine ? "justify-end" : "justify-start")}>
          {m.reactions.map((r) => {
            const mineReact = r.users.includes(CURRENT_USER.id);
            return (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                className={
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors " +
                  (mineReact
                    ? "bg-primary/20 border-primary/40 text-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40")
                }
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] font-semibold">{r.users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hover actions */}
      {showActions && (
        <div
          className={
            "absolute -top-8 z-10 flex items-center gap-0.5 bg-popover border border-border rounded-full px-1 py-1 shadow-lg " +
            (mine ? "right-0" : "left-0")
          }
        >
          {REACT_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              className="h-7 w-7 rounded-full hover:bg-accent grid place-items-center text-base"
            >
              {e}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-0.5" />
          <button onClick={onReply} title="Répondre" className="h-7 w-7 rounded-full hover:bg-accent grid place-items-center text-muted-foreground">
            <Reply className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 rounded-full hover:bg-accent grid place-items-center text-muted-foreground">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              <DropdownMenuItem onClick={onReply}><Reply className="h-4 w-4" /> Répondre</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard?.writeText(m.text);
                  toast.success("Copié");
                }}
              >
                <Copy className="h-4 w-4" /> Copier
              </DropdownMenuItem>
              {mine && (
                <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Modifier</DropdownMenuItem>
              )}
              {mine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
