// Client-side mirror of the backend permission check. Works on the `me`
// object returned by GET /api/admin/auth/me (which includes
// `effectivePermissions: [...]`).

export const hasPermission = (me, required) => {
    const set = me?.effectivePermissions || [];
    if (!required) return true;
    if (set.includes('*')) return true;
    if (set.includes(required)) return true;
    const resource = required.split(':')[0];
    return set.includes(`${resource}:*`);
};

// True if the user has ANY of the listed permissions (handy for menu gating).
export const hasAnyPermission = (me, list = []) =>
    list.length === 0 || list.some((p) => hasPermission(me, p));

export const ROLE_LABELS = {
    'super-admin': 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    support: 'Support',
    viewer: 'Viewer',
};

export const ROLE_BADGE = {
    'super-admin': 'bg-purple-100 text-purple-700 border-purple-200',
    admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    manager: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    support: 'bg-amber-100 text-amber-700 border-amber-200',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};
