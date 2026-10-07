import type { StatusKey } from '../lib/positions.ts';
import { StatusDot } from './StatusDot.tsx';

export function SummaryTiles({ counts, total }: { counts: Record<StatusKey, number>; total: number }) {
  const tiles: { label: string; value: number; status?: StatusKey }[] = [
    { label: 'Open positions', value: total },
    { label: 'In range', value: counts.in, status: 'in' },
    { label: 'Near edge', value: counts.near, status: 'near' },
    { label: 'Out of range', value: counts.out, status: 'out' },
  ];
  return (
    <section className="tiles">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="label">
            {t.status && <StatusDot status={t.status} />}
            {t.label}
          </div>
          <div className="value">{t.value}</div>
        </div>
      ))}
    </section>
  );
}
