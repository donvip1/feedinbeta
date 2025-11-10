import { useState, useEffect } from 'react';
import { PreferenceManager } from '@/lib/cookie-manager';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  autoPlayVideos?: boolean;
  showNotifications?: boolean;
  feedView?: 'following' | 'forYou';
}

/**
 * Hook to manage user preferences stored in cookies
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    theme: PreferenceManager.get(PreferenceManager.THEME, 'system'),
    language: PreferenceManager.get(PreferenceManager.LANGUAGE, 'en'),
    autoPlayVideos: PreferenceManager.get(PreferenceManager.AUTO_PLAY, true),
    showNotifications: PreferenceManager.get(PreferenceManager.NOTIFICATIONS, true),
    feedView: PreferenceManager.get(PreferenceManager.FEED_VIEW, 'forYou'),
  }));

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    // Map preference key to cookie key
    const cookieKeyMap: Record<string, string> = {
      theme: PreferenceManager.THEME,
      language: PreferenceManager.LANGUAGE,
      autoPlayVideos: PreferenceManager.AUTO_PLAY,
      showNotifications: PreferenceManager.NOTIFICATIONS,
      feedView: PreferenceManager.FEED_VIEW,
    };

    const cookieKey = cookieKeyMap[key];
    if (cookieKey) {
      PreferenceManager.set(cookieKey, value);
      setPreferences((prev) => ({ ...prev, [key]: value }));
    }
  };

  const clearPreferences = () => {
    PreferenceManager.clearAll();
    setPreferences({
      theme: 'system',
      language: 'en',
      autoPlayVideos: true,
      showNotifications: true,
      feedView: 'forYou',
    });
  };

  return {
    preferences,
    updatePreference,
    clearPreferences,
  };
}
