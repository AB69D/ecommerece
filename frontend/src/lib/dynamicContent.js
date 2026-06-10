// Small fetchers for admin-editable site content.
// Used by Footer, Navbar, layout SEO. All endpoints are read-only and public.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const fetchJson = async (path) => {
    // On the server (SSR / static export) a relative URL has no host to resolve
    // against and the prerender hangs, so target the absolute backend URL. In the
    // browser keep the relative path so the Next.js rewrite proxy handles it.
    const url = typeof window === "undefined" ? `${BACKEND_URL}${path}` : path;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, { next: { revalidate: 60 }, signal: controller.signal });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

export const fetchSiteSettings = () => fetchJson('/api/client/site-settings');
export const fetchFooter = () => fetchJson('/api/client/footer');
export const fetchNavMenu = (location) =>
    fetchJson(location ? `/api/client/nav-menu?location=${location}` : '/api/client/nav-menu');

// Admin-overridable content for a fixed page (returns null when no override has
// been saved, so the route renders its built-in default content).
export const fetchPage = (slug) => fetchJson(`/api/client/page/${slug}`);
