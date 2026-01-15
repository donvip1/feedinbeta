/**
 * Native Call Handler
 * Handles incoming call notifications and background call management
 * for native mobile app using Capacitor
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

export interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'video' | 'voice';
}

class NativeCallHandler {
  private isInitialized = false;
  private activeCallId: string | null = null;
  private callNotificationId = 9999; // Fixed ID for call notifications

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Only initialize on native platforms
      if (!Capacitor.isNativePlatform()) {
        console.log('[NativeCallHandler] Not on native platform, skipping initialization');
        return;
      }

      // Request notification permissions
      const permResult = await LocalNotifications.requestPermissions();
      if (permResult.display !== 'granted') {
        console.warn('[NativeCallHandler] Notification permission not granted');
      }

      // Register notification action handlers
      await this.setupNotificationListeners();

      // Listen for app state changes
      App.addListener('appStateChange', async ({ isActive }) => {
        console.log('[NativeCallHandler] App state changed, isActive:', isActive);
        
        if (isActive && this.activeCallId) {
          // App came to foreground with active call - navigate to call screen
          // This is handled by the app routing
        }
      });

      this.isInitialized = true;
      console.log('[NativeCallHandler] Initialized successfully');
    } catch (error) {
      console.error('[NativeCallHandler] Failed to initialize:', error);
    }
  }

  private async setupNotificationListeners(): Promise<void> {
    // Handle notification actions
    LocalNotifications.addListener('localNotificationActionPerformed', async (notification) => {
      const { actionId, notification: notif } = notification;
      const callData = notif.extra as IncomingCallData;

      console.log('[NativeCallHandler] Notification action:', actionId, callData);

      if (actionId === 'answer' && callData?.callId) {
        await this.answerCall(callData.callId);
      } else if (actionId === 'decline' && callData?.callId) {
        await this.declineCall(callData.callId);
      }
    });

    // Handle notification tap
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('[NativeCallHandler] Notification received:', notification);
    });
  }

  /**
   * Show incoming call notification (for background calls)
   */
  async showIncomingCallNotification(callData: IncomingCallData): Promise<void> {
    try {
      this.activeCallId = callData.callId;

      // Cancel any existing call notification
      await LocalNotifications.cancel({ notifications: [{ id: this.callNotificationId }] });

      // Show high-priority call notification
      await LocalNotifications.schedule({
        notifications: [{
          id: this.callNotificationId,
          title: `${callData.callType === 'video' ? '📹' : '📞'} Incoming ${callData.callType} call`,
          body: `${callData.callerName} is calling you`,
          sound: 'ringtone.wav', // Custom ringtone
          ongoing: true, // Keep notification until user interacts
          autoCancel: false,
          extra: callData,
          actionTypeId: 'INCOMING_CALL',
          channelId: 'calls', // High priority channel
        }],
      });

      console.log('[NativeCallHandler] Incoming call notification shown');
    } catch (error) {
      console.error('[NativeCallHandler] Failed to show notification:', error);
    }
  }

  /**
   * Cancel the incoming call notification
   */
  async cancelIncomingCallNotification(): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: this.callNotificationId }] });
      this.activeCallId = null;
      console.log('[NativeCallHandler] Incoming call notification cancelled');
    } catch (error) {
      console.error('[NativeCallHandler] Failed to cancel notification:', error);
    }
  }

  /**
   * Answer an incoming call
   */
  private async answerCall(callId: string): Promise<void> {
    try {
      // Update call status to answered
      await supabase
        .from('call_logs')
        .update({
          status: 'answered',
          started_at: new Date().toISOString(),
        })
        .eq('id', callId);

      // Cancel notification
      await this.cancelIncomingCallNotification();

      // Navigate to call page (will be handled by app routing)
      // The app will detect the call status change via realtime subscription
      console.log('[NativeCallHandler] Call answered:', callId);
    } catch (error) {
      console.error('[NativeCallHandler] Failed to answer call:', error);
    }
  }

  /**
   * Decline an incoming call
   */
  private async declineCall(callId: string): Promise<void> {
    try {
      // Update call status to rejected
      await supabase
        .from('call_logs')
        .update({
          status: 'rejected',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      // Cancel notification
      await this.cancelIncomingCallNotification();

      console.log('[NativeCallHandler] Call declined:', callId);
    } catch (error) {
      console.error('[NativeCallHandler] Failed to decline call:', error);
    }
  }

  /**
   * Register notification channels (Android)
   */
  async registerNotificationChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Create a high-priority channel for calls
      await LocalNotifications.createChannel({
        id: 'calls',
        name: 'Incoming Calls',
        description: 'Notifications for incoming calls',
        importance: 5, // Max importance
        visibility: 1, // Public
        vibration: true,
        sound: 'ringtone.wav',
        lights: true,
      });

      console.log('[NativeCallHandler] Notification channels registered');
    } catch (error) {
      console.error('[NativeCallHandler] Failed to register channels:', error);
    }
  }

  /**
   * Check if running on native platform
   */
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get the active call ID
   */
  getActiveCallId(): string | null {
    return this.activeCallId;
  }
}

// Export singleton instance
export const nativeCallHandler = new NativeCallHandler();
