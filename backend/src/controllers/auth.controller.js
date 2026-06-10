import OtpModel from "../models/otp.model.js";
import AdminModel from "../models/admin.model.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { effectivePermissions } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const BREVO_KEY = process.env.API_KEY || process.env.SMTP_KEY;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendCode = async (request, response) => {
    try {
        const { email } = request.body;

        if (!email) {
            return response.status(400).json({
                message: "Email is required",
                error: true,
                success: false
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const isEnvAdmin = ADMIN_EMAILS.includes(normalizedEmail);
        const dbAdmin = await AdminModel.findOne({ email: normalizedEmail });

        if (!isEnvAdmin && !dbAdmin) {
            return response.status(403).json({
                message: "This email is not authorized for admin access",
                error: true,
                success: false
            });
        }

        const code = generateCode();

        await OtpModel.deleteMany({ email: normalizedEmail });

        const otp = new OtpModel({
            email: normalizedEmail,
            code,
            expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        });
        await otp.save();

        try {
            const emailRes = await fetch(BREVO_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': BREVO_KEY
                },
                body: JSON.stringify({
                    sender: {
                        name: process.env.MAIL_FROM_NAME,
                        email: process.env.MAIL_FROM_ADDRESS
                    },
                    to: [{ email: normalizedEmail }],
                    subject: 'Ab9dEcommerce Admin - Login Code',
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #1a1a1a; margin-bottom: 16px;">Admin Login Code</h2>
                            <p style="color: #666; font-size: 14px; line-height: 1.6;">
                                Use the following code to log in to your Ab9dEcommerce admin panel.
                                This code expires in 3 hours.
                            </p>
                            <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
                            </div>
                            <p style="color: #999; font-size: 12px;">
                                If you did not request this code, please ignore this email.
                            </p>
                        </div>
                    `
                })
            });

            if (!emailRes.ok) {
                const errBody = await emailRes.json().catch(() => ({}));
                throw new Error(errBody.message || `Brevo API error: ${emailRes.status}`);
            }
        } catch (emailError) {
            await OtpModel.deleteOne({ _id: otp._id });
            return response.status(500).json({
                message: "Failed to send email. " + emailError.message,
                error: true,
                success: false
            });
        }

        return response.json({
            message: "Login code sent to your email",
            error: false,
            success: true
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const verifyCode = async (request, response) => {
    try {
        const { email, code } = request.body;

        if (!email || !code) {
            return response.status(400).json({
                message: "Email and code are required",
                error: true,
                success: false
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const otp = await OtpModel.findOne({
            email: normalizedEmail,
            code,
            verified: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otp) {
            return response.status(400).json({
                message: "Invalid or expired code",
                error: true,
                success: false
            });
        }

        otp.verified = true;
        await otp.save();

        const token = jwt.sign(
            { email: normalizedEmail },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        return response.json({
            message: "Login successful",
            error: false,
            success: true,
            data: { token }
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const verifyToken = async (request, response) => {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return response.status(401).json({
                message: "No token provided",
                error: true,
                success: false,
                valid: false
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return response.json({
            message: "Token is valid",
            error: false,
            success: true,
            valid: true,
            data: { email: decoded.email }
        });

    } catch (error) {
        return response.status(401).json({
            message: "Invalid or expired token",
            error: true,
            success: false,
            valid: false
        });
    }
};

// ---------------------------------------------------------------
// Username + password login (preferred)
// POST /api/admin/auth/login   { username, password }
// ---------------------------------------------------------------
export const login = async (request, response) => {
    try {
        const { username, password } = request.body || {};
        if (!username || !password) {
            return response.status(400).json({
                success: false,
                error: true,
                message: "Username and password are required",
            });
        }

        const normalized = String(username).toLowerCase().trim();
        const admin = await AdminModel.findOne({ username: normalized, isActive: true })
            .select('+passwordHash');

        if (!admin) {
            return response.status(401).json({
                success: false,
                error: true,
                message: "Invalid username or password",
            });
        }

        const ok = await bcrypt.compare(String(password), admin.passwordHash);
        if (!ok) {
            await writeAudit({
                actor: { id: admin._id, username: admin.username, role: admin.role },
                action: 'auth.login_failed',
                resource: 'Admin',
                resourceId: String(admin._id),
                method: 'POST',
                path: '/api/admin/auth/login',
                statusCode: 401,
                ip: request.ip || '',
                userAgent: (request.headers['user-agent'] || '').slice(0, 300),
                message: `Failed login for "${admin.username}" (bad password)`,
                success: false,
            });
            return response.status(401).json({
                success: false,
                error: true,
                message: "Invalid username or password",
            });
        }

        admin.lastLoginAt = new Date();
        await admin.save();

        await writeAudit({
            actor: { id: admin._id, username: admin.username, role: admin.role },
            action: 'auth.login',
            resource: 'Admin',
            resourceId: String(admin._id),
            method: 'POST',
            path: '/api/admin/auth/login',
            statusCode: 200,
            ip: request.ip || '',
            userAgent: (request.headers['user-agent'] || '').slice(0, 300),
            message: `"${admin.username}" logged in`,
            success: true,
        });

        const token = jwt.sign(
            {
                sub: admin._id.toString(),
                username: admin.username,
                role: admin.role,
                email: admin.email || undefined,
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' },
        );

        return response.json({
            success: true,
            error: false,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email || null,
                    fullName: admin.fullName,
                    role: admin.role,
                },
            },
        });
    } catch (err) {
        return response.status(500).json({
            success: false,
            error: true,
            message: err.message || "Login failed",
        });
    }
};

// ---------------------------------------------------------------
// GET /api/admin/auth/me  - current admin from JWT (used by frontend)
// ---------------------------------------------------------------
export const me = async (request, response) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return response.status(401).json({ success: false, error: true, message: "Unauthorized" });
        }
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Username/password flow — JWT carries `sub` = admin id.
        if (decoded.sub) {
            const admin = await AdminModel.findById(decoded.sub).lean();
            if (!admin || !admin.isActive) {
                return response.status(401).json({ success: false, error: true, message: "Account inactive or removed" });
            }
            return response.json({
                success: true,
                data: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email || null,
                    fullName: admin.fullName,
                    role: admin.role,
                    permissions: admin.permissions || [],
                    effectivePermissions: [...effectivePermissions(admin)],
                    lastLoginAt: admin.lastLoginAt,
                },
            });
        }

        // Legacy OTP / email flow — JWT carries `email`. Resolve identity +
        // permissions from the env owner allow-list and/or the matching record
        // so these accounts aren't bounced back to the login screen.
        if (decoded.email) {
            const email = String(decoded.email).toLowerCase();
            const admin = await AdminModel.findOne({ email }).lean();
            if (admin && admin.isActive === false) {
                return response.status(401).json({ success: false, error: true, message: "Account inactive or removed" });
            }
            const isEnvAdmin = ADMIN_EMAILS.includes(email);
            if (!admin && !isEnvAdmin) {
                return response.status(401).json({ success: false, error: true, message: "Account inactive or removed" });
            }
            // Env owners are full super-admins; legacy email admins created
            // before roles existed default to the full "admin" role.
            const role = isEnvAdmin ? 'super-admin' : (admin?.role || 'admin');
            const perms = isEnvAdmin
                ? new Set(['*'])
                : effectivePermissions({ role, permissions: admin?.permissions });
            return response.json({
                success: true,
                data: {
                    id: admin?._id || null,
                    username: admin?.username || email,
                    email,
                    fullName: admin?.fullName || '',
                    role,
                    permissions: admin?.permissions || [],
                    effectivePermissions: [...perms],
                    lastLoginAt: admin?.lastLoginAt || null,
                },
            });
        }

        return response.status(401).json({ success: false, error: true, message: "Unauthorized" });
    } catch (err) {
        return response.status(401).json({ success: false, error: true, message: "Invalid or expired token" });
    }
};
