/**
 * Memory Cache - Synchronous in-memory cache for instant data access
 * This provides 0ms data access for cached data
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries = 100;

  /**
   * Set a value in the cache (synchronous)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Enforce max entries
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get a value from the cache (synchronous)
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all keys that match a pattern
   */
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    return keys.filter(key => key.includes(pattern));
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const memoryCache = new MemoryCache();

// Cleanup expired entries every minute
setInterval(() => {
  memoryCache.cleanup();
}, 60 * 1000);

export default memoryCache;
