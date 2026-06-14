const API = '/api/client/auth';

// Storefront customer auth. Mirrors services/adminAuth.js but talks to the
// client auth API and stores its own token under a separate localStorage key,
// so a shopper session and an admin session can coexist in one browser without
// clobbering each other.
const TOKEN_KEY = 'customer_token';

export const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
};

// Credential requests carry the current anonymous guest-id so the backend can
// fold whatever the shopper collected before signing in (cart + wishlist) into
// their account. Without it the merge-on-login step has nothing to adopt.
const headersWithGuest = (store = "") => {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
        const guestId = localStorage.getItem('guestId');
        if (guestId) headers['guest-id'] = guestId;
    }
    if (store) headers['X-Tenant'] = store;
    return headers;
};

export const register = async ({ name, email, phone, password }, store = "") => {
    const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: headersWithGuest(store),
        body: JSON.stringify({ name, email, phone, password }),
    });
    return res.json();
};

export const login = async ({ email, password }, store = "") => {
    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: headersWithGuest(store),
        body: JSON.stringify({ email, password }),
    });
    return res.json();
};

// Kick off a password reset. The backend always replies with the same generic
// success (it never reveals whether the email has an account), so the UI shows
// the same "check your email" message regardless.
export const requestPasswordReset = async ({ email }, store = "") => {
    const res = await fetch(`${API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(store ? { 'X-Tenant': store } : {}) },
        body: JSON.stringify({ email }),
    });
    return res.json();
};

// Redeem a reset token (from the emailed link) and set a new password. On
// success the backend returns a fresh JWT + customer so the caller can sign the
// shopper straight in via the auth context.
export const resetPassword = async ({ token, password }, store = "") => {
    const res = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: headersWithGuest(store),
        body: JSON.stringify({ token, password }),
    });
    return res.json();
};

// Current customer from the stored JWT. Silent: a missing/expired token just
// resolves to { success:false } (most visitors are anonymous — no redirect).
export const fetchMe = async (store = "") => {
    const token = getToken();
    if (!token) return { success: false };
    const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}`, ...(store ? { 'X-Tenant': store } : {}) },
    });
    return res.json();
};

// On a successful sign-in: persist the customer JWT and adopt the account's
// stable guestId, so every existing guest-id-keyed endpoint (cart, wishlist,
// orders) now reads and writes this account's data. The backend has already
// merged the anonymous guestId we sent into the account, so no items are lost.
export const persistSession = (token, customer) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    if (customer?.guestId) localStorage.setItem('guestId', customer.guestId);
};

export const logout = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    // Drop the account guestId so utils/cart.ensureGuestId mints a fresh
    // anonymous id — a signed-out shopper starts with an empty cart rather than
    // continuing to see the account cart they no longer own.
    localStorage.removeItem('guestId');
};

export const isAuthenticated = () => !!getToken();
