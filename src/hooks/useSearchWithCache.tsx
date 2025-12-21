import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import indexedDBCache from '@/lib/indexed-db-cache';
import { searchCache } from '@/lib/feed-cache';

interface SearchResults {
  posts: any[];
  users: any[];
  hashtags: any[];
}

interface TrendingSearch {
  id: string;
  query: string;
  search_count: number;
}

interface UseSearchResult {
  results: SearchResults;
  isLoading: boolean;
  error: Error | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

interface UseTrendingSearchesResult {
  trendingSearches: TrendingSearch[];
  recentSearches: string[];
  isLoading: boolean;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

const RECENT_SEARCHES_KEY = 'recent_searches';
const TRENDING_SEARCHES_KEY = 'trending_searches_list';
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RECENT_SEARCHES = 10;

export const useSearchWithCache = (): UseSearchResult => {
  const [results, setResults] = useState<SearchResults>({ posts: [], users: [], hashtags: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults({ posts: [], users: [], hashtags: [] });
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();

    try {
      // Check cache first
      const cached = await searchCache.get(normalizedQuery);
      if (cached) {
        setResults(cached);
        // Still fetch fresh in background
      } else {
        setIsLoading(true);
      }

      // Track search for trending
      trackSearch(normalizedQuery);

      // Parallel fetch all search types
      const [postsResult, usersResult, hashtagsResult] = await Promise.all([
        searchPosts(normalizedQuery),
        searchUsers(normalizedQuery),
        searchHashtags(normalizedQuery),
      ]);

      const newResults = {
        posts: postsResult,
        users: usersResult,
        hashtags: hashtagsResult,
      };

      // Cache the results
      await searchCache.set(normalizedQuery, newResults);
      setResults(newResults);
      setError(null);
    } catch (err) {
      console.error('[useSearchWithCache] Error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults({ posts: [], users: [], hashtags: [] });
    setError(null);
  }, []);

  return { results, isLoading, error, search, clearResults };
};

async function searchPosts(query: string): Promise<any[]> {
  // Check if searching by hashtag
  if (query.startsWith('#')) {
    const hashtagName = query.slice(1);
    const { data: hashtagData } = await supabase
      .from('hashtags')
      .select('id')
      .eq('name', hashtagName)
      .single();

    if (hashtagData) {
      const { data: postHashtags } = await supabase
        .from('post_hashtags')
        .select('post_id')
        .eq('hashtag_id', hashtagData.id)
        .limit(30);

      if (postHashtags && postHashtags.length > 0) {
        const postIds = postHashtags.map(ph => ph.post_id);
        const { data: posts } = await supabase
          .from('posts')
          .select(`
            id, user_id, content, media_url, media_type, media_urls, media_types,
            created_at, likes_count, comments_count, views_count,
            profiles:user_id(username, display_name, avatar_url)
          `)
          .in('id', postIds)
          .order('created_at', { ascending: false });

        return posts || [];
      }
    }
    return [];
  }

  // Regular content search
  const { data } = await supabase
    .from('posts')
    .select(`
      id, user_id, content, media_url, media_type, media_urls, media_types,
      created_at, likes_count, comments_count, views_count,
      profiles:user_id(username, display_name, avatar_url)
    `)
    .ilike('content', `%${query}%`)
    .order('likes_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(30);

  return data || [];
}

async function searchUsers(query: string): Promise<any[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_verified, followers_count')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order('followers_count', { ascending: false, nullsFirst: false })
    .limit(20);

  return data || [];
}

async function searchHashtags(query: string): Promise<any[]> {
  const searchTerm = query.startsWith('#') ? query.slice(1) : query;
  
  const { data } = await supabase
    .from('hashtags')
    .select('id, name, posts_count')
    .ilike('name', `%${searchTerm}%`)
    .order('posts_count', { ascending: false, nullsFirst: false })
    .limit(20);

  return data || [];
}

async function trackSearch(query: string): Promise<void> {
  try {
    // Upsert trending search
    const { data: existing } = await supabase
      .from('trending_searches')
      .select('id, search_count')
      .eq('query', query)
      .single();

    if (existing) {
      await supabase
        .from('trending_searches')
        .update({
          search_count: (existing.search_count || 0) + 1,
          last_searched_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('trending_searches')
        .insert({ query, search_count: 1 });
    }
  } catch (error) {
    // Silently fail - tracking shouldn't break search
    console.error('[trackSearch] Error:', error);
  }
}

export const useTrendingSearches = (): UseTrendingSearchesResult => {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount
  useState(() => {
    loadSearches();
  });

  async function loadSearches() {
    try {
      // Load recent searches from cache
      const recent = await indexedDBCache.get<string[]>(RECENT_SEARCHES_KEY);
      if (recent) {
        setRecentSearches(recent);
      }

      // Load trending searches
      const cachedTrending = await indexedDBCache.get<TrendingSearch[]>(TRENDING_SEARCHES_KEY);
      if (cachedTrending) {
        setTrendingSearches(cachedTrending);
      }

      // Fetch fresh trending
      const { data } = await supabase
        .from('trending_searches')
        .select('id, query, search_count')
        .order('search_count', { ascending: false })
        .limit(10);

      if (data) {
        setTrendingSearches(data);
        await indexedDBCache.set(TRENDING_SEARCHES_KEY, data, 60 * 60 * 1000);
      }
    } catch (error) {
      console.error('[useTrendingSearches] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const addRecentSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== normalizedQuery);
      const updated = [normalizedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      
      // Save to cache
      indexedDBCache.set(RECENT_SEARCHES_KEY, updated);
      
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await indexedDBCache.delete(RECENT_SEARCHES_KEY);
  }, []);

  return {
    trendingSearches,
    recentSearches,
    isLoading,
    addRecentSearch,
    clearRecentSearches,
  };
};

export default useSearchWithCache;
