export interface Strategy {
  id: string;
  name: string;
  pair: string;
  indicator: "RSI" | "MACD" | "EMA_CROSS" | "BB";
  buyThreshold: number;
  sellThreshold: number;
  stopLoss: number;
  takeProfit: number;
  enabled: boolean;
}
