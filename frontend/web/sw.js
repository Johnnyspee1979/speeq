/* SpeeQ — Service Worker v4 — network-first, geen stale code meer */
const CACHE_NAME = 'wkb-snap-v4';
const OFFLINE_SHELL = ['/'];

// Install: cache app shell, direct activeren
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_SHELL))
  );
  self.skipWaiting();
});

// Activate: oude caches WEG, neem direct over
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Verwijder ALLE oude caches (niet alleen de v3-naam)
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Forceer alle open tabs te herladen zodat nieuwe code direct draait
    const clientsList = await self.clients.matchAll({ type: 'window' });
    for (const client of clientsList) {
      client.postMessage({ type: 'SW_UPDATED' });
    }
  })());
});

// Fetch: NETWORK-FIRST voor HTML/JS (altijd verse code).
// Cache-fallback alleen als offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (url.includes('supabase.co') || url.includes('/api/')) return;
  if (url.startsWith('chrome-extension')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(req);
      // Cache alleen succesvolle responses
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, response.clone());
      }
      return response;
    } catch (err) {
      // Offline: pak cache
      const cached = await caches.match(req);
      if (cached) return cached;
      // Echt niets: fallback naar shell
      return caches.match('/');
    }
  })());
});

// ── Push notificatie handler ─────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SpeeQ', body: event.data.text() };
  }

  const title = data.title ?? 'SpeeQ';
  const options = {
    body: data.body ?? '',
    icon: '/assets/icon.png',
    badge: '/assets/favicon.png',
    tag: data.tag ?? ('wkb-' + Date.now()),
    renotify: true,
    requireInteraction: true,
    data: data.data ?? {},
    actions: [
      { action: 'open', title: '📸 Bekijken' },
      { action: 'dismiss', title: 'Sluiten' },
    ],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notificatie klik handler ─────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const projectId = event.notification.data && event.notification.data.projectId;
  const evidenceId = event.notification.data && event.notification.data.evidenceId;
  const appUrl = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          client.postMessage({ type: 'PUSH_CLICK', projectId: projectId, evidenceId: evidenceId });
          return client.focus();
        }
      }
      return clients.openWindow(appUrl);
    })
  );
});

// ── Push subscription change ─────────────────────────────────────────────────

self.addEventListener('pushsubscriptionchange', function() {
  console.log('[SW] Push subscription changed');
});

// ── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'wkb-sync-evidence') {
    console.log('[SW] Background sync gestart: wkb-sync-evidence');
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length === 0) return;
        for (const client of clientList) {
          client.postMessage({ type: 'BG_SYNC_REQUESTED' });
        }
      })
    );
  }
});

// ── Message handler — app kan SKIP_WAITING vragen ───────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
