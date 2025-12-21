/**
 * Startup Preloader - Aggressively prefetches critical data within 5 seconds
 * Uses parallel loading for maximum speed
 */

import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/lib/indexed-db-cache';
import { memoryCache } from '@/lib/memory-cache';

// Cache TTLs in milliseconds
const CACHE_TTLS = {
  profile: 30 * 60 * 1000,
  credits: 10 * 60 * 1000,
  packages: 60 * 60 * 1000,
  notifications: 2 * 60 * 1000,
  friends: 10 * 60 * 1000,
  groups: 15 * 60 * 1000,
  subscription: 30 * 60 * 1000,
  courses: 60 * 60 * 1000,
};

class StartupPreloader {
  private isPreloading = false;
  private userId: string | null = null;
  private preloadComplete = false;

  async startPreload(userId: string): Promise<void> {
    if (this.isPreloading || this.preloadComplete) return;
    if (!userId) return;

    this.isPreloading = true;
    this.userId = userId;

    console.log('[StartupPreloader] Starting parallel preload...');
    const startTime = Date.now();

    try {
      // ALL PARALLEL - Load everything at once
      await Promise.allSettled([
        this.prefetchProfile(),
        this.prefetchCredits(),
        this.prefetchNotificationCount(),
        this.prefetchCreditPackages(),
        this.prefetchSubscriptionTiers(),
        this.prefetchUserSubscription(),
        this.prefetchFriends(),
        this.prefetchGroups(),
      ]);

      const elapsed = Date.now() - startTime;
      console.log(`[StartupPreloader] Complete in ${elapsed}ms`);
      this.preloadComplete = true;
    } catch (error) {
      console.error('[StartupPreloader] Error:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  private async saveToCache<T>(key: string, data: T, ttl: number): Promise<void> {
    memoryCache.set(key, data, ttl);
    await indexedDBCache.set(key, data, ttl);
  }

  private async prefetchProfile(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', this.userId).single();
      if (data) {
        await this.saveToCache(`profile:${this.userId}`, data, CACHE_TTLS.profile);
        if (data.username) await this.saveToCache(`profile:${data.username}`, data, CACHE_TTLS.profile);
      }
    } catch (error) {
      console.error('[Preloader] Profile error:', error);
    }
  }

  private async prefetchCredits(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.from('user_credits').select('*').eq('user_id', this.userId).single();
      if (data) await this.saveToCache(`credits:${this.userId}`, data, CACHE_TTLS.credits);
    } catch (error) {
      console.error('[Preloader] Credits error:', error);
    }
  }

  private async prefetchNotificationCount(): Promise<void> {
    if (!this.userId) return;
    try {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('is_read', false);
      await this.saveToCache(`notifications_count:${this.userId}`, count || 0, CACHE_TTLS.notifications);
    } catch (error) {
      console.error('[Preloader] Notifications error:', error);
    }
  }

  private async prefetchCreditPackages(): Promise<void> {
    try {
      const { data } = await supabase.from('credit_packages').select('*').eq('is_active', true).order('price', { ascending: true });
      if (data) await this.saveToCache('credit_packages', data, CACHE_TTLS.packages);
    } catch (error) {
      console.error('[Preloader] Packages error:', error);
    }
  }

  private async prefetchSubscriptionTiers(): Promise<void> {
    try {
      const { data } = await supabase.from('subscription_tiers').select('*').eq('is_active', true).order('price', { ascending: true });
      if (data) await this.saveToCache('subscription_tiers', data, CACHE_TTLS.subscription);
    } catch (error) {
      console.error('[Preloader] Tiers error:', error);
    }
  }

  private async prefetchUserSubscription(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data } = await supabase.from('user_subscriptions').select('*, subscription_tiers(*)').eq('user_id', this.userId).eq('status', 'active').single();
      if (data) await this.saveToCache(`subscription:${this.userId}`, data, CACHE_TTLS.subscription);
    } catch (error) { /* User might not have subscription */ }
  }

  private async prefetchFriends(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data: requests } = await supabase.from('friend_requests').select('sender_id, receiver_id').eq('status', 'accepted').or(`sender_id.eq.${this.userId},receiver_id.eq.${this.userId}`);
      if (requests && requests.length > 0) {
        const friendIds = requests.map(r => r.sender_id === this.userId ? r.receiver_id : r.sender_id);
        const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', friendIds);
        if (profiles) await this.saveToCache(`friends:${this.userId}`, profiles, CACHE_TTLS.friends);
      }
    } catch (error) {
      console.error('[Preloader] Friends error:', error);
    }
  }

  private async prefetchGroups(): Promise<void> {
    if (!this.userId) return;
    try {
      const { data: memberGroups } = await supabase.from('group_members').select('group_id').eq('user_id', this.userId);
      if (memberGroups && memberGroups.length > 0) {
        const groupIds = memberGroups.map(m => m.group_id);
        const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
        if (groups) await this.saveToCache(`my_groups:${this.userId}`, groups, CACHE_TTLS.groups);
      }
    } catch (error) {
      console.error('[Preloader] Groups error:', error);
    }
  }

  isComplete(): boolean {
    return this.preloadComplete;
  }

  reset(): void {
    this.preloadComplete = false;
    this.isPreloading = false;
    this.userId = null;
  }
}

export const startupPreloader = new StartupPreloader();
export default startupPreloader;
