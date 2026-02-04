import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PrivacySettings {
  profile_visible: boolean;
  show_online_status: boolean;
  allow_friend_requests: boolean;
  allow_messages_from_strangers: boolean;
  show_read_receipts: boolean;
  show_activity_status: boolean;
  // Field-level visibility controls
  show_phone_number: boolean;
  show_email: boolean;
  show_date_of_birth: boolean;
  show_location: boolean;
  show_marital_status: boolean;
  show_occupation: boolean;
  show_social_links: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  profile_visible: true,
  show_online_status: true,
  allow_friend_requests: true,
  allow_messages_from_strangers: false,
  show_read_receipts: true,
  show_activity_status: true,
  // Default: sensitive fields hidden, general fields visible
  show_phone_number: false,
  show_email: false,
  show_date_of_birth: false,
  show_location: true,
  show_marital_status: false,
  show_occupation: true,
  show_social_links: true,
};

// Cache for other users' privacy settings
const privacyCache = new Map<string, { settings: PrivacySettings; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const usePrivacySettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load current user's privacy settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('privacy_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading privacy settings:', error);
          return;
        }

        if (data) {
          setSettings({
            profile_visible: data.profile_visible ?? true,
            show_online_status: data.show_online_status ?? true,
            allow_friend_requests: data.allow_friend_requests ?? true,
            allow_messages_from_strangers: data.allow_messages_from_strangers ?? false,
            show_read_receipts: data.show_read_receipts ?? true,
            show_activity_status: data.show_activity_status ?? true,
            // Field-level visibility
            show_phone_number: data.show_phone_number ?? false,
            show_email: data.show_email ?? false,
            show_date_of_birth: data.show_date_of_birth ?? false,
            show_location: data.show_location ?? true,
            show_marital_status: data.show_marital_status ?? false,
            show_occupation: data.show_occupation ?? true,
            show_social_links: data.show_social_links ?? true,
          });
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  return { settings, isLoading };
};

// Hook to get another user's privacy settings (for checking if we can interact with them)
export const useOtherUserPrivacySettings = (targetUserId: string | null) => {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!targetUserId) {
        setIsLoading(false);
        return;
      }

      // Check cache first
      const cached = privacyCache.get(targetUserId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setSettings(cached.settings);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('privacy_settings')
          .select('*')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading user privacy settings:', error);
          setSettings(DEFAULT_SETTINGS);
          return;
        }

        const userSettings: PrivacySettings = data ? {
          profile_visible: data.profile_visible ?? true,
          show_online_status: data.show_online_status ?? true,
          allow_friend_requests: data.allow_friend_requests ?? true,
          allow_messages_from_strangers: data.allow_messages_from_strangers ?? false,
          show_read_receipts: data.show_read_receipts ?? true,
          show_activity_status: data.show_activity_status ?? true,
          show_phone_number: data.show_phone_number ?? false,
          show_email: data.show_email ?? false,
          show_date_of_birth: data.show_date_of_birth ?? false,
          show_location: data.show_location ?? true,
          show_marital_status: data.show_marital_status ?? false,
          show_occupation: data.show_occupation ?? true,
          show_social_links: data.show_social_links ?? true,
        } : DEFAULT_SETTINGS;

        // Cache the result
        privacyCache.set(targetUserId, { settings: userSettings, timestamp: Date.now() });
        setSettings(userSettings);
      } catch (error) {
        console.error('Error loading user privacy settings:', error);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [targetUserId]);

  return { settings, isLoading };
};

// Helper function to check if user can send message to target
export const checkCanMessageUser = async (
  senderId: string,
  targetUserId: string
): Promise<{ canMessage: boolean; reason?: string }> => {
  try {
    // Check if they are friends
    const { data: friendship } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${senderId})`)
      .limit(1)
      .maybeSingle();

    if (friendship) {
      return { canMessage: true };
    }

    // Not friends - check target's privacy settings
    const { data: settings } = await supabase
      .from('privacy_settings')
      .select('allow_messages_from_strangers')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (settings?.allow_messages_from_strangers) {
      return { canMessage: true };
    }

    return { 
      canMessage: false, 
      reason: 'This user only accepts messages from friends' 
    };
  } catch (error) {
    console.error('Error checking message permissions:', error);
    return { canMessage: true }; // Fail open
  }
};

// Helper function to check if user can send friend request
export const checkCanSendFriendRequest = async (
  senderId: string,
  targetUserId: string
): Promise<{ canSend: boolean; reason?: string }> => {
  try {
    // Check target's privacy settings
    const { data: settings } = await supabase
      .from('privacy_settings')
      .select('allow_friend_requests')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (settings && !settings.allow_friend_requests) {
      return { 
        canSend: false, 
        reason: 'This user is not accepting friend requests' 
      };
    }

    return { canSend: true };
  } catch (error) {
    console.error('Error checking friend request permissions:', error);
    return { canSend: true }; // Fail open
  }
};