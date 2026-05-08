/* WKB Snap & Sync — Service Worker v3 */
const CACHE_NAME = 'wkb-snap-v3';
const OFFLINE_SHELL = ['/'];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate for static, network-first for API
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;
  if (url.includes('supabase.co') || url.includes('/api/')) return;
  if (url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok && response.type !== 'opaque') {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => cached);

      return cached ?? networkFetch;
    })
  );
});

// ── Push notificatie handler ─────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'WKB Snap & Sync', body: event.data.text() };
  }

  const title = data.title ?? 'WKB Snap & Sync';
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
  // Browser heeft subscription vernieuwd — app hersubscribeert bij volgende laad
  console.log('[SW] Push subscription changed');
});

// ── Background Sync ──────────────────────────────────────────────────────────
// Vuurt wanneer het netwerk terugkomt, ook als de PWA in de achtergrond zit.
// Stuurt een bericht naar alle open tabbladen zodat de app de wachtrij kan uploaden.

self.addEventListener('sync', (event) => {
  if (event.tag === 'wkb-sync-evidence') {
    console.log('[SW] Background sync gestart: wkb-sync-evidence');
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length === 0) {
          // Geen open vensters — niks te doen, app triggert sync zelf bij openen
          return;
        }
        for (const client of clientList) {
          client.postMessage({ type: 'BG_SYNC_REQUESTED' });
        }
      })
    );
  }
});
