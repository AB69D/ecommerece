// Small fetchers for admin-editable site content.
// Used by Footer, Navbar, layout SEO. All endpoints are read-only and public.

const fetchJson = async (path) => {
    try {
        const res = await fetch(path, { next: { revalidate: 60 } });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    }
};

export const fetchSiteSettings = () => fetchJson('/api/client/site-settings');
export const fetchFooter = () => fetchJson('/api/client/footer');
export const fetchNavMenu = (location) =>
    fetchJson(location ? `/api/client/nav-menu?location=${location}` : '/api/client/nav-menu');
