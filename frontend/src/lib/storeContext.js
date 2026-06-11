// Server-only helper for the interim path-based storefront (Phase 2).
//
// On the SHARED domain (no per-store subdomains yet) a guest "enters" a store by
// visiting /s/<sub>/... — middleware.js sets a `store` cookie and rewrites them to
// the clean URL. Client-side fetches then carry X-Tenant automatically (middleware
// injects it on /api/client/*). But SERVER COMPONENTS fetch the backend directly
// (absolute NEXT_PUBLIC_BACKEND_URL), bypassing middleware — so they must read the
// cookie and forward the tenant themselves. That's what this module is for.
//
// Imports next/headers, so it is server-only: never import it from a "use client"
// module (use the middleware-injected header path there instead).

import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Matches the backend subdomain rule (and the SignupForm validator): a DNS label
// of 2–63 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const isValidStore = (s) =>
    typeof s === "string" && s.length >= 2 && s.length <= 63 && SUBDOMAIN_RE.test(s);

// Infra labels that are never a store. The backend treats these as "no tenant"
// and falls back to the primary store, so we must reject them here ourselves —
// otherwise /admin etc. would render the primary storefront. (Not 'app': that IS
// the primary store's slug.)
const RESERVED_STORE = new Set(["www", "api", "cdn", "assets", "static", "mail", "admin"]);

// Does this slug resolve to a live, approved tenant? resolveTenant 404s an unknown
// or un-approved store and 403s a suspended one. We probe the products list (not
// site-settings) because it returns 200 for a brand-new store that hasn't saved
// any settings yet — so a freshly-approved blank store is still browsable. Used by
// the [store] layout to 404 a bad /<store> URL. no-store so one store's answer is
// never cached for another.
export async function validateStore(store) {
    if (!isValidStore(store) || RESERVED_STORE.has(store)) return false;
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/product/products?limit=1`, {
            headers: { "X-Tenant": store },
            cache: "no-store",
        });
        return res.ok;
    } catch {
        return false;
    }
}

// The store a guest is currently viewing on the shared domain, from the `store`
// cookie. Returns '' for the primary store (no cookie) or when called outside a
// request scope. Reading the cookie opts the route into dynamic rendering — an
// accepted cost of path-routing that goes away once real subdomains land.
export async function getActiveStore() {
    try {
        const jar = await cookies();
        const value = jar.get("store")?.value || "";
        return isValidStore(value) ? value : "";
    } catch {
        return "";
    }
}

// Header bag for scoping a server-side backend fetch to the active store. Empty
// for the primary store so its responses stay shared-cacheable (revalidate).
export async function storeHeaders() {
    const store = await getActiveStore();
    return store ? { "X-Tenant": store } : {};
}
