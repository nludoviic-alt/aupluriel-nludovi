export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0] || 0;
  for (let i = 0; i < values.length; i++) {
    const val = values[i] * k + prev * (1 - k);
    result.push(val);
    prev = val;
  }
  return result;
}

export function bollinger(values: number[], period: number = 20, stdDevMult: number = 2) {
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      middle.push(values[i]);
      upper.push(values[i]);
      lower.push(values[i]);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    middle.push(mean);
    upper.push(mean + sd * stdDevMult);
    lower.push(mean - sd * stdDevMult);
  }
  return { middle, upper, lower };
}

export function rsi(values: number[], period: number = 14): number[] {
  const result: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (i <= period) {
      if (diff >= 0) gains += diff;
      else losses -= diff;
      result.push(50);
      continue;
    }
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    gains = (gains * (period - 1) + gain) / period;
    losses = (losses * (period - 1) + loss) / period;
    const rs = losses === 0 ? 100 : gains / losses;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

export function macd(values: number[], fast: number = 12, slow: number = 26, signalPeriod: number = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = fastEma.map((f, i) => f - slowEma[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export function stochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3) {
  const k: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) {
      k.push(50);
      continue;
    }
    const hSlice = highs.slice(i - kPeriod + 1, i + 1);
    const lSlice = lows.slice(i - kPeriod + 1, i + 1);
    const maxH = Math.max(...hSlice);
    const minL = Math.min(...lSlice);
    const currK = maxH === minL ? 50 : ((closes[i] - minL) / (maxH - minL)) * 100;
    k.push(currK);
  }
  const d = ema(k, dPeriod);
  return { k, d };
}
