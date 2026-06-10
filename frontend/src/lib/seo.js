// Shared SEO helpers — single source of truth for the public site URL and for
// turning relative asset paths (logo, og image) into absolute URLs, which
// search engines and social scrapers require.

export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// Resolve a possibly-relative path against the public site origin. Absolute
// URLs (http/https) and protocol-relative URLs are returned untouched.
export const absoluteUrl = (path = "") => {
    if (!path) return SITE_URL;
    if (/^https?:\/\//i.test(path) || path.startsWith("//")) return path;
    return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Build Organization + WebSite JSON-LD from the admin site settings. Returns an
// array so the caller can render one <JsonLd> per node.
export const buildSiteJsonLd = (settings = {}) => {
    const siteName = settings?.siteName || "Ab9dEcommerce";
    const logo = absoluteUrl(settings?.logoUrl || "/logo.png");
    const sameAs = (settings?.socialLinks || [])
        .map((l) => l?.url)
        .filter(Boolean);

    const contactPoint =
        settings?.contactPhone || settings?.contactEmail
            ? {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  ...(settings?.contactPhone ? { telephone: settings.contactPhone } : {}),
                  ...(settings?.contactEmail ? { email: settings.contactEmail } : {}),
              }
            : null;

    const organization = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteName,
        url: SITE_URL,
        logo,
        ...(settings?.description ? { description: settings.description } : {}),
        ...(contactPoint ? { contactPoint } : {}),
        ...(sameAs.length ? { sameAs } : {}),
    };

    const website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: SITE_URL,
        potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    };

    return [organization, website];
};
