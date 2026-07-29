import { useEffect, useState } from "react";

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useDerivCandles(symbol: string, granularity: number = 60, count: number = 200) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const now = Math.floor(Date.now() / 1000);
    const basePrice = symbol.includes("BTC") ? 64000 : symbol.includes("ETH") ? 3400 : symbol.includes("75") ? 940 : 500;
    const items: Candle[] = [];
    let curr = basePrice;

    for (let i = count; i >= 0; i--) {
      const time = now - i * granularity;
      const change = (Math.random() - 0.49) * (basePrice * 0.005);
      const open = curr;
      const close = curr + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.002);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.002);
      curr = close;
      items.push({ epoch: time, open, high, low, close });
    }

    if (isMounted) {
      setCandles(items);
      setLoading(false);
    }

    const timer = setInterval(() => {
      if (!isMounted) return;
      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = { ...prev[prev.length - 1] };
        const tick = (Math.random() - 0.49) * (basePrice * 0.001);
        last.close += tick;
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
        return [...prev.slice(0, -1), last];
      });
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [symbol, granularity, count]);

  return { candles, loading };
}
