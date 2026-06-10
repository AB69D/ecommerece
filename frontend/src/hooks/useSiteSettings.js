"use client";
import { useEffect, useState } from "react";
import { fetchSiteSettings } from "@/lib/dynamicContent";

// Shared, module-level cache of the public site settings so every consumer
// (header, footer, chatbot, product page, reviews, PWA, …) triggers a single
// network request instead of each refetching the same document.
let _cache = null; // resolved settings object
let _inflight = null; // Promise while the first fetch is running

export const loadSiteSettings = () => {
    if (_cache) return Promise.resolve(_cache);
    if (_inflight) return _inflight;
    _inflight = fetchSiteSettings()
        .then((data) => {
            _cache = data || {};
            return _cache;
        })
        .catch(() => {
            _cache = {};
            return _cache;
        })
        .finally(() => {
            _inflight = null;
        });
    return _inflight;
};

// Returns the cached settings object, or null until the first fetch resolves.
export function useSiteSettings() {
    const [settings, setSettings] = useState(_cache);

    useEffect(() => {
        if (_cache) {
            setSettings(_cache);
            return;
        }
        let cancelled = false;
        loadSiteSettings().then((s) => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return settings;
}

// Boolean helper for a single feature flag. Defaults to `true` for an unknown
// flag (matches the backend `isFeatureEnabled` / model defaults). While the
// settings are still loading it also returns the fallback, so gated UI doesn't
// flash off-then-on for default-enabled features.
export function useFeature(name, fallback = true) {
    const settings = useSiteSettings();
    if (settings == null) return fallback;
    const v = settings?.features?.[name];
    return v === undefined || v === null ? fallback : v !== false;
}
