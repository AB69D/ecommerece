// Unified Meta Pixel event tracking — browser + server, deduplicated.
//
// Every event fires twice:
//   1. Browser  → window.fbq('track', name, data, { eventID })
//   2. Server   → POST /api/client/track  (Meta Conversions API) with the SAME
//      eventID, so Meta dedupes the pair.
//
// The server copy survives ad-blockers / iOS tracking prevention and improves
// match quality with hashed customer data. Both legs are gated on
// `window.fbq` existing, which only happens when an admin has enabled "Web
// analytics" and set a Meta Pixel ID (see components/Analytics.jsx). With no
// pixel configured every call here is a harmless no-op.

function makeEventId() {
    try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch {
        /* ignore */
    }
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name) {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : undefined;
}

// Core: fire one event on both the browser pixel and the server CAPI.
//   customData → Meta custom_data (currency, value, content_ids, …)
//   userData   → optional PII (email/phone/firstName); hashed server-side only.
export function track(eventName, customData = {}, userData = {}) {
    if (typeof window === "undefined") return;
    // Single gate: window.fbq is injected only when a pixel is configured.
    if (typeof window.fbq !== "function") return;

    const eventId = makeEventId();

    // 1) Browser pixel.
    try {
        window.fbq("track", eventName, customData, { eventID: eventId });
    } catch {
        /* ignore */
    }

    // 2) Server-side Conversions API — fire-and-forget. A missing backend route
    // (e.g. before the backend deploy lands) or any network error must never
    // surface to the shopper, so all failures are swallowed.
    try {
        const body = JSON.stringify({
            eventName,
            eventId,
            eventSourceUrl: window.location.href,
            customData,
            userData: {
                ...userData,
                fbp: readCookie("_fbp"),
                fbc: readCookie("_fbc"),
            },
        });
        fetch("/api/client/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
            credentials: "include",
        }).catch(() => {});
    } catch {
        /* ignore */
    }
}

// ── Standard e-commerce events ────────────────────────────────────────────
// Helpers keep call sites tidy and the custom_data shape consistent with what
// Meta's catalog / dynamic-ads expect (content_ids + contents + value).

export function trackViewContent(product, { currency, price } = {}) {
    if (!product) return;
    const id = product._id;
    const value = Number(price) || Number(product.weights?.[0]?.price) || 0;
    track("ViewContent", {
        content_ids: id ? [id] : [],
        content_type: "product",
        content_name: product.firstName,
        content_category: product.category?.category_name,
        currency,
        value,
    });
}

export function trackAddToCart({ productId, name, price, quantity = 1, currency } = {}) {
    const qty = Number(quantity) || 1;
    track("AddToCart", {
        content_ids: productId ? [productId] : [],
        content_type: "product",
        content_name: name,
        contents: productId ? [{ id: productId, quantity: qty }] : [],
        currency,
        value: (Number(price) || 0) * qty,
    });
}

function toContents(items = []) {
    return items
        .map((i) => ({ id: i.productId || i._id, quantity: Number(i.quantity) || 1 }))
        .filter((c) => c.id);
}

export function trackInitiateCheckout({ items = [], value, currency } = {}) {
    track("InitiateCheckout", {
        content_ids: toContents(items).map((c) => c.id),
        content_type: "product",
        contents: toContents(items),
        num_items: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
        currency,
        value: Number(value) || 0,
    });
}

export function trackPurchase({ items = [], value, currency, orderId, email, phone, firstName } = {}) {
    track(
        "Purchase",
        {
            content_ids: toContents(items).map((c) => c.id),
            content_type: "product",
            contents: toContents(items),
            num_items: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
            currency,
            value: Number(value) || 0,
            ...(orderId ? { order_id: orderId } : {}),
        },
        { email, phone, firstName },
    );
}
