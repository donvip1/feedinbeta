/**
 * App Shell Preloader - Loads all critical data BEFORE React renders
 * This ensures instant navigation for authenticated users
 */

import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from './indexed-db-cache';
import { memoryCache } from './memory-cache';
import { usernameCache } from './username-cache';
import { navigationPrefetcher } from './navigation-prefetcher';

const CACHE_TTL = {
  profile: 30 * 60 * 1000,
  credits: 10 * 60 * 1000,
  packages: 60 * 60 * 1000,
  notifications: 2 * 60 * 1000,
  friends: 10 * 60 * 1000,
  groups: 15 * 60 * 1000,
  subscription: 30 * 60 * 1000,
  conversations: 5 * 60 * 1000,
  feed: 5 * 60 * 1000,
};

class AppShellPreloader {
  private isPreloading = false;
  private preloadComplete = false;
  private userId: string | null = null;

  /**
   * Get current user ID from localStorage (synchronous)
   */
  getUserId(): string | null {
    return localStorage.getItem('currentUserId');
  }

  /**
   * Check if user is likely authenticated
   */
  isLikelyAuthenticated(): boolean {
    return !!this.getUserId();
  }

  /**
   * Phase 1: Load IndexedDB cache into memory (synchronous feel)
   * This runs BEFORE React mounts
   */
  async loadCacheToMemory(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    this.userId = userId;
    
    const startTime = Date.now();
    console.log('[AppShellPreloader] Loading cache to memory...');

    // Load username cache first
    await usernameCache.load();

    // Keys to preload into memory
    const keys = [
      `profile:${userId}`,
      `credits:${userId}`,
      `notifications_count:${userId}`,
      `subscription:${userId}`,
      `friends:${userId}`,
      `my_groups:${userId}`,
      `conversations:${userId}`,
      `feed_posts_forYou`,
      `feed_posts_following`,
      'credit_packages',
      'subscription_tiers',
    ];

    // Load all in parallel
    await Promise.all(keys.map(async (key) => {
      try {
        const data = await indexedDBCache.get(key);
        if (data) {
          memoryCache.set(key, data, 30 * 60 * 1000);
        }
      } catch (error) {
        // Ignore individual cache errors
      }
    }));

    console.log(`[AppShellPreloader] Cache loaded in ${Date.now() - startTime}ms`);
  }

  /**
   * Phase 2: Fetch fresh data in background (after React mounts)
   * This updates the cache silently without blocking UI
   */
  async refreshInBackground(): Promise<void> {
    if (this.isPreloading || !this.userId) return;
    
    this.isPreloading = true;
    const startTime = Date.now();
    console.log('[AppShellPreloader] Background refresh starting...');

    // Set up navigation prefetcher
    navigationPrefetcher.setUserId(this.userId);

    try {
      // Fetch all critical data in parallel
      await Promise.allSettled([
        this.refreshProfile(),
        this.refreshCredits(),
        this.refreshNotificationCount(),
        this.refreshCreditPackages(),
        this.refreshSubscriptionTiers(),
        this.refreshUserSubscription(),
        this.refreshFriends(),
        this.refreshGroups(),
        this.refreshConversations(),
      ]);

      console.log(`[AppShellPreloader] Background refresh done in ${Date.now() - startTime}ms`);
      this.preloadComplete = true;
    } catch (error) {
      console.error('[AppShellPreloader] Background refresh error:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  private async saveToCache<T>(key: string, data: T, ttl: number): Promise<void> {
    memoryCache.set(key, data, ttl);
    await indexedDBCache.set(key, data, ttl);
  }

  private async refreshProfile(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', this.userId).single();
      if (data) {
        await this.saveToCache(`profile:${this.userId}`, data, CACHE_TTL.profile);
        if (data.username) {
          await this.saveToCache(`profile:${data.username}`, data, CACHE_TTL.profile);
          await usernameCache.set(data.username, this.userId);
        }
      }
    } catch (error) { /* Ignore */ }
  }

  private async refreshCredits(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.from('user_credits').select('*').eq('user_id', this.userId).single();
      if (data) await this.saveToCache(`credits:${this.userId}`, data, CACHE_TTL.credits);
    } catch (error) { /* Ignore */ }
  }

  private async refreshNotificationCount(): Promise<void> {
    if (!this.userId) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('is_read', false);
      await this.saveToCache(`notifications_count:${this.userId}`, count || 0, CACHE_TTL.notifications);
    } catch (error) { /* Ignore */ }
  }

  private async refreshCreditPackages(): Promise<void> {
    try {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (data) await this.saveToCache('credit_packages', data, CACHE_TTL.packages);
    } catch (error) { /* Ignore */ }
  }

  private async refreshSubscriptionTiers(): Promise<void> {
    try {
      const { data } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (data) await this.saveToCache('subscription_tiers', data, CACHE_TTL.subscription);
    } catch (error) { /* Ignore */ }
  }

  private async refreshUserSubscription(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('user_id', this.userId)
        .eq('status', 'active')
        .single();
      if (data) await this.saveToCache(`subscription:${this.userId}`, data, CACHE_TTL.subscription);
    } catch (error) { /* User might not have subscription */ }
  }

  private async refreshFriends(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${this.userId},receiver_id.eq.${this.userId}`);
      
      if (requests && requests.length > 0) {
        const friendIds = requests.map(r => r.sender_id === this.userId ? r.receiver_id : r.sender_id);
        const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', friendIds);
        
        if (profiles) {
          await this.saveToCache(`friends:${this.userId}`, profiles, CACHE_TTL.friends);
          
          // Also cache each friend's profile for instant profile viewing
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
    } catch (error) { /* Ignore */ }
  }

  private async refreshGroups(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data: memberGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', this.userId);
      
      if (memberGroups && memberGroups.length > 0) {
        const groupIds = memberGroups.map(m => m.group_id);
        const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
        if (groups) await this.saveToCache(`my_groups:${this.userId}`, groups, CACHE_TTL.groups);
      }
    } catch (error) { /* Ignore */ }
  }

  private async refreshConversations(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.rpc('get_conversations_with_details', { p_user_id: this.userId });
      if (data) await this.saveToCache(`conversations:${this.userId}`, data, CACHE_TTL.conversations);
    } catch (error) { /* Ignore */ }
  }

  isComplete(): boolean {
    return this.preloadComplete;
  }

  reset(): void {
    this.preloadComplete = false;
    this.isPreloading = false;
    this.userId = null;
    navigationPrefetcher.reset();
  }
}

export const appShellPreloader = new AppShellPreloader();
export default appShellPreloader;
