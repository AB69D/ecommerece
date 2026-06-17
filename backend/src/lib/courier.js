// Unified courier abstraction for Pathao and Steadfast.
// Credentials are stored per-tenant in SiteSettings (never in env).
// Each function returns a normalised result shape:
//   { ok: bool, trackingCode, consignmentId, status, rawStatus, deliveryFee, error }

import { logger } from './logger.js';

// ── Pathao ───────────────────────────────────────────────────────────────────
// OAuth2 password-grant flow. Tokens expire in 30 days.
// https://developer.pathao.com/

const PATHAO_AUTH_URL = 'https://hermes.pathao.com/aladdin/api/v1/issue-token';
const PATHAO_REFRESH_URL = 'https://hermes.pathao.com/aladdin/api/v1/refresh-token';
const PATHAO_BASE = 'https://hermes.pathao.com/api/v1';

/**
 * Get a fresh Pathao access token using password grant.
 * Call when no cached token is available.
 */
export const pathaoIssueToken = async ({ clientId, clientSecret, username, password }) => {
    const res = await fetch(PATHAO_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            username,
            password,
            grant_type: 'password',
        }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
        throw new Error(`Pathao token error: ${data.message || JSON.stringify(data)}`);
    }
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        // expires_in is in seconds; store an absolute timestamp for easy comparison
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 2_592_000) * 1_000),
    };
};

/**
 * Refresh a Pathao access token using the stored refresh token.
 */
export const pathaoRefreshToken = async ({ refreshToken }) => {
    const res = await fetch(PATHAO_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
        throw new Error(`Pathao refresh error: ${data.message || JSON.stringify(data)}`);
    }
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 2_592_000) * 1_000),
    };
};

/**
 * Returns a valid Pathao access token, refreshing/reissuing when needed.
 * Mutates tokenState in-place and persists via saveToken().
 */
const pathaoEnsureToken = async (credentials, tokenState, saveToken) => {
    const now = new Date();
    const bufferMs = 5 * 60_000; // treat token as expired 5 min early

    // Still valid
    if (
        tokenState.accessToken &&
        tokenState.tokenExpiresAt &&
        new Date(tokenState.tokenExpiresAt) > new Date(now.getTime() + bufferMs)
    ) {
        return tokenState.accessToken;
    }

    let refreshed;
    // Try refresh first (cheaper); fall back to password grant if refresh fails
    if (tokenState.refreshToken) {
        try {
            refreshed = await pathaoRefreshToken({ refreshToken: tokenState.refreshToken });
        } catch (err) {
            logger.warn({ err }, 'Pathao token refresh failed — reissuing');
        }
    }
    if (!refreshed) {
        refreshed = await pathaoIssueToken(credentials);
    }

    Object.assign(tokenState, refreshed);
    await saveToken(refreshed);
    return refreshed.accessToken;
};

/**
 * Create a Pathao consignment.
 * @param {object} credentials  - { clientId, clientSecret, username, password, storeId }
 * @param {object} tokenState   - { accessToken, refreshToken, tokenExpiresAt } (may be empty)
 * @param {Function} saveToken  - async (tokenPatch) => void — persists updated tokens to SiteSettings
 * @param {object} order        - normalised order: { orderId, customerName, customerPhone,
 *                                  shippingAddress, city, items, paymentMethod, totalAmount }
 */
