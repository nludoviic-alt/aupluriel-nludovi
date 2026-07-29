import { useEffect, useState } from "react";

/**
 * Accumule les valeurs réellement observées (prix, équité...) dans un buffer
 * borné côté client, au fil des polls/WS réels du moteur — pas une historique
 * serveur, mais de vrais échantillons observés, pas des données inventées.
 */
export function useRollingSeries(value: number | null | undefined, maxPoints = 30): number[] {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    setPoints((prev) => {
      const next = [...prev, value];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [value, maxPoints]);

  return points;
}
