import { z } from 'zod';

const link = z.object({
    label: z.string().min(1).max(100),
    url: z.string().min(1).max(500),
    openInNewTab: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
});

const column = z.object({
    title: z.string().min(1).max(100),
    order: z.number().int().nonnegative().optional(),
    links: z.array(link).optional(),
});

export const updateFooterSchema = z.object({
    aboutText: z.string().max(2000).optional(),
    columns: z.array(column).optional(),
    showNewsletter: z.boolean().optional(),
    newsletterTitle: z.string().max(200).optional(),
    newsletterDescription: z.string().max(500).optional(),
    copyrightText: z.string().max(500).optional(),
    showPaymentBadges: z.boolean().optional(),
    bottomLinks: z.array(link).optional(),
});