export const pathaoCreateOrder = async (credentials, tokenState, saveToken, order) => {
    const token = await pathaoEnsureToken(credentials, tokenState, saveToken);

    const payload = {
        store_id: Number(credentials.storeId),
        merchant_order_id: order.orderId,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: [order.shippingAddress, order.city].filter(Boolean).join(', '),
        recipient_city: 1,          // Dhaka; admin should configure per order in future
        recipient_zone: 1,          // zone 1; extend later
        delivery_type: 48,          // 48 h standard
        item_type: 2,               // parcel
        item_quantity: order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1,
        item_weight: 0.5,
        item_description: (order.items || []).map((i) => i.productName).join(', ').slice(0, 100),
        amount_to_collect: order.paymentMethod === 'cash_on_delivery' ? (order.totalAmount || 0) : 0,
    };

    const res = await fetch(`${PATHAO_BASE}/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.type !== 'success') {
        return {
            ok: false,
            error: data.message || JSON.stringify(data),
        };
    }

    return {
        ok: true,
        consignmentId: data.data.consignment_id,
        trackingCode: data.data.consignment_id,   // Pathao uses consignment_id for tracking
        status: 'pending',
        rawStatus: data.data.order_status,
        deliveryFee: data.data.delivery_fee || 0,
    };
};

/**
 * Get the live status of a Pathao consignment.
 */
export const pathaoTrackOrder = async (credentials, tokenState, saveToken, consignmentId) => {
    const token = await pathaoEnsureToken(credentials, tokenState, saveToken);

    const res = await fetch(`${PATHAO_BASE}/orders/${consignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok || data.type !== 'success') {
        return { ok: false, error: data.message || JSON.stringify(data) };
    }

    return {
        ok: true,
        consignmentId,
        trackingCode: consignmentId,
        rawStatus: data.data.order_status,
        status: normalisePathaoStatus(data.data.order_status),
    };
};

const normalisePathaoStatus = (raw = '') => {
    const s = raw.toLowerCase();
    if (s.includes('pending')) return 'pending';
    if (s.includes('picked')) return 'picked';
    if (s.includes('transit')) return 'in_transit';
    if (s.includes('delivered')) return 'delivered';
    if (s.includes('return')) return 'returned';
    if (s.includes('cancel')) return 'cancelled';
    return 'unknown';
};

// ── Steadfast ────────────────────────────────────────────────────────────────
// API key + secret in request headers; no token refresh needed.
// https://portal.steadfast.com.bd/

const STEADFAST_BASE = 'https://portal.steadfast.com.bd/api/v1';

const steadfastHeaders = ({ apiKey, secretKey }) => ({
    'Api-Key': apiKey,
    'Secret-Key': secretKey,
    'Content-Type': 'application/json',
});

/**
 * Create a Steadfast order.
 */
export const steadfastCreateOrder = async (credentials, order) => {
    const payload = {
        invoice: order.orderId,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: [order.shippingAddress, order.city].filter(Boolean).join(', '),
        cod_amount: order.paymentMethod === 'cash_on_delivery' ? (order.totalAmount || 0) : 0,
        note: `Items: ${(order.items || []).map((i) => i.productName).join(', ')}`.slice(0, 200),
    };

    const res = await fetch(`${STEADFAST_BASE}/create_order`, {
        method: 'POST',
        headers: steadfastHeaders(credentials),
        body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.status !== 200) {
        return { ok: false, error: data.message || JSON.stringify(data) };
    }

    return {
        ok: true,
        consignmentId: String(data.consignment?.id || ''),
        trackingCode: data.consignment?.tracking_code || '',
        status: 'pending',
        rawStatus: data.consignment?.status || '',
        deliveryFee: 0,
    };
};

/**
 * Track a Steadfast order by tracking code.
 */
export const steadfastTrackOrder = async (credentials, trackingCode) => {
    const res = await fetch(
        `${STEADFAST_BASE}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`,
        { headers: steadfastHeaders(credentials) },
    );
    const data = await res.json();

    if (!res.ok || data.status !== 200) {
        return { ok: false, error: data.message || JSON.stringify(data) };
    }

    return {
        ok: true,
        trackingCode,
        rawStatus: data.delivery_status,
        status: normaliseSteadfastStatus(data.delivery_status),
    };
};

/**
 * Fetch the current COD remittance balance from Steadfast.
 */
export const steadfastGetBalance = async (credentials) => {
    const res = await fetch(`${STEADFAST_BASE}/get_balance`, {
        headers: steadfastHeaders(credentials),
    });
    const data = await res.json();

    if (!res.ok || data.status !== 200) {
        return { ok: false, error: data.message || JSON.stringify(data) };
    }

    return { ok: true, balance: data.current_balance ?? 0, currency: 'BDT' };
};

const normaliseSteadfastStatus = (raw = '') => {
    switch (raw) {
        case 'in_review':
        case 'pending':
            return 'pending';
        case 'picked_up':
            return 'picked';
        case 'in_transit':
            return 'in_transit';
        case 'delivered':
        case 'partial_delivered':
            return 'delivered';
        case 'cancelled':
            return 'cancelled';
        case 'hold':
            return 'pending';
        case 'returned_to_merchant':
            return 'returned';
        default:
            return 'unknown';
    }
};
