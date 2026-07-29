import type { LogEntry } from "@/hooks/use-engine";

export interface TradeRecord {
  id: number;
  time: string;
  timestamp: number;
  instrument: string;
  strategy: string;
  direction: string;
  confidence: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  result: "win" | "loss";
}

/**
 * Reconstruit les trades fermés à partir du journal réel du moteur
 * (engine/bot.py `_record_trade_result` — catégories "trade"/"execution").
 * Les entrées loguées avant l'enrichissement du backend peuvent manquer
 * certains champs ; on affiche "—" plutôt que de deviner une valeur.
 */
export function logsToTrades(logs: LogEntry[]): TradeRecord[] {
  const trades: TradeRecord[] = [];
  let id = 0;
  for (const log of logs) {
    if (log.category !== "trade" && log.category !== "execution") continue;
    const data = log.data ?? {};
    const profit = (data.profit as number) ?? (data.pnl as number) ?? 0;
    const isWin = (data.result as string) === "win" || profit > 0;
    trades.push({
      id: ++id,
      timestamp: log.timestamp,
      time: log.datetime || new Date(log.timestamp * 1000).toLocaleString("fr-FR"),
      instrument: (data.symbol as string) ?? "—",
      strategy: (data.strategy as string) ?? "—",
      direction: (data.direction as string) ?? "—",
      confidence: (data.confidence as number) ?? 0,
      entry_price: (data.entry_price as number) ?? 0,
      exit_price: (data.exit_price as number) ?? 0,
      pnl: profit,
      result: isWin ? "win" : "loss",
    });
  }
  return trades.sort((a, b) => b.id - a.id);
}
