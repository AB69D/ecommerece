import { NextResponse } from 'next/server';

// ── Tenant signal injection (Phase 2) ───────────────────────────────────────
// The storefront is multi-tenant by subdomain: acme.<BASE_DOMAIN> is the "acme"
// store. The browser knows which store it's on (it's in the Host), but the
// backend never sees that Host: next.config.mjs rewrites /api/:path* to the API
// origin and, like any proxy, replaces the Host with the API's own. So the
// subdomain would be lost in transit.
//
// This middleware is the one place that still sees the browser's real Host. It
// runs BEFORE the rewrite, reads the subdomain, and forwards it to the API as an
// explicit `X-Tenant` header. That single hook covers every backend call the app
// makes — all three fetch wrappers (admin/customer/pos) and every raw fetch —
// because they all go through /api/*. The backend's resolveTenant reads X-Tenant
// first and scopes the request to that tenant.
//
// In the single-tenant interim (no BASE_DOMAIN configured, apex, localhost, IP)
// no header is injected and the backend falls through to its default tenant, so
// behaviour is unchanged until real subdomains go live.

// Base domain for tenant subdomains, e.g. 'myapp.com' so acme.myapp.com -> 'acme'.
// Must match the backend's PLATFORM_BASE_DOMAIN. Unset => no subdomain routing.
const BASE_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN || '').trim().toLowerCase();

// Infra/platform labels that are never tenants. Kept in lockstep with the
// backend's RESERVED_LABELS so both ends agree on what "no tenant" looks like.
const RESERVED = new Set(['www', 'api', 'cdn', 'assets', 'static', 'mail', 'admin']);

// ── Interim path-routing on the shared domain (before subdomains) ────────────
// Until each store gets acme.<BASE_DOMAIN>, a guest browses a store by visiting
// /s/<sub>/... . We stamp the chosen store into a `store` cookie and rewrite to
// the clean URL; thereafter the cookie (read here) supplies X-Tenant on the
// storefront API, and the server data layer reads the same cookie for SSR. This
// whole block is throwaway once real subdomains land.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const isValidStore = (s) =>
    typeof s === 'string' && s.length >= 2 && s.length <= 63 && SUBDOMAIN_RE.test(s);
const STORE_COOKIE = 'store';
const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Extract the tenant label from a Host. Mirrors backend subdomainFromHost():
// 'acme.myapp.com' + base 'myapp.com' -> 'acme'. Apex / IP / localhost / a
// different domain / a reserved label all -> '' (meaning "no tenant").
function tenantFromHost(rawHost) {
    const host = String(rawHost || '').split(':')[0].trim().toLowerCase();
    if (!host) return '';
    if (host === 'localhost' || host.endsWith('.localhost')) return '';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return ''; // bare IPv4 (port stripped)
    if (!BASE_DOMAIN || host === BASE_DOMAIN) return '';
    const suffix = `.${BASE_DOMAIN}`;
    if (!host.endsWith(suffix)) return ''; // a different domain entirely
    const label = host.slice(0, -suffix.length).split('.')[0] || '';
    return RESERVED.has(label) ? '' : label;
}

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Enter/leave a store on the shared domain: /s/<sub> in, /s out.
    if (pathname === '/s' || pathname.startsWith('/s/')) {
        return handleStorePath(request);
    }

    // A real subdomain (the permanent signal) wins. Otherwise fall back to the
    // `store` cookie a guest picked via /s/<sub> — but ONLY for the public
    // storefront API. Admin/platform/POS requests are scoped by their own token,
    // so a stale store cookie must never leak into them.
    let tenant = tenantFromHost(request.headers.get('host'));
    if (!tenant && pathname.startsWith('/api/client/')) {
        const cookieStore = request.cookies.get(STORE_COOKIE)?.value;
        if (isValidStore(cookieStore)) tenant = cookieStore;
    }

    const requestHeaders = new Headers(request.headers);
    // Anti-spoof: never trust an X-Tenant that arrived from the client. We always
    // derive it ourselves, so drop any inbound value first, then set our own.
    requestHeaders.delete('x-tenant');
    if (tenant) requestHeaders.set('x-tenant', tenant);

    return NextResponse.next({ request: { headers: requestHeaders } });
}

// Path-routing entry/exit handler (shared-domain interim).
//   /s/<sub>[/rest][?q]  -> set `store` cookie, redirect to /rest (clean URL)
//   /s, /s/, bad label   -> clear `store` cookie, redirect home (exit the store)
function handleStorePath(request) {
    const url = request.nextUrl.clone();
    const rest = request.nextUrl.pathname.replace(/^\/s\/?/, ''); // '' for /s and /s/
    const [sub, ...tail] = rest.split('/');

    if (!isValidStore(sub) || RESERVED.has(sub)) {
        url.pathname = '/';
        const res = NextResponse.redirect(url);
        res.cookies.set(STORE_COOKIE, '', { path: '/', maxAge: 0 });
        return res;
    }

    url.pathname = '/' + tail.join('/'); // '/' when there is no remainder
    const res = NextResponse.redirect(url);
    res.cookies.set(STORE_COOKIE, sub, {
        path: '/',
        maxAge: STORE_COOKIE_MAX_AGE,
        sameSite: 'lax',
        httpOnly: false, // the storefront banner reads it via document.cookie
    });
    return res;
}

// The API proxy needs the tenant signal; the /s paths need the entry/exit hook.
// Everything else (page navigation, static assets) is untouched — SSR tenant
// scoping is handled in the data layer via the same cookie (see storeContext.js).
export const config = {
    matcher: ['/api/:path*', '/s', '/s/:path*'],
};
