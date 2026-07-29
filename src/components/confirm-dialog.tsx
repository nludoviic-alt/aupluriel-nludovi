import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  resolve?: (val: boolean) => void;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirmer",
  });

  const confirm = (opts: { title: string; description: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel || "Confirmer",
        danger: opts.danger,
        resolve: (result: boolean) => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(result);
        },
      });
    });
  };

  return { confirmState, confirm };
}

export function ConfirmDialog({ state }: { state: ConfirmState }) {
  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="rounded-xl border border-border bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-foreground">{state.title}</h3>
        <p className="text-xs text-muted-foreground">{state.description}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => state.resolve?.(false)}
            className="text-xs rounded-lg"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            variant={state.danger ? "destructive" : "default"}
            onClick={() => state.resolve?.(true)}
            className="text-xs rounded-lg font-bold"
          >
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
