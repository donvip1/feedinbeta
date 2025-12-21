import { supabase } from '@/integrations/supabase/client';
import indexedDBCache from './indexed-db-cache';
import { feedCache, profileCache, CachedPost, CachedProfile } from './feed-cache';

interface PreloadedData {
  profile: CachedProfile | null;
  forYouFeed: CachedPost[];
  followingFeed: CachedPost[];
  trendingPosts: CachedPost[];
  trendingHashtags: any[];
  followingList: string[];
}

class AppDataPreloader {
  private static instance: AppDataPreloader;
  private isPreloading = false;
  private preloadPromise: Promise<PreloadedData> | null = null;
  private preloadedData: PreloadedData | null = null;

  static getInstance(): AppDataPreloader {
    if (!this.instance) {
      this.instance = new AppDataPreloader();
    }
    return this.instance;
  }

  async preloadEssentialData(userId: string): Promise<PreloadedData> {
    if (this.isPreloading && this.preloadPromise) {
      return this.preloadPromise;
    }

    this.isPreloading = true;
    this.preloadPromise = this.doPreload(userId);
    
    try {
      this.preloadedData = await this.preloadPromise;
      return this.preloadedData;
    } finally {
      this.isPreloading = false;
    }
  }

  private async doPreload(userId: string): Promise<PreloadedData> {
    console.log('[AppPreloader] Starting essential data preload...');
    const startTime = Date.now();

    // Parallel loading of all essential data
    const [
      profile,
      forYouFeed,
      followingFeed,
      trendingPosts,
      trendingHashtags,
      followingList,
    ] = await Promise.all([
      this.preloadProfile(userId),
      this.preloadFeed('forYou', userId),
      this.preloadFeed('following', userId),
      this.preloadTrendingPosts(),
      this.preloadTrendingHashtags(),
      this.preloadFollowingList(userId),
    ]);

    console.log(`[AppPreloader] Preload complete in ${Date.now() - startTime}ms`);

    return {
      profile,
      forYouFeed,
      followingFeed,
      trendingPosts,
      trendingHashtags,
      followingList,
    };
  }

