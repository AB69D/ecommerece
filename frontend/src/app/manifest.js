import { fetchSiteSettings } from "@/lib/dynamicContent.js";

// PWA web app manifest (served at /manifest.webmanifest). The installed app's
// name + icon follow the admin Site Settings (logo / company name) so there is
// nothing hardcoded to go stale. When no logo/name is set we fall back to the
// bundled placeholder icons. Revalidated so an admin logo change reaches the
// install banner within a few minutes.
export const revalidate = 300;

const PLACEHOLDER_ICONS = [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export default async function manifest() {
    const s = await fetchSiteSettings().catch(() => null);

    const name = s?.siteName?.trim() || "Store";
    const shortName = name.length > 12 ? name.slice(0, 12).trim() : name;
    const description =
        s?.description?.trim() ||
        s?.tagline?.trim() ||
        "Point-of-sale terminal and online store.";

    // Prefer the admin-set logo (then favicon) for the install icon; otherwise
    // fall back to the bundled placeholders. `type` is omitted for the remote
    // logo since its real format (png/webp/svg) isn't known here.
    const logo = s?.logoUrl?.trim() || s?.faviconUrl?.trim() || "";
    const icons = logo
        ? [
            { src: logo, sizes: "192x192", purpose: "any" },
            { src: logo, sizes: "512x512", purpose: "any" },
            { src: logo, sizes: "512x512", purpose: "maskable" },
        ]
        : PLACEHOLDER_ICONS;

    return {
        name,
        short_name: shortName,
        description,
        start_url: "/pos",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#0f766e",
        icons,
    };
}
