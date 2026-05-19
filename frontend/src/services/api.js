const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_token');
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
        const loginUrl = '/admin/login';
        if (window.location.pathname !== loginUrl) {
            window.location.replace(loginUrl);
        }
    }

    return res;
};
