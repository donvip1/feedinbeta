import { supabase } from '@/integrations/supabase/client';

// Fallback VAPID public key (should be replaced by fetching from edge function)
const FALLBACK_VAPID_PUBLIC_KEY = 'BEbH8f_x9v5NxFSdoZ6i0Q0f7qP3rVzB3qFKpN9mLkXHEcHGlJqKvJMOxGlXHUxPmV6BkCpK_6FfH8mN5rXwK7Y';

class PushNotificationManager {
  private static instance: PushNotificationManager;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string | null = null;

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      console.log('[Push] Initializing push notification manager...');
      this.registration = await navigator.serviceWorker.ready;
      
      // Fetch VAPID key from edge function
      await this.fetchVapidKey();
      
      console.log('[Push] Push notification manager initialized');
      return true;
    } catch (error) {
      console.error('[Push] Error initializing:', error);
      return false;
    }
  }

  private async fetchVapidKey(): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-key');
      
      if (error) {
        console.warn('[Push] Failed to fetch VAPID key:', error);
        this.vapidPublicKey = FALLBACK_VAPID_PUBLIC_KEY;
        return;
      }
      
      if (data?.publicKey) {
        console.log('[Push] Fetched VAPID public key from server');
        this.vapidPublicKey = data.publicKey;
      } else {
        console.warn('[Push] No VAPID key in response, using fallback');
        this.vapidPublicKey = FALLBACK_VAPID_PUBLIC_KEY;
      }
    } catch (error) {
      console.error('[Push] Error fetching VAPID key:', error);
      this.vapidPublicKey = FALLBACK_VAPID_PUBLIC_KEY;
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
    console.log('[Push] Requesting notification permission...');
    const result = await Notification.requestPermission();
    console.log('[Push] Permission result:', result);
    return result;
  }

  async subscribe(userId: string): Promise<boolean> {
    if (!this.registration) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Permission not granted');
        return false;
      }

      // Check for existing subscription
      this.subscription = await (this.registration as any).pushManager.getSubscription();
      
      if (!this.subscription) {
        console.log('[Push] Creating new push subscription...');
        const vapidKey = this.vapidPublicKey || FALLBACK_VAPID_PUBLIC_KEY;
        const key = this.urlBase64ToUint8Array(vapidKey);
        
        this.subscription = await (this.registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });
        console.log('[Push] Push subscription created');
      } else {
        console.log('[Push] Using existing push subscription');
      }
      
      await this.saveSubscription(userId, this.subscription);
      console.log('[Push] Subscription saved for user:', userId.slice(0, 8));
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
        console.log('[Push] Unsubscribed successfully');
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
    this.subscription = await (this.registration as any).pushManager.getSubscription();
    return !!this.subscription;
  }

  private async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const keys = subscription.toJSON().keys;
    
    const subscriptionData = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys?.p256dh || '',
      auth: keys?.auth || '',
      updated_at: new Date().toISOString(),
    };
    
    console.log('[Push] Saving subscription to database...');
    
    const { error } = await supabase.from('push_subscriptions').upsert(
      subscriptionData,
      { onConflict: 'user_id,endpoint' }
    );
    
    if (error) {
      console.error('[Push] Error saving subscription:', error);
      // Try insert if upsert fails
      const { error: insertError } = await supabase.from('push_subscriptions').insert(subscriptionData);
      if (insertError) {
        console.error('[Push] Error inserting subscription:', insertError);
      }
    }
  }

  private async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  }

  async showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.isSupported()) return;
    const permission = await this.getPermissionStatus();
    if (permission !== 'granted') return;

    console.log('[Push] Showing local notification:', title);
    
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
