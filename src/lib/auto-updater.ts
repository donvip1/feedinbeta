/**
 * Auto Updater - Manages automatic background updates for the PWA
 */

class AutoUpdater {
  private static instance: AutoUpdater;
  private registration: ServiceWorkerRegistration | null = null;
  private checkInterval: number | null = null;
  private isChecking = false;
  private lastCheck = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_CHECK_GAP = 60 * 1000; // 1 minute minimum between checks

  private constructor() {
    this.init();
  }

  static getInstance(): AutoUpdater {
    if (!AutoUpdater.instance) {
      AutoUpdater.instance = new AutoUpdater();
    }
    return AutoUpdater.instance;
  }

  private async init() {
    if (!('serviceWorker' in navigator)) return;

    try {
      // Get registration
      this.registration = await navigator.serviceWorker.ready;
      
      // Set up periodic checks
      this.startPeriodicChecks();
      
      // Check on visibility change (when app becomes visible)
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Check on focus
      window.addEventListener('focus', this.handleFocus);
      
      // Check on online
      window.addEventListener('online', this.handleOnline);
      
      // Listen for update found
      if (this.registration) {
        this.registration.addEventListener('updatefound', this.handleUpdateFound);
      }

      // Listen for controller change
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('[AutoUpdater] Controller changed, reloading...');
        // Small delay to ensure smooth transition
        setTimeout(() => window.location.reload(), 100);
      });

      console.log('[AutoUpdater] Initialized');
    } catch (error) {
      console.error('[AutoUpdater] Init failed:', error);
    }
  }

  private startPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Check every 5 minutes
    this.checkInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Initial check after 30 seconds
    setTimeout(() => this.checkForUpdates(), 30000);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.checkForUpdates();
    }
  };

  private handleFocus = () => {
    this.checkForUpdates();
  };

  private handleOnline = () => {
    // Check for updates when coming back online
    setTimeout(() => this.checkForUpdates(), 2000);
  };

  private handleUpdateFound = () => {
    console.log('[AutoUpdater] New service worker found');
    
    const newWorker = this.registration?.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[AutoUpdater] New version ready, applying update...');
        this.applyUpdate();
      }
    });
  };

  async checkForUpdates(): Promise<boolean> {
    if (this.isChecking) return false;
    if (Date.now() - this.lastCheck < this.MIN_CHECK_GAP) return false;
    if (!navigator.onLine) return false;
    if (!this.registration) return false;

    this.isChecking = true;
    this.lastCheck = Date.now();

    try {
      await this.registration.update();
      console.log('[AutoUpdater] Update check completed');
      
      // Check if there's a waiting worker
      if (this.registration.waiting) {
        console.log('[AutoUpdater] Update available, applying...');
        this.applyUpdate();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[AutoUpdater] Update check failed:', error);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  applyUpdate() {
    if (!this.registration?.waiting) {
      console.log('[AutoUpdater] No waiting worker to apply');
      return;
    }

    // Check if user is idle (no interaction in last 10 seconds)
    const isIdle = this.isUserIdle();
    
    if (isIdle) {
      console.log('[AutoUpdater] User is idle, applying update now');
      this.registration.waiting.postMessage({ action: 'skipWaiting' });
    } else {
      console.log('[AutoUpdater] User is active, will apply on next visibility change');
      // Apply on next visibility change or after a timeout
      const applyOnIdle = () => {
        if (document.visibilityState === 'hidden' || this.isUserIdle()) {
          document.removeEventListener('visibilitychange', applyOnIdle);
          this.registration?.waiting?.postMessage({ action: 'skipWaiting' });
        }
      };
      
      document.addEventListener('visibilitychange', applyOnIdle);
      
      // Fallback: apply after 5 minutes regardless
      setTimeout(() => {
        document.removeEventListener('visibilitychange', applyOnIdle);
        this.registration?.waiting?.postMessage({ action: 'skipWaiting' });
      }, 5 * 60 * 1000);
    }
  }

  private isUserIdle(): boolean {
    const lastActivity = parseInt(sessionStorage.getItem('lastUserActivity') || '0', 10);
    return Date.now() - lastActivity > 10000; // 10 seconds of inactivity
  }

  // Track user activity
  trackActivity() {
    sessionStorage.setItem('lastUserActivity', Date.now().toString());
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
  }
}

// Lazy initialization to avoid module-level side effects
let _autoUpdater: AutoUpdater | null = null;

export const getAutoUpdater = (): AutoUpdater => {
  if (!_autoUpdater) {
    _autoUpdater = AutoUpdater.getInstance();
    
    // Track user activity on common events
    if (typeof window !== 'undefined') {
      ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
        window.addEventListener(event, () => {
          _autoUpdater?.trackActivity();
        }, { passive: true });
      });
    }
  }
  return _autoUpdater;
};

// Export for backwards compatibility - but lazy
export const autoUpdater = {
  get instance() {
    return getAutoUpdater();
  },
  trackActivity() {
    getAutoUpdater().trackActivity();
  },
  checkForUpdates() {
    return getAutoUpdater().checkForUpdates();
  },
  applyUpdate() {
    getAutoUpdater().applyUpdate();
  },
  destroy() {
    getAutoUpdater().destroy();
  }
};
