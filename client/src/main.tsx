import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-reload on stale chunk errors (happens after new deploys when browser has old HTML cached)
// Only match actual dynamic import / chunk errors, NOT generic "Failed to fetch" from API calls
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || event.reason || '');
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  ) {
    const reloadKey = 'chunk_reload_' + window.location.pathname;
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    } else {
      sessionStorage.removeItem(reloadKey);
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Unregister any existing service worker and clear all caches
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const r of registrations) r.unregister();
  });
}
if ("caches" in window) {
  caches.keys().then((names) => {
    for (const name of names) caches.delete(name);
  });
}
