"use client";
import { waLink, fillTemplate } from "@/lib/whatsapp";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// React hook exposing the admin-configured WhatsApp setup.
// `enabled` is true only when the feature flag is on AND a number is set, so
// callers can simply do `if (!wa.enabled) return null` to hide every link.
export function useWhatsApp() {
    const settings = useSiteSettings();

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
