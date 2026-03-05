/**
 * Cache Manager - Handles app caching and service worker registration
 */

// Update check interval (2 minutes for faster updates)
const UPDATE_CHECK_INTERVAL = 2 * 60 * 1000;

export const CacheManager = {
  currentVersion: '',
  lastUpdateCheck: 0,
  registration: null as ServiceWorkerRegistration | null,

  /**
   * Register service worker
   */
  async register(): Promise<ServiceWorkerRegistration | undefined> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        this.registration = registration;
        console.log('[Cache] Service Worker registered:', registration.scope);

        // Check for updates on page load
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available - auto-update silently
                console.log('[Cache] New version available - auto-updating...');
                this.updateToNewVersionSilently(registration);
              }
            });
          }
        });

        // Check for updates every 2 minutes
        setInterval(() => {
          this.checkForUpdates();
        }, UPDATE_CHECK_INTERVAL);

        // Initial update check after 10 seconds (faster)
        setTimeout(() => this.checkForUpdates(), 10000);

        // Check on visibility change
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkForUpdates();
          } else if (document.visibilityState === 'hidden' && this.registration?.waiting) {
            // Apply pending updates when user leaves
            console.log('[Cache] App hidden, applying pending update...');
            this.updateToNewVersionSilently(this.registration);
          }
        });

        // Check when coming back online
        window.addEventListener('online', () => {
          setTimeout(() => this.checkForUpdates(), 1000);
        });

        return registration;
      } catch (error) {
        console.error('[Cache] Service Worker registration failed:', error);
      }
    }
    return undefined;
  },

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false;
    if (!navigator.onLine) return false;
    
    // Rate limit checks to once per 30 seconds
    if (Date.now() - this.lastUpdateCheck < 30000) return false;
    this.lastUpdateCheck = Date.now();

    try {
      await this.registration.update();
      console.log('[Cache] Update check completed');
      
      if (this.registration.waiting) {
        console.log('[Cache] Update available');
        this.updateToNewVersionSilently(this.registration);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Cache] Update check failed:', error);
      return false;
    }
  },

  /**
   * Unregister service worker (for debugging)
   */
  async unregister(): Promise<boolean> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return registration.unregister();
    }
    return false;
  },

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[Cache] All caches cleared');
    }

    // Also send message to service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
    }
  },

  /**
   * Get cache size
   */
  async getSize(): Promise<{ name: string; size: number }[]> {
    if (!('caches' in window)) return [];

    const cacheNames = await caches.keys();
    const sizes = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        const responses = await Promise.all(keys.map((key) => cache.match(key)));
        const size = await Promise.all(
          responses.map(async (response) => {
            if (!response) return 0;
            const blob = await response.blob();
            return blob.size;
          })
        );
        return {
          name,
          size: size.reduce((a, b) => a + b, 0),
        };
      })
    );

    return sizes;
  },

  /**
   * Notify user about new version
   */
  notifyNewVersion(): void {
    // Dispatch custom event that app can listen to
    window.dispatchEvent(new CustomEvent('app-update-available'));
  },

  /**
   * Update to new version silently (automatic - no user prompt)
   */
  async updateToNewVersionSilently(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.waiting) {
      // Do NOT force skipWaiting or reload - this kicks users out of live spaces
      // The new SW will activate naturally on next page load
      console.log('[Cache] New version waiting - will activate on next page load');
    }
  },

  /**
   * Update to new version (manual)
   */
  async updateToNewVersion(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Do NOT force skipWaiting or reload - this kicks users out of live spaces
      // The new SW will activate naturally on next page load
      console.log('[Cache] New version available - will activate on next page load');
    }
  },

  /**
   * Check if app is running in standalone mode (installed as PWA)
   */
  isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  },

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  },
};

// Listen for service worker messages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.action === 'cacheCleared') {
      console.log('[Cache] Cache cleared by service worker');
    }
  });
}
