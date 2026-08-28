// Service Worker for Kan Alma Siramatik PWA

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Basic pass-through fetching.
  // We do not cache WebSocket or live API requests to prevent real-time lag.
  event.respondWith(fetch(event.request));
});
