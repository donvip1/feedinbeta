/**
 * Auto Updater - Manages automatic background updates for the PWA
 */

// Custom event for update available
export const UPDATE_AVAILABLE_EVENT = 'feedin-update-available';

class AutoUpdater {
  private static instance: AutoUpdater;
  private registration: ServiceWorkerRegistration | null = null;
  private checkInterval: number | null = null;
  private isChecking = false;
  private lastCheck = 0;
  private pendingUpdate = false;
  private readonly CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes for faster updates
  private readonly MIN_CHECK_GAP = 30 * 1000; // 30 seconds minimum between checks
  private readonly IDLE_THRESHOLD = 5 * 1000; // 5 seconds of inactivity to apply update

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

      // Listen for controller change - apply silently
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('[AutoUpdater] Controller changed, applying update silently...');
        // Reload silently - the service worker will serve new content
        window.location.reload();
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
    
    // Check every 2 minutes for faster updates
    this.checkInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Initial check after 10 seconds (faster initial check)
    setTimeout(() => this.checkForUpdates(), 10000);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Check for updates when app becomes visible
      this.checkForUpdates();
    } else if (document.visibilityState === 'hidden') {
      // Perfect time to apply pending updates when user leaves
      if (this.registration?.waiting) {
        console.log('[AutoUpdater] App hidden, applying pending update...');
        this.registration.waiting.postMessage({ action: 'skipWaiting' });
      }
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
        console.log('[AutoUpdater] New version ready, notifying user...');
        this.pendingUpdate = true;
        // Dispatch custom event to show update prompt
        window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
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
        console.log('[AutoUpdater] Update available, notifying user...');
        this.pendingUpdate = true;
        window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
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

    console.log('[AutoUpdater] Applying update now...');
    this.pendingUpdate = false;
    this.registration.waiting.postMessage({ action: 'skipWaiting' });
  }

  hasPendingUpdate(): boolean {
    return this.pendingUpdate || !!this.registration?.waiting;
  }

  dismissUpdate() {
    // User chose to update later - we'll remind them on next check
    console.log('[AutoUpdater] User dismissed update prompt');
  }

  private isUserIdle(): boolean {
    const lastActivity = parseInt(sessionStorage.getItem('lastUserActivity') || '0', 10);
    return Date.now() - lastActivity > this.IDLE_THRESHOLD;
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
  hasPendingUpdate() {
    return getAutoUpdater().hasPendingUpdate();
  },
  dismissUpdate() {
    getAutoUpdater().dismissUpdate();
  },
  destroy() {
    getAutoUpdater().destroy();
  }
};
