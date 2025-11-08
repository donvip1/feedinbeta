import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CacheManager } from "./lib/cache-manager";

// Build timestamp: Force rebuild to clear stale Vite cache
console.log("React version:", React.version);
console.log("Build time:", new Date().toISOString());

// Register service worker for caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    CacheManager.register();
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<App />);
