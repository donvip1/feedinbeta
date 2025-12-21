import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CacheManager } from "./lib/cache-manager";
import { indexedDBCache } from "./lib/indexed-db-cache";

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
}, 5 * 60 * 1000); // Every 5 minutes

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
