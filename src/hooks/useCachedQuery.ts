import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { indexedDBCache } from '@/lib/indexed-db-cache';
import { memoryCache } from '@/lib/memory-cache';

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
 * Uses memory cache first (synchronous), then IndexedDB, then network
 */
export function useCachedQuery<TData>({
  cacheKey,
  queryKey,
  queryFn,
  ttl = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  ...options
}: UseCachedQueryOptions<TData>): UseCachedQueryResult<TData> {
  // INSTANT: Check memory cache synchronously first
  const memoryCached = memoryCache.get<TData>(cacheKey);
  
  const [cachedData, setCachedData] = useState<TData | undefined>(memoryCached || undefined);
  const [isStale, setIsStale] = useState(!!memoryCached);
  const [cacheLoaded, setCacheLoaded] = useState(!!memoryCached);

  // Load from IndexedDB if not in memory cache
  useEffect(() => {
    if (!enabled || cacheLoaded) return;

    const loadCache = async () => {
      try {
        const cached = await indexedDBCache.get<TData>(cacheKey);
        if (cached) {
          setCachedData(cached);
          setIsStale(true);
          // Also save to memory cache for future instant access
          memoryCache.set(cacheKey, cached, ttl);
        }
      } catch (error) {
        console.error('[useCachedQuery] Cache load error:', error);
      } finally {
        setCacheLoaded(true);
      }
    };

    loadCache();
  }, [cacheKey, enabled, cacheLoaded, ttl]);

  // Use React Query for fresh data fetching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const freshData = await queryFn();
      // Save to both memory and IndexedDB cache
      try {
        memoryCache.set(cacheKey, freshData, ttl);
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
    memoryCache.set(cacheKey, data, ttl);
    await indexedDBCache.set(cacheKey, data, ttl);
  } catch (error) {
    console.error('[preCacheData] Error:', error);
  }
}

/**
 * Get cached data synchronously from memory cache
 */
export function getCachedDataSync<TData>(cacheKey: string): TData | null {
  return memoryCache.get<TData>(cacheKey);
}
export async function getCachedData<TData>(cacheKey: string): Promise<TData | null> {
  try {
    return await indexedDBCache.get<TData>(cacheKey);
  } catch (error) {
    console.error('[getCachedData] Error:', error);
    return null;
  }
}

export default useCachedQuery;
