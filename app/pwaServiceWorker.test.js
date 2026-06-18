/* global describe, expect, it */

const fs = require('fs');
const path = require('path');

describe('PWA service worker freshness', () => {
  it('ships Superadmin shells with network-first Expo assets and no-cache service worker updates', () => {
    const root = process.cwd();
    const syncScript = fs.readFileSync(path.join(root, 'scripts', 'sync-expo-web-to-next-public.js'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
    const expoShell = fs.readFileSync(path.join(root, 'public', 'expo-index.html'), 'utf8');

    expect(syncScript).toContain("updateViaCache: 'none'");
    expect(expoShell).toContain("updateViaCache: 'none'");
    expect(serviceWorker).toContain("const CACHE_NAME = 'shii-edu-pwa-shell-v9';");
    expect(serviceWorker).toContain("url.pathname.startsWith('/_expo/')");
    expect(serviceWorker).toMatch(/fetch\(request\)\s+\.then\(function \(response\) \{ return cacheAndReturn\(request, response\); \}\)\s+\.catch\(function \(\) \{ return caches\.match\(request\); \}\)/);
    expect(serviceWorker).not.toContain('return cached || network;');
  });
});
