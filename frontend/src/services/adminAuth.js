const API = '/api/admin/auth';

// Username + password login (preferred).
export const loginWithPassword = async (username, password) => {
    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return res.json();
};

// Returns current admin from JWT.
export const fetchMe = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return { success: false };
    const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
};

// Legacy OTP flow — kept for backward compatibility.
export const sendLoginCode = async (email) => {
    const res = await fetch(`${API}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    return res.json();
};

export const verifyLoginCode = async (email, code) => {
    const res = await fetch(`${API}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    return res.json();
};

export const verifyToken = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return { valid: false };
    const res = await fetch(`${API}/verify-token`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
};

export const login = (token) => {
    localStorage.setItem('admin_token', token);
};

export const logout = () => {
    localStorage.removeItem('admin_token');
};

export const isAuthenticated = () => !!localStorage.getItem('admin_token');
