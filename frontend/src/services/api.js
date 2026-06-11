const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_token');
};

// The store segment of the current URL (/<store>/…), or '' on a platform/root
// page. Lets these non-React services build store-aware redirect targets.
const RESERVED_FIRST_SEG = new Set(['login', 'platform', 'sell', 'api']);
const currentStore = () => {
    if (typeof window === 'undefined') return '';
    const seg = window.location.pathname.split('/')[1] || '';
    return seg && !RESERVED_FIRST_SEG.has(seg) ? seg : '';
};

export const authFetch = async (url, options = {}) => {
    const token = getToken();
    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        // Global sign-in (path-based multi-tenancy): it routes the owner back to
        // their own /<store>/admin (or the platform console) after re-auth.
        const loginUrl = '/login';
        if (window.location.pathname !== loginUrl) {
            window.location.replace(loginUrl);
        }
    }

    return res;
};

// Storefront sibling of authFetch: attaches the customer JWT and, on a 401
// (expired/invalid token), clears it and bounces to the customer login. Use it
// only for endpoints that REQUIRE a signed-in shopper (account dashboard,
// address book, profile edits); anonymous reads must not redirect.
export const customerFetch = async (url, options = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('customer_token');
        const store = currentStore();
        const loginUrl = store ? `/${store}/account/login` : '/account/login';
        if (window.location.pathname !== loginUrl) {
            window.location.replace(loginUrl);
        }
    }

    return res;
};
