/**
 * IndexedDB Cache Manager for FeedIn
 * Provides fast, persistent caching for conversations, messages, profiles,
 * and general app data with TTL support
 */

const DB_NAME = 'feedin_cache';
const DB_VERSION = 2; // Upgraded for new stores

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
    const stores = ['conversations', 'messages', 'profiles', 'cache'];
    
    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
    }
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

export default indexedDBCache;
