import { z } from 'zod';

const code = z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes or underscores only');

// Date that accepts ISO strings / Date / null. Absent (undefined) fields are
// preserved as undefined so partial updates never wipe an existing date; an
// explicit '' or null clears it.
const dateField = z.preprocess((v) => {
    if (v === undefined) return undefined;
    if (v === '' || v === null) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}, z.date().nullable().optional());

// Boolean that also accepts the strings 'true'/'false'/'1'/'0' (z.coerce.boolean
// is unusable here — Boolean('false') is true).
const boolish = z.preprocess((v) => {
    if (typeof v === 'string') return v === 'true' || v === '1';
    return v;
}, z.boolean());

export const createCouponSchema = z.object({
    code,
    description: z.string().max(240).optional().default(''),
    type: z.enum(['percent', 'fixed']).default('percent'),
    value: z.coerce.number().nonnegative().max(10_000_000),
    minSubtotal: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
    maxDiscount: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
    startsAt: dateField,
    expiresAt: dateField,
    usageLimit: z.coerce.number().int().nonnegative().max(1_000_000).optional().default(0),
    channels: z.array(z.enum(['ecommerce', 'pos'])).min(1).optional().default(['ecommerce', 'pos']),
    active: boolish.optional().default(true),
});

// Partial for updates — every field optional, `code` still validated if present.
export const updateCouponSchema = z.object({
    code: code.optional(),
    description: z.string().max(240).optional(),
    type: z.enum(['percent', 'fixed']).optional(),
    value: z.coerce.number().nonnegative().max(10_000_000).optional(),
    minSubtotal: z.coerce.number().nonnegative().max(10_000_000).optional(),
    maxDiscount: z.coerce.number().nonnegative().max(10_000_000).optional(),
    startsAt: dateField,
    expiresAt: dateField,
    usageLimit: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
    channels: z.array(z.enum(['ecommerce', 'pos'])).min(1).optional(),
    active: boolish.optional(),
});

export const validateCouponSchema = z.object({
    code,
    subtotal: z.coerce.number().nonnegative().max(100_000_000),
    channel: z.enum(['ecommerce', 'pos']).default('ecommerce'),
});

export const listCouponQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().max(80).optional(),
    active: z.enum(['true', 'false']).optional(),
});
