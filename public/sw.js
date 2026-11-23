'use strict';
/* EndoControl service worker: shows glucose alerts sent by the server (Web Push) even when the
   app is closed, and opens the app when the notification is tapped. It caches nothing. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const urgent = d.level === 'critical' || d.level === 'urgent';
  e.waitUntil(self.registration.showNotification(d.title || 'EndoControl', {
    body: d.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: d.tag || 'glucose',          // a newer alert replaces the older one…
    renotify: true,                    // …and still rings
    requireInteraction: urgent,        // lows stay on screen until handled
    vibrate: d.level === 'critical' ? [500, 200, 500, 200, 500] : urgent ? [300, 150, 300] : [200],
    data: { url: d.url || '/', kind: d.kind },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) { await w.focus(); w.postMessage({ type: 'alert-open', url }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
