// POS terminal API client.
//
// POS uses its OWN token (`pos_token`) kept separate from the admin panel's
// `admin_token`, so a cashier's session never collides with an admin session
// and a 401 sends them back to the POS login — not /admin/login.
const API = "/api/admin";
const TOKEN_KEY = "pos_token";
const jsonHeaders = { "Content-Type": "application/json" };

export const getPosToken = () =>
    (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);

export const setPosToken = (t) => localStorage.setItem(TOKEN_KEY, t);

export const clearPosToken = () => localStorage.removeItem(TOKEN_KEY);

export const isPosAuthed = () => !!getPosToken();

// Shared login endpoint (username + password) — same as the admin panel.
export const posLogin = async (username, password) => {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ username, password }),
    });
    return res.json();
};

// Current account + effective permissions (used to gate POS features).
export const posFetchMe = async () => {
    const token = getPosToken();
    if (!token) return { success: false };
    const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
        clearPosToken();
        return { success: false };
    }
    return res.json();
};

// Authenticated fetch for POS endpoints. Broadcasts `pos:unauthorized` on 401
// so the terminal can drop back to the login screen.
const posFetch = async (path, options = {}) => {
    const token = getPosToken();
    const headers = { ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...options, headers });
    if (res.status === 401) {
        clearPosToken();
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("pos:unauthorized"));
        }
    }
    return res;
};

const json = (r) => r.json();
const qs = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.append(k, v);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
};

export const getPosProducts = (params) => posFetch(`/pos/products${qs(params)}`).then(json);

export const createPosSale = (payload) =>
    posFetch(`/pos/sale`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then(json);

export const returnPosSale = (orderId) =>
    posFetch(`/pos/return`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ orderId }) }).then(json);

export const getPosSales = (params) => posFetch(`/pos/sales${qs(params)}`).then(json);

export const getPosReport = () => posFetch(`/pos/report`).then(json);
