import indexedDBCache from './indexed-db-cache';

export interface CachedPost {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  refeeds_count: number | null;
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

const FEED_CACHE_KEY = 'feed_posts';
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Feed cache manager for instant feed loading
 */
export const feedCache = {
  /**
   * Get cached feed posts
   */
  async get(tab: 'following' | 'forYou'): Promise<CachedPost[] | null> {
    const key = `${FEED_CACHE_KEY}_${tab}`;
    return indexedDBCache.get<CachedPost[]>(key);
  },

  /**
   * Save feed posts to cache
   */
  async set(tab: 'following' | 'forYou', posts: CachedPost[]): Promise<void> {
    const key = `${FEED_CACHE_KEY}_${tab}`;
    await indexedDBCache.set(key, posts, FEED_CACHE_TTL);
  },

  /**
   * Update a single post in the cache
   */
  async updatePost(tab: 'following' | 'forYou', postId: string, updates: Partial<CachedPost>): Promise<void> {
    const posts = await this.get(tab);
    if (!posts) return;

    const updatedPosts = posts.map(post => 
      post.id === postId ? { ...post, ...updates } : post
    );
    await this.set(tab, updatedPosts);
  },

  /**
   * Remove a post from cache
   */
  async removePost(tab: 'following' | 'forYou', postId: string): Promise<void> {
    const posts = await this.get(tab);
    if (!posts) return;

    const filteredPosts = posts.filter(post => post.id !== postId);
    await this.set(tab, filteredPosts);
  },

  /**
   * Clear all feed caches
   */
  async clear(): Promise<void> {
    await Promise.all([
      indexedDBCache.delete(`${FEED_CACHE_KEY}_following`),
      indexedDBCache.delete(`${FEED_CACHE_KEY}_forYou`),
    ]);
  },
};

/**
 * Profile cache for quick profile loading
 */
const PROFILE_CACHE_KEY = 'profile';
const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface CachedProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

export const profileCache = {
  async get(identifier: string): Promise<CachedProfile | null> {
    return indexedDBCache.get<CachedProfile>(`${PROFILE_CACHE_KEY}_${identifier}`);
  },

  async set(identifier: string, profile: CachedProfile): Promise<void> {
    await indexedDBCache.set(`${PROFILE_CACHE_KEY}_${identifier}`, profile, PROFILE_CACHE_TTL);
  },

  async clear(identifier: string): Promise<void> {
    await indexedDBCache.delete(`${PROFILE_CACHE_KEY}_${identifier}`);
  },
};

/**
 * Stories cache
 */
const STORIES_CACHE_KEY = 'stories';
const STORIES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes (stories are time-sensitive)

export const storiesCache = {
  async get(): Promise<any[] | null> {
    return indexedDBCache.get<any[]>(STORIES_CACHE_KEY);
  },

  async set(stories: any[]): Promise<void> {
    await indexedDBCache.set(STORIES_CACHE_KEY, stories, STORIES_CACHE_TTL);
  },

  async clear(): Promise<void> {
    await indexedDBCache.delete(STORIES_CACHE_KEY);
  },
};

/**
 * Search results cache
 */
const SEARCH_CACHE_KEY = 'search_results';
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const searchCache = {
  async get(query: string): Promise<any | null> {
    return indexedDBCache.get<any>(`${SEARCH_CACHE_KEY}_${query}`);
  },

  async set(query: string, results: any): Promise<void> {
    await indexedDBCache.set(`${SEARCH_CACHE_KEY}_${query}`, results, SEARCH_CACHE_TTL);
  },
};

export default feedCache;
