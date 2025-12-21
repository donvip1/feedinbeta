import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import indexedDBCache from '@/lib/indexed-db-cache';
import { CachedPost } from '@/lib/feed-cache';

interface TrendingHashtag {
  id: string;
  name: string;
  posts_count: number | null;
  is_trending: boolean | null;
  trending_score: number | null;
}

interface UseTrendingPostsResult {
  posts: CachedPost[];
  isLoading: boolean;
  isFreshLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseTrendingHashtagsResult {
  hashtags: TrendingHashtag[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const TRENDING_POSTS_CACHE_KEY = 'trending_posts';
const TRENDING_HASHTAGS_CACHE_KEY = 'trending_hashtags';
const TRENDING_POSTS_TTL = 15 * 60 * 1000; // 15 minutes
const TRENDING_HASHTAGS_TTL = 60 * 60 * 1000; // 1 hour

export const useTrendingPosts = (viewedPostIds: string[] = []): UseTrendingPostsResult => {
  const [posts, setPosts] = useState<CachedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFreshLoading, setIsFreshLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrendingPosts = useCallback(async (showLoading = true) => {
    try {
      // Check cache first
      const cached = await indexedDBCache.get<CachedPost[]>(TRENDING_POSTS_CACHE_KEY);
      if (cached && cached.length > 0) {
        // Filter out viewed posts but keep some for variety
        const unviewedPosts = cached.filter(p => !viewedPostIds.includes(p.id));
        const postsToShow = unviewedPosts.length >= 10 
          ? unviewedPosts 
          : [...unviewedPosts, ...cached.filter(p => viewedPostIds.includes(p.id)).slice(0, 20 - unviewedPosts.length)];
        
        setPosts(postsToShow);
        setIsLoading(false);
        setIsFreshLoading(true);
      } else if (showLoading) {
        setIsLoading(true);
      }

      // Fetch active promotions first
      const { data: promotionsData } = await supabase
        .from('post_promotions')
        .select('post_id, boost_level, is_active')
        .eq('is_active', true);

      const promotedPostIds = new Set((promotionsData || []).map(p => p.post_id));
      const promotionLevels = new Map((promotionsData || []).map(p => [p.post_id, p.boost_level]));

      // Fetch trending posts
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          id, user_id, content, media_url, media_type, media_urls, media_types,
          created_at, likes_count, comments_count, views_count, refeeds_count,
          location, post_type, original_post_id, trending_score,
          profiles:user_id(username, display_name, avatar_url)
        `)
        .order('trending_score', { ascending: false, nullsFirst: false })
        .order('likes_count', { ascending: false, nullsFirst: false })
        .order('views_count', { ascending: false, nullsFirst: false })
        .limit(50);

      if (fetchError) throw fetchError;

      let fetchedPosts = (data || []) as unknown as CachedPost[];

      // Sort with promotions at top
      fetchedPosts.sort((a, b) => {
        const aPromoted = promotedPostIds.has(a.id);
        const bPromoted = promotedPostIds.has(b.id);
        
        if (aPromoted && !bPromoted) return -1;
        if (!aPromoted && bPromoted) return 1;
        
        if (aPromoted && bPromoted) {
          const aLevel = Number(promotionLevels.get(a.id)) || 1;
          const bLevel = Number(promotionLevels.get(b.id)) || 1;
          return bLevel - aLevel; // Higher boost level first
        }

        return 0; // Keep original trending order for non-promoted
      });

      // Cache the posts
      await indexedDBCache.set(TRENDING_POSTS_CACHE_KEY, fetchedPosts, TRENDING_POSTS_TTL);

      // Filter out viewed posts
      const unviewedPosts = fetchedPosts.filter(p => !viewedPostIds.includes(p.id));
      const postsToShow = unviewedPosts.length >= 10 
        ? unviewedPosts 
        : [...unviewedPosts, ...fetchedPosts.filter(p => viewedPostIds.includes(p.id)).slice(0, 20 - unviewedPosts.length)];

      setPosts(postsToShow);
      setError(null);
    } catch (err) {
      console.error('[useTrendingPosts] Error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
      setIsFreshLoading(false);
    }
  }, [viewedPostIds]);

  useEffect(() => {
    fetchTrendingPosts();
  }, [fetchTrendingPosts]);

  return {
    posts,
    isLoading,
    isFreshLoading,
    error,
    refetch: () => fetchTrendingPosts(false),
  };
};

export const useTrendingHashtags = (limit = 20): UseTrendingHashtagsResult => {
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrendingHashtags = useCallback(async (showLoading = true) => {
    try {
      // Check cache first
      const cached = await indexedDBCache.get<TrendingHashtag[]>(TRENDING_HASHTAGS_CACHE_KEY);
      if (cached && cached.length > 0) {
        setHashtags(cached.slice(0, limit));
        setIsLoading(false);
        // Background refresh
      } else if (showLoading) {
        setIsLoading(true);
      }

      const { data, error: fetchError } = await supabase
        .from('hashtags')
        .select('id, name, posts_count, is_trending, trending_score')
        .order('trending_score', { ascending: false, nullsFirst: false })
        .order('posts_count', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      const fetchedHashtags = (data || []) as TrendingHashtag[];
      
      await indexedDBCache.set(TRENDING_HASHTAGS_CACHE_KEY, fetchedHashtags, TRENDING_HASHTAGS_TTL);
      setHashtags(fetchedHashtags);
      setError(null);
    } catch (err) {
      console.error('[useTrendingHashtags] Error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrendingHashtags();
  }, [fetchTrendingHashtags]);

  return {
    hashtags,
    isLoading,
    error,
    refetch: () => fetchTrendingHashtags(false),
  };
};

export default useTrendingPosts;
