const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webBuild = path.join(root, 'web-build');
const publicDir = path.join(root, 'public');

const ensureDirectory = (target) => {
  fs.mkdirSync(target, { recursive: true });
};

const copyDirectory = (source, target) => {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { force: true, recursive: true });
  fs.cpSync(source, target, { recursive: true });
};

if (!fs.existsSync(path.join(webBuild, 'index.html'))) {
  throw new Error('web-build/index.html was not found. Run the Expo web export before syncing.');
}

ensureDirectory(publicDir);
copyDirectory(path.join(webBuild, '_expo'), path.join(publicDir, '_expo'));
copyDirectory(path.join(webBuild, 'assets'), path.join(publicDir, 'assets'));

for (const fileName of ['favicon.ico', 'metadata.json']) {
  const source = path.join(webBuild, fileName);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(publicDir, fileName));
  }
}

let expoIndexHtml = fs.readFileSync(path.join(webBuild, 'index.html'), 'utf8');
const pwaHead = [
  '<script>',
  '(function () {',
  '  var roleManifests = {',
  "    '/auth/institute': '/manifest-institute.webmanifest',",
  "    '/auth/parents': '/manifest-parents.webmanifest',",
  "    '/auth/driver': '/manifest-driver.webmanifest',",
  "    '/login': '/manifest-institute.webmanifest'",
  '  };',
  "  var path = window.location.pathname.replace(/\\/$/, '') || '/';",
  "  var manifest = roleManifests[path] || '/manifest.webmanifest';",
  "  var link = document.querySelector('link[rel=\"manifest\"]') || document.createElement('link');",
  "  link.setAttribute('rel', 'manifest');",
  '  link.setAttribute("href", manifest);',
  '  document.head.appendChild(link);',
  '}());',
  '</script>',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Shii-Edu" />',
].join('\n');
const serviceWorkerScript = [
  '<script>',
  "if ('serviceWorker' in navigator) {",
  "  window.addEventListener('load', function () {",
  "    navigator.serviceWorker.register('/sw.js').catch(function () {});",
  '  });',
  '}',
  '</script>',
].join('\n');

