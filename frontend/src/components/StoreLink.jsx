"use client";

import { useCallback } from "react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";

// ── Store-aware <Link> ───────────────────────────────────────────────────────
// Under path-based multi-tenancy every store lives at /<store>/… . Components
// still write their hrefs the natural way ("/cart", "/admin/orders", "/") and
// this wrapper prefixes the current store from the route params, so a link never
// drops the store segment on navigation. Platform-level destinations (/login,
// /platform, /sell), already-prefixed, relative, hash and external links pass
// through untouched. Outside a /<store> route (no param) it behaves like a plain
// <Link>.

const ESCAPES = /^\/(login|platform|sell)(\/|$|\?|#)/;

export function storeHref(href, store) {
    if (!store || typeof href !== "string") return href;
    if (!href.startsWith("/")) return href;                 // relative / external / hash
    if (href === `/${store}` || href.startsWith(`/${store}/`)) return href; // already scoped
    if (ESCAPES.test(href)) return href;                    // platform-level pages
    return `/${store}${href === "/" ? "" : href}`;          // "/" -> "/<store>"
}

export default function StoreLink({ href, ...props }) {
    const { store } = useParams();
    return <NextLink href={storeHref(href, store)} {...props} />;
}

// Store-aware router.push for imperative navigation (button onClick handlers).
// Prefixes the current store the same way StoreLink does.
export function useStorePush() {
    const router = useRouter();
    const { store } = useParams();
    return useCallback((href, opts) => router.push(storeHref(href, store), opts), [router, store]);
}
