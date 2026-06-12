import { SiteSettings } from '../models/siteSettings.model.js';
import { getEffectiveTenantId } from '../tenancy/tenantContext.js';

// In-process, PER-TENANT cache for each tenant's singleton site-settings document.
//
// getSettings() / isFeatureEnabled() run on nearly every request — feature flags,
// payment config, tax, currency, plus the stock-ledger gate on every single sale
// — so a Mongo round trip per call is wasteful. We cache each tenant's doc for a
// short TTL and hand every caller an independent clone (so a caller mutating its
// copy can't corrupt the shared cache). Admin settings writes call
// invalidateSettingsCache() for instant effect; the TTL is just a safety net.
//
// CRITICAL: the cache is keyed by TENANT. A single shared slot (the previous
// implementation) served whichever store loaded first to every other store for
// the TTL window — a cross-tenant settings / feature / currency leak. Each tenant
// now has its own entry.
//
// Scope is this process only. If the backend is ever scaled to multiple
// instances, replace this with a shared cache (e.g. Redis) plus pub/sub
// invalidation so a write on one instance is seen by the others.
const CACHE_TTL_MS = 30_000;
// Safety cap so the map can't grow without bound as the platform adds tenants;
// on overflow we drop everything and let it warm again on demand.
const MAX_ENTRIES = 5_000;
const cache = new Map(); // tenantId(string) -> { doc, at }

// The tenant whose settings this call is about — taken from the request's async
// context. Falls back to 'default' outside a request (e.g. a one-off script).
const cacheKey = () => String(getEffectiveTenantId() || 'default');

const loadSettings = async () => {
    let doc = await SiteSettings.findOne({ key: 'global' }).lean();
    if (!doc) {
        const created = await SiteSettings.create({ key: 'global' });
        doc = created.toObject();
    }
    return doc;
};

// Drop the CURRENT tenant's cached settings so its next read re-fetches from
// Mongo. Called after a settings write (itself tenant-scoped), so only that
// tenant's entry is invalidated — other stores keep their warm caches.
export const invalidateSettingsCache = () => {
    cache.delete(cacheKey());
};

// Shared accessor for a tenant's singleton site-settings document so controllers
// can cheaply read feature flags / config (POS shift, tax, WhatsApp, currency)
// without each re-implementing the get-or-create dance. Returns a plain object
// the caller owns (a clone of the cached copy).
export const getSettings = async () => {
    const key = cacheKey();
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) {
        return structuredClone(hit.doc);
    }
    const doc = await loadSettings();
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(key, { doc, at: now });
    return structuredClone(doc);
};

// Convenience: is a given feature flag enabled? Defaults to `true` so a missing
// flag never silently disables existing behaviour (matches the model defaults).
export const isFeatureEnabled = async (name, fallback = true) => {
    const s = await getSettings();
    const v = s?.features?.[name];
    return v === undefined || v === null ? fallback : v !== false;
};
