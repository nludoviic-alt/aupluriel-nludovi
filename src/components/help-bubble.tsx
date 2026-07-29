export function HelpBubble({ content }: { content: string }) {
  return (
    <span title={content} className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted/30 text-[10px] font-bold text-muted-foreground cursor-help">
      ?
    </span>
  );
}
