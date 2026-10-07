import type { Position, Token } from '../../shared/types.ts';

// Tokens that read best as the "price in" unit, most preferred first.
const QUOTES = ['USDC', 'USDT', 'DAI', 'USDS', 'USDe', 'PYUSD', 'USD1', 'WETH', 'ETH', 'WSOL', 'SOL', 'WBTC', 'cbBTC'];

export type StatusKey = 'in' | 'near' | 'out' | 'closed';
export interface Status {
  key: StatusKey;
  label: string;
  /** Sort order: positions needing attention first. */
  rank: number;
}

export function statusOf(p: Position, nearEdgeThreshold: number): Status {
  if (p.closed) return { key: 'closed', label: 'Closed', rank: 3 };
  if (!p.inRange) return { key: 'out', label: 'Out of range', rank: 0 };
  if (p.rangePosition < nearEdgeThreshold || p.rangePosition > 1 - nearEdgeThreshold) {
    return { key: 'near', label: 'Near edge', rank: 1 };
  }
  return { key: 'in', label: 'In range', rank: 2 };
}

/** Should prices read as token0-per-token1 instead of the raw token1-per-token0? */
export function defaultInverted(p: Position) {
  const rank = (t: Token) => {
    const i = QUOTES.indexOf(t.symbol);
    return i === -1 ? Infinity : i;
  };
  return rank(p.token0) < rank(p.token1);
}

export interface PriceView {
  base: Token;
  quote: Token;
  lower: number;
  upper: number;
  current: number;
  /** Where a tick sits along the range bar: 0 = min edge, 1 = max edge. */
  frac: (tick: number) => number;
}

export function priceView(p: Position, inverted: boolean): PriceView {
  return {
    base: inverted ? p.token1 : p.token0,
    quote: inverted ? p.token0 : p.token1,
    lower: inverted ? 1 / p.priceUpper : p.priceLower,
    upper: inverted ? 1 / p.priceLower : p.priceUpper,
    current: inverted ? 1 / p.priceCurrent : p.priceCurrent,
    // Tick space is log-price, so this stays linear in either orientation.
    frac: (t) => {
      const f = (t - p.tickLower) / (p.tickUpper - p.tickLower);
      return inverted ? 1 - f : f;
    },
  };
}

/** How far price is outside the range, or how much room is left inside it. */
export function distanceLabel(v: PriceView) {
  const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 2 : 1)}%`;
  if (v.current > v.upper) return `${pct(v.current / v.upper - 1)} above range`;
  if (v.current < v.lower) return `${pct(1 - v.current / v.lower)} below range`;
  const down = 1 - v.lower / v.current;
  const up = v.upper / v.current - 1;
  return down < up ? `${pct(down)} to min` : `${pct(up)} to max`;
}

export function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '–';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: abs >= 1000 ? 2 : 4 });
  return n.toPrecision(4);
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
