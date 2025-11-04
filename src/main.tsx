import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CacheManager } from "./lib/cache-manager";

console.log("React version:", React.version);

// Register service worker for caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    CacheManager.register();
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<App />);
