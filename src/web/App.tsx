import { useEffect, useMemo, useState } from 'react';
import { Filters, type ChainFilter } from './components/Filters.tsx';
import { PositionCard } from './components/PositionCard.tsx';
import { SummaryTiles } from './components/SummaryTiles.tsx';
import { useFlipped } from './hooks/useFlipped.ts';
import { usePositions } from './hooks/usePositions.ts';
import { defaultInverted, statusOf, type StatusKey } from './lib/positions.ts';

export function App() {
  const { data, error, loading, refresh } = usePositions();
  const [flipped, setFlipped] = useFlipped();
  const [chain, setChain] = useState<ChainFilter>('all');
  const [showClosed, setShowClosed] = useState(false);

  const threshold = data?.nearEdgeThreshold ?? 0.1;
  const inChain = useMemo(
    () => (data?.positions ?? []).filter((p) => chain === 'all' || p.chain === chain),
    [data, chain],
  );

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { in: 0, near: 0, out: 0, closed: 0 };
    for (const p of inChain) c[statusOf(p, threshold).key]++;
    return c;
  }, [inChain, threshold]);

  const visible = useMemo(
    () => inChain
      .filter((p) => showClosed || !p.closed)
      .map((p) => ({ p, status: statusOf(p, threshold) }))
      .sort((a, b) => a.status.rank - b.status.rank || a.p.rangePosition - b.p.rangePosition),
    [inChain, showClosed, threshold],
  );

  useEffect(() => {
    document.title = counts.out ? `(${counts.out} out) LP Positions` : 'LP Positions';
  }, [counts.out]);

  return (
    <>
      <header>
        <div>
          <h1>LP Positions</h1>
          <p className="muted">
            {data
              ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()} · auto-refreshes every minute`
              : 'Loading…'}
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>Refresh</button>
      </header>

      <SummaryTiles counts={counts} total={inChain.length - counts.closed} />
      <Filters chain={chain} onChainChange={setChain} showClosed={showClosed} onShowClosedChange={setShowClosed} />

      {error && <div className="error">⚠ Failed to load positions: {error}</div>}
      {data?.errors.map((e) => <div className="error" key={e}>⚠ {e}</div>)}

      <main className="grid">
        {visible.map(({ p, status }) => {
          const inverted = flipped[p.id] ?? defaultInverted(p);
          return (
            <PositionCard
              key={`${p.chain}-${p.id}`}
              position={p}
              status={status}
              inverted={inverted}
              onFlip={() => setFlipped(p.id, !inverted)}
            />
          );
        })}
        {data && !visible.length && <p className="empty">No positions found for the configured wallets.</p>}
      </main>
    </>
  );
}
