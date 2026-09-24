/* Service worker: la app abre sin señal y se instala como PWA.
   - La página (index.html) se pide primero a la red (así "Forzar actualización" trae lo nuevo) y, sin
     señal, sale de la copia guardada.
   - css/js/íconos llevan ?v= en su URL: se guardan una vez y se sirven desde la caché.
   - Firebase, fuentes y el lector de tickets (CDN, URLs con versión fija) también se guardan.
   - Todo lo demás (Firestore, login, cotizaciones) pasa directo: los datos los guarda Firestore.
   La versión (?v= del registro) es la misma que la de los archivos en index.html. */
'use strict';
const V = new URL(self.location).searchParams.get('v') || '0';
const SHELL = 'viajes-shell-' + V, CDN = 'viajes-cdn-v1';
const JS = ['config', 'core', 'plata', 'vistas', 'mispagos', 'render', 'avisos', 'final', 'ticket', 'lugares', 'clima', 'mapa', 'grupos', 'formularios', 'compartir', 'nube', 'pwa', 'main'];   /* los mismos que index.html */
const FILES = ['./', 'manifest.webmanifest', 'css/app.css?v=' + V, 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png']
  .concat(JS.map(f => 'js/' + f + '.js?v=' + V));
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'tessdata.projectnaptha.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('viajes-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin === scope.origin) {
    if (!url.pathname.startsWith(scope.pathname) || url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/sw.js')) return;
    if (req.mode === 'navigate' || url.pathname === scope.pathname || url.pathname.endsWith('/index.html')) {
      e.respondWith(fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./', copy)); }
        return res;
      }).catch(() => caches.match('./', { cacheName: SHELL }).then(r => r || caches.match('./'))));
      return;
    }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && url.search.includes('v=')) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CDN).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
/* Tocar un aviso abre (o trae al frente) la app. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
