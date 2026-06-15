import TenantModel from '../models/tenant.model.js';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

// ── Tenant resolution (Phase 2) ─────────────────────────────────────────────
// Turn an incoming HTTP request into "which tenant is this for?" so withTenant
// can bind the async context and the scoping plugin filters every query to it.
//
// Resolution order (first hit wins):
//   1. X-Tenant header — the storefront subdomain, injected by the frontend's
//      Next.js middleware. The Vercel rewrite proxy strips the browser's Host
//      when it forwards to this API, so the app forwards the subdomain
//      explicitly. This is the primary production signal.
//   2. Host subdomain — <sub>.<PLATFORM_BASE_DOMAIN>; covers any request that
//      reaches us with the real Host (direct API access, server-to-server).
//   3. Custom domain — an exact Host match against a tenant's customDomain
//      (Phase 5 vanity domains; supported here for direct hits).
//
// When NOTHING resolves (no signal, apex, IP, localhost) we fall through and
// let the plugin's default tenant (the primary, set at bootstrap) handle it —
// so the single-tenant interim and direct-IP access keep working unchanged,
// with zero extra DB hits. A signal that names an UNKNOWN or SUSPENDED store is
// rejected, so we never silently serve the primary store under a stranger's
// subdomain.

// Infra labels that are never tenants (treated as "no tenant" -> default).
const RESERVED_LABELS = new Set(['www', 'api', 'cdn', 'assets', 'static', 'mail', 'admin']);

// host -> descriptor | null(miss). Short TTL so an approve/suspend in Phase 3/4
// takes effect within a minute without a per-request DB read. Negative results
// are cached too (so a flood of bad subdomains can't hammer the DB).
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // key -> { value, expires }

const cacheGet = (key) => {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
        cache.delete(key);
        return undefined;
    }
    return hit.value; // may be null (a cached miss)
};
const cacheSet = (key, value) => cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });

// Drop cached entries. Call after a tenant's subdomain/status changes (Phase 3/4
// approval, suspension, custom-domain edits). No arg clears everything.
export const clearTenantCache = (key) => (key ? cache.delete(key) : cache.clear());

// Strip the port and lowercase. '' for empty/missing.
const normalizeHost = (host) => String(host || '').split(':')[0].trim().toLowerCase();

const isIpOrLocal = (host) =>
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host); // bare IPv4 (port already stripped)

// First value if a header arrived as an array, else the string.
const headerValue = (raw) => (Array.isArray(raw) ? raw[0] : raw);

// True when the Host belongs to the platform itself (apex, a platform subdomain,
// or a bare IP/localhost) rather than a tenant's own vanity domain.
const isPlatformHost = (host, base) =>
    !base || host === base || host.endsWith(`.${base}`) || isIpOrLocal(host);

// Extract the tenant label from a Host given the configured base domain.
// 'acme.app.com' + base 'app.com' -> 'acme'. Apex / non-matching / unset -> ''.
export const subdomainFromHost = (rawHost, baseDomain = env.PLATFORM_BASE_DOMAIN) => {
    const host = normalizeHost(rawHost);
    if (!host || isIpOrLocal(host)) return '';
    const base = normalizeHost(baseDomain);
    if (!base || host === base) return '';
    const suffix = `.${base}`;
    if (!host.endsWith(suffix)) return ''; // a different domain (e.g. this API's own)
    return host.slice(0, -suffix.length).split('.')[0] || '';
};

const toDescriptor = (tenant) =>
    tenant
        ? { tenantId: tenant._id, subdomain: tenant.subdomain, status: tenant.status }
        : null;

const findBySubdomain = async (subdomain) => {
    const key = `sub:${subdomain}`;
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
    const tenant = await TenantModel.findOne({ subdomain }).select('_id subdomain status').lean();
    const value = toDescriptor(tenant);
    cacheSet(key, value);
    return value;
};

const findByCustomDomain = async (host) => {
    const key = `dom:${host}`;
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
    const tenant = await TenantModel.findOne({ customDomain: host }).select('_id subdomain status').lean();
    const value = toDescriptor(tenant);
    cacheSet(key, value);
    return value;
};

// Validate the resolved tenant and bind it to the request (or reject).
const finalize = (req, next, label, tenant) => {
    if (!tenant) return next(ApiError.notFound(`No store found for "${label}".`));
    if (tenant.status === 'suspended') return next(ApiError.forbidden('This store is currently suspended.'));
    if (tenant.status !== 'approved') return next(ApiError.notFound(`Store "${label}" is not active yet.`));
    req.tenantId = tenant.tenantId;
    req.tenant = { _id: tenant.tenantId, subdomain: tenant.subdomain, status: tenant.status };
    return next();
};

// Express middleware. Resolves the tenant and attaches it; never throws for the
// no-signal case (it falls through to the default tenant). Async errors are
// forwarded to the error handler.
export const resolveTenant = async (req, _res, next) => {
    try {
        const host = normalizeHost(req.headers.host);
        const headerSub = normalizeHost(headerValue(req.headers['x-tenant']));
        const subdomain = headerSub || subdomainFromHost(host);

        if (subdomain && !RESERVED_LABELS.has(subdomain)) {
            return finalize(req, next, subdomain, await findBySubdomain(subdomain));
        }

        // No subdomain signal: a non-platform Host may be a tenant's custom domain.
        const base = normalizeHost(env.PLATFORM_BASE_DOMAIN);
        if (host && !isPlatformHost(host, base)) {
            const byDomain = await findByCustomDomain(host);
            if (byDomain) return finalize(req, next, host, byDomain);
        }

        // No tenant signal — fall through to the default (primary) tenant.
        // Admin auth will bind the correct tenant from the JWT via
        // setRequestTenant(); platform routes run in system context.
        // Client storefront routes also fall through here; the tenantPlugin
        // picks up the defaultTenantId set at bootstrap so single-tenant
        // and direct-IP access keep working without extra config.
        return next();
    } catch (err) {
        return next(err);
    }
};

export default resolveTenant;
