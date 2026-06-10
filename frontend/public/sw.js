/* Service worker for the storefront + POS PWA.
 *
 * Strategy:
 *  - App shell (the /pos terminal + icons): precached so the terminal opens
 *    even with no network.
 *  - Next.js hashed static assets (/_next/static/...): cache-first — they are
 *    immutable, so once cached they never need a refetch.
 *  - Navigations: network-first, falling back to the cached shell when offline.
 *  - POS catalog + public site settings: network-first with a cache fallback so
 *    the product grid still renders offline (the actual offline *sales* are
 *    queued in IndexedDB by the app, not here).
 *  - Everything else (incl. all POST/PUT/DELETE): passed straight through.
 */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_ASSETS = [
    "/pos",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/maskable-512.png",
];

// Runtime-cacheable GET endpoints (matched by pathname, ignoring query string).
const RUNTIME_PATHS = ["/api/admin/pos/products", "/api/client/site-settings"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            // addAll is atomic; use individual best-effort puts so one bad
            // response (e.g. a transient 5xx on /pos) doesn't abort install.
            .then((cache) =>
                Promise.all(
                    SHELL_ASSETS.map((url) =>
                        fetch(url, { credentials: "same-origin" })
                            .then((res) => (res.ok ? cache.put(url, res) : null))
                            .catch(() => null),
                    ),
                ),
            )
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
                    .map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackUrl) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (fallbackUrl) {
            const fb = await cache.match(fallbackUrl);
            if (fb) return fb;
        }
        throw err;
    }
}

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

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, SHELL_CACHE, "/pos"));
        return;
    }

    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
        event.respondWith(cacheFirst(request, SHELL_CACHE));
        return;
    }

    if (RUNTIME_PATHS.includes(url.pathname)) {
        event.respondWith(networkFirst(request, RUNTIME_CACHE));
        return;
    }
});
