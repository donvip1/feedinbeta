/**
 * Startup Preloader - Aggressively prefetches critical data within 15 seconds
 * Implements phased loading for optimal UX
 */

import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/lib/indexed-db-cache';

// Cache TTLs in milliseconds
const CACHE_TTLS = {
  profile: 30 * 60 * 1000,      // 30 minutes
  credits: 10 * 60 * 1000,      // 10 minutes
  packages: 60 * 60 * 1000,     // 1 hour
  wallet: 5 * 60 * 1000,        // 5 minutes
  settings: 30 * 60 * 1000,     // 30 minutes
  courses: 60 * 60 * 1000,      // 1 hour
  notifications: 2 * 60 * 1000, // 2 minutes
  friends: 10 * 60 * 1000,      // 10 minutes
  groups: 15 * 60 * 1000,       // 15 minutes
  subscription: 30 * 60 * 1000, // 30 minutes
};

class StartupPreloader {
  private isPreloading = false;
  private userId: string | null = null;
  private preloadComplete = false;

  /**
   * Start the aggressive preload process
   * Completes within 15 seconds
   */
  async startPreload(userId: string): Promise<void> {
    if (this.isPreloading || this.preloadComplete) return;
    if (!userId) return;

    this.isPreloading = true;
    this.userId = userId;

    console.log('[StartupPreloader] Starting aggressive preload...');
    const startTime = Date.now();

    try {
      // Phase 1 (0-5s): Critical user data
      await this.phase1CriticalData();

      // Phase 2 (5-10s): Secondary data
      await this.phase2SecondaryData();

      // Phase 3 (10-15s): Background data
      await this.phase3BackgroundData();

      const elapsed = Date.now() - startTime;
      console.log(`[StartupPreloader] Complete in ${elapsed}ms`);
      this.preloadComplete = true;
    } catch (error) {
      console.error('[StartupPreloader] Error:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Phase 1: Critical user data (0-5 seconds)
   * Profile, credits, notifications count
   */
  private async phase1CriticalData(): Promise<void> {
    const promises: Promise<void>[] = [];

    // User profile
    promises.push(this.prefetchProfile());

    // User credits
    promises.push(this.prefetchCredits());

    // Notification count
    promises.push(this.prefetchNotificationCount());

    await Promise.allSettled(promises);
  }

  /**
   * Phase 2: Secondary data (5-10 seconds)
   * Wallet, settings, subscription
   */
  private async phase2SecondaryData(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Credit packages (for store)
    promises.push(this.prefetchCreditPackages());

    // Subscription tiers
    promises.push(this.prefetchSubscriptionTiers());

    // User subscription status
    promises.push(this.prefetchUserSubscription());

    await Promise.allSettled(promises);
  }

  /**
   * Phase 3: Background data (10-15 seconds)
   * Friends, groups, courses
   */
  private async phase3BackgroundData(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Friends list
    promises.push(this.prefetchFriends());

    // Groups
    promises.push(this.prefetchGroups());

    // Courses (for Learn Tech)
    promises.push(this.prefetchEnrolledCourses());

    await Promise.allSettled(promises);
  }

  private async prefetchProfile(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.userId)
        .single();

      if (data) {
        await indexedDBCache.set(`profile:${this.userId}`, data, CACHE_TTLS.profile);
        await indexedDBCache.set(`profile:${data.username}`, data, CACHE_TTLS.profile);
      }
    } catch (error) {
      console.error('[Preloader] Profile fetch error:', error);
    }
  }

  private async prefetchCredits(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data: baseData } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      const { data: secureCredits } = await supabase.rpc('get_user_credits', {
        p_user_id: this.userId
      });

      const credits = {
        balance: secureCredits ?? baseData?.balance ?? 0,
        total_earned: baseData?.total_earned ?? 0,
        total_spent: baseData?.total_spent ?? 0,
      };

      await indexedDBCache.set(`credits:${this.userId}`, credits, CACHE_TTLS.credits);
    } catch (error) {
      console.error('[Preloader] Credits fetch error:', error);
    }
  }

  private async prefetchNotificationCount(): Promise<void> {
    if (!this.userId) return;

    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('is_read', false);

      await indexedDBCache.set(`notifications_count:${this.userId}`, count || 0, CACHE_TTLS.notifications);
    } catch (error) {
      console.error('[Preloader] Notifications fetch error:', error);
    }
  }

  private async prefetchCreditPackages(): Promise<void> {
    try {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (data) {
        await indexedDBCache.set('credit_packages', data, CACHE_TTLS.packages);
      }
    } catch (error) {
      console.error('[Preloader] Packages fetch error:', error);
    }
  }

  private async prefetchSubscriptionTiers(): Promise<void> {
    try {
      const { data } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (data) {
        await indexedDBCache.set('subscription_tiers', data, CACHE_TTLS.subscription);
      }
    } catch (error) {
      console.error('[Preloader] Tiers fetch error:', error);
    }
  }

  private async prefetchUserSubscription(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('user_id', this.userId)
        .eq('status', 'active')
        .single();

      if (data) {
        await indexedDBCache.set(`subscription:${this.userId}`, data, CACHE_TTLS.subscription);
      }
    } catch (error) {
      // User might not have subscription - that's ok
    }
  }

  private async prefetchFriends(): Promise<void> {
    if (!this.userId) return;

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
          await indexedDBCache.set(`friends:${this.userId}`, profiles, CACHE_TTLS.friends);
        }
      }
    } catch (error) {
      console.error('[Preloader] Friends fetch error:', error);
    }
  }

  private async prefetchGroups(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data: memberGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', this.userId);

      if (memberGroups && memberGroups.length > 0) {
        const groupIds = memberGroups.map(m => m.group_id);

        const { data: groups } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groups) {
          await indexedDBCache.set(`my_groups:${this.userId}`, groups, CACHE_TTLS.groups);
        }
      }

      // Also fetch discoverable groups
      const { data: allGroups } = await supabase
        .from('groups')
        .select('*')
        .order('member_count', { ascending: false })
        .limit(20);

      if (allGroups) {
        await indexedDBCache.set('discover_groups', allGroups, CACHE_TTLS.groups);
      }
    } catch (error) {
      console.error('[Preloader] Groups fetch error:', error);
    }
  }

  private async prefetchEnrolledCourses(): Promise<void> {
    if (!this.userId) return;

    try {
      // For now, enrolled courses are stored in localStorage
      // This is a placeholder for when courses are stored in DB
      const enrolled = localStorage.getItem(`enrolled_courses_${this.userId}`);
      if (enrolled) {
        await indexedDBCache.set(`enrolled_courses:${this.userId}`, JSON.parse(enrolled), CACHE_TTLS.courses);
      }
    } catch (error) {
      console.error('[Preloader] Courses fetch error:', error);
    }
  }

  /**
   * Check if preload is complete
   */
  isComplete(): boolean {
    return this.preloadComplete;
  }

  /**
   * Reset preloader for new session
   */
  reset(): void {
    this.preloadComplete = false;
    this.isPreloading = false;
    this.userId = null;
  }
}

export const startupPreloader = new StartupPreloader();
export default startupPreloader;
