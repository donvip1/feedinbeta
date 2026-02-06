/**
 * App Data Sync Manager
 * Ensures mobile app always has fresh data by:
 * - Triggering refetch when app comes to foreground
 * - Periodic background sync for critical data
 * - Network reconnection handling
 */

import { QueryClient } from '@tanstack/react-query';

// Critical queries that should always be fresh
const CRITICAL_QUERIES = [
  'live-streams',
  'live-spaces',
  'feed-posts',
  'posts',
  'notifications',
  'unread-notifications',
  'conversations',
  'messages',
  'user-credits',
  'stories',
  'profile',
];

// Queries that need instant refresh on focus
const INSTANT_REFRESH_QUERIES = [
  'live-streams',
  'live-spaces',
  'active-streams',
  'active-spaces',
];

class AppDataSyncManager {
  private queryClient: QueryClient | null = null;
  private lastFocusTime = 0;
  private isInitialized = false;
  private focusRefreshInterval: number | null = null;
  private readonly FOCUS_DEBOUNCE = 500; // 500ms debounce
  private readonly BACKGROUND_SYNC_INTERVAL = 30 * 1000; // 30 seconds
  private readonly STALE_THRESHOLD = 10 * 1000; // Consider data stale after 10s

  /**
   * Initialize with QueryClient
   */
  initialize(queryClient: QueryClient): void {
    if (this.isInitialized) return;
    
    this.queryClient = queryClient;
    this.isInitialized = true;
    
    // Set up visibility change listener (most important for mobile)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Set up focus listener (backup for desktop)
    window.addEventListener('focus', this.handleFocus);
    
    // Set up online listener
    window.addEventListener('online', this.handleOnline);
    
    // Set up pageshow listener for mobile back navigation
    window.addEventListener('pageshow', this.handlePageShow);
    
    // Start periodic background sync for when app is in foreground
    this.startBackgroundSync();
    
    console.log('[AppDataSync] Initialized - Mobile instant refresh enabled');
  }

  /**
   * Stop all listeners
   */
  stop(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('pageshow', this.handlePageShow);
    
    if (this.focusRefreshInterval) {
      clearInterval(this.focusRefreshInterval);
    }
    
    this.isInitialized = false;
    console.log('[AppDataSync] Stopped');
  }

  /**
   * Handle visibility change (app foreground/background)
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.onAppForeground();
    }
  };

  /**
   * Handle window focus
   */
  private handleFocus = (): void => {
    this.onAppForeground();
  };

  /**
   * Handle page show (mobile back navigation)
   */
  private handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      // Page was restored from bfcache
      this.onAppForeground();
    }
  };

  /**
   * Handle network reconnection - only log, don't refresh
   */
  private handleOnline = (): void => {
    console.log('[AppDataSync] Network reconnected - NOT auto-refreshing to maintain stability');
    // DISABLED: Do NOT refresh all data - this kicks users off screens
  };

  /**
   * Called when app comes to foreground
   * DISABLED aggressive refresh to prevent kicking users off screens
   */
  private onAppForeground(): void {
    const now = Date.now();
    
    // Debounce rapid focus events
    if (now - this.lastFocusTime < this.FOCUS_DEBOUNCE) {
      return;
    }
    
    this.lastFocusTime = now;
    console.log('[AppDataSync] App came to foreground - NOT refreshing to maintain stability');
    
    // DISABLED: Do NOT refresh data automatically - this kicks users off screens
    // Users can manually refresh via pull-to-refresh if they want fresh data
  }

  /**
   * Refresh queries that need instant refresh (like live content)
   */
  private refreshInstantData(): void {
    if (!this.queryClient) return;

    INSTANT_REFRESH_QUERIES.forEach(queryKey => {
      // Force refetch, ignoring any cache
      this.queryClient!.invalidateQueries({ 
        queryKey: [queryKey],
        refetchType: 'all',
      });
    });
    
    console.log('[AppDataSync] Instant refresh triggered for:', INSTANT_REFRESH_QUERIES);
  }

  /**
   * Refresh all critical data
   */
  private refreshAllCriticalData(): void {
    if (!this.queryClient) return;

    CRITICAL_QUERIES.forEach(queryKey => {
      this.queryClient!.invalidateQueries({ 
        queryKey: [queryKey],
        refetchType: 'active',
      });
    });
    
    console.log('[AppDataSync] All critical data refreshed');
  }

  /**
   * Force refresh specific queries
   */
  forceRefresh(queryKeys: string[]): void {
    if (!this.queryClient) return;

    queryKeys.forEach(queryKey => {
      this.queryClient!.invalidateQueries({ 
        queryKey: [queryKey],
        refetchType: 'all',
      });
    });
  }

  /**
   * Start periodic background sync - DISABLED to prevent auto-refresh issues
   */
  private startBackgroundSync(): void {
    // DISABLED: Background sync causes page refreshes that kick users off screens
    // Users can manually refresh via pull-to-refresh if they want fresh data
    console.log('[AppDataSync] Background sync disabled to maintain stability');
  }

  /**
   * Get the QueryClient for external use
   */
  getQueryClient(): QueryClient | null {
    return this.queryClient;
  }
}

export const appDataSync = new AppDataSyncManager();
export default appDataSync;
