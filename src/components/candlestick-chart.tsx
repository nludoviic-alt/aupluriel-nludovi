import React from "react";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Line } from "recharts";

interface CandleItem {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Overlays {
  ema50?: number[];
  ema200?: number[];
  bbUpper?: number[];
  bbLower?: number[];
  bbMiddle?: number[];
}

export const CandlestickChart = React.memo(function CandlestickChart({
  data,
  overlays,
  chartHeight = 380,
}: {
  data: CandleItem[];
  overlays?: Overlays;
  chartHeight?: number;
}) {
  const chartData = data.map((d, i) => ({
    ...d,
    ema50: overlays?.ema50?.[i],
    ema200: overlays?.ema200?.[i],
    bbUpper: overlays?.bbUpper?.[i],
    bbLower: overlays?.bbLower?.[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <ComposedChart data={chartData}>
        <XAxis
          dataKey="t"
          tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          stroke="oklch(0.7 0.03 255 / 0.5)"
          fontSize={11}
          minTickGap={40}
        />
        <YAxis domain={["auto", "auto"]} stroke="oklch(0.7 0.03 255 / 0.5)" fontSize={11} width={70} />
        <Tooltip
          contentStyle={{
            background: "oklch(0.20 0.035 260)",
            border: "1px solid oklch(1 0 0 / 0.08)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
        />
        <Line type="monotone" dataKey="close" stroke="var(--primary, #f97316)" strokeWidth={1.6} dot={false} name="Prix" />
        {overlays?.ema50 && <Line type="monotone" dataKey="ema50" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="EMA 50" />}
        {overlays?.ema200 && <Line type="monotone" dataKey="ema200" stroke="#a855f7" strokeWidth={1.2} dot={false} name="EMA 200" />}
      </ComposedChart>
    </ResponsiveContainer>
  );
});
