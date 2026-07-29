import { Button } from "@/components/ui/button";

export function AvatarPicker({
  currentAvatar,
  onSelect,
}: {
  currentAvatar: string;
  onSelect: (avatar: string) => void;
}) {
  const avatars = ["⚡", "🤖", "📈", "🛡️", "🔮", "💎"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {avatars.map((a) => (
        <button
          key={a}
          onClick={() => onSelect(a)}
          className={`h-9 w-9 rounded-xl border flex items-center justify-center text-base transition-all ${
            currentAvatar === a ? "bg-primary/20 border-primary" : "border-border/50 bg-card/60 hover:bg-accent"
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
