import { z } from 'zod';
import { ROLES, isValidPermission } from '../lib/permissions.js';

const username = z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(64)
    .regex(/^[a-z0-9._-]+$/, 'Only lowercase letters, numbers, dot, underscore, hyphen');

const password = z.string().min(6, 'Password must be at least 6 characters').max(128);

const email = z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email')
    .or(z.literal(''))
    .optional();

const role = z.enum(ROLES);

const permissions = z
    .array(z.string())
    .max(200)
    .refine((arr) => arr.every(isValidPermission), {
        message: 'One or more permissions are invalid',
    })
    .optional();

export const createAdminSchema = z.object({
    username,
    password,
    fullName: z.string().trim().max(120).optional(),
    email,
    role: role.optional(),
    permissions,
});

export const updateAdminSchema = z
    .object({
        fullName: z.string().trim().max(120).optional(),
        email,
        role: role.optional(),
        permissions,
        isActive: z.boolean().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export const resetPasswordSchema = z.object({
    password,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
});
