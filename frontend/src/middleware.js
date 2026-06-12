import { NextResponse } from 'next/server';

// ── Tenant routing (path-based multi-tenancy) ────────────────────────────────
// Each store lives under /<store> — storefront at /<store>, admin at
// /<store>/admin, pos at /<store>/pos. The store slug in the FIRST path segment
// is the source of truth. This middleware does two jobs:
//
//   1. Page requests under a store -> remember the slug in a `store` cookie, so
//      the store's CLIENT-SIDE /api/client/* calls (which carry no slug in their
//      URL) can be scoped. Reserved roots (/, /login, /platform, /sell) clear it.
//   2. /api/* requests -> turn that signal into an explicit `X-Tenant` header for
//      the backend (a real Host subdomain wins when present; otherwise the cookie,
//      but only for the public storefront API — admin/platform/pos are token-scoped).
//
// SSR reads the slug straight from the route params, so it never depends on the
// cookie timing; the cookie exists purely for client-side storefront fetches.

const BASE_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN || '').trim().toLowerCase();
const RESERVED = new Set(['www', 'api', 'cdn', 'assets', 'static', 'mail', 'admin']);

// DNS-label rule, matches the backend subdomain validator.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const isValidStore = (s) =>
    typeof s === 'string' && s.length >= 2 && s.length <= 63 && SUBDOMAIN_RE.test(s);

// First-segment words that are platform pages, never a store.
const ROOT_RESERVED = new Set(['login', 'platform', 'sell']);

const STORE_COOKIE = 'store';
const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Extract a tenant label from a real Host subdomain (the future permanent signal):
// 'acme.myapp.com' + base 'myapp.com' -> 'acme'. Empty when not applicable.
function tenantFromHost(rawHost) {
    const host = String(rawHost || '').split(':')[0].trim().toLowerCase();
    if (!host) return '';
    if (host === 'localhost' || host.endsWith('.localhost')) return '';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
    if (!BASE_DOMAIN || host === BASE_DOMAIN) return '';
    const suffix = `.${BASE_DOMAIN}`;
    if (!host.endsWith(suffix)) return '';
    const label = host.slice(0, -suffix.length).split('.')[0] || '';
    return RESERVED.has(label) ? '' : label;
}

// True for a first path segment that is a real store (not an infra/platform word).
const isStoreSeg = (seg) => !!seg && !ROOT_RESERVED.has(seg) && !RESERVED.has(seg) && isValidStore(seg);

// The store of the PAGE that issued a client API call, read from its Referer. This
// is the source of truth for scoping /api/client/* because it's per-request — two
// browser tabs on different stores each carry their own page URL, so they never
// bleed into each other the way a single shared cookie can.
function storeFromReferer(referer) {
    if (!referer) return '';
    try {
        const seg = new URL(referer).pathname.split('/')[1] || '';
        return isStoreSeg(seg) ? seg : '';
    } catch {
        return '';
    }
}

export function middleware(request) {
    const { pathname } = request.nextUrl;
    const seg = pathname.split('/')[1] || '';

    // 1) Backend calls — derive X-Tenant.
    if (seg === 'api') {
        let tenant = tenantFromHost(request.headers.get('host'));
        if (!tenant && pathname.startsWith('/api/client/')) {
            // Referer (the calling page) is authoritative and multi-tab safe; the
            // cookie is only a fallback for when the Referer is stripped.
            tenant = storeFromReferer(request.headers.get('referer'));
            if (!tenant) {
                const cookieStore = request.cookies.get(STORE_COOKIE)?.value;
                if (isValidStore(cookieStore)) tenant = cookieStore;
            }
        }
        // Admin & POS are token-scoped, BUT we still pass the CURRENT store (from
        // the calling page's Referer) so the backend can REJECT any write whose
        // URL store doesn't match the session's token store. This is the safety
        // net for a stale browser tab / cross-store bleed silently writing to the
        // wrong store: the backend's token-vs-host guard turns it into a 403
        // instead of a misfiled record. Referer ONLY (never the cookie) so it's
        // multi-tab safe; auth (login / me) is exempt — it's global-by-username
        // and is how the app itself detects a store mismatch.
        if (
            !tenant &&
            pathname.startsWith('/api/admin/') &&
            !pathname.startsWith('/api/admin/auth/')
        ) {
            tenant = storeFromReferer(request.headers.get('referer'));
        }
        const headers = new Headers(request.headers);
        headers.delete('x-tenant'); // never trust an inbound value
        if (tenant) headers.set('x-tenant', tenant);
        return NextResponse.next({ request: { headers } });
    }

    // 2) A store page (/<store>/...): remember the slug for client-side API calls.
    //    Skip infra labels (admin/api/…) — they're never a store.
    if (isStoreSeg(seg)) {
        const res = NextResponse.next();
        res.cookies.set(STORE_COOKIE, seg, {
            path: '/',
            maxAge: STORE_COOKIE_MAX_AGE,
            sameSite: 'lax',
            httpOnly: false, // storefront client code reads it for its fetches
        });
        return res;
    }

    // 3) Platform pages / root / static: not a store — drop any stale cookie so a
    //    client /api/client/* call here can't inherit a previous store.
    const res = NextResponse.next();
    if (request.cookies.get(STORE_COOKIE)) {
        res.cookies.set(STORE_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return res;
}

// Run on everything except Next internals and static asset files (so store page
// navigations get their cookie set, and /api/* gets X-Tenant).
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|map|txt|xml|webmanifest)$).*)'],
};
