// Service Worker for Kan Alma Siramatik PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Handle incoming background Push Notification from Server
self.addEventListener('push', (event) => {
  let data = { title: "🔔 SIRANIZ GELDİ!", body: "Lütfen çağrıldığınız odaya geçiniz." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "🔔 SIRANIZ GELDİ!", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "https://cdn-icons-png.flaticon.com/512/2869/2869818.png",
    badge: "https://cdn-icons-png.flaticon.com/512/2869/2869818.png",
    tag: "sira-cagrisi",
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 SIRANIZ GELDİ!", options)
  );
});

// Handle OS-level system notification click across other apps
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
