import type { Position } from '../../shared/types.ts';
import { fmt, type PriceView } from '../lib/positions.ts';

export function RangeBar({ position, view }: { position: Position; view: PriceView }) {
  // Pad the domain so the band sits mid-track and an out-of-range marker stays visible.
  const current = view.frac(position.tickCurrent);
  const lo = Math.min(-0.3, current - 0.08);
  const hi = Math.max(1.3, current + 0.08);
  const pct = (f: number) => ((f - lo) / (hi - lo)) * 100;

  return (
    <div className="range" title={`Current ${fmt(view.current)} ${view.quote.symbol} per ${view.base.symbol}`}>
      <div className="track" />
      <div className="band" style={{ left: `${pct(0)}%`, width: `${pct(1) - pct(0)}%` }} />
      <div className="marker" style={{ left: `${pct(current)}%` }} />
    </div>
  );
}
