import { useState } from 'react';

const KEY = 'flipped';

/** Per-position price orientation overrides, remembered in this browser. */
export function useFlipped() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      return {};
    }
  });

  const set = (id: string, inverted: boolean) => {
    const next = { ...flipped, [id]: inverted };
    setFlipped(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Per-browser nicety only.
    }
  };

  return [flipped, set] as const;
}
