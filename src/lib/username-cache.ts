/**
 * Username Cache - Maps usernames to user IDs for instant profile resolution
 */

import { indexedDBCache } from './indexed-db-cache';

const USERNAME_CACHE_KEY = 'username_mappings';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class UsernameCache {
  private cache: Map<string, string> = new Map();
  private loaded = false;

  /**
   * Load mappings from IndexedDB into memory
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      const stored = await indexedDBCache.get<Record<string, string>>(USERNAME_CACHE_KEY);
      if (stored) {
        Object.entries(stored).forEach(([username, id]) => {
          this.cache.set(username.toLowerCase(), id);
        });
      }
      this.loaded = true;
    } catch (error) {
      console.error('[UsernameCache] Load error:', error);
    }
  }

  /**
   * Get user ID from username (synchronous - from memory)
   */
  get(username: string): string | null {
    return this.cache.get(username.toLowerCase()) || null;
  }

  /**
   * Set username -> userId mapping
   */
  async set(username: string, userId: string): Promise<void> {
    this.cache.set(username.toLowerCase(), userId);
    
    // Persist to IndexedDB
    try {
      const stored = await indexedDBCache.get<Record<string, string>>(USERNAME_CACHE_KEY) || {};
      stored[username.toLowerCase()] = userId;
      await indexedDBCache.set(USERNAME_CACHE_KEY, stored, CACHE_TTL);
    } catch (error) {
      console.error('[UsernameCache] Save error:', error);
    }
  }

  /**
   * Set multiple mappings at once
   */
  async setMany(mappings: Array<{ username: string; id: string }>): Promise<void> {
    mappings.forEach(({ username, id }) => {
      if (username) {
        this.cache.set(username.toLowerCase(), id);
      }
    });

    // Persist to IndexedDB
    try {
      const stored = await indexedDBCache.get<Record<string, string>>(USERNAME_CACHE_KEY) || {};
      mappings.forEach(({ username, id }) => {
        if (username) {
          stored[username.toLowerCase()] = id;
        }
      });
      await indexedDBCache.set(USERNAME_CACHE_KEY, stored, CACHE_TTL);
    } catch (error) {
      console.error('[UsernameCache] Save many error:', error);
    }
  }

  /**
   * Check if username is cached
   */
  has(username: string): boolean {
    return this.cache.has(username.toLowerCase());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

export const usernameCache = new UsernameCache();
export default usernameCache;
