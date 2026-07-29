import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  StickyNote, Plus, Trash2, Search, Pin, Tag, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notes — Au Pluriel" }] }),
  component: NotesPage,
});

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "lio23.notes";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch { /* ignore */ }
}

function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    let result = notes;
    if (tagFilter) result = result.filter(n => n.tags.includes(tagFilter));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, search, tagFilter]);

  function persist(next: Note[]) {
    setNotes(next);
    saveNotes(next);
  }

  function createNote() {
    const note: Note = {
      id: `n${Date.now()}`,
      title: "",
      content: "",
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditing(note);
  }

  function saveNote(note: Note) {
    note.updatedAt = Date.now();
    const exists = notes.some(n => n.id === note.id);
    persist(exists ? notes.map(n => n.id === note.id ? note : n) : [note, ...notes]);
    setEditing(null);
  }

  function deleteNote(id: string) {
    persist(notes.filter(n => n.id !== id));
  }

  function togglePin(id: string) {
    persist(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <StickyNote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Carnet de bord — {notes.length} note{notes.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={createNote}
          className="bg-gradient-to-r from-[color:var(--brand-cyan)] to-[color:var(--brand-violet)] text-[color:var(--background)] font-bold h-11 text-sm sm:h-9"
        >
          <Plus className="mr-2 h-4 w-4" /> Nouvelle note
        </Button>
      </div>

      {/* Search + Tags */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full h-10 rounded-xl bg-background/60 border border-border/50 text-sm pl-9 pr-3 text-foreground"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors",
                  tagFilter === t
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
                )}
              >
                <Tag className="mr-1 inline h-3 w-3" />{t}
              </button>
            ))}
            {tagFilter && (
              <button onClick={() => setTagFilter(null)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground font-semibold">
            {notes.length === 0 ? "Aucune note" : "Aucun résultat"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {notes.length === 0 ? "Crée ta première note pour commencer." : "Essaie d'autres critères de recherche."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(note => (
            <div
              key={note.id}
              className={cn(
                "rounded-xl border p-4 space-y-3 transition-all hover:border-primary/30",
                note.pinned ? "border-primary/30 bg-primary/5" : "border-border/50 bg-card/60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground flex-1 break-words">
                  {note.title || "Sans titre"}
                </h3>
                <button
                  onClick={() => togglePin(note.id)}
                  className={cn("shrink-0 transition-colors", note.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                >
                  <Pin className="h-4 w-4" />
                </button>
              </div>
              {note.content && (
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap break-words">
                  {note.content}
                </p>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map(t => (
                    <span key={t} className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  {new Date(note.updatedAt).toLocaleDateString("fr-FR")}
                </span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditing(note)} className="h-7 px-2.5 text-[11px]">
                    Éditer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNote(note.id)}
                    className="text-destructive hover:text-destructive h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <NoteEditor
          note={editing}
          onSave={saveNote}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note: Note;
  onSave: (n: Note) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(", "));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-lg rounded-xl p-5 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold">{note.title ? "Éditer la note" : "Nouvelle note"}</h3>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Titre</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de la note..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-cyan-500/50 outline-none"
              autoFocus
            />
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Contenu</span>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Écris tes observations..."
              rows={6}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-cyan-500/50 outline-none resize-none"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Tags (séparés par virgules)</span>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="trading, btc, analyse..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-cyan-500/50 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel} className="h-10 text-sm sm:h-9">Annuler</Button>
          <Button
            onClick={() => onSave({
              ...note,
              title: title.trim(),
              content: content.trim(),
              tags: tags.split(",").map(t => t.trim()).filter(Boolean),
            })}
            className="bg-gradient-to-r from-[color:var(--brand-cyan)] to-[color:var(--brand-violet)] text-[color:var(--background)] font-bold h-10 text-sm sm:h-9"
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
