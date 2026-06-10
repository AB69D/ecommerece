// The site's fixed content pages. Their *routes* are defined in code (the paths
// never change); only each page's content is editable from the admin Pages
// editor. This list mirrors the backend registry (backend/src/lib/cmsPages.js)
// and is used by the footer link picker so admins choose a fixed page rather
// than typing a free-form path.
export const SITE_PAGES = [
    { slug: "about", label: "About", path: "/about", editable: true },
    { slug: "privacy-policy", label: "Privacy Policy", path: "/privacy-policy", editable: true },
    { slug: "terms-condition", label: "Terms & Conditions", path: "/terms-condition", editable: true },
    { slug: "refund-returns", label: "Refund & Returns", path: "/refund-returns", editable: true },
    { slug: "corporate-deal", label: "Corporate Deal", path: "/corporate-deal", editable: true },
    { slug: "contact", label: "Contact", path: "/contact", editable: false },
    { slug: "faq", label: "FAQ", path: "/faq", editable: false },
];

export const PAGE_BY_PATH = Object.fromEntries(SITE_PAGES.map((p) => [p.path, p]));
