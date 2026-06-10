import { SiteSettings } from '../models/siteSettings.model.js';

// Shared accessor for the singleton site-settings document so controllers can
// cheaply read feature flags / config (e.g. POS shift, tax, WhatsApp) without
// each re-implementing the get-or-create dance. Returns a plain object.
export const getSettings = async () => {
    let doc = await SiteSettings.findOne({ key: 'global' }).lean();
    if (!doc) {
        const created = await SiteSettings.create({ key: 'global' });
        doc = created.toObject();
    }
    return doc;
};

// Convenience: is a given feature flag enabled? Defaults to `true` so a missing
// flag never silently disables existing behaviour (matches the model defaults).
export const isFeatureEnabled = async (name, fallback = true) => {
    const s = await getSettings();
    const v = s?.features?.[name];
    return v === undefined || v === null ? fallback : v !== false;
};
