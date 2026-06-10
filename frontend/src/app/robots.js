import { SITE_URL } from "@/lib/seo.js";

// Generates /robots.txt. Keeps crawlers out of the admin panel, POS and
// transactional pages while pointing them at the sitemap.
export default function robots() {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin", "/pos", "/checkout", "/cart", "/api/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
