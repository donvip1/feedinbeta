import { CookieManager } from './cookie-manager';

/**
 * Session Manager - Handles session persistence
 * Note: Supabase handles auth sessions automatically, but we can use this for additional session data
 */

export interface SessionData {
  lastActiveTab?: string;
  lastViewedPost?: string;
  scrollPosition?: number;
  draftPost?: any;
}

export const SessionManager = {
  /**
   * Save session data
   */
  set(key: string, value: any): void {
    try {
      CookieManager.setJSON(`session_${key}`, value, {
        expires: 7, // 7 days
        sameSite: 'Lax',
        secure: true,
      });
      
      // Also store in sessionStorage for faster access
      sessionStorage.setItem(`session_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('[Session] Failed to save session data:', error);
    }
  },

  /**
   * Get session data
   */
  get<T = any>(key: string): T | null {
    try {
      // Try sessionStorage first (faster)
      const sessionValue = sessionStorage.getItem(`session_${key}`);
      if (sessionValue) {
        return JSON.parse(sessionValue);
      }

      // Fallback to cookie
      return CookieManager.getJSON<T>(`session_${key}`);
    } catch (error) {
      console.error('[Session] Failed to get session data:', error);
      return null;
    }
  },

  /**
   * Remove session data
   */
  remove(key: string): void {
    CookieManager.remove(`session_${key}`);
    sessionStorage.removeItem(`session_${key}`);
  },

  /**
   * Clear all session data
   */
  clearAll(): void {
    const cookies = CookieManager.getAll();
    Object.keys(cookies)
      .filter((name) => name.startsWith('session_'))
      .forEach((name) => CookieManager.remove(name));
    
    // Clear sessionStorage
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('session_'))
      .forEach((key) => sessionStorage.removeItem(key));
  },

  // Common session keys
  ACTIVE_TAB: 'active_tab',
  SCROLL_POSITION: 'scroll_position',
  DRAFT_POST: 'draft_post',
  LAST_VIEWED: 'last_viewed',
};
