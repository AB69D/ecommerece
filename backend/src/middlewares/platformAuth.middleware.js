import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// ── Platform super-admin gate ───────────────────────────────────────────────
// The platform owner(s) are the env ADMIN_EMAILS allow-list — the same trusted
// identities that own the primary store. Any valid admin token (username/password
// or OTP login) whose `email` claim is on that list may manage the tenant fleet.
//
// The /api/platform route group runs in a SYSTEM (cross-tenant) context, so these
// handlers see every tenant, not just one. This middleware only checks identity;
// it does not bind a tenant.
export const requireSuperAdmin = (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: true, message: 'Unauthorized' });
        }
        const decoded = jwt.verify(header.slice(7), env.JWT_SECRET);
        const email = String(decoded.email || '').toLowerCase();
        if (!email || !env.ADMIN_EMAILS.includes(email)) {
            return res.status(403).json({
                success: false,
                error: true,
                message: 'Platform admin access required',
            });
        }
        req.platformAdmin = { email };
        return next();
    } catch {
        return res.status(401).json({ success: false, error: true, message: 'Invalid or expired token' });
    }
};

export default requireSuperAdmin;
