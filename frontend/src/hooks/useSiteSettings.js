"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchSiteSettings } from "@/lib/dynamicContent";

// Shared, module-level cache of the public site settings keyed by store slug so
// every consumer (header, footer, chatbot, product page, reviews, PWA, …) within
// the same store triggers a single network request instead of each refetching the
// same document. Navigating between stores never serves stale data from a
// different tenant because each store gets its own cache entry.
const _cache = new Map(); // store slug → resolved settings object
const _inflight = new Map(); // store slug → Promise while the first fetch is running

export const loadSiteSettings = (store = "") => {
    if (_cache.has(store)) return Promise.resolve(_cache.get(store));
    if (_inflight.has(store)) return _inflight.get(store);
    const p = fetchSiteSettings(store)
        .then((data) => {
            const result = data || {};
            _cache.set(store, result);
            return result;
        })
        .catch(() => {
            _cache.set(store, {});
            return {};
        })
        .finally(() => {
            _inflight.delete(store);
        });
    _inflight.set(store, p);
    return p;
};

// Returns the cached settings object for the active store, or null until the
// first fetch resolves.
export function useSiteSettings() {
    const params = useParams();
    const store = params?.store || "";
    const [settings, setSettings] = useState(_cache.get(store) ?? null);

    useEffect(() => {
        const cached = _cache.get(store);
        if (cached) {
            setSettings(cached);
            return;
        }
        let cancelled = false;
        loadSiteSettings(store).then((s) => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, [store]);

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
