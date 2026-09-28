'use client';

import { useEffect, useState } from 'react';
import { loadCached, peekCache } from '@/lib/clientCache';

// Shows the last data seen for `key` straight away (if any) and always
// refreshes it from the server when the screen opens, or when
// `refreshToken` changes (e.g. after an expense is saved).
export function useCachedData<T>(key: string, loader: () => Promise<T>, refreshToken?: unknown) {
  const [state, setState] = useState<{ key: string; data: T | undefined; error: string | null }>(() => ({
    key,
    data: peekCache<T>(key),
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    loadCached(key, loader)
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ key, data: s.key === key ? s.data : peekCache<T>(key), error: err instanceof Error ? err.message : 'Failed to load' }));
      });
    return () => {
      cancelled = true;
    };
    // The loader is expected to depend only on `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshToken]);

  // A new key (e.g. another date range) shows that key's cached data, if any,
  // until its own request finishes.
  const data = state.key === key ? state.data : peekCache<T>(key);
  const error = state.key === key ? state.error : null;
  return { data, error, loading: data === undefined && !error };
}
