import { z } from 'zod';

const saleItem = z.object({
    productId: z.string().min(1).max(64),
    weightIndex: z.coerce.number().int().nonnegative().default(0),
    quantity: z.coerce.number().int().positive().max(9999),
    // Only honoured for wholesale sales (per-line price override).
    unitPrice: z.coerce.number().nonnegative().max(10_000_000).optional(),
});

export const createSaleSchema = z.object({
    items: z.array(saleItem).min(1).max(100),
    saleType: z.enum(['retail', 'wholesale']).default('retail'),
    customerName: z.string().max(120).optional(),
    customerPhone: z.string().max(40).optional(),
    customerEmail: z.string().max(160).optional(),
    paymentMethod: z.enum(['cash', 'card', 'online']).default('cash'),
    notes: z.string().max(400).optional(),
    // Optional cart-level coupon code applied at the till.
    couponCode: z.string().max(40).optional(),
});

export const returnSaleSchema = z.object({
    orderId: z.string().min(1).max(64),
});

export const salesQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().max(120).optional(),
    saleType: z.enum(['retail', 'wholesale']).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
});

export const productsQuerySchema = z.object({
    search: z.string().max(120).optional(),
    categoryId: z.string().max(64).optional(),
});

export const lookupQuerySchema = z.object({
    code: z.string().min(1).max(64),
});
