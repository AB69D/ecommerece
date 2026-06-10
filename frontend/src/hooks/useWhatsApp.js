"use client";
import { useEffect, useState } from "react";
import { fetchSiteSettings } from "@/lib/dynamicContent";
import { waLink, fillTemplate } from "@/lib/whatsapp";

// Module-level cache so every WhatsApp touchpoint (header, footer, chatbot,
// product page, checkout, track-order, admin orders) shares a single network
// request for the public site settings rather than each refetching.
let _cache = null; // resolved settings object
let _inflight = null; // Promise while the first fetch is running

const loadSettings = () => {
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

// React hook exposing the admin-configured WhatsApp setup.
// `enabled` is true only when the feature flag is on AND a number is set, so
// callers can simply do `if (!wa.enabled) return null` to hide every link.
export function useWhatsApp() {
    const [settings, setSettings] = useState(_cache);

    useEffect(() => {
        if (_cache) {
            setSettings(_cache);
            return;
        }
        let cancelled = false;
        loadSettings().then((s) => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const wa = settings?.whatsapp || {};
    const features = settings?.features || {};
    const number = wa.businessNumber || "";
    const enabled = Boolean(features.whatsapp) && Boolean(number);

    return {
        ready: settings != null,
        // True when the feature flag is on (regardless of business number).
        // Use this for admin → customer messaging where the destination is the
        // customer's own phone, not the store number.
        featureEnabled: Boolean(features.whatsapp),
        // True when the feature is on AND a store number is configured. Use this
        // for storefront "chat with the shop" links.
        enabled,
        number,
        contactPhone: settings?.contactPhone || "",
        orderTemplate: wa.orderTemplate || "",
        statusTemplate: wa.statusTemplate || "",
        // Build a wa.me link to the business number with an optional message.
        chatUrl: (message = "") => waLink(number, message),
        // Build a wa.me link to an arbitrary number (e.g. a customer's phone).
        linkTo: (toNumber, message = "") => waLink(toNumber, message),
        fillTemplate,
    };
}
