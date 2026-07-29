export const SYMBOLS = [
  { deriv: "R_100", label: "Volatility 100 Index", market: "volatility" },
  { deriv: "R_75", label: "Volatility 75 Index", market: "volatility" },
  { deriv: "cryBTCUSD", label: "BTC/USD", market: "crypto" },
  { deriv: "cryETHUSD", label: "ETH/USD", market: "crypto" },
  { deriv: "frxEURUSD", label: "EUR/USD", market: "forex" },
  { deriv: "frxGBPUSD", label: "GBP/USD", market: "forex" },
];

export const GRANULARITY: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
};
