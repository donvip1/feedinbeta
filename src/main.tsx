import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { fastBoot } from "./lib/fast-boot";

/**
 * Ultra-fast app initialization optimized for mobile APK
 * 
 * Boot sequence:
 * 1. Critical boot (< 100ms) - Load essential cached data
 * 2. Render React immediately
 * 3. Secondary boot - Load additional cached data
 * 4. Deferred boot - Load remaining data in idle time
 * 5. Background refresh - Fetch fresh data from server
 */
const initializeApp = async () => {
  const startTime = performance.now();
  
  // PHASE 1: Critical boot - only essential data
  if (fastBoot.isAuthenticated()) {
    await fastBoot.criticalBoot();
  }

  // PHASE 2: Render React immediately (don't wait for more data)
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Hide static policy footer once React app has mounted (crawlers still see it on initial load)
  const policyFooter = document.getElementById('static-policy-links');
  if (policyFooter) policyFooter.style.display = 'none';

  console.log(`[Main] First paint in ${(performance.now() - startTime).toFixed(1)}ms`);

  // PHASE 3: Post-render initialization (non-blocking)
  if (fastBoot.isAuthenticated()) {
    // Secondary boot - load more cached data
    requestAnimationFrame(() => {
      fastBoot.secondaryBoot().then(() => {
        // Deferred boot - load remaining data in idle time
        fastBoot.deferredBoot();
      });
    });

    // Background refresh - fetch fresh data from server
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fastBoot.backgroundRefresh();
      }, { timeout: 3000 });
    } else {
      setTimeout(() => fastBoot.backgroundRefresh(), 500);
    }
  }

  // PHASE 4: Register service worker (deferred)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      const { CacheManager } = await import('./lib/cache-manager');
      CacheManager.register();
    });
  }

  // PHASE 5: Periodic cleanup (very low priority)
  setTimeout(async () => {
    const { indexedDBCache } = await import('./lib/indexed-db-cache');
    const { memoryCache } = await import('./lib/memory-cache');
    
    indexedDBCache.cleanupExpired();
    
    setInterval(() => {
      indexedDBCache.cleanupExpired();
      memoryCache.cleanup();
    }, 5 * 60 * 1000);
  }, 10000);
};

// Start immediately
initializeApp();
