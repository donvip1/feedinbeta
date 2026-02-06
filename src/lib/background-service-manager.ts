/**
 * Background Service Manager
 * Enables WhatsApp-like background connectivity for live spaces, calls, and streams
 * Ensures audio continues when app is minimized or in background
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { backgroundAudioManager } from './background-audio-manager';

export type BackgroundServiceType = 'live_space' | 'live_stream' | 'voice_call' | 'video_call';

interface ActiveService {
  id: string;
  type: BackgroundServiceType;
  title: string;
  startedAt: Date;
  audioElements: string[];
}

class BackgroundServiceManager {
  private static instance: BackgroundServiceManager;
  private activeServices: Map<string, ActiveService> = new Map();
  private isNative: boolean = false;
  private isInitialized: boolean = false;
  private appStateListenerHandle: any = null;
  private notificationId: number = 1;

  static getInstance(): BackgroundServiceManager {
    if (!BackgroundServiceManager.instance) {
      BackgroundServiceManager.instance = new BackgroundServiceManager();
    }
    return BackgroundServiceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.isNative = Capacitor.isNativePlatform();
      
      // Initialize background audio manager
      await backgroundAudioManager.initialize();

      // Set up app state listener
      await this.setupAppStateListener();

      // Set up visibility change listener for web
      if (!this.isNative) {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }

      this.isInitialized = true;
      console.log('[BackgroundService] Initialized, native:', this.isNative);
    } catch (error) {
      console.error('[BackgroundService] Initialization error:', error);
    }
  }

  private async setupAppStateListener(): Promise<void> {
    if (!this.isNative) return;

    try {
      this.appStateListenerHandle = await App.addListener('appStateChange', async ({ isActive }) => {
        console.log('[BackgroundService] App state changed, isActive:', isActive);
        
        if (isActive) {
          await this.onAppForeground();
        } else {
          await this.onAppBackground();
        }
      });
    } catch (error) {
      console.error('[BackgroundService] Failed to setup app state listener:', error);
    }
  }

  private handleVisibilityChange = async (): Promise<void> => {
    if (document.hidden) {
      await this.onAppBackground();
    } else {
      await this.onAppForeground();
    }
  };

  private async onAppBackground(): Promise<void> {
    console.log('[BackgroundService] App entering background');
    
    if (this.activeServices.size === 0) {
      console.log('[BackgroundService] No active services, skipping background mode');
      return;
    }

    // Keep audio playing
    this.ensureAudioContinues();

    // Show persistent notification on native
    if (this.isNative) {
      await this.showBackgroundNotification();
    }

    console.log('[BackgroundService] Background mode activated for', this.activeServices.size, 'services');
  }

  private async onAppForeground(): Promise<void> {
    console.log('[BackgroundService] App returning to foreground');
    
    // Resume any suspended audio contexts
    this.ensureAudioContinues();
    
    // Update notification or hide it
    if (this.isNative && this.activeServices.size > 0) {
      await this.updateBackgroundNotification();
    }
  }

  private ensureAudioContinues(): void {
    // Resume all registered audio elements
    this.activeServices.forEach((service) => {
      service.audioElements.forEach((elementId) => {
        const element = document.getElementById(elementId) as HTMLAudioElement;
        if (element && element.paused && element.srcObject) {
          element.play().catch(err => {
            console.warn('[BackgroundService] Failed to resume audio:', err);
          });
        }
      });
    });
  }

  private async showBackgroundNotification(): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      const activeService = Array.from(this.activeServices.values())[0];
      if (!activeService) return;

      const typeLabels: Record<BackgroundServiceType, string> = {
        live_space: '🎙️ Live Space',
        live_stream: '📺 Live Stream',
        voice_call: '📞 Voice Call',
        video_call: '📹 Video Call',
      };

      await LocalNotifications.schedule({
        notifications: [{
          id: this.notificationId,
          title: typeLabels[activeService.type],
          body: `${activeService.title} is active in background`,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#9333EA',
        }],
      });

      console.log('[BackgroundService] Background notification shown');
    } catch (error) {
      console.error('[BackgroundService] Failed to show notification:', error);
    }
  }

  private async updateBackgroundNotification(): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      if (this.activeServices.size === 0) {
        await LocalNotifications.cancel({ notifications: [{ id: this.notificationId }] });
        console.log('[BackgroundService] Background notification cancelled');
      } else {
        // Update notification with current status
        await this.showBackgroundNotification();
      }
    } catch (error) {
      console.error('[BackgroundService] Failed to update notification:', error);
    }
  }

  /**
   * Start a background service for a live space, stream, or call
   */
  async startService(
    id: string,
    type: BackgroundServiceType,
    title: string,
    audioElementIds: string[] = []
  ): Promise<void> {
    console.log('[BackgroundService] Starting service:', type, id);

    // Register audio elements with background audio manager
    audioElementIds.forEach(elementId => {
      const element = document.getElementById(elementId) as HTMLAudioElement;
      if (element) {
        backgroundAudioManager.registerAudioElement(elementId, element);
      }
    });

    this.activeServices.set(id, {
      id,
      type,
      title,
      startedAt: new Date(),
      audioElements: audioElementIds,
    });

    // Show notification if app is already in background
    if (document.hidden && this.isNative) {
      await this.showBackgroundNotification();
    }

    console.log('[BackgroundService] Service started, total active:', this.activeServices.size);
  }

  /**
   * Stop a background service
   */
  async stopService(id: string): Promise<void> {
    console.log('[BackgroundService] Stopping service:', id);

    const service = this.activeServices.get(id);
    if (service) {
      // Unregister audio elements
      service.audioElements.forEach(elementId => {
        backgroundAudioManager.unregisterAudioElement(elementId);
      });
    }

    this.activeServices.delete(id);

    // Cancel notification if no more services
    if (this.activeServices.size === 0 && this.isNative) {
      await this.cancelBackgroundNotification();
    }

    console.log('[BackgroundService] Service stopped, remaining:', this.activeServices.size);
  }

  /**
   * Add an audio element to an existing service
   */
  addAudioElement(serviceId: string, elementId: string): void {
    const service = this.activeServices.get(serviceId);
    if (service) {
      service.audioElements.push(elementId);
      
      const element = document.getElementById(elementId) as HTMLAudioElement;
      if (element) {
        backgroundAudioManager.registerAudioElement(elementId, element);
      }
    }
  }

  /**
   * Remove an audio element from a service
   */
  removeAudioElement(serviceId: string, elementId: string): void {
    const service = this.activeServices.get(serviceId);
    if (service) {
      service.audioElements = service.audioElements.filter(id => id !== elementId);
      backgroundAudioManager.unregisterAudioElement(elementId);
    }
  }

  /**
   * Check if any service is active
   */
  hasActiveServices(): boolean {
    return this.activeServices.size > 0;
  }

  /**
   * Get active service by ID
   */
  getService(id: string): ActiveService | undefined {
    return this.activeServices.get(id);
  }

  /**
   * Get all active services
   */
  getAllServices(): ActiveService[] {
    return Array.from(this.activeServices.values());
  }

  private async cancelBackgroundNotification(): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: this.notificationId }] });
      console.log('[BackgroundService] Background notification cancelled');
    } catch (error) {
      console.error('[BackgroundService] Failed to cancel notification:', error);
    }
  }

  /**
   * Cleanup all services and resources
   */
  async cleanup(): Promise<void> {
    // Stop all services
    for (const [id] of this.activeServices) {
      await this.stopService(id);
    }

    // Remove listeners
    if (this.appStateListenerHandle) {
      this.appStateListenerHandle.remove();
      this.appStateListenerHandle = null;
    }

    if (!this.isNative) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Cleanup background audio
    await backgroundAudioManager.cleanup();

    this.isInitialized = false;
    console.log('[BackgroundService] Cleanup complete');
  }
}

// Export singleton instance
export const backgroundServiceManager = BackgroundServiceManager.getInstance();
