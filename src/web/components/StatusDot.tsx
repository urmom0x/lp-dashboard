import type { StatusKey } from '../lib/positions.ts';

export function StatusDot({ status, label }: { status: StatusKey; label?: string }) {
  return (
    <span className={`status ${status}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
