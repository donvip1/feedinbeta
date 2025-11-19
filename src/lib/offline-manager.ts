import { supabase } from '@/integrations/supabase/client';

export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = navigator.onLine;
  private pendingActions: any[] = [];

  private constructor() {
    this.setupListeners();
    this.registerServiceWorker();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingActions();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', registration);

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async showNotification(title: string, options?: NotificationOptions) {
    if (!this.isOnline) {
      // Store notification for later
      this.pendingActions.push({ type: 'notification', title, options });
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          ...options,
          icon: '/favicon.png',
          badge: '/favicon.png',
        });
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  }

  async cacheImportantData(key: string, data: any) {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  getCachedData(key: string): any | null {
    try {
      const data = localStorage.getItem(`offline_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving cached data:', error);
      return null;
    }
  }

  async syncPendingActions() {
    if (!this.isOnline || this.pendingActions.length === 0) return;

    const actions = [...this.pendingActions];
    this.pendingActions = [];

    for (const action of actions) {
      try {
        if (action.type === 'notification') {
          await this.showNotification(action.title, action.options);
        }
        // Add more action types as needed
      } catch (error) {
        console.error('Error syncing action:', error);
        this.pendingActions.push(action); // Re-add on failure
      }
    }
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const offlineManager = OfflineManager.getInstance();
