// Canonical registry of the site's fixed content pages. The *routes* live in
// the frontend code (paths never change); this registry is the source of truth
// for which slugs exist and which ones expose an editable title/body in the
// admin Pages editor. Pages flagged `editable: false` are still listed (so the
// footer link picker can point at them) but their layout is bespoke (e.g. the
// contact form, the FAQ accordion) and isn't driven by a CMS body.
export const PAGE_REGISTRY = [
    { slug: 'about', label: 'About', path: '/about', editable: true },
    { slug: 'privacy-policy', label: 'Privacy Policy', path: '/privacy-policy', editable: true },
    { slug: 'terms-condition', label: 'Terms & Conditions', path: '/terms-condition', editable: true },
    { slug: 'refund-returns', label: 'Refund & Returns', path: '/refund-returns', editable: true },
    { slug: 'corporate-deal', label: 'Corporate Deal', path: '/corporate-deal', editable: true },
    { slug: 'contact', label: 'Contact', path: '/contact', editable: false },
    { slug: 'faq', label: 'FAQ', path: '/faq', editable: false },
];

export const PAGE_BY_SLUG = Object.fromEntries(PAGE_REGISTRY.map((p) => [p.slug, p]));

export const isKnownPage = (slug) => Object.prototype.hasOwnProperty.call(PAGE_BY_SLUG, slug);
export const isEditablePage = (slug) => !!PAGE_BY_SLUG[slug]?.editable;
