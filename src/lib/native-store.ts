/**
 * Native-first persistence layer.
 *
 * Goal: make the app open instantly like TikTok/Instagram by reading
 * the last-known feed/messages/profile from on-device SQLite, then
 * refreshing from Supabase in the background.
 *
 * - On native (Capacitor iOS/Android): uses @capacitor-community/sqlite (real SQLite)
 * - On web/preview: falls back to IndexedDB via the existing indexed-db-cache
 *
 * Public API is identical on every platform, so callers don't branch.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { indexedDBCache } from './indexed-db-cache';

const DB_NAME = 'feedin_native';
const DB_VERSION = 1;

type CacheRow = {
  key: string;
  value: string;     // JSON-serialized payload
  updated_at: number; // unix ms
};

class NativeStore {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initPromise: Promise<void> | null = null;
  private isNative = Capacitor.isNativePlatform();

  /** Lazy, idempotent init. Safe to call from anywhere. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    if (!this.isNative) {
      // Web fallback: indexed-db-cache is already initialized lazily
      return;
    }

    try {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);

      // Ensure no stale connection
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

      if (ret.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          DB_VERSION,
          false
        );
      }

      await this.db.open();

      // One generic K/V table covers feed, messages, profiles, etc.
      // Keyed by namespace:id (e.g. "feed:home", "msg:<conv-id>", "profile:<user-id>")
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cache_updated ON cache(updated_at);
      `);

      console.log('[NativeStore] SQLite initialized');
    } catch (e) {
      console.warn('[NativeStore] SQLite init failed, falling back to IndexedDB:', e);
      this.isNative = false;
      this.db = null;
    }
  }

  /** Read a cached payload. Returns null if missing. */
  async get<T = unknown>(key: string): Promise<T | null> {
    await this.init();

    if (this.isNative && this.db) {
      try {
        const res = await this.db.query('SELECT value FROM cache WHERE key = ?;', [key]);
        const row = res.values?.[0] as Pick<CacheRow, 'value'> | undefined;
        return row ? (JSON.parse(row.value) as T) : null;
      } catch (e) {
        console.warn('[NativeStore] get failed:', e);
        return null;
      }
    }

    // Web fallback
    return indexedDBCache.get<T>(key);
  }

  /** Write a payload. Overwrites existing. */
  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.init();
    const now = Date.now();

    if (this.isNative && this.db) {
      try {
        await this.db.run(
          'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?);',
          [key, JSON.stringify(value), now]
        );
        return;
      } catch (e) {
        console.warn('[NativeStore] set failed:', e);
      }
    }

    // Web fallback (indexed-db-cache supports TTL natively)
    await indexedDBCache.set(key, value, ttlMs);
  }

  /** Delete a single key. */
  async remove(key: string): Promise<void> {
    await this.init();

    if (this.isNative && this.db) {
      try {
        await this.db.run('DELETE FROM cache WHERE key = ?;', [key]);
        return;
      } catch (e) {
        console.warn('[NativeStore] remove failed:', e);
      }
    }

    await indexedDBCache.remove(key);
  }

  /** Delete every cached key matching a prefix (e.g. "feed:"). */
  async clearPrefix(prefix: string): Promise<void> {
    await this.init();

    if (this.isNative && this.db) {
      try {
        await this.db.run('DELETE FROM cache WHERE key LIKE ?;', [`${prefix}%`]);
        return;
      } catch (e) {
        console.warn('[NativeStore] clearPrefix failed:', e);
      }
    }

    // IndexedDB fallback: best-effort
    try {
      await indexedDBCache.cleanupExpired();
    } catch {}
  }

  /** Was this last updated within the freshness window? */
  async isFresh(key: string, maxAgeMs: number): Promise<boolean> {
    await this.init();

    if (this.isNative && this.db) {
      try {
        const res = await this.db.query('SELECT updated_at FROM cache WHERE key = ?;', [key]);
        const row = res.values?.[0] as Pick<CacheRow, 'updated_at'> | undefined;
        return row ? Date.now() - row.updated_at < maxAgeMs : false;
      } catch {
        return false;
      }
    }

    // Web fallback: presence implies non-expired (indexedDBCache enforces TTL)
    return (await indexedDBCache.get(key)) !== null;
  }
}

export const nativeStore = new NativeStore();

// Eager init on app start so the first read is instant
if (typeof window !== 'undefined') {
  nativeStore.init().catch(() => {});
}
