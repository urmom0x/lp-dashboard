import type { Position } from '../../shared/types.ts';
import { distanceLabel, fmt, priceView, shortAddress, type Status } from '../lib/positions.ts';
import { RangeBar } from './RangeBar.tsx';
import { StatusDot } from './StatusDot.tsx';

interface Props {
  position: Position;
  status: Status;
  inverted: boolean;
  onFlip: () => void;
}

export function PositionCard({ position: p, status, inverted, onFlip }: Props) {
  const v = priceView(p, inverted);
  const pair = (a: number, b: number) => `${fmt(a)} ${p.token0.symbol} · ${fmt(b)} ${p.token1.symbol}`;

  return (
    <article className={`card${p.closed ? ' closed' : ''}`}>
      <div className="card-head">
        <div>
          <div className="pair">{p.token0.symbol} / {p.token1.symbol}</div>
          <div className="meta">
            {[p.protocol, p.feeTier, shortAddress(p.owner)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <StatusDot status={status.key} label={status.label} />
      </div>

      <RangeBar position={p} view={v} />

      <div className="prices">
        <div><div className="k">Min</div><div className="v">{fmt(v.lower)}</div></div>
        <div><div className="k">Current</div><div className="v">{fmt(v.current)}</div></div>
        <div><div className="k">Max</div><div className="v">{fmt(v.upper)}</div></div>
      </div>
      <div className="unit">
        <span>
          {v.quote.symbol} per {v.base.symbol}
          {!p.closed && ` · ${distanceLabel(v)}`}
        </span>
        <button type="button" onClick={onFlip} title="Invert price">⇄</button>
      </div>

      <dl>
        <dt>Holding</dt>
        <dd>{pair(p.amounts.amount0, p.amounts.amount1)}</dd>
        {p.fees && (
          <>
            <dt>Unclaimed fees</dt>
            <dd>{pair(p.fees.amount0, p.fees.amount1)}</dd>
          </>
        )}
      </dl>

      <a href={p.url} target="_blank" rel="noopener">Open in {p.protocol.split(' ')[0]} ↗</a>
    </article>
  );
}
