/**
 * Background Sync Manager
 * Handles data synchronization when:
 * - App regains focus
 * - Network reconnects
 * - Periodic idle sync
 */

import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/lib/indexed-db-cache';

// Sync intervals
const IDLE_SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MIN_SYNC_INTERVAL = 30 * 1000; // 30 seconds minimum between syncs

// Cache keys that need regular sync
const SYNC_KEYS = [
  'credits',
  'notifications_count',
  'profile',
] as const;

class BackgroundSyncManager {
  private lastSyncTime = 0;
  private idleSyncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private userId: string | null = null;
  private listeners: Set<() => void> = new Set();

  /**
   * Initialize background sync for a user
   */
  initialize(userId: string): void {
    if (this.isRunning && this.userId === userId) return;

    this.userId = userId;
    this.isRunning = true;

    // Set up visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Set up online/offline listeners
    window.addEventListener('online', this.handleOnline);

    // Start idle sync timer
    this.startIdleSyncTimer();

    console.log('[BackgroundSync] Initialized for user:', userId);
  }

  /**
   * Stop background sync
   */
  stop(): void {
    this.isRunning = false;
    this.userId = null;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);

    if (this.idleSyncTimer) {
      clearInterval(this.idleSyncTimer);
      this.idleSyncTimer = null;
    }

    console.log('[BackgroundSync] Stopped');
  }

  /**
   * Register a listener to be notified when data is synced
   */
  onSync(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Handle visibility change (app focus/blur)
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // App regained focus - sync data
      this.syncCriticalData();
    }
  };

  /**
   * Handle network reconnection
   */
  private handleOnline = (): void => {
    console.log('[BackgroundSync] Network reconnected, syncing...');
    this.syncCriticalData();
  };

  /**
   * Start idle sync timer
   */
  private startIdleSyncTimer(): void {
    if (this.idleSyncTimer) {
      clearInterval(this.idleSyncTimer);
    }

    this.idleSyncTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.syncCriticalData();
      }
    }, IDLE_SYNC_INTERVAL);
  }

  /**
   * Sync critical data with rate limiting
   */
  private async syncCriticalData(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncTime < MIN_SYNC_INTERVAL) {
      return; // Rate limited
    }

    if (!this.userId || !this.isRunning) return;

    this.lastSyncTime = now;
    console.log('[BackgroundSync] Syncing critical data...');

    try {
      await Promise.all([
        this.syncCredits(),
        this.syncNotificationCount(),
      ]);

      // Notify listeners
      this.listeners.forEach(cb => cb());
    } catch (error) {
      console.error('[BackgroundSync] Sync error:', error);
    }
  }

  /**
   * Sync user credits
   */
  private async syncCredits(): Promise<void> {
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

      await indexedDBCache.set(`credits:${this.userId}`, credits, 10 * 60 * 1000);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Sync notification count
   */
  private async syncNotificationCount(): Promise<void> {
    if (!this.userId) return;

    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('is_read', false);

      await indexedDBCache.set(`notifications_count:${this.userId}`, count || 0, 2 * 60 * 1000);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Force sync all data
   */
  async forceSync(): Promise<void> {
    this.lastSyncTime = 0;
    await this.syncCriticalData();
  }
}

export const backgroundSync = new BackgroundSyncManager();
export default backgroundSync;
