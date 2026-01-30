import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  refeeds_count: number;
  location: string | null;
  post_type: string | null;
  original_post_id: string | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  original_post?: any;
}

export const usePersonalizedFeed = (enabled: boolean = true) => {
  const { user, session } = useAuth();

  return useInfiniteQuery({
    queryKey: ['personalized-feed', user?.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user || !session) {
        throw new Error('User not authenticated');
      }

      try {
        // Try AI-powered feed first
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-feed-ranking`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              limit: 20,
              offset: pageParam,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          // Fetch profiles for posts
          const postIds = data.posts.map((p: any) => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', postIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          
          // Fetch original posts for refeeds
          const refeedIds = data.posts.filter((p: any) => p.original_post_id).map((p: any) => p.original_post_id);
          let originalPosts: any[] = [];
          
          if (refeedIds.length > 0) {
            const { data: originals } = await supabase
              .from('posts')
              .select(`
                *,
                profiles:user_id (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .in('id', refeedIds);
            originalPosts = originals || [];
          }

          const originalPostMap = new Map(originalPosts.map(p => [p.id, p]));
          
          const postsWithProfiles = data.posts.map((post: any) => ({
            ...post,
            profiles: profileMap.get(post.user_id),
            original_post: post.original_post_id ? originalPostMap.get(post.original_post_id) : null,
          }));

          return {
            posts: postsWithProfiles,
            nextOffset: (pageParam as number) + 20,
            hasMore: data.posts.length === 20,
          };
        }
      } catch (error) {
        console.log('AI feed failed, falling back to standard query:', error);
      }

      // Fallback to standard personalized query
      const { data: posts, error } = await supabase
        .rpc('get_personalized_feed' as any, {
          p_user_id: user.id,
          p_limit: 20,
          p_offset: pageParam as number,
        });

      if (error) throw error;

      // Fetch profiles for posts
      const userIds = posts?.map((p: any) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch original posts for refeeds
      const refeedIds = posts?.filter((p: any) => p.original_post_id).map((p: any) => p.original_post_id) || [];
      let originalPosts: any[] = [];
      
      if (refeedIds.length > 0) {
        const { data: originals } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          `)
          .in('id', refeedIds);
        originalPosts = originals || [];
      }

      const originalPostMap = new Map(originalPosts.map(p => [p.id, p]));

      const postsWithProfiles = posts?.map((post: any) => ({
        ...post,
        profiles: profileMap.get(post.user_id),
        original_post: post.original_post_id ? originalPostMap.get(post.original_post_id) : null,
      })) || [];

      return {
        posts: postsWithProfiles,
        nextOffset: (pageParam as number) + 20,
        hasMore: (posts?.length || 0) === 20,
      };
    },
    getNextPageParam: (lastPage: any) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: enabled && !!user,
    staleTime: 1000 * 60 * 2,
  });
};

export const useFollowingFeed = (enabled: boolean = true) => {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['following-feed', user?.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user) throw new Error('User not authenticated');

      // Get list of followed users
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];
      
      // Include user's own posts in the following feed
      const userIdsToFetch = [...followingIds, user.id];

      if (userIdsToFetch.length === 0) {
        return { posts: [], nextOffset: 0, hasMore: false };
      }

      // Fetch posts from followed users
      const offset = pageParam as number;
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .in('user_id', userIdsToFetch)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + 19);

      if (error) throw error;

      // Fetch original posts for refeeds
      const refeedIds = posts?.filter(p => p.original_post_id).map(p => p.original_post_id) || [];
      let originalPosts: any[] = [];
      
      if (refeedIds.length > 0) {
        const { data } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          `)
          .in('id', refeedIds);
        originalPosts = data || [];
      }

      const originalPostMap = new Map(originalPosts.map(p => [p.id, p]));

      const postsWithOriginals = posts?.map(post => ({
        ...post,
        original_post: post.original_post_id ? originalPostMap.get(post.original_post_id) : null,
      })) || [];

      return {
        posts: postsWithOriginals,
        nextOffset: (pageParam as number) + 20,
        hasMore: (posts?.length || 0) === 20,
      };
    },
    getNextPageParam: (lastPage: any) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: enabled && !!user,
    staleTime: 1000 * 60,
  });
};
