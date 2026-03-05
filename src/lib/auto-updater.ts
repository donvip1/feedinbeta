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
  private updatePromptShown = false; // Track if we already showed the prompt this session
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks
  private readonly MIN_CHECK_GAP = 60 * 1000; // 1 minute minimum between checks
  private readonly IDLE_THRESHOLD = 3 * 1000; // 3 seconds of inactivity to apply update
  private readonly FORCE_CHECK_ON_RESUME = true; // Always check when app resumes

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

      // Do NOT reload on controllerchange - this kicks users out of live spaces
      // The new service worker will serve updated content on the next natural page load
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[AutoUpdater] Controller changed - new version will be active on next page load');
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
    
    // Check every minute for faster updates on APK devices
    this.checkInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Initial check after 30 seconds (give app time to load)
    setTimeout(() => this.checkForUpdates(), 30000);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Only check for updates when returning, don't auto-apply
      this.checkForUpdates();
    }
    // Do NOT auto-apply updates when app goes hidden - this causes
    // page reloads that kick users out of live spaces
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
        console.log('[AutoUpdater] New version installed and waiting - will activate on next page load');
        this.pendingUpdate = true;
        // Do NOT call skipWaiting/applyUpdate - let it activate naturally on next page load
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
      
      // Check if there's a waiting worker - do NOT force activate, let it wait
      if (this.registration.waiting) {
        console.log('[AutoUpdater] Update available - will activate on next page load');
        this.pendingUpdate = true;
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
