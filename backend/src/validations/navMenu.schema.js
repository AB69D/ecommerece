import { z } from 'zod';

const locationEnum = z.enum(['header', 'sidebar', 'mobile', 'footer']);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createMenuItemSchema = z.object({
    label: z.string().min(1).max(100),
    url: z.string().min(1).max(500),
    icon: z.string().optional(),
    openInNewTab: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
    parent: objectId.nullable().optional(),
    location: locationEnum.optional(),
    isVisible: z.boolean().optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const reorderSchema = z.object({
    items: z
        .array(
            z.object({
                id: objectId,
                order: z.number().int().nonnegative(),
                parent: objectId.nullable().optional(),
            }),
        )
        .min(1),
});

export const menuIdParam = z.object({ id: objectId });
