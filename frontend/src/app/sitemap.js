import { SITE_URL } from "@/lib/seo.js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Public content + marketing pages worth indexing. Transactional pages
// (cart, checkout, wishlist, track-order) are deliberately excluded.
const STATIC_PATHS = [
    "",
    "/about",
    "/contact",
    "/faq",
    "/blog",
    "/top-selling",
    "/privacy-policy",
    "/terms-condition",
    "/refund-returns",
];

export default async function sitemap() {
    const now = new Date();

    const entries = STATIC_PATHS.map((path) => ({
        url: `${SITE_URL}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.6,
    }));

    // Append every storefront-visible product so detail pages get indexed.
    try {
        const res = await fetch(
            `${BACKEND_URL}/api/client/product/products?limit=1000`,
            { next: { revalidate: 3600 } },
        );
        if (res.ok) {
            const json = await res.json();
            const products = Array.isArray(json?.data) ? json.data : [];
            for (const p of products) {
                if (!p?._id) continue;
                entries.push({
                    url: `${SITE_URL}/product/${p._id}`,
                    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
                    changeFrequency: "weekly",
                    priority: 0.8,
                });
            }
        }
    } catch {
        // Backend unreachable at build time — ship the static entries only.
    }

    return entries;
}
