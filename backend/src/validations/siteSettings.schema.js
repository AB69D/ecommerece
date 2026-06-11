import { z } from 'zod';

const socialLink = z.object({
    platform: z.string().min(1),
    url: z.string().url(),
    icon: z.string().optional(),
});

// Feature master switches. Every key is an optional boolean so the admin can
// toggle one flag at a time without resending the whole block.
const features = z
    .object({
        barcode: z.boolean(),
        coupons: z.boolean(),
        wishlist: z.boolean(),
        receiptPrinting: z.boolean(),
        labelPrinting: z.boolean(),
        posShift: z.boolean(),
        profitReporting: z.boolean(),
        stockLedger: z.boolean(),
        pwa: z.boolean(),
        whatsapp: z.boolean(),
        analytics: z.boolean(),
    })
    .partial();

const receipt = z
    .object({
        header: z.string().max(200),
        footerNote: z.string().max(300),
        showLogo: z.boolean(),
        paperWidth: z.enum(['58', '80']),
        showTax: z.boolean(),
        returnPolicy: z.string().max(500),
    })
    .partial();

const barcode = z
    .object({
        symbology: z.enum(['CODE128', 'EAN13']),
        prefix: z.string().max(20),
        labelWidthMm: z.number().min(10).max(200),
        labelHeightMm: z.number().min(10).max(200),
        showPrice: z.boolean(),
        showName: z.boolean(),
    })
    .partial();

const pos = z
    .object({
        lowStockThreshold: z.number().min(0).max(100000),
        taxPercent: z.number().min(0).max(100),
        taxLabel: z.string().max(20),
        requireShift: z.boolean(),
        allowNegativeStock: z.boolean(),
        wholesaleDiscountPercent: z.number().min(0).max(100),
    })
    .partial();

const analytics = z
    .object({
        ga4Id: z.string().max(40),
        metaPixelId: z.string().max(40),
        gtmId: z.string().max(40),
        metaCapiToken: z.string().max(400),
        metaTestEventCode: z.string().max(40),
    })
    .partial();

const whatsapp = z
    .object({
        businessNumber: z.string().max(20),
        notifyOnOrder: z.boolean(),
        notifyOnStatusChange: z.boolean(),
        orderTemplate: z.string().max(500),
        statusTemplate: z.string().max(500),
    })
    .partial();

// Online payment gateway credentials. Every key optional so the admin can flip
// the toggle or update one field without resending the secret each time.
const payment = z
    .object({
        provider: z.enum(['sslcommerz']),
        enabled: z.boolean(),
        sandbox: z.boolean(),
        storeId: z.string().max(100),
        storePassword: z.string().max(200),
    })
    .partial();

// Accepts #rgb or #rrggbb (case-insensitive). Empty string is rejected so a
// blank picker never wipes a colour to an invalid value.
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour like #047857');

// Storefront appearance. Every colour is optional so the admin can change one
// swatch at a time; the flatten-for-set update merges it without clobbering the
// rest of the theme.
const theme = z
    .object({
        navbarFrom: hexColor,
        navbarVia: hexColor,
        navbarTo: hexColor,
        navbarText: hexColor,
        footerFrom: hexColor,
        footerVia: hexColor,
        footerTo: hexColor,
        homeFrom: hexColor,
        homeTo: hexColor,
        primary: hexColor,
        accent: hexColor,
    })
    .partial();

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
    features: features.optional(),
    receipt: receipt.optional(),
    barcode: barcode.optional(),
    pos: pos.optional(),
    analytics: analytics.optional(),
    whatsapp: whatsapp.optional(),
    theme: theme.optional(),
    payment: payment.optional(),
    maintenanceMode: z.boolean().optional(),
});
