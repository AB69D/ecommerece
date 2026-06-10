// Storefront wishlist client. The wishlist lives server-side keyed by the same
// anonymous `guest-id` used for the cart, but we also keep a lightweight set of
// product ids in localStorage so the heart on every product card can render its
// state instantly (no per-card fetch) and stay in sync via a window event.

const LS_IDS = "wishlistIds";
const LS_FEATURE = "feature_wishlist";
const EVENT = "wishlist-updated";
const FEATURE_EVENT = "features-updated";

// ---- feature flag cache ---------------------------------------------------
// The admin can disable the wishlist from Site Settings. The Navbar fetches the
// public settings once and mirrors the flag here so every product card can hide
// its heart without each one re-fetching settings. Defaults to enabled so the
// UI doesn't flicker before settings load.
export const isWishlistEnabled = () => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(LS_FEATURE) !== "0";
};

export const setWishlistEnabled = (enabled) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_FEATURE, enabled ? "1" : "0");
    window.dispatchEvent(new Event(FEATURE_EVENT));
};

const guestHeader = () => {
    if (typeof window === "undefined") return {};
    let id = localStorage.getItem("guestId");
    if (!id) {
        id = `guest_${Date.now()}`;
        localStorage.setItem("guestId", id);
    }
    return { "guest-id": id };
};

// ---- local id cache (instant heart state) ---------------------------------
export const readWishlistIds = () => {
    if (typeof window === "undefined") return new Set();
    try {
        return new Set(JSON.parse(localStorage.getItem(LS_IDS) || "[]").map(String));
    } catch {
        return new Set();
    }
};

export const writeWishlistIds = (ids) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_IDS, JSON.stringify([...ids]));
    window.dispatchEvent(new Event(EVENT));
};

export const isWishlisted = (productId) => readWishlistIds().has(String(productId));

// ---- server calls ---------------------------------------------------------
export const getWishlist = () =>
    fetch(`/api/client/wishlist/get`, { headers: { ...guestHeader() } }).then((r) => r.json());

export const toggleWishlist = (item) =>
    fetch(`/api/client/wishlist/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...guestHeader() },
        body: JSON.stringify(item),
    }).then((r) => r.json());

export const removeFromWishlist = (productId) =>
    fetch(`/api/client/wishlist/remove/${productId}`, {
        method: "DELETE",
        headers: { ...guestHeader() },
    }).then((r) => r.json());

export const clearWishlist = () =>
    fetch(`/api/client/wishlist/clear`, {
        method: "DELETE",
        headers: { ...guestHeader() },
    }).then((r) => r.json());

// Pull the server wishlist and refresh the local id cache. Call on app load so
// hearts reflect a wishlist built on another device/session for this guest.
export const syncWishlistIds = async () => {
    try {
        const res = await getWishlist();
        if (res?.success && res.data) {
            const ids = new Set((res.data.items || []).map((it) => String(it.productId)));
            writeWishlistIds(ids);
            return ids;
        }
    } catch {
        /* keep whatever is cached */
    }
    return readWishlistIds();
};
