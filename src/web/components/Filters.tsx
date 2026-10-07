import type { Chain } from '../../shared/types.ts';

export type ChainFilter = Chain | 'all';

const OPTIONS: { value: ChainFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Ethereum', label: 'Ethereum' },
  { value: 'Solana', label: 'Solana' },
];

interface Props {
  chain: ChainFilter;
  onChainChange: (chain: ChainFilter) => void;
  showClosed: boolean;
  onShowClosedChange: (show: boolean) => void;
}

export function Filters({ chain, onChainChange, showClosed, onShowClosedChange }: Props) {
  return (
    <div className="filters">
      <div className="segmented" role="group" aria-label="Chain">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" aria-pressed={chain === o.value} onClick={() => onChainChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <label>
        <input type="checkbox" checked={showClosed} onChange={(e) => onShowClosedChange(e.target.checked)} />
        {' '}Show closed positions
      </label>
    </div>
  );
}
