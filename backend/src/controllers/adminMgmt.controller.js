import bcrypt from 'bcryptjs';
import AdminModel from '../models/admin.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created } from '../lib/ApiResponse.js';
import { effectivePermissions } from '../lib/permissions.js';

const BCRYPT_ROUNDS = 10;

// Shape an admin doc for API responses (never leak passwordHash).
const presentAdmin = (admin) => {
    const obj = admin.toObject ? admin.toObject() : admin;
    delete obj.passwordHash;
    obj.effectivePermissions = [...effectivePermissions(obj)];
    return obj;
};

const isSuperAdmin = (req) => (req.adminDoc?.role || req.admin?.role) === 'super-admin';

// Only a super-admin may create/modify super-admins or grant the "*" wildcard.
const guardPrivilegeEscalation = (req, { role, permissions }) => {
    if (isSuperAdmin(req)) return;
    if (role === 'super-admin') {
        throw ApiError.forbidden('Only a super-admin can assign the super-admin role');
    }
    if (Array.isArray(permissions) && permissions.includes('*')) {
        throw ApiError.forbidden('Only a super-admin can grant the "*" permission');
    }
};

// GET /api/admin/admins
export const getAllAdmins = asyncHandler(async (_req, res) => {
    const admins = await AdminModel.find().sort({ createdAt: -1 });
    return ok(res, admins.map(presentAdmin), 'Admin users');
});

// GET /api/admin/admins/:id
export const getAdmin = asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw ApiError.notFound('Admin user not found');
    return ok(res, presentAdmin(admin), 'Admin user');
});

// POST /api/admin/admins
export const addAdmin = asyncHandler(async (req, res) => {
    const { username, password, fullName = '', email = '', role = 'admin', permissions = [] } =
        req.body;

    guardPrivilegeEscalation(req, { role, permissions });

    const exists = await AdminModel.findOne({ username });
    if (exists) throw ApiError.conflict('That username is already taken');
    if (email) {
        const emailExists = await AdminModel.findOne({ email });
        if (emailExists) throw ApiError.conflict('That email is already in use');
    }

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const admin = await AdminModel.create({
        username,
        passwordHash,
        fullName,
        email: email || undefined,
        role,
        permissions,
        addedBy: req.adminDoc?.username || req.admin?.username || 'system',
    });

    req.audit({
        action: 'user.create',
        resource: 'Admin',
        resourceId: admin._id,
        message: `Created admin "${admin.username}" (${admin.role})`,
        after: { username: admin.username, role: admin.role, permissions: admin.permissions },
    });

    return created(res, presentAdmin(admin), 'Admin user created');
});

// PATCH /api/admin/admins/:id
export const updateAdmin = asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.params.id).select('+permissions');
    if (!admin) throw ApiError.notFound('Admin user not found');

    // Non-super-admins cannot edit a super-admin.
    if (admin.role === 'super-admin' && !isSuperAdmin(req)) {
        throw ApiError.forbidden('Only a super-admin can modify a super-admin');
    }
    guardPrivilegeEscalation(req, { role: req.body.role, permissions: req.body.permissions });

    const before = {
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        isActive: admin.isActive,
    };

    // Prevent self-lockout: can't deactivate or demote yourself.
    const editingSelf = String(admin._id) === String(req.adminDoc?._id);
    if (editingSelf && req.body.isActive === false) {
        throw ApiError.badRequest('You cannot deactivate your own account');
    }

    if (req.body.email !== undefined && req.body.email) {
        const clash = await AdminModel.findOne({ email: req.body.email, _id: { $ne: admin._id } });
        if (clash) throw ApiError.conflict('That email is already in use');
    }

    // Don't allow removing the last active super-admin.
    if (admin.role === 'super-admin' && (req.body.role && req.body.role !== 'super-admin' || req.body.isActive === false)) {
        const otherSupers = await AdminModel.countDocuments({
            role: 'super-admin',
            isActive: true,
            _id: { $ne: admin._id },
        });
        if (otherSupers === 0) throw ApiError.badRequest('Cannot remove the last active super-admin');
    }

    const fields = ['fullName', 'email', 'role', 'permissions', 'isActive'];
    for (const f of fields) {
        if (req.body[f] !== undefined) admin[f] = f === 'email' ? req.body[f] || undefined : req.body[f];
    }
    await admin.save();

    req.audit({
        action: 'user.update',
        resource: 'Admin',
        resourceId: admin._id,
        message: `Updated admin "${admin.username}"`,
        before,
        after: {
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role,
            permissions: admin.permissions,
            isActive: admin.isActive,
        },
    });

    return ok(res, presentAdmin(admin), 'Admin user updated');
});

// POST /api/admin/admins/:id/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw ApiError.notFound('Admin user not found');
    if (admin.role === 'super-admin' && !isSuperAdmin(req)) {
        throw ApiError.forbidden('Only a super-admin can reset a super-admin password');
    }

    admin.passwordHash = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);
    await admin.save();

    req.audit({
        action: 'user.reset_password',
        resource: 'Admin',
        resourceId: admin._id,
        message: `Reset password for "${admin.username}"`,
    });

    return ok(res, { id: admin._id }, 'Password reset successfully');
});

// DELETE /api/admin/admins/:id
export const removeAdmin = asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) throw ApiError.notFound('Admin user not found');

    if (String(admin._id) === String(req.adminDoc?._id)) {
        throw ApiError.badRequest('You cannot delete your own account');
    }
    if (admin.role === 'super-admin' && !isSuperAdmin(req)) {
        throw ApiError.forbidden('Only a super-admin can delete a super-admin');
    }
    if (admin.role === 'super-admin') {
        const otherSupers = await AdminModel.countDocuments({
            role: 'super-admin',
            _id: { $ne: admin._id },
        });
        if (otherSupers === 0) throw ApiError.badRequest('Cannot delete the last super-admin');
    }

    await admin.deleteOne();

    req.audit({
        action: 'user.delete',
        resource: 'Admin',
        resourceId: admin._id,
        message: `Deleted admin "${admin.username}"`,
        before: { username: admin.username, role: admin.role },
    });

    return ok(res, { id: admin._id }, 'Admin user deleted');
});

// PATCH /api/admin/admins/me/password  — change your own password.
export const changeOwnPassword = asyncHandler(async (req, res) => {
    const me = await AdminModel.findById(req.adminDoc?._id || req.admin?.sub).select('+passwordHash');
    if (!me) throw ApiError.unauthorized();

    const matches = await bcrypt.compare(String(req.body.currentPassword), me.passwordHash);
    if (!matches) throw ApiError.badRequest('Current password is incorrect');

    me.passwordHash = await bcrypt.hash(String(req.body.newPassword), BCRYPT_ROUNDS);
    await me.save();

    req.audit({
        action: 'user.change_own_password',
        resource: 'Admin',
        resourceId: me._id,
        message: `"${me.username}" changed their own password`,
    });

    return ok(res, { id: me._id }, 'Password changed successfully');
});
