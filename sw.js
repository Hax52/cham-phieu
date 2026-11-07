/* Offline support: keeps the app on the phone so it opens without a connection. */
const CACHE = 'cham-phieu-02a8b57887';
const ASSETS = ["./", "index.html", "logic.js", "manifest.webmanifest", "omr.js", "sample.jpg", "scan-worker.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "fonts/be-vietnam-pro-latin-400-normal.woff2", "fonts/be-vietnam-pro-latin-500-normal.woff2", "fonts/be-vietnam-pro-latin-600-normal.woff2", "fonts/be-vietnam-pro-latin-700-normal.woff2", "fonts/be-vietnam-pro-latin-ext-400-normal.woff2", "fonts/be-vietnam-pro-latin-ext-500-normal.woff2", "fonts/be-vietnam-pro-latin-ext-600-normal.woff2", "fonts/be-vietnam-pro-latin-ext-700-normal.woff2", "fonts/be-vietnam-pro-vietnamese-400-normal.woff2", "fonts/be-vietnam-pro-vietnamese-500-normal.woff2", "fonts/be-vietnam-pro-vietnamese-600-normal.woff2", "fonts/be-vietnam-pro-vietnamese-700-normal.woff2", "fonts/bricolage-grotesque-latin-600-normal.woff2", "fonts/bricolage-grotesque-latin-700-normal.woff2", "fonts/bricolage-grotesque-latin-ext-600-normal.woff2", "fonts/bricolage-grotesque-latin-ext-700-normal.woff2", "fonts/bricolage-grotesque-vietnamese-600-normal.woff2", "fonts/bricolage-grotesque-vietnamese-700-normal.woff2", "fonts/fonts.css", "fonts/jetbrains-mono-latin-500-normal.woff2", "fonts/jetbrains-mono-latin-700-normal.woff2", "fonts/jetbrains-mono-latin-ext-500-normal.woff2", "fonts/jetbrains-mono-latin-ext-700-normal.woff2", "fonts/jetbrains-mono-vietnamese-500-normal.woff2", "fonts/jetbrains-mono-vietnamese-700-normal.woff2", "lib/pdf.min.js", "lib/pdf.worker.min.js", "lib/xlsx.full.min.js"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('cham-phieu-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./') : Response.error())));
});