  private async preloadProfile(userId: string): Promise<CachedProfile | null> {
    try {
      // Check cache first
      const cached = await profileCache.get(userId);
      if (cached) {
        console.log('[AppPreloader] Profile loaded from cache');
        return cached;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, cover_url, bio, followers_count, following_count')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      // Get posts count separately
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const profile: CachedProfile = {
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        cover_url: data.cover_url,
        bio: data.bio,
        followers_count: data.followers_count || 0,
        following_count: data.following_count || 0,
        posts_count: postsCount || 0,
      };

      await profileCache.set(userId, profile);
      console.log('[AppPreloader] Profile fetched and cached');
      return profile;
    } catch (error) {
      console.error('[AppPreloader] Profile preload error:', error);
      return null;
    }
  }

  private async preloadFeed(tab: 'forYou' | 'following', userId: string): Promise<CachedPost[]> {
    try {
      // Check cache first
      const cached = await feedCache.get(tab);
      if (cached && cached.length > 0) {
        console.log(`[AppPreloader] ${tab} feed loaded from cache (${cached.length} posts)`);
        return cached;
      }

      let posts: CachedPost[] = [];

      if (tab === 'following') {
        // Get following list first
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        const followingIds = followingData?.map(f => f.following_id) || [];
        
        if (followingIds.length > 0) {
          const { data } = await supabase
            .from('posts')
            .select(`
              id, user_id, content, media_url, media_type, media_urls, media_types,
              created_at, likes_count, comments_count, views_count, refeeds_count,
              location, post_type, original_post_id,
              profiles:user_id(username, display_name, avatar_url)
            `)
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .limit(30);

          posts = (data || []) as unknown as CachedPost[];
        }
      } else {
        // For You feed - use trending/popular posts
        const { data } = await supabase
          .from('posts')
          .select(`
            id, user_id, content, media_url, media_type, media_urls, media_types,
            created_at, likes_count, comments_count, views_count, refeeds_count,
            location, post_type, original_post_id,
            profiles:user_id(username, display_name, avatar_url)
          `)
          .neq('user_id', userId)
          .order('trending_score', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(30);

        posts = (data || []) as unknown as CachedPost[];
      }

      if (posts.length > 0) {
        await feedCache.set(tab, posts);
        console.log(`[AppPreloader] ${tab} feed fetched and cached (${posts.length} posts)`);
      }

      return posts;
    } catch (error) {
      console.error(`[AppPreloader] ${tab} feed preload error:`, error);
      return [];
    }
  }

  private async preloadTrendingPosts(): Promise<CachedPost[]> {
    try {
      const cached = await indexedDBCache.get<CachedPost[]>('trending_posts');
      if (cached && cached.length > 0) {
        console.log('[AppPreloader] Trending posts loaded from cache');
        return cached;
      }

      const { data } = await supabase
        .from('posts')
        .select(`
          id, user_id, content, media_url, media_type, media_urls, media_types,
          created_at, likes_count, comments_count, views_count, refeeds_count,
          location, post_type, original_post_id,
          profiles:user_id(username, display_name, avatar_url)
        `)
        .order('trending_score', { ascending: false, nullsFirst: false })
        .order('likes_count', { ascending: false, nullsFirst: false })
        .limit(30);

      const posts = (data || []) as unknown as CachedPost[];
      
      if (posts.length > 0) {
        await indexedDBCache.set('trending_posts', posts, 15 * 60 * 1000);
        console.log(`[AppPreloader] Trending posts cached (${posts.length})`);
      }

      return posts;
    } catch (error) {
      console.error('[AppPreloader] Trending posts preload error:', error);
      return [];
    }
  }

  private async preloadTrendingHashtags(): Promise<any[]> {
    try {
      const cached = await indexedDBCache.get<any[]>('trending_hashtags');
      if (cached && cached.length > 0) {
        console.log('[AppPreloader] Trending hashtags loaded from cache');
        return cached;
      }

      const { data } = await supabase
        .from('hashtags')
        .select('id, name, posts_count, is_trending, trending_score')
        .order('trending_score', { ascending: false, nullsFirst: false })
        .order('posts_count', { ascending: false, nullsFirst: false })
        .limit(20);

      const hashtags = data || [];
      
      if (hashtags.length > 0) {
        await indexedDBCache.set('trending_hashtags', hashtags, 60 * 60 * 1000);
        console.log(`[AppPreloader] Trending hashtags cached (${hashtags.length})`);
      }

      return hashtags;
    } catch (error) {
      console.error('[AppPreloader] Trending hashtags preload error:', error);
      return [];
    }
  }

  private async preloadFollowingList(userId: string): Promise<string[]> {
    try {
      const cached = await indexedDBCache.get<string[]>(`following_list_${userId}`);
      if (cached && cached.length > 0) {
        console.log('[AppPreloader] Following list loaded from cache');
        return cached;
      }

      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = (data || []).map(f => f.following_id);
      
      if (followingIds.length > 0) {
        await indexedDBCache.set(`following_list_${userId}`, followingIds, 24 * 60 * 60 * 1000);
        console.log(`[AppPreloader] Following list cached (${followingIds.length})`);
      }

      return followingIds;
    } catch (error) {
      console.error('[AppPreloader] Following list preload error:', error);
      return [];
    }
  }

  getPreloadedData(): PreloadedData | null {
    return this.preloadedData;
  }

  async refreshInBackground(userId: string): Promise<void> {
    // Silent background refresh
    try {
      await Promise.all([
        this.preloadFeed('forYou', userId),
        this.preloadFeed('following', userId),
        this.preloadTrendingPosts(),
      ]);
      console.log('[AppPreloader] Background refresh complete');
    } catch (error) {
      console.error('[AppPreloader] Background refresh error:', error);
    }
  }
}

export const appPreloader = AppDataPreloader.getInstance();
export default appPreloader;
