import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import AdminModel from '../models/admin.model.js';
import { runAsSystem } from '../tenancy/tenantContext.js';

// True when `email` is on the env ADMIN_EMAILS allow-list — the bootstrap set of
// platform owners that can never be revoked from the UI (lockout-proof).
export const isPlatformEmail = (email) =>
    env.ADMIN_EMAILS.includes(String(email || '').toLowerCase());

// ── Platform super-admin gate ───────────────────────────────────────────────
// A platform owner is EITHER on the env ADMIN_EMAILS allow-list (bootstrap) OR a
// live admin carrying the DB-backed `isPlatformOwner` flag (granted from the
// Owner Management panel). Either way they may manage the whole tenant fleet.
//
// The /api/platform route group runs in a SYSTEM (cross-tenant) context, so these
// handlers see every tenant, not just one. This middleware only checks identity
// (and stamps req.platformAdmin); it does not bind a tenant.
export const requireSuperAdmin = async (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: true, message: 'Unauthorized' });
        }
        const decoded = jwt.verify(header.slice(7), env.JWT_SECRET);

        if (decoded.type === 'customer') {
            return res.status(401).json({ success: false, error: true, message: 'Invalid token type' });
        }

        const email = String(decoded.email || '').toLowerCase();

        // Fast path: env allow-list owner (no DB read needed).
        if (email && isPlatformEmail(email)) {
            req.platformAdmin = { id: decoded.sub ? String(decoded.sub) : null, email };
            return next();
        }

        // DB-backed owner: load the LIVE admin (cross-tenant) so a just-revoked or
        // just-deactivated owner loses access immediately — no stale-token bypass.
        let admin = null;
        if (decoded.sub) {
            admin = await runAsSystem(() =>
                AdminModel.findById(decoded.sub)
                    .select('email isActive isPlatformOwner')
                    .lean()
                    .exec(),
            );
        } else if (email) {
            admin = await runAsSystem(() =>
                AdminModel.findOne({ email })
                    .select('email isActive isPlatformOwner')
                    .lean()
                    .exec(),
            );
        }

        if (admin && admin.isActive !== false && admin.isPlatformOwner === true) {
            req.platformAdmin = { id: String(admin._id), email: admin.email || email };
            return next();
        }

        return res.status(403).json({
            success: false,
            error: true,
            message: 'Platform admin access required',
        });
    } catch {
        return res.status(401).json({ success: false, error: true, message: 'Invalid or expired token' });
    }
};

export default requireSuperAdmin;
