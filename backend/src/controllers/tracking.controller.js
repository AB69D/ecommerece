import crypto from 'crypto';
import { getSettings } from '../lib/siteSettings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';

// Meta Conversions API (server-side tracking).
//
// The storefront fires each pixel event twice: once in the browser via
// window.fbq (with an `eventID`) and once here on the server with the SAME
// event id. Meta deduplicates the pair, so reporting stays accurate while the
// server copy survives ad-blockers / iOS tracking prevention and improves the
// match rate with hashed customer data.
//
// Everything is admin-driven: the Pixel ID + access token live in Site
// Settings. With nothing configured the endpoint is a silent no-op, so the
// public route is safe to call unconditionally from the browser.

const GRAPH_VERSION = 'v19.0';

// Only these standard events are forwarded. Whitelisting stops the public
// endpoint from being abused to inject arbitrary event names into the pixel.
const ALLOWED_EVENTS = new Set([
    'PageView',
    'ViewContent',
    'Search',
    'AddToCart',
    'AddToWishlist',
    'InitiateCheckout',
    'AddPaymentInfo',
    'Purchase',
    'Lead',
    'CompleteRegistration',
    'Contact',
]);

// Meta requires PII to be SHA-256 hashed (lower-cased + trimmed) by the sender.
const sha256 = (value) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return undefined;
    return crypto.createHash('sha256').update(normalized).digest('hex');
};

// Phone numbers: keep digits only before hashing (Meta normalization spec).
const sha256Phone = (value) => {
    if (!value) return undefined;
    const digits = String(value).replace(/[^0-9]/g, '');
    if (!digits) return undefined;
    return crypto.createHash('sha256').update(digits).digest('hex');
};

// Minimal cookie parser (the app doesn't use cookie-parser middleware). Used to
// recover the Meta browser identifiers `_fbp` / `_fbc` for better matching.
const parseCookies = (header = '') =>
    header.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx > -1) {
            const k = part.slice(0, idx).trim();
            if (k) acc[k] = decodeURIComponent(part.slice(idx + 1).trim());
        }
        return acc;
    }, {});

// POST /api/client/track  (public)
export const trackEvent = asyncHandler(async (req, res) => {
    const settings = await getSettings().catch(() => null);
    const pixelId = settings?.analytics?.metaPixelId?.trim();
    const token = settings?.analytics?.metaCapiToken?.trim();
    const testCode = settings?.analytics?.metaTestEventCode?.trim();
    const analyticsOn = settings?.features?.analytics !== false;

    // Not configured for server-side tracking (or analytics turned off) → no-op.
    if (!analyticsOn || !pixelId || !token) {
        return ok(res, { skipped: true });
    }

    const {
        eventName,
        eventId,
        eventSourceUrl,
        customData = {},
        userData = {},
    } = req.body || {};

    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
        return ok(res, { skipped: true });
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const fbp = userData.fbp || cookies._fbp;
    const fbc = userData.fbc || cookies._fbc;

    const user_data = {
        client_ip_address: req.ip,
        client_user_agent: req.headers['user-agent'] || '',
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
    };
    const em = sha256(userData.email);
    const ph = sha256Phone(userData.phone);
    const fn = sha256(userData.firstName);
    if (em) user_data.em = [em];
    if (ph) user_data.ph = [ph];
    if (fn) user_data.fn = [fn];

    const event = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: eventSourceUrl || req.headers.referer || '',
        user_data,
        custom_data: customData && typeof customData === 'object' ? customData : {},
    };
    if (eventId) event.event_id = String(eventId);

    const payload = { data: [event] };
    if (testCode) payload.test_event_code = testCode;

    try {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
        const fbRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await fbRes.json().catch(() => ({}));
        if (!fbRes.ok) {
            // Log for the operator but never leak Meta's error detail to the
            // public caller.
            console.error('[CAPI] Meta rejected', eventName, '-', body?.error?.message || fbRes.status);
            return ok(res, { forwarded: false });
        }
        return ok(res, { forwarded: true, events_received: body.events_received ?? 1 });
    } catch (err) {
        console.error('[CAPI] forward failed:', err.message);
        return ok(res, { forwarded: false });
    }
});
