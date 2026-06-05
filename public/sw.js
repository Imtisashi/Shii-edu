const CACHE_NAME = 'shii-edu-pwa-shell-v4';
const SHELL_URLS = [
  '/',
  '/roles',
  '/login',
  '/auth/institute',
  '/auth/parents',
  '/auth/driver',
  '/expo-index.html',
  '/manifest.webmanifest',
  '/manifest-institute.webmanifest',
  '/manifest-parents.webmanifest',
  '/manifest-driver.webmanifest',
  '/assets/images/icon.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_URLS).catch(function () { return undefined; });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

const cacheAndReturn = function (request, response) {
  if (!response || response.status >= 400) return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }).catch(function () {});
  return response;
};

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) { return cacheAndReturn(request, response); })
        .catch(function () { return caches.match(request).then(function (cached) { return cached || caches.match('/expo-index.html') || caches.match('/'); }); })
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.webmanifest') || url.pathname === '/sw.js') {
    event.respondWith(
      caches.match(request).then(function (cached) {
        const network = fetch(request).then(function (response) { return cacheAndReturn(request, response); }).catch(function () { return cached; });
        return cached || network;
      })
    );
  }
});

const normalizeNotificationPayload = function (payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return {
    title: data.title || 'Shii-Edu',
    options: {
      body: data.body || data.message || '',
      data: {
        url: data.url || data.path || '/',
        ...(data.data || {})
      },
      icon: data.icon || '/assets/images/icon.png',
      tag: data.tag || 'shii-edu-notification'
    }
  };
};

self.addEventListener('message', function (event) {
  const payload = event.data || {};
  if (payload.type !== 'SHOW_NOTIFICATION') return;
  const notification = normalizeNotificationPayload(payload);
  event.waitUntil(self.registration.showNotification(notification.title, notification.options));
});

self.addEventListener('push', function (event) {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_error) {
      payload = { body: event.data.text() };
    }
  }

  const notification = normalizeNotificationPayload(payload);
  event.waitUntil(self.registration.showNotification(notification.title, notification.options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (clients) {
      for (const client of clients) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) return client.navigate(targetUrl).then(function () { return client.focus(); });
          return client.focus();
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
