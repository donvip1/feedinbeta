/**
 * IndexedDB Cache Manager for FeedIn
 * Provides fast, persistent caching for conversations, messages, profiles,
 * and general app data with TTL support
 * 
 * Enhanced with additional stores for stories, trending, wallet, and live content
 */

const DB_NAME = 'feedin_cache';
const DB_VERSION = 3; // Upgraded for new stores (v3)

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface ConversationCache {
  id: string;
  updated_at: string;
  other_participant: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

interface MessageCache {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface ProfileCache {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (this.dbPromise) return this.dbPromise;
    
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('updated_at', 'updated_at');
        }
        
        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversation_id', 'conversation_id');
          msgStore.createIndex('created_at', 'created_at');
        }
        
        // Profiles store
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        
        // Generic cache store with TTL support
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expiresAt', 'expiresAt');
        }

        // App data store for structured data (v2)
        if (!db.objectStoreNames.contains('app_data')) {
          const appStore = db.createObjectStore('app_data', { keyPath: 'key' });
          appStore.createIndex('category', 'category');
          appStore.createIndex('expiresAt', 'expiresAt');
        }

        // Stories store (v3)
        if (!db.objectStoreNames.contains('stories')) {
          const storiesStore = db.createObjectStore('stories', { keyPath: 'id' });
          storiesStore.createIndex('user_id', 'user_id');
          storiesStore.createIndex('expires_at', 'expires_at');
        }

        // Trending store (v3)
        if (!db.objectStoreNames.contains('trending')) {
          const trendingStore = db.createObjectStore('trending', { keyPath: 'id' });
          trendingStore.createIndex('category', 'category');
        }

        // Wallet store (v3)
        if (!db.objectStoreNames.contains('wallet')) {
          const walletStore = db.createObjectStore('wallet', { keyPath: 'user_id' });
        }

        // Live content store (v3)
        if (!db.objectStoreNames.contains('live_content')) {
          const liveStore = db.createObjectStore('live_content', { keyPath: 'id' });
          liveStore.createIndex('type', 'type');
          liveStore.createIndex('status', 'status');
        }

        // Media URLs store for preloaded media (v3)
        if (!db.objectStoreNames.contains('media_urls')) {
          const mediaStore = db.createObjectStore('media_urls', { keyPath: 'url' });
          mediaStore.createIndex('preloaded_at', 'preloaded_at');
        }
      };
    });
    
    return this.dbPromise;
  }

  // Conversations
  async saveConversations(conversations: ConversationCache[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('conversations', 'readwrite');
    const store = tx.objectStore('conversations');
    
    for (const conv of conversations) {
      store.put(conv);
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getConversations(): Promise<ConversationCache[]> {
    const db = await this.getDB();
    const tx = db.transaction('conversations', 'readonly');
    const store = tx.objectStore('conversations');
    const index = store.index('updated_at');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by updated_at descending
        const results = request.result.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateConversation(conversation: Partial<ConversationCache> & { id: string }): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('conversations', 'readwrite');
    const store = tx.objectStore('conversations');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(conversation.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {};
        store.put({ ...existing, ...conversation });
        tx.oncomplete = () => resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Messages
  async saveMessages(conversationId: string, messages: MessageCache[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    
    for (const msg of messages) {
      store.put(msg);
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessages(conversationId: string, limit = 50): Promise<MessageCache[]> {
    const db = await this.getDB();
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('conversation_id');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(conversationId);
      request.onsuccess = () => {
        // Sort by created_at descending and limit
        const results = request.result
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit);
        resolve(results.reverse()); // Reverse to get ascending order
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(message: MessageCache): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    store.put(message);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Profiles
  async saveProfile(profile: ProfileCache): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('profiles', 'readwrite');
    const store = tx.objectStore('profiles');
    store.put(profile);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getProfile(id: string): Promise<ProfileCache | null> {
    const db = await this.getDB();
    const tx = db.transaction('profiles', 'readonly');
    const store = tx.objectStore('profiles');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic cache with TTL
  async set<T>(key: string, data: T, ttlMs = 3600000): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    
    store.put(entry);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        
        // Check if expired
        if (Date.now() > entry.expiresAt) {
          // Delete expired entry
          this.delete(key);
          resolve(null);
          return;
        }
        
        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    store.delete(key);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Clear all data
  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const stores = ['conversations', 'messages', 'profiles', 'cache', 'app_data', 'stories', 'trending', 'wallet', 'live_content', 'media_urls'];
    
    for (const storeName of stores) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      } catch (e) {
        // Store might not exist in older versions
      }
    }
  }

  // Save feed posts for instant load
  async saveFeedPosts(posts: any[], cacheKey: string = 'feed_posts'): Promise<void> {
    return this.set(cacheKey, posts, 5 * 60 * 1000); // 5 min TTL
  }

  async getFeedPosts(cacheKey: string = 'feed_posts'): Promise<any[] | null> {
    return this.get(cacheKey);
  }

  // Save user credits for instant wallet display
  async saveUserCredits(userId: string, credits: any): Promise<void> {
    return this.set(`credits_${userId}`, credits, 2 * 60 * 1000); // 2 min TTL
  }

  async getUserCredits(userId: string): Promise<any | null> {
    return this.get(`credits_${userId}`);
  }

  // Save notifications count
  async saveNotificationCount(userId: string, count: number): Promise<void> {
    return this.set(`notif_count_${userId}`, count, 60 * 1000); // 1 min TTL
  }

  async getNotificationCount(userId: string): Promise<number | null> {
    return this.get(`notif_count_${userId}`);
  }

  // Preload critical data - call this on app startup
  async preloadCriticalData(userId: string): Promise<void> {
    console.log('[IndexedDBCache] Preloading critical data for user:', userId);
    // This is called by background-sync, data is fetched there
  }

  // Cleanup expired entries
  async cleanupExpired(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const index = store.index('expiresAt');
    
    const range = IDBKeyRange.upperBound(Date.now());
    const request = index.openCursor(range);
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  // Get cache size estimate
  async getCacheSize(): Promise<{ entries: number; stores: string[] }> {
    const db = await this.getDB();
    const stores = Array.from(db.objectStoreNames);
    let totalEntries = 0;

    for (const storeName of stores) {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const count = await new Promise<number>((resolve) => {
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        });
        totalEntries += count;
      } catch (e) {
        // Ignore errors
      }
    }

    return { entries: totalEntries, stores };
  }
}

// Singleton instance
export const indexedDBCache = new IndexedDBCache();

// Convenience exports
export const conversationCache = {
  save: (conversations: ConversationCache[]) => indexedDBCache.saveConversations(conversations),
  getAll: () => indexedDBCache.getConversations(),
  update: (conversation: Partial<ConversationCache> & { id: string }) => 
    indexedDBCache.updateConversation(conversation),
};

export const messageCache = {
  save: (conversationId: string, messages: MessageCache[]) => 
    indexedDBCache.saveMessages(conversationId, messages),
  get: (conversationId: string, limit?: number) => 
    indexedDBCache.getMessages(conversationId, limit),
  add: (message: MessageCache) => indexedDBCache.addMessage(message),
};

export const profileCache = {
  save: (profile: ProfileCache) => indexedDBCache.saveProfile(profile),
  get: (id: string) => indexedDBCache.getProfile(id),
};

export const feedCache = {
  save: (posts: any[], key?: string) => indexedDBCache.saveFeedPosts(posts, key),
  get: (key?: string) => indexedDBCache.getFeedPosts(key),
};

export const creditsCache = {
  save: (userId: string, credits: any) => indexedDBCache.saveUserCredits(userId, credits),
  get: (userId: string) => indexedDBCache.getUserCredits(userId),
};

export const notificationCache = {
  saveCount: (userId: string, count: number) => indexedDBCache.saveNotificationCount(userId, count),
  getCount: (userId: string) => indexedDBCache.getNotificationCount(userId),
};

export default indexedDBCache;
