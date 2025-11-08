import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  aspect_ratio?: string;
  has_blur_background?: boolean;
  moderation_status?: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

type FeedTab = 'following' | 'forYou' | 'myPosts';

interface UseFeedOptions {
  userId?: string;
  activeTab: FeedTab;
  searchQuery?: string;
}

export const useFeed = ({ userId, activeTab, searchQuery = '' }: UseFeedOptions) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 20;

  const loadPosts = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!userId) return;

    try {
      setLoading(true);

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'active')
        .in('moderation_status', ['approved', 'pending'])
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      // Search filter
      if (searchQuery) {
        query = query.or(`content.ilike.%${searchQuery}%,profiles.username.ilike.%${searchQuery}%,profiles.display_name.ilike.%${searchQuery}%`);
      }

      // Tab-specific filters
      if (activeTab === 'following') {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (following && following.length > 0) {
          const followingIds = following.map(f => f.following_id);
          query = query.in('user_id', followingIds);
        } else {
          setPosts([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
      } else if (activeTab === 'myPosts') {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const newPosts = data || [];
      setHasMore(newPosts.length === PAGE_SIZE);
      
      if (append) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }
    } catch (error: any) {
      console.error('Error loading feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, searchQuery, toast]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    loadPosts(0, false);
  }, [userId, activeTab, searchQuery]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  }, [page, loading, hasMore, loadPosts]);

  const refreshPosts = useCallback(() => {
    setPage(0);
    setHasMore(true);
    loadPosts(0, false);
  }, [loadPosts]);

  return {
    posts,
    loading,
    hasMore,
    loadMore,
    refreshPosts,
    setPosts,
  };
};
