import { z } from 'zod';

const socialLink = z.object({
    platform: z.string().min(1),
    url: z.string().url(),
    icon: z.string().optional(),
});

export const updateSiteSettingsSchema = z.object({
    siteName: z.string().min(1).max(100).optional(),
    tagline: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    logoUrl: z.string().url().or(z.literal('')).optional(),
    faviconUrl: z.string().url().or(z.literal('')).optional(),
    contactEmail: z.string().email().or(z.literal('')).optional(),
    contactPhone: z.string().max(50).optional(),
    contactAddress: z.string().max(500).optional(),
    socialLinks: z.array(socialLink).optional(),
    currencyCode: z.string().length(3).optional(),
    currencySymbol: z.string().max(5).optional(),
    seo: z
        .object({
            defaultTitle: z.string().optional(),
            defaultDescription: z.string().optional(),
            defaultKeywords: z.string().optional(),
            ogImage: z.string().url().or(z.literal('')).optional(),
        })
        .partial()
        .optional(),
    maintenanceMode: z.boolean().optional(),
});
