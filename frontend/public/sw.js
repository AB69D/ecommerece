/* Service worker for the storefront + POS PWA.
 *
 * MULTI-TENANT SAFETY: this worker caches ONLY immutable, tenant-AGNOSTIC assets
 * (Next.js hashed static files + icons). It deliberately does NOT cache API
 * responses or page HTML, because those are per-store — caching them keyed by URL
 * alone (as a previous version did for /api/admin/pos/products and
 * /api/client/site-settings) serves one store's data to another. All navigations
 * and /api/* calls now pass straight through to the network, so each store always
 * renders its own fresh data. Offline *sales* are queued in IndexedDB by the app,
 * not here.
 *
 * Bumping VERSION purges every older cache on activate, clearing any cross-store
 * data the previous worker may have stored.
 */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;

self.addEventListener("install", () => {
    // Nothing tenant-specific to precache — take over as soon as possible.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Drop every cache from older worker versions (they may hold stale,
            // cross-store data such as another store's POS catalog or settings).
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // ONLY immutable, tenant-agnostic static assets are cached. Everything else —
    // navigations and every /api/* call — goes to the network untouched so each
    // store gets its own data and nothing leaks between stores.
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
});
