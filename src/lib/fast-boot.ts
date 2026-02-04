/**
 * Fast Boot - Ultra-fast app initialization for mobile APK
 * Optimized for instant startup with deferred non-critical operations
 */

// Critical data keys that must load before render
const CRITICAL_KEYS = [
  'profile',
  'credits',
  'notifications_count',
] as const;

// Secondary data loaded after first paint
const SECONDARY_KEYS = [
  'friends',
  'conversations',
  'subscription',
  'my_groups',
] as const;

// Deferred data loaded in idle time
const DEFERRED_KEYS = [
  'stories',
  'trending_posts',
  'live_content',
  'wallet',
  'feed_posts_forYou',
  'feed_posts_following',
] as const;

class FastBoot {
  private startTime = 0;
  private userId: string | null = null;
  private isBooting = false;
  private bootComplete = false;
  private criticalDataReady = false;
  
  // Metrics
  private metrics = {
    cacheLoadTime: 0,
    firstPaintTime: 0,
    fullBootTime: 0,
  };

  /**
   * Get user ID synchronously from localStorage
   */
  getUserId(): string | null {
    if (this.userId) return this.userId;
    this.userId = localStorage.getItem('currentUserId');
    return this.userId;
  }

  /**
   * Check if user is likely authenticated (synchronous)
   */
  isAuthenticated(): boolean {
    return !!this.getUserId();
  }

  /**
   * Phase 1: Critical boot - loads essential data only
   * Must complete in < 100ms
   */
  async criticalBoot(): Promise<void> {
    if (this.isBooting) return;
    this.isBooting = true;
    this.startTime = performance.now();

    const userId = this.getUserId();
    if (!userId) {
      this.isBooting = false;
      return;
    }

    try {
      // Load from memory cache first (synchronous)
      const { memoryCache } = await import('./memory-cache');
      const hasMemoryData = memoryCache.has(`profile:${userId}`);
      
      if (hasMemoryData) {
        this.criticalDataReady = true;
        this.metrics.cacheLoadTime = performance.now() - this.startTime;
        console.log(`[FastBoot] Memory cache hit in ${this.metrics.cacheLoadTime.toFixed(1)}ms`);
        return;
      }

      // Fallback to IndexedDB (async but still fast)
      const { indexedDBCache } = await import('./indexed-db-cache');
      
      // Load only critical keys in parallel
      const criticalPromises = CRITICAL_KEYS.map(async (key) => {
        const fullKey = `${key}:${userId}`;
        const data = await indexedDBCache.get(fullKey);
        if (data) {
          memoryCache.set(fullKey, data, 5 * 60 * 1000);
        }
        return data;
      });

      await Promise.all(criticalPromises);
      
      this.criticalDataReady = true;
      this.metrics.cacheLoadTime = performance.now() - this.startTime;
      console.log(`[FastBoot] Critical boot in ${this.metrics.cacheLoadTime.toFixed(1)}ms`);
    } catch (error) {
      console.error('[FastBoot] Critical boot error:', error);
    }
  }

  /**
   * Phase 2: Secondary boot - loads additional data after first paint
   * Runs after React mounts
   */
  async secondaryBoot(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    const startSecondary = performance.now();

    try {
      const [{ memoryCache }, { indexedDBCache }] = await Promise.all([
        import('./memory-cache'),
        import('./indexed-db-cache'),
      ]);

      // Load secondary keys
      const secondaryPromises = SECONDARY_KEYS.map(async (key) => {
        const fullKey = `${key}:${userId}`;
        if (!memoryCache.has(fullKey)) {
          const data = await indexedDBCache.get(fullKey);
          if (data) {
            memoryCache.set(fullKey, data, 10 * 60 * 1000);
          }
        }
      });

      await Promise.all(secondaryPromises);
      
      this.metrics.firstPaintTime = performance.now() - this.startTime;
      console.log(`[FastBoot] Secondary boot in ${(performance.now() - startSecondary).toFixed(1)}ms`);
    } catch (error) {
      console.error('[FastBoot] Secondary boot error:', error);
    }
  }

  /**
   * Phase 3: Deferred boot - loads non-critical data in idle time
   */
  deferredBoot(): void {
    const userId = this.getUserId();
    if (!userId) return;

    const runDeferred = async () => {
      const startDeferred = performance.now();

      try {
        const [{ memoryCache }, { indexedDBCache }] = await Promise.all([
          import('./memory-cache'),
          import('./indexed-db-cache'),
        ]);

        // Load deferred keys
        for (const key of DEFERRED_KEYS) {
          const fullKey = key.includes(':') ? key : `${key}:${userId}`;
          if (!memoryCache.has(fullKey)) {
            const data = await indexedDBCache.get(fullKey);
            if (data) {
              memoryCache.set(fullKey, data, 15 * 60 * 1000);
            }
          }
        }

        // Also load global keys
        const globalKeys = ['credit_packages', 'subscription_tiers'];
        for (const key of globalKeys) {
          if (!memoryCache.has(key)) {
            const data = await indexedDBCache.get(key);
            if (data) {
              memoryCache.set(key, data, 60 * 60 * 1000);
            }
          }
        }

        this.bootComplete = true;
        this.metrics.fullBootTime = performance.now() - this.startTime;
        this.isBooting = false;
        
        console.log(`[FastBoot] Full boot complete in ${this.metrics.fullBootTime.toFixed(1)}ms`);
        console.log(`[FastBoot] Metrics:`, this.metrics);
      } catch (error) {
        console.error('[FastBoot] Deferred boot error:', error);
      }
    };

    // Use requestIdleCallback for non-blocking deferred load
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => runDeferred(), { timeout: 2000 });
    } else {
      setTimeout(() => runDeferred(), 100);
    }
  }

  /**
   * Background refresh - fetches fresh data from server
   */
  async backgroundRefresh(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    try {
      const { appShellPreloader } = await import('./app-shell-preloader');
      await appShellPreloader.refreshInBackground();
    } catch (error) {
      console.error('[FastBoot] Background refresh error:', error);
    }
  }

  /**
   * Get boot metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if critical data is ready
   */
  isCriticalReady(): boolean {
    return this.criticalDataReady;
  }

  /**
   * Check if boot is complete
   */
  isComplete(): boolean {
    return this.bootComplete;
  }

  /**
   * Reset boot state (for logout)
   */
  reset(): void {
    this.userId = null;
    this.isBooting = false;
    this.bootComplete = false;
    this.criticalDataReady = false;
    this.metrics = {
      cacheLoadTime: 0,
      firstPaintTime: 0,
      fullBootTime: 0,
    };
  }
}

// Singleton
export const fastBoot = new FastBoot();
export default fastBoot;
