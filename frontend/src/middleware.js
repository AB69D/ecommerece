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
    const tenant = tenantFromHost(request.headers.get('host'));

    const requestHeaders = new Headers(request.headers);
    // Anti-spoof: never trust an X-Tenant that arrived from the client. We always
    // derive it from the Host, so drop any inbound value first, then set our own.
    requestHeaders.delete('x-tenant');
    if (tenant) requestHeaders.set('x-tenant', tenant);

    return NextResponse.next({ request: { headers: requestHeaders } });
}

// Only the API proxy path needs the tenant signal; SSR/page rendering is handled
// separately (and is single-tenant for now). Scoping the matcher keeps the
// middleware off static assets and page navigations.
export const config = {
    matcher: ['/api/:path*'],
};
