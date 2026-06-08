import { z } from 'zod';

// The widget holds the conversation state and passes it back as `context`.
// We keep validation permissive here (shape only) because the engine fully
// sanitizes and re-derives every value server-side from the database.
const cartItem = z.object({
    productId: z.string().max(64),
    weightIndex: z.coerce.number().int().nonnegative().optional(),
    quantity: z.coerce.number().int().optional(),
}).passthrough();

const draft = z.object({
    customerName: z.string().max(120).optional(),
    customerPhone: z.string().max(40).optional(),
    customerEmail: z.string().max(160).optional(),
    shippingAddress: z.string().max(500).optional(),
    deliveryArea: z.string().max(40).optional(),
    notes: z.string().max(400).optional(),
}).passthrough();

const context = z.object({
    stage: z.string().max(40).optional(),
    guestId: z.string().max(120).optional(),
    cart: z.array(cartItem).max(50).optional(),
    draft: draft.optional(),
}).passthrough();

const action = z.object({
    type: z.string().max(40),
    productId: z.string().max(64).optional(),
    weightIndex: z.coerce.number().int().optional(),
    quantity: z.coerce.number().int().optional(),
    categoryId: z.string().max(64).optional(),
    query: z.string().max(200).optional(),
    area: z.string().max(40).optional(),
    index: z.coerce.number().int().optional(),
    text: z.string().max(500).optional(),
}).passthrough();

// `.nullish()` (optional + nullable): the widget sends literal `null` for
// `context`/`guestId` on a visitor's first turn, which `.optional()` alone
// rejects. The engine re-derives every value server-side, so null == absent.
export const chatMessageSchema = z.object({
    message: z.string().max(1000).nullish(),
    action: action.nullish(),
    guestId: z.string().max(120).nullish(),
    context: context.nullish(),
});