if (!expoIndexHtml.includes('roleManifests')) {
  expoIndexHtml = expoIndexHtml.replace(/<link\s+rel=["']manifest["']\s+href=["'][^"']+["']\s*\/?>/g, '');
  expoIndexHtml = expoIndexHtml.replace('</head>', `${pwaHead}\n</head>`);
}

if (!expoIndexHtml.includes("navigator.serviceWorker.register('/sw.js')")) {
  expoIndexHtml = expoIndexHtml.includes('</body>')
    ? expoIndexHtml.replace('</body>', `${serviceWorkerScript}\n</body>`)
    : `${expoIndexHtml}\n${serviceWorkerScript}`;
}

fs.writeFileSync(path.join(publicDir, 'expo-index.html'), expoIndexHtml);

const manifest = {
  background_color: '#FFFFFF',
  description: 'Choose the Shii-Edu app for Institute, Parents, or Driver access.',
  display: 'standalone',
  icons: [
    {
      purpose: 'any maskable',
      sizes: '192x192',
      src: '/icon.png',
      type: 'image/png',
    },
    {
      purpose: 'any maskable',
      sizes: '512x512',
      src: '/icon.png',
      type: 'image/png',
    },
  ],
  name: 'Shii-Edu',
  scope: '/',
  short_name: 'Shii-Edu',
  start_url: '/roles',
  theme_color: '#FFFFFF',
};

const createRoleManifest = ({
  backgroundColor = '#FFFFFF',
  description,
  id,
  name,
  shortName,
  startUrl,
  themeColor,
}) => ({
  background_color: backgroundColor,
  description,
  display: 'standalone',
  icons: manifest.icons,
  id,
  name,
  scope: '/',
  short_name: shortName,
  start_url: startUrl,
  theme_color: themeColor,
});

const roleManifests = {
  'manifest-institute.webmanifest': createRoleManifest({
    description: 'Shii-Edu Institute workspace for admins, teachers, and students.',
    id: '/auth/institute',
    name: 'Shii-Edu Institute',
    shortName: 'Institute',
    startUrl: '/auth/institute',
    themeColor: '#635BFF',
  }),
  'manifest-parents.webmanifest': createRoleManifest({
    description: 'Shii-Edu Parents workspace for guardian updates, fees, notices, and transport.',
    id: '/auth/parents',
    name: 'Shii-Edu Parents',
    shortName: 'Parents',
    startUrl: '/auth/parents',
    themeColor: '#0F766E',
  }),
  'manifest-driver.webmanifest': createRoleManifest({
    description: 'Shii-Edu Driver workspace for route assignments and live fleet status.',
    id: '/auth/driver',
    name: 'Shii-Edu Driver',
    shortName: 'Driver',
    startUrl: '/auth/driver',
    themeColor: '#B45309',
  }),
};

fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
Object.entries(roleManifests).forEach(([fileName, data]) => {
  fs.writeFileSync(path.join(publicDir, fileName), `${JSON.stringify(data, null, 2)}\n`);
});
fs.writeFileSync(path.join(publicDir, 'sw.js'), [
  "const CACHE_NAME = 'shii-edu-pwa-shell-v4';",
  "const SHELL_URLS = [",
  "  '/',",
  "  '/roles',",
  "  '/login',",
  "  '/auth/institute',",
  "  '/auth/parents',",
  "  '/auth/driver',",
  "  '/expo-index.html',",
  "  '/manifest.webmanifest',",
  "  '/manifest-institute.webmanifest',",
  "  '/manifest-parents.webmanifest',",
  "  '/manifest-driver.webmanifest',",
  "  '/icon.png'",
  '];',
  '',
  "self.addEventListener('install', function (event) {",
  '  self.skipWaiting();',
  '  event.waitUntil(',
  '    caches.open(CACHE_NAME).then(function (cache) {',
  '      return cache.addAll(SHELL_URLS).catch(function () { return undefined; });',
  '    })',
  '  );',
  '});',
  '',
  "self.addEventListener('activate', function (event) {",
  '  event.waitUntil(',
  '    caches.keys().then(function (keys) {',
  '      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));',
  '    }).then(function () { return self.clients.claim(); })',
  '  );',
  '});',
  '',
  'const cacheAndReturn = function (request, response) {',
  '  if (!response || response.status >= 400) return response;',
  '  const copy = response.clone();',
  '  caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }).catch(function () {});',
  '  return response;',
  '};',
  '',
  "self.addEventListener('fetch', function (event) {",
  '  const request = event.request;',
  '  if (request.method !== "GET") return;',
  '  const url = new URL(request.url);',
  '  if (url.origin !== self.location.origin) return;',
  '',
  "  if (request.mode === 'navigate') {",
  '    event.respondWith(',
  '      fetch(request)',
  '        .then(function (response) { return cacheAndReturn(request, response); })',
  "        .catch(function () { return caches.match(request).then(function (cached) { return cached || caches.match('/expo-index.html') || caches.match('/'); }); })",
  '    );',
  '    return;',
  '  }',
  '',
  "  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.webmanifest') || url.pathname === '/sw.js') {",
  '    event.respondWith(',
  '      caches.match(request).then(function (cached) {',
  '        const network = fetch(request).then(function (response) { return cacheAndReturn(request, response); }).catch(function () { return cached; });',
  '        return cached || network;',
  '      })',
  '    );',
  '  }',
  '});',
  '',
  'const normalizeNotificationPayload = function (payload) {',
  "  const data = payload && typeof payload === 'object' ? payload : {};",
  '  return {',
  "    title: data.title || 'Shii-Edu',",
  '    options: {',
  "      body: data.body || data.message || '',",
  '      data: {',
  "        url: data.url || data.path || '/',",
  '        ...(data.data || {})',
  '      },',
  "      icon: data.icon || '/icon.png',",
  "      tag: data.tag || 'shii-edu-notification'",
  '    }',
  '  };',
  '};',
  '',
  "self.addEventListener('message', function (event) {",
  '  const payload = event.data || {};',
  "  if (payload.type !== 'SHOW_NOTIFICATION') return;",
  '  const notification = normalizeNotificationPayload(payload);',
  '  event.waitUntil(self.registration.showNotification(notification.title, notification.options));',
  '});',
  '',
  "self.addEventListener('push', function (event) {",
  '  let payload = {};',
  '  if (event.data) {',
  '    try {',
  '      payload = event.data.json();',
  '    } catch (_error) {',
  '      payload = { body: event.data.text() };',
  '    }',
  '  }',
  '',
  '  const notification = normalizeNotificationPayload(payload);',
  '  event.waitUntil(self.registration.showNotification(notification.title, notification.options));',
  '});',
  '',
  "self.addEventListener('notificationclick', function (event) {",
  '  event.notification.close();',
  "  const targetUrl = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin).href;",
  '',
  '  event.waitUntil(',
  "    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (clients) {",
  '      for (const client of clients) {',
  "        if ('focus' in client && new URL(client.url).origin === self.location.origin) {",
  "          if ('navigate' in client) return client.navigate(targetUrl).then(function () { return client.focus(); });",
  '          return client.focus();',
  '        }',
  '      }',
  '',
  '      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);',
  '      return undefined;',
  '    })',
  '  );',
  '});',
  '',
].join('\n'));

const iconSource = path.join(root, 'assets', 'images', 'icon.png');
const iconTarget = path.join(publicDir, 'assets', 'images', 'icon.png');
if (fs.existsSync(iconSource) && !fs.existsSync(iconTarget)) {
  ensureDirectory(path.dirname(iconTarget));
  fs.copyFileSync(iconSource, iconTarget);
}

const heroVideoSource = path.join(root, 'assets', 'videos', 'cosmic-campus.mp4');
const heroVideoTarget = path.join(publicDir, 'assets', 'videos', 'cosmic-campus.mp4');
if (fs.existsSync(heroVideoSource)) {
  ensureDirectory(path.dirname(heroVideoTarget));
  fs.copyFileSync(heroVideoSource, heroVideoTarget);
}

console.log('Synced Expo web export into Next public assets.');
