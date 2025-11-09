/**
 * Cache Manager - Handles app caching and service worker registration
 */

export const CacheManager = {
  /**
   * Register service worker
   */
  async register(): Promise<ServiceWorkerRegistration | undefined> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

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

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        return registration;
      } catch (error) {
        console.error('[Cache] Service Worker registration failed:', error);
      }
    }
    return undefined;
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
   * Update to new version silently (automatic)
   */
  async updateToNewVersionSilently(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.waiting) {
      // Set up the listener BEFORE sending the message
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('[Cache] Controller changed, reloading silently...');
        // Delay reload slightly to ensure smooth transition
        setTimeout(() => {
          window.location.reload();
        }, 100);
      });

      // Tell the service worker to skip waiting
      registration.waiting.postMessage({ action: 'skipWaiting' });
    }
  },

  /**
   * Update to new version (manual)
   */
  async updateToNewVersion(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Set up the listener BEFORE sending the message
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('[Cache] Controller changed, reloading...');
        window.location.reload();
      });

      // Tell the service worker to skip waiting
      if (registration.waiting) {
        registration.waiting.postMessage({ action: 'skipWaiting' });
      }
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
