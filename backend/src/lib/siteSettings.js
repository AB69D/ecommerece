import { SiteSettings } from '../models/siteSettings.model.js';

// In-process cache for the singleton site-settings document.
//
// getSettings() / isFeatureEnabled() run on nearly every request — feature
// flags, payment config, tax, currency, plus the stock-ledger gate on every
// single sale — so a Mongo round trip per call is wasteful. We cache the doc for
// a short TTL and hand each caller an independent clone (so a caller mutating
// its copy can't corrupt the shared cache). Admin settings writes call
// invalidateSettingsCache() for instant effect; the TTL is just a safety net.
//
// Scope is this process only. If the backend is ever scaled to multiple
// instances, replace this with a shared cache (e.g. Redis) plus pub/sub
// invalidation so a write on one instance is seen by the others.
const CACHE_TTL_MS = 30_000;
let cached = null;
let cachedAt = 0;

const loadSettings = async () => {
    let doc = await SiteSettings.findOne({ key: 'global' }).lean();
    if (!doc) {
        const created = await SiteSettings.create({ key: 'global' });
        doc = created.toObject();
    }
    return doc;
};

// Drop the cached settings so the next read re-fetches from Mongo. Call this
// after any write to the settings document.
export const invalidateSettingsCache = () => {
    cached = null;
    cachedAt = 0;
};

// Shared accessor for the singleton site-settings document so controllers can
// cheaply read feature flags / config (e.g. POS shift, tax, WhatsApp) without
// each re-implementing the get-or-create dance. Returns a plain object that the
// caller owns (a clone of the cached copy). structuredClone preserves every
// config value and Date; the only field it doesn't faithfully reproduce is the
// BSON _id, which no caller reads off this result.
export const getSettings = async () => {
    const now = Date.now();
    if (!cached || now - cachedAt >= CACHE_TTL_MS) {
        cached = await loadSettings();
        cachedAt = now;
    }
    return structuredClone(cached);
};

// Convenience: is a given feature flag enabled? Defaults to `true` so a missing
// flag never silently disables existing behaviour (matches the model defaults).
export const isFeatureEnabled = async (name, fallback = true) => {
    const s = await getSettings();
    const v = s?.features?.[name];
    return v === undefined || v === null ? fallback : v !== false;
};
