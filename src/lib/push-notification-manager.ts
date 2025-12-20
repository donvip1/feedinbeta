import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BEbH8f_x9v5NxFSdoZ6i0Q0f7qP3rVzB3qFKpN9mLkXHEcHGlJqKvJMOxGlXHUxPmV6BkCpK_6FfH8mN5rXwK7Y';

class PushNotificationManager {
  private static instance: PushNotificationManager;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      this.registration = await navigator.serviceWorker.ready;
      return true;
    } catch (error) {
      console.error('[Push] Error initializing:', error);
      return false;
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async getPermissionStatus(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return await Notification.requestPermission();
  }

  async subscribe(userId: string): Promise<boolean> {
    if (!this.registration) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') return false;

      this.subscription = await this.registration!.pushManager.getSubscription();
      if (!this.subscription) {
        const key = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        this.subscription = await this.registration!.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });
      }
      await this.saveSubscription(userId, this.subscription);
      return true;
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      return false;
    }
  }

  async unsubscribe(userId: string): Promise<boolean> {
    try {
      if (this.subscription) {
        await this.removeSubscription(userId, this.subscription.endpoint);
        await this.subscription.unsubscribe();
        this.subscription = null;
      }
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    this.subscription = await this.registration!.pushManager.getSubscription();
    return !!this.subscription;
  }

  private async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const keys = subscription.toJSON().keys;
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys?.p256dh || '',
      auth: keys?.auth || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });
  }

  private async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  }

  async showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.isSupported()) return;
    const permission = await this.getPermissionStatus();
    if (permission !== 'granted') return;

    if (this.registration) {
      await this.registration.showNotification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: options?.tag || 'feedin-notification',
        ...options,
      });
    } else {
      new Notification(title, { icon: '/favicon.png', ...options });
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushNotificationManager = PushNotificationManager.getInstance();
export default pushNotificationManager;