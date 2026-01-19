/**
 * Native App Manager - SDK-like initialization for all native features
 * Ensures all Capacitor plugins, notifications, background handling, and caching work seamlessly
 */

import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { appDataSync } from './app-data-sync';
import { appShellPreloader } from './app-shell-preloader';
import { backgroundAudioManager } from './background-audio-manager';
import { pushNotificationManager } from './push-notification-manager';
import { indexedDBCache } from './indexed-db-cache';
import { memoryCache } from './memory-cache';

interface NativeAppConfig {
  queryClient: QueryClient;
  userId?: string;
}

class NativeAppManager {
  private static instance: NativeAppManager;
  private isInitialized = false;
  private isNativePlatform = false;
  private platform: 'ios' | 'android' | 'web' = 'web';
  private queryClient: QueryClient | null = null;
  private userId: string | null = null;

  static getInstance(): NativeAppManager {
    if (!NativeAppManager.instance) {
      NativeAppManager.instance = new NativeAppManager();
    }
    return NativeAppManager.instance;
  }

  /**
   * Initialize all native features - call this once on app startup
   */
  async initialize(config: NativeAppConfig): Promise<void> {
    if (this.isInitialized) return;

    console.log('[NativeAppManager] Initializing native features...');
    const startTime = Date.now();

    this.queryClient = config.queryClient;
    this.userId = config.userId || null;

    try {
      // Detect platform
      await this.detectPlatform();

      // Initialize all systems in parallel
      await Promise.allSettled([
        this.initializeDataSync(),
        this.initializePushNotifications(),
        this.initializeNativePlugins(),
        this.initializeBackgroundHandling(),
        this.initializeCacheSystem(),
      ]);

      this.isInitialized = true;
      console.log(`[NativeAppManager] Initialization complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('[NativeAppManager] Initialization error:', error);
    }
  }

  /**
   * Detect if running on native platform
   */
  private async detectPlatform(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this.isNativePlatform = Capacitor.isNativePlatform();
      this.platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
      console.log(`[NativeAppManager] Platform: ${this.platform}, Native: ${this.isNativePlatform}`);
    } catch {
      this.isNativePlatform = false;
      this.platform = 'web';
    }
  }

  /**
   * Initialize data sync system
   */
  private async initializeDataSync(): Promise<void> {
    if (this.queryClient) {
      appDataSync.initialize(this.queryClient);
    }
  }

  /**
   * Initialize push notifications (both web and native)
   */
  private async initializePushNotifications(): Promise<void> {
    try {
      if (this.isNativePlatform) {
        await this.initializeNativePush();
      } else {
        await pushNotificationManager.initialize();
      }
    } catch (error) {
      console.warn('[NativeAppManager] Push notification init failed:', error);
    }
  }

  /**
   * Initialize native push notifications via Capacitor
   */
  private async initializeNativePush(): Promise<void> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[NativeAppManager] Push permission not granted');
        return;
      }

      // Register for push
      await PushNotifications.register();

      // Set up listeners
      PushNotifications.addListener('registration', async (token) => {
        console.log('[NativeAppManager] Push token:', token.value);
        await this.savePushToken(token.value);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[NativeAppManager] Push received:', notification);
        this.handlePushNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[NativeAppManager] Push action:', action);
        this.handlePushAction(action);
      });

      console.log('[NativeAppManager] Native push initialized');
    } catch (error) {
      console.warn('[NativeAppManager] Native push init error:', error);
    }
  }

  /**
   * Save push token to database
   */
  private async savePushToken(token: string): Promise<void> {
    if (!this.userId) return;

    try {
      // Store in a generic cache key since push_subscriptions table may have different schema
      await indexedDBCache.set(`push_token:${this.userId}`, { 
        token, 
        platform: this.platform 
      }, 24 * 60 * 60 * 1000);
      console.log('[NativeAppManager] Push token saved to cache');
    } catch (error) {
      console.warn('[NativeAppManager] Failed to save push token:', error);
    }
  }

  /**
   * Handle incoming push notification
   */
  private handlePushNotification(notification: any): void {
    // Invalidate relevant queries based on notification type
    if (this.queryClient) {
      const type = notification.data?.type;
      
      switch (type) {
        case 'message':
          this.queryClient.invalidateQueries({ queryKey: ['messages'] });
          this.queryClient.invalidateQueries({ queryKey: ['conversations'] });
          break;
        case 'like':
        case 'comment':
          this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
        case 'call':
          this.queryClient.invalidateQueries({ queryKey: ['incoming-call'] });
          break;
        case 'gift':
          this.queryClient.invalidateQueries({ queryKey: ['user-credits'] });
          this.queryClient.invalidateQueries({ queryKey: ['wallet'] });
          break;
        default:
          this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    }
  }

  /**
   * Handle push notification action (tap, button, etc.)
   */
  private handlePushAction(action: any): void {
    const data = action.notification?.data;
    if (!data) return;

    // Navigate based on notification type
    switch (data.type) {
      case 'message':
        window.location.href = `/messages/${data.conversation_id}`;
        break;
      case 'like':
      case 'comment':
        if (data.post_id) {
          window.location.href = `/feed/post/${data.post_id}`;
        }
        break;
      case 'call':
        if (data.call_id) {
          window.location.href = `/call/${data.call_id}`;
        }
        break;
      case 'follow':
        if (data.user_id) {
          window.location.href = `/profile/${data.user_id}`;
        }
        break;
      default:
        window.location.href = '/notifications/history';
    }
  }

  /**
   * Initialize native Capacitor plugins
   */
  private async initializeNativePlugins(): Promise<void> {
    if (!this.isNativePlatform) return;

    try {
      // Hide splash screen
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 300 });

      // Set status bar style
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#000000' });

      // Initialize keyboard handling
      const { Keyboard } = await import('@capacitor/keyboard');
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      });

      // Initialize app state handling
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.onAppForeground();
        } else {
          this.onAppBackground();
        }
      });

      // Handle Android back button
      if (this.platform === 'android') {
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
      }

      // Handle deep links
      App.addListener('appUrlOpen', ({ url }) => {
        this.handleDeepLink(url);
      });

      console.log('[NativeAppManager] Native plugins initialized');
    } catch (error) {
      console.warn('[NativeAppManager] Native plugin init error:', error);
    }
  }

  /**
   * Handle deep links
   */
  private handleDeepLink(url: string): void {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // Navigate to the path
      if (path && path !== '/') {
        window.location.href = path;
      }
    } catch (error) {
      console.warn('[NativeAppManager] Deep link error:', error);
    }
  }

  /**
   * Initialize background handling
   */
  private async initializeBackgroundHandling(): Promise<void> {
    // Set up visibility change listener for web
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.onAppForeground();
      } else {
        this.onAppBackground();
      }
    });

    // Initialize background audio manager for calls/live
    await backgroundAudioManager.initialize();
  }

  /**
   * Initialize cache system
   */
  private async initializeCacheSystem(): Promise<void> {
    // Cleanup expired cache entries
    await indexedDBCache.cleanupExpired();
    
    // Set up periodic cleanup
    setInterval(() => {
      indexedDBCache.cleanupExpired();
      memoryCache.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Called when app comes to foreground
   */
  private onAppForeground(): void {
    console.log('[NativeAppManager] App came to foreground');

    // Refresh critical data
    if (this.queryClient) {
      appDataSync.forceRefresh([
        'notifications',
        'messages',
        'user-credits',
        'live-streams',
        'live-spaces',
      ]);
    }

    // Reconnect Supabase realtime
    supabase.realtime.connect();
  }

  /**
   * Called when app goes to background
   */
  private onAppBackground(): void {
    console.log('[NativeAppManager] App went to background');

    // Save current state to cache
    if (this.userId) {
      this.persistCurrentState();
    }
  }

  /**
   * Persist current state to cache for instant restore
   */
  private async persistCurrentState(): Promise<void> {
    if (!this.userId || !this.queryClient) return;

    const keysToCache = [
      ['profile', this.userId],
      ['user-credits', this.userId],
      ['notifications'],
      ['conversations'],
    ];

    for (const queryKey of keysToCache) {
      const data = this.queryClient.getQueryData(queryKey);
      if (data) {
        const cacheKey = queryKey.join(':');
        memoryCache.set(cacheKey, data, 60 * 60 * 1000); // 1 hour
        await indexedDBCache.set(cacheKey, data, 60 * 60 * 1000);
      }
    }
  }

  /**
   * Update user ID (call after login)
   */
  setUserId(userId: string): void {
    this.userId = userId;
    localStorage.setItem('currentUserId', userId);
    
    // Refresh preloaded data for new user
    appShellPreloader.reset();
    appShellPreloader.loadCacheToMemory().then(() => {
      appShellPreloader.refreshInBackground();
    });
  }

  /**
   * Clear user data (call on logout)
   */
  async clearUserData(): Promise<void> {
    this.userId = null;
    localStorage.removeItem('currentUserId');
    
    // Clear user-specific caches
    await indexedDBCache.cleanupExpired();
    memoryCache.clear();
    appShellPreloader.reset();
  }

  /**
   * Check if running on native platform
   */
  isNative(): boolean {
    return this.isNativePlatform;
  }

  /**
   * Get current platform
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    return this.platform;
  }
}

export const nativeAppManager = NativeAppManager.getInstance();
export default nativeAppManager;
