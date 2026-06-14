// Small fetchers for admin-editable site content.
// Used by Footer, Navbar, layout SEO. All endpoints are read-only and public.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// `store` is the optional active store (a subdomain) for the interim shared-domain
// path-routing. Server components pass it (from getActiveStore in storeContext.js)
// so SSR fetches hit the right tenant; the browser leaves it blank because the
// middleware injects X-Tenant from the cookie on the relative /api proxy path.
const fetchJson = async (path, store = "") => {
    // On the server (SSR / static export) a relative URL has no host to resolve
    // against and the prerender hangs, so target the absolute backend URL. In the
    // browser keep the relative path so the Next.js rewrite proxy handles it.
    const isServer = typeof window === "undefined";
    const url = isServer ? `${BACKEND_URL}${path}` : path;
    // On the server: forward the tenant header (absolute URL bypasses middleware)
    // and skip the shared-URL data cache so store A's response is never served for
    // store B. On the client: also forward X-Tenant when a store slug is provided
    // so the browser's relative-path fetch hits the right tenant.
    const scoped = !!store;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, {
            ...(scoped
                ? { headers: { "X-Tenant": store }, cache: "no-store" }
                : isServer
                    ? { next: { revalidate: 60 } }
                    : {}),
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

export const fetchSiteSettings = (store = "") => fetchJson('/api/client/site-settings', store);
export const fetchFooter = (store = "") => fetchJson('/api/client/footer', store);
export const fetchNavMenu = (location, store = "") =>
    fetchJson(location ? `/api/client/nav-menu?location=${location}` : '/api/client/nav-menu', store);

// Admin-overridable content for a fixed page (returns null when no override has
// been saved, so the route renders its built-in default content).
export const fetchPage = (slug, store = "") => fetchJson(`/api/client/page/${slug}`, store);
