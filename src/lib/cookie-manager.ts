/**
 * Cookie Manager - Handles cookie operations for sessions and preferences
 */

export interface CookieOptions {
  expires?: Date | number; // Date object or days from now
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export const CookieManager = {
  /**
   * Set a cookie
   */
  set(name: string, value: string, options: CookieOptions = {}): void {
    const {
      expires,
      path = '/',
      domain,
      secure = window.location.protocol === 'https:',
      sameSite = 'Lax',
    } = options;

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (expires) {
      const expiresDate =
        expires instanceof Date
          ? expires
          : new Date(Date.now() + expires * 24 * 60 * 60 * 1000);
      cookieString += `; expires=${expiresDate.toUTCString()}`;
    }

    if (path) cookieString += `; path=${path}`;
    if (domain) cookieString += `; domain=${domain}`;
    if (secure) cookieString += '; secure';
    if (sameSite) cookieString += `; samesite=${sameSite}`;

    document.cookie = cookieString;
  },

  /**
   * Get a cookie value
   */
  get(name: string): string | null {
    const cookies = document.cookie.split('; ');
    const cookie = cookies.find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
    
    if (!cookie) return null;
    
    const value = cookie.split('=')[1];
    return value ? decodeURIComponent(value) : null;
  },

  /**
   * Remove a cookie
   */
  remove(name: string, options: Omit<CookieOptions, 'expires'> = {}): void {
    this.set(name, '', { ...options, expires: new Date(0) });
  },

  /**
   * Check if a cookie exists
   */
  has(name: string): boolean {
    return this.get(name) !== null;
  },

  /**
   * Get all cookies as an object
   */
  getAll(): Record<string, string> {
    const cookies: Record<string, string> = {};
    document.cookie.split('; ').forEach((cookie) => {
      const [name, value] = cookie.split('=');
      if (name && value) {
        cookies[decodeURIComponent(name)] = decodeURIComponent(value);
      }
    });
    return cookies;
  },

  /**
   * Clear all cookies
   */
  clearAll(): void {
    const cookies = this.getAll();
    Object.keys(cookies).forEach((name) => {
      this.remove(name);
    });
  },

  /**
   * Set JSON cookie (for complex data)
   */
  setJSON(name: string, value: any, options?: CookieOptions): void {
    this.set(name, JSON.stringify(value), options);
  },

  /**
   * Get JSON cookie
   */
  getJSON<T = any>(name: string): T | null {
    const value = this.get(name);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },
};

/**
 * Preference Manager - Manages user preferences in cookies
 */
export const PreferenceManager = {
  /**
   * Save user preference
   */
  set(key: string, value: any): void {
    CookieManager.setJSON(`pref_${key}`, value, {
      expires: 365, // 1 year
      sameSite: 'Lax',
    });
  },

  /**
   * Get user preference
   */
  get<T = any>(key: string, defaultValue?: T): T | null {
    const value = CookieManager.getJSON<T>(`pref_${key}`);
    return value !== null ? value : (defaultValue !== undefined ? defaultValue : null);
  },

  /**
   * Remove preference
   */
  remove(key: string): void {
    CookieManager.remove(`pref_${key}`);
  },

  /**
   * Clear all preferences
   */
  clearAll(): void {
    const cookies = CookieManager.getAll();
    Object.keys(cookies)
      .filter((name) => name.startsWith('pref_'))
      .forEach((name) => CookieManager.remove(name));
  },

  // Common preference keys
  THEME: 'theme',
  LANGUAGE: 'language',
  FEED_VIEW: 'feed_view',
  NOTIFICATIONS: 'notifications',
  AUTO_PLAY: 'auto_play',
};
