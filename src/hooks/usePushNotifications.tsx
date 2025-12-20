import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { pushNotificationManager } from '@/lib/push-notification-manager';

interface NotificationPreferences {
  push_enabled: boolean;
  likes_enabled: boolean;
  comments_enabled: boolean;
  messages_enabled: boolean;
  stories_enabled: boolean;
  friend_requests_enabled: boolean;
  gifts_enabled: boolean;
  follows_enabled: boolean;
  live_enabled: boolean;
  email_enabled: boolean;
}

const defaultPreferences: NotificationPreferences = {
  push_enabled: true,
  likes_enabled: true,
  comments_enabled: true,
  messages_enabled: true,
  stories_enabled: true,
  friend_requests_enabled: true,
  gifts_enabled: true,
  follows_enabled: true,
  live_enabled: true,
  email_enabled: false,
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  // Initialize push notification support
  useEffect(() => {
    const init = async () => {
      const supported = pushNotificationManager.isSupported();
      setIsSupported(supported);

      if (supported) {
        const perm = await pushNotificationManager.getPermissionStatus();
        setPermission(perm);

        const subscribed = await pushNotificationManager.isSubscribed();
        setIsSubscribed(subscribed);
      }

      setLoading(false);
    };

    init();
  }, []);

  // Load preferences when user logs in
  useEffect(() => {
    if (!user) return;
    loadPreferences();
  }, [user]);

  // Auto-subscribe when user logs in and push is enabled
  useEffect(() => {
    if (!user || !isSupported || !preferences.push_enabled) return;

    const autoSubscribe = async () => {
      const perm = await pushNotificationManager.getPermissionStatus();
      if (perm === 'granted' && !isSubscribed) {
        const success = await pushNotificationManager.subscribe(user.id);
        setIsSubscribed(success);
      }
    };

    autoSubscribe();
  }, [user, isSupported, preferences.push_enabled]);

  // Subscribe to realtime notifications and show push when appropriate
  useEffect(() => {
    if (!user || !isSubscribed || !preferences.push_enabled) return;

    const channel = supabase
      .channel(`notifications-push-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const notification = payload?.new;
          if (!notification) return;

          // Check if this notification type is enabled
          const shouldNotify = checkNotificationEnabled(notification.type, preferences);
          if (!shouldNotify) return;

          // Check if document is hidden (user not actively on app)
          if (document.visibilityState === 'hidden') {
            await pushNotificationManager.showLocalNotification(
              notification.title,
              {
                body: notification.message || '',
                tag: `feedin-${notification.type}-${notification.id}`,
                data: {
                  type: notification.type,
                  related_id: notification.related_id,
                  related_type: notification.related_type,
                },
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isSubscribed, preferences]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Create default preferences if they don't exist
        await supabase
          .from('notification_preferences')
          .insert([{ user_id: user.id }]);
      } else if (data) {
        setPreferences({
          push_enabled: data.push_enabled ?? true,
          likes_enabled: data.likes_enabled ?? true,
          comments_enabled: data.comments_enabled ?? true,
          messages_enabled: data.messages_enabled ?? true,
          stories_enabled: data.stories_enabled ?? true,
          friend_requests_enabled: data.friend_requests_enabled ?? true,
          gifts_enabled: data.gifts_enabled ?? true,
          follows_enabled: data.follows_enabled ?? true,
          live_enabled: data.live_enabled ?? true,
          email_enabled: data.email_enabled ?? false,
        });
      }
    } catch (error) {
      console.error('[Push] Error loading preferences:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const perm = await pushNotificationManager.requestPermission();
    setPermission(perm);

    if (perm === 'granted') {
      const success = await pushNotificationManager.subscribe(user.id);
      setIsSubscribed(success);
      return success;
    }

    return false;
  }, [user]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const success = await requestPermission();
    if (success) {
      await updatePreference('push_enabled', true);
    }
    return success;
  }, [user, requestPermission]);

  const disablePush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    await pushNotificationManager.unsubscribe(user.id);
    setIsSubscribed(false);
    await updatePreference('push_enabled', false);
    return true;
  }, [user]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      await supabase
        .from('notification_preferences')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('[Push] Error updating preference:', error);
    }
  };

  const updateAllPreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user) return;

    setPreferences(prev => ({ ...prev, ...newPreferences }));

    try {
      await supabase
        .from('notification_preferences')
        .update({ ...newPreferences, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('[Push] Error updating preferences:', error);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    preferences,
    requestPermission,
    enablePush,
    disablePush,
    updatePreference,
    updateAllPreferences,
    loadPreferences,
  };
}

// Helper to check if a notification type is enabled
function checkNotificationEnabled(
  type: string,
  preferences: NotificationPreferences
): boolean {
  if (!preferences.push_enabled) return false;

  const typeMap: Record<string, keyof NotificationPreferences> = {
    'like': 'likes_enabled',
    'comment': 'comments_enabled',
    'reply': 'comments_enabled',
    'message': 'messages_enabled',
    'story_reply': 'stories_enabled',
    'story_reaction': 'stories_enabled',
    'friend_request': 'friend_requests_enabled',
    'friend_request_accepted': 'friend_requests_enabled',
    'gift': 'gifts_enabled',
    'gift_received': 'gifts_enabled',
    'live_gift': 'gifts_enabled',
    'follow': 'follows_enabled',
    'live_invite': 'live_enabled',
    'mention': 'comments_enabled',
    'refeed': 'likes_enabled',
    'quote': 'likes_enabled',
  };

  const prefKey = typeMap[type];
  if (!prefKey) return true; // Unknown type, default to enabled

  return preferences[prefKey];
}