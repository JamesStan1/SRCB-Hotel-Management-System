/* Service Worker for handling push events and showing notifications.
   This file is served from /sw.js and will be registered by the client.
   It handles 'push' events (if you implement server push) and displays
   notifications with vibration where supported.
*/

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Notification', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || payload.message || 'Alert';
  const body = payload.body || payload.message || '';
  const options = {
    body,
    tag: payload.tag || 'housekeeping-notification',
    vibrate: payload.vibrate || [200, 100, 200],
    data: payload.data || {},
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const hadWindowToFocus = clientsArr.some((client) => client.url === url && 'focus' in client && client.focus());
      if (!hadWindowToFocus) {
        self.clients.openWindow(url).catch(() => {});
      }
    })
  );
});
