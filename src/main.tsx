import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CacheManager } from "./lib/cache-manager";
import { indexedDBCache } from "./lib/indexed-db-cache";
import { memoryCache } from "./lib/memory-cache";

// Preload critical data into memory cache from IndexedDB BEFORE React renders
const preloadMemoryCache = async () => {
  try {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      // Load critical data into memory cache in parallel
      const keys = [
        `profile:${userId}`,
        `credits:${userId}`,
        `notifications_count:${userId}`,
        'credit_packages',
        'subscription_tiers',
      ];
      
      await Promise.all(keys.map(async (key) => {
        const data = await indexedDBCache.get(key);
        if (data) {
          memoryCache.set(key, data, 30 * 60 * 1000); // 30 min TTL
        }
      }));
      
      console.log('[Main] Memory cache preloaded');
    }
  } catch (error) {
    console.error('[Main] Preload error:', error);
  }
};

// Start preloading immediately
preloadMemoryCache();

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    CacheManager.register();
  });
}

// Cleanup expired cache entries periodically
indexedDBCache.cleanupExpired();
setInterval(() => {
  indexedDBCache.cleanupExpired();
  memoryCache.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
