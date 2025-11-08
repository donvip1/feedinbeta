import { useState, useEffect, useCallback, useRef } from 'react';
import { withRetry } from '@/lib/retry-utils';
import { dedupeRequest } from '@/lib/request-deduplication';

interface UseOptimizedQueryOptions<T> {
  queryKey: string;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  retry?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface QueryCache<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, QueryCache<any>>();

export const useOptimizedQuery = <T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 30000, // 30 seconds
  cacheTime = 300000, // 5 minutes
  retry = true,
  onSuccess,
  onError,
}: UseOptimizedQueryOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Check cache first
    const cached = queryCache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < staleTime) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Deduplicate concurrent requests
      const result = await dedupeRequest(queryKey, async () => {
        if (retry) {
          return await withRetry(queryFn, {
            maxAttempts: 3,
            baseDelay: 1000,
          });
        }
        return await queryFn();
      });

      if (!mountedRef.current) return;

      // Update cache
      queryCache.set(queryKey, {
        data: result,
        timestamp: Date.now(),
      });

      setData(result);
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorObj = err as Error;
      setError(errorObj);
      onError?.(errorObj);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, queryKey, queryFn, retry, staleTime, onSuccess, onError]);

  useEffect(() => {
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Cleanup old cache entries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      queryCache.forEach((value, key) => {
        if (now - value.timestamp > cacheTime) {
          queryCache.delete(key);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [cacheTime]);

  const refetch = useCallback(() => {
    queryCache.delete(queryKey);
    return fetchData();
  }, [queryKey, fetchData]);

  const invalidate = useCallback(() => {
    queryCache.delete(queryKey);
  }, [queryKey]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
    isStale: !queryCache.has(queryKey),
  };
};
