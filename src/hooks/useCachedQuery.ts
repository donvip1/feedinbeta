import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { indexedDBCache } from '@/lib/indexed-db-cache';

interface UseCachedQueryOptions<TData> extends Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'> {
  cacheKey: string;
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  ttl?: number; // TTL in milliseconds
}

interface UseCachedQueryResult<TData> {
  data: TData | undefined;
  isLoading: boolean;
  isFreshLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * A hook that implements stale-while-revalidate pattern
 * Returns cached data immediately while fetching fresh data in the background
 */
export function useCachedQuery<TData>({
  cacheKey,
  queryKey,
  queryFn,
  ttl = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  ...options
}: UseCachedQueryOptions<TData>): UseCachedQueryResult<TData> {
  const [cachedData, setCachedData] = useState<TData | undefined>(undefined);
  const [isStale, setIsStale] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Load from cache immediately on mount
  useEffect(() => {
    if (!enabled) {
      setCacheLoaded(true);
      return;
    }

    const loadCache = async () => {
      try {
        const cached = await indexedDBCache.get<TData>(cacheKey);
        if (cached) {
          setCachedData(cached);
          setIsStale(true); // Mark as stale since we're fetching fresh data
        }
      } catch (error) {
        console.error('[useCachedQuery] Cache load error:', error);
      } finally {
        setCacheLoaded(true);
      }
    };

    loadCache();
  }, [cacheKey, enabled]);

  // Use React Query for fresh data fetching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const freshData = await queryFn();
      // Save to cache
      try {
        await indexedDBCache.set(cacheKey, freshData, ttl);
      } catch (error) {
        console.error('[useCachedQuery] Cache save error:', error);
      }
      return freshData;
    },
    enabled: enabled && cacheLoaded,
    staleTime: ttl,
    ...options,
  });

  // Update stale status when fresh data arrives
  useEffect(() => {
    if (query.data) {
      setIsStale(false);
    }
  }, [query.data]);

  // Determine what data to show
  const displayData = query.data ?? cachedData;

  return {
    data: displayData,
    isLoading: !cacheLoaded || (!cachedData && query.isLoading),
    isFreshLoading: query.isLoading && !!cachedData,
    isStale: isStale && !query.data,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

/**
 * Pre-cache data for a specific key
 */
export async function preCacheData<TData>(
  cacheKey: string,
  data: TData,
  ttl: number = 5 * 60 * 1000
): Promise<void> {
  try {
    await indexedDBCache.set(cacheKey, data, ttl);
  } catch (error) {
    console.error('[preCacheData] Error:', error);
  }
}

/**
 * Get cached data without triggering a query
 */
export async function getCachedData<TData>(cacheKey: string): Promise<TData | null> {
  try {
    return await indexedDBCache.get<TData>(cacheKey);
  } catch (error) {
    console.error('[getCachedData] Error:', error);
    return null;
  }
}

export default useCachedQuery;
