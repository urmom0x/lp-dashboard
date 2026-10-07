import { useCallback, useEffect, useState } from 'react';
import type { PositionsResponse } from '../../shared/types.ts';

const REFRESH_MS = 60_000;

export function usePositions() {
  const [data, setData] = useState<PositionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/positions');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setData(body as PositionsResponse);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { data, error, loading, refresh };
}
