import { useState, useCallback } from 'react';

interface UsePaginatedQueryOptions<T> {
  pageSize?: number;
  fetchFn: (page: number, size: number) => Promise<T[]>;
}

export const usePaginatedQuery = <T>({ 
  pageSize = 20, 
  fetchFn 
}: UsePaginatedQueryOptions<T>) => {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    setError(null);

    try {
      const newData = await fetchFn(page, pageSize);
      
      if (newData.length < pageSize) {
        setHasMore(false);
      }

      setData(prev => [...prev, ...newData]);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err as Error);
      console.error('Pagination error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, loading, hasMore, fetchFn]);

  const reset = useCallback(() => {
    setData([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    loading,
    hasMore,
    error,
    loadMore,
    reset,
  };
};
