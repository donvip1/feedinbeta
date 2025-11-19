/**
 * Notification Manager - Handles push notification registration and permissions
 */

export class NotificationManager {
  /**
   * Request notification permission from the user
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Show a local notification (works even when app is in foreground)
   */
  static async showNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    const permission = await NotificationManager.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // If service worker is available, use it for better control
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        icon: '/favicon.png',
        ...options,
      });
    }
  }

  /**
   * Check if notifications are supported and enabled
   */
  static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  static getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }
}
