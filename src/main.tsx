import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CacheManager } from "./lib/cache-manager";
import { indexedDBCache } from "./lib/indexed-db-cache";
import { memoryCache } from "./lib/memory-cache";
import { appShellPreloader } from "./lib/app-shell-preloader";

// PHASE 1: Load cache to memory BEFORE React renders (instant feel)
const initializeApp = async () => {
  const startTime = Date.now();
  
  // Check if user is likely authenticated
  if (appShellPreloader.isLikelyAuthenticated()) {
    // Load cached data into memory for instant access
    await appShellPreloader.loadCacheToMemory();
    console.log(`[Main] App shell preloaded in ${Date.now() - startTime}ms`);
  }

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

  // Now render React
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // PHASE 2: Refresh data in background AFTER React mounts
  if (appShellPreloader.isLikelyAuthenticated()) {
    // Use requestIdleCallback for non-blocking background refresh
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        appShellPreloader.refreshInBackground();
      }, { timeout: 3000 });
    } else {
      setTimeout(() => {
        appShellPreloader.refreshInBackground();
      }, 100);
    }
  }
};

// Start initialization
initializeApp();
