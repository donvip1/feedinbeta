/**
 * Navigation Prefetcher - Prefetches data for navigation destinations
 * Ensures all nav destinations have their data cached before user navigates
 */

import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from './memory-cache';
import { indexedDBCache } from './indexed-db-cache';
import { usernameCache } from './username-cache';

const CACHE_TTL = {
  profile: 30 * 60 * 1000,
  credits: 10 * 60 * 1000,
  messages: 5 * 60 * 1000,
  wallet: 15 * 60 * 1000,
  friends: 10 * 60 * 1000,
};

class NavigationPrefetcher {
  private prefetchedRoutes = new Set<string>();
  private userId: string | null = null;

  setUserId(id: string | null) {
    this.userId = id;
    if (id) {
      // Prefetch all nav destinations immediately
      this.prefetchAllNavDestinations();
    }
  }

  /**
   * Prefetch data for all bottom nav destinations
   */
  async prefetchAllNavDestinations(): Promise<void> {
    if (!this.userId) return;

    const startTime = Date.now();
    console.log('[NavigationPrefetcher] Prefetching all nav destinations...');

    // Prefetch all destinations in parallel
    await Promise.allSettled([
      this.prefetchProfile(this.userId),
      this.prefetchCredits(),
      this.prefetchConversations(),
      this.prefetchFriends(),
      this.prefetchNotifications(),
    ]);

    console.log(`[NavigationPrefetcher] Complete in ${Date.now() - startTime}ms`);
  }

  /**
   * Prefetch profile data for instant display
   */
  async prefetchProfile(identifier: string): Promise<void> {
    const cacheKey = `profile:${identifier}`;
    
    // Skip if already cached
    if (memoryCache.has(cacheKey)) return;

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      let query = supabase.from('profiles').select('*');
      if (isUUID) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('username', identifier);
      }

      const { data } = await query.single();
      
      if (data) {
        memoryCache.set(cacheKey, data, CACHE_TTL.profile);
        await indexedDBCache.set(cacheKey, data, CACHE_TTL.profile);
        
        // Cache username -> ID mapping
        if (data.username) {
          await usernameCache.set(data.username, data.id);
          if (!isUUID) {
            memoryCache.set(`profile:${data.id}`, data, CACHE_TTL.profile);
          }
        }
      }
    } catch (error) {
      console.error('[NavigationPrefetcher] Profile prefetch error:', error);
    }
  }

  /**
   * Prefetch user credits for wallet
   */
  async prefetchCredits(): Promise<void> {
    if (!this.userId) return;
    
    const cacheKey = `credits:${this.userId}`;
    if (memoryCache.has(cacheKey)) return;

    try {
      const { data } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', this.userId)
        .single();
      
      if (data) {
        memoryCache.set(cacheKey, data, CACHE_TTL.credits);
        await indexedDBCache.set(cacheKey, data, CACHE_TTL.credits);
      }
    } catch (error) {
      console.error('[NavigationPrefetcher] Credits prefetch error:', error);
    }
  }

  /**
   * Prefetch conversations for messages
   */
  async prefetchConversations(): Promise<void> {
    if (!this.userId) return;
    
    const cacheKey = `conversations:${this.userId}`;
    if (memoryCache.has(cacheKey)) return;

    try {
      const { data } = await supabase.rpc('get_conversations_with_details', { 
        p_user_id: this.userId 
      });
      
      if (data) {
        memoryCache.set(cacheKey, data, CACHE_TTL.messages);
        await indexedDBCache.set(cacheKey, data, CACHE_TTL.messages);
      }
    } catch (error) {
      console.error('[NavigationPrefetcher] Conversations prefetch error:', error);
    }
  }

  /**
   * Prefetch friends list
   */
  async prefetchFriends(): Promise<void> {
    if (!this.userId) return;
    
    const cacheKey = `friends:${this.userId}`;
    if (memoryCache.has(cacheKey)) return;

    try {
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${this.userId},receiver_id.eq.${this.userId}`);
      
      if (requests && requests.length > 0) {
        const friendIds = requests.map(r => 
          r.sender_id === this.userId ? r.receiver_id : r.sender_id
        );
        
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('*')
          .in('id', friendIds);
        
        if (profiles) {
          memoryCache.set(cacheKey, profiles, CACHE_TTL.friends);
          await indexedDBCache.set(cacheKey, profiles, CACHE_TTL.friends);
          
          // Cache each friend's profile and username mapping
          await usernameCache.setMany(profiles.filter(p => p.username).map(p => ({
            username: p.username!,
            id: p.id
          })));
          
          profiles.forEach(profile => {
            memoryCache.set(`profile:${profile.id}`, profile, CACHE_TTL.profile);
            if (profile.username) {
              memoryCache.set(`profile:${profile.username}`, profile, CACHE_TTL.profile);
            }
          });
        }
      }
    } catch (error) {
      console.error('[NavigationPrefetcher] Friends prefetch error:', error);
    }
  }

  /**
   * Prefetch notification count
   */
  async prefetchNotifications(): Promise<void> {
    if (!this.userId) return;
    
    const cacheKey = `notifications_count:${this.userId}`;
    if (memoryCache.has(cacheKey)) return;

    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('is_read', false);
      
      memoryCache.set(cacheKey, count || 0, 2 * 60 * 1000);
    } catch (error) {
      console.error('[NavigationPrefetcher] Notifications prefetch error:', error);
    }
  }

  /**
   * Prefetch data when user hovers/touches a link
   */
  async prefetchOnInteraction(path: string): Promise<void> {
    if (this.prefetchedRoutes.has(path)) return;
    this.prefetchedRoutes.add(path);

    // Extract profile identifier from path
    const profileMatch = path.match(/\/profile\/(.+)/);
    if (profileMatch) {
      await this.prefetchProfile(profileMatch[1]);
    }
  }

  /**
   * Prefetch profiles from feed posts
   */
  async prefetchProfilesFromPosts(posts: Array<{ user_id: string; profiles?: { username?: string | null } }>): Promise<void> {
    const profileIds = [...new Set(posts.map(p => p.user_id))];
    
    // Cache username mappings
    const mappings = posts
      .filter(p => p.profiles?.username)
      .map(p => ({ username: p.profiles!.username!, id: p.user_id }));
    
    if (mappings.length > 0) {
      await usernameCache.setMany(mappings);
    }
    
    // Prefetch profiles that aren't cached
    const uncachedIds = profileIds.filter(id => !memoryCache.has(`profile:${id}`));
    
    if (uncachedIds.length > 0) {
      // Batch fetch uncached profiles
      try {
        const { data } = await supabase
          .from('public_profiles')
          .select('*')
          .in('id', uncachedIds.slice(0, 20)); // Limit to 20 at a time
        
        if (data) {
          data.forEach(profile => {
            memoryCache.set(`profile:${profile.id}`, profile, CACHE_TTL.profile);
            if (profile.username) {
              memoryCache.set(`profile:${profile.username}`, profile, CACHE_TTL.profile);
            }
          });
        }
      } catch (error) {
        console.error('[NavigationPrefetcher] Batch profile prefetch error:', error);
      }
    }
  }

  /**
   * Clear prefetch tracking (on logout)
   */
  reset(): void {
    this.prefetchedRoutes.clear();
    this.userId = null;
  }
}

export const navigationPrefetcher = new NavigationPrefetcher();
export default navigationPrefetcher;
