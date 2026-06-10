import { z } from 'zod';

export const updatePageSchema = z.object({
    title: z.string().max(200).optional(),
    body: z.string().max(100_000).optional(),
    seoTitle: z.string().max(200).optional(),
    seoDescription: z.string().max(400).optional(),
    isPublished: z.boolean().optional(),
});
