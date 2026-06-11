// Storefront product browse/search service. Talks to the server-side search
// endpoint (GET /api/client/product/search) which does all the filtering,
// sorting and pagination in Mongo — the page just renders what it returns.

const API = "/api/client/product";

// Build a clean query string, dropping empty / falsy values so the URL stays
// tidy (no ?minPrice=&inStock=false noise).
const toQuery = (params = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "" || value === false) return;
        sp.set(key, String(value));
    });
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
};

// Search / browse products. Accepts { q, category, sort, minPrice, maxPrice,
// inStock, page, limit }. Returns the raw envelope
// { success, data, totalCount, totalNoPage, page, priceBounds, appliedSort }.
export const searchProducts = async (params = {}) => {
    const res = await fetch(`${API}/search${toQuery(params)}`);
    return res.json();
};

// Autocomplete suggestions for the search box. Accepts { q, limit }; returns
// the envelope { success, data } where data is a short list of name-matched
// products (image + variant price only). The backend ignores queries shorter
// than two characters.
export const suggestProducts = async (params = {}) => {
    const res = await fetch(`${API}/suggest${toQuery(params)}`);
    return res.json();
};
