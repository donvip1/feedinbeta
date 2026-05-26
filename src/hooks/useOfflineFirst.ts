/**
 * Offline-first data hook — the heart of the "feels native" upgrade.
 *
 * Behavior (like TikTok / Instagram):
 *   1. Mount → instantly return last-known cached data (zero loading flash)
 *   2. Kick off a fresh fetch in the background
 *   3. When fresh data arrives, swap it in and persist to on-device storage
 *
 * Works on both native (SQLite) and web (IndexedDB) via nativeStore.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { nativeStore } from '@/lib/native-store';

type FetcherFn<T> = () => Promise<T>;

interface Options<T> {
  /** Cache key (e.g. "feed:home", "messages:<conv-id>", "profile:<user>") */
  key: string;
  /** Async function that fetches fresh data from Supabase */
  fetcher: FetcherFn<T>;
  /** If cached value is younger than this, skip the background refetch. Default: 60s */
  freshFor?: number;
  /** Disable the hook (e.g. waiting for auth) */
  enabled?: boolean;
}

interface Result<T> {
  data: T | null;
  /** true only when there is no cached data AND a fetch is in flight */
  loading: boolean;
  /** true whenever a background refetch is in flight (cached data already shown) */
  refreshing: boolean;
  error: Error | null;
  /** Manual refetch (e.g. pull-to-refresh) */
  refresh: () => Promise<void>;
}

export function useOfflineFirst<T>({
  key,
  fetcher,
  freshFor = 60_000,
  enabled = true,
}: Options<T>): Result<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep latest fetcher in a ref so its identity doesn't restart effects
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchFresh = useCallback(
    async (hadCache: boolean) => {
      if (hadCache) setRefreshing(true);
      try {
        const fresh = await fetcherRef.current();
        setData(fresh);
        setError(null);
        // Persist for next cold start — fire-and-forget
        nativeStore.set(key, fresh).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      // 1. Hydrate from cache instantly
      const cached = await nativeStore.get<T>(key);
      if (cancelled) return;

      if (cached !== null) {
        setData(cached);
        setLoading(false);
      }

      // 2. Skip background fetch if cache is still fresh
      const fresh = await nativeStore.isFresh(key, freshFor);
      if (cancelled) return;
      if (cached !== null && fresh) return;

      // 3. Background refetch
      await fetchFresh(cached !== null);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, freshFor, fetchFresh]);

  const refresh = useCallback(() => fetchFresh(data !== null), [fetchFresh, data]);

  return { data, loading, refreshing, error, refresh };
}
