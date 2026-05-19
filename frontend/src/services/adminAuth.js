const API = '/api/admin/auth';

export const sendLoginCode = async (email) => {
    const res = await fetch(`${API}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    return res.json();
};

export const verifyLoginCode = async (email, code) => {
    const res = await fetch(`${API}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
    });
    return res.json();
};

export const verifyToken = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return { valid: false };

    const res = await fetch(`${API}/verify-token`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
};

export const login = (token) => {
    localStorage.setItem('admin_token', token);
};

export const logout = () => {
    localStorage.removeItem('admin_token');
};

export const isAuthenticated = () => {
    return !!localStorage.getItem('admin_token');
};
