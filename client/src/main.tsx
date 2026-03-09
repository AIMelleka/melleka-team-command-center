import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
