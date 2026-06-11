import mongoose from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const socialLinkSchema = new mongoose.Schema(
    {
        platform: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        icon: { type: String, default: '' },
    },
    { _id: false },
);

const siteSettingsSchema = new mongoose.Schema(
    {
        // Singleton PER TENANT — exactly one document per tenant (see compound
        // index below). `key` stays for backwards-compatible reads/upserts.
        key: { type: String, default: 'global', immutable: true },

        siteName: { type: String, default: 'Ab9dEcommerce', trim: true },
        tagline: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },

        logoUrl: { type: String, default: '' },
        faviconUrl: { type: String, default: '' },

        contactEmail: { type: String, default: '', trim: true, lowercase: true },
        contactPhone: { type: String, default: '', trim: true },
        contactAddress: { type: String, default: '', trim: true },

        socialLinks: { type: [socialLinkSchema], default: [] },

        currencyCode: { type: String, default: 'USD', uppercase: true },
        currencySymbol: { type: String, default: '$' },

        seo: {
            defaultTitle: { type: String, default: '' },
            defaultDescription: { type: String, default: '' },
            defaultKeywords: { type: String, default: '' },
            ogImage: { type: String, default: '' },
        },

        // ── Advanced feature master switches (toggled from the admin panel) ──
        // Every feature added in Phase 1/2 reads its flag here. Defaults keep
        // existing behaviour intact so nothing changes until an admin opts in.
        features: {
            barcode: { type: Boolean, default: true },
            coupons: { type: Boolean, default: true },
            wishlist: { type: Boolean, default: true },
            receiptPrinting: { type: Boolean, default: true },
            labelPrinting: { type: Boolean, default: true },
            posShift: { type: Boolean, default: true },
            profitReporting: { type: Boolean, default: true },
            stockLedger: { type: Boolean, default: true },
            pwa: { type: Boolean, default: true },
            whatsapp: { type: Boolean, default: false },
            analytics: { type: Boolean, default: true },
            productReviews: { type: Boolean, default: true },
        },

        // POS receipt + storefront invoice customization.
        receipt: {
            header: { type: String, default: '' },        // extra line under the store name
            footerNote: { type: String, default: 'Thank you for shopping with us!' },
            showLogo: { type: Boolean, default: true },
            paperWidth: { type: String, enum: ['58', '80'], default: '80' }, // mm
            showTax: { type: Boolean, default: false },
            returnPolicy: { type: String, default: '' },
        },

        // Barcode / label configuration.
        barcode: {
            symbology: { type: String, enum: ['CODE128', 'EAN13'], default: 'CODE128' },
            prefix: { type: String, default: '' },           // optional SKU/barcode prefix
            labelWidthMm: { type: Number, default: 40 },
            labelHeightMm: { type: Number, default: 30 },
            showPrice: { type: Boolean, default: true },
            showName: { type: Boolean, default: true },
        },

        // POS behaviour.
        pos: {
            lowStockThreshold: { type: Number, default: 5 },
            taxPercent: { type: Number, default: 0 },
            taxLabel: { type: String, default: 'VAT' },
            requireShift: { type: Boolean, default: false },  // force open shift before selling
            allowNegativeStock: { type: Boolean, default: false },
            // Default % discount pre-filled on a wholesale sale (cashier can edit
            // or clear it per sale). 0 disables the pre-fill.
            wholesaleDiscountPercent: { type: Number, default: 0 },
        },

        // Web analytics (injected into the storefront <head> when set).
        analytics: {
            ga4Id: { type: String, default: '' },     // G-XXXXXXXXXX
            metaPixelId: { type: String, default: '' },
            gtmId: { type: String, default: '' },     // GTM-XXXXXXX
            // Meta Conversions API (server-side tracking). The access token is a
            // SECRET — the public site-settings endpoint strips it before
            // responding so it never reaches the browser. The optional test
            // event code routes events to Meta's "Test Events" tab during setup.
            metaCapiToken: { type: String, default: '' },
            metaTestEventCode: { type: String, default: '' },
        },

        // WhatsApp order / status notifications.
        whatsapp: {
            businessNumber: { type: String, default: '' }, // E.164 without '+', e.g. 8801XXXXXXXXX
            notifyOnOrder: { type: Boolean, default: true },
            notifyOnStatusChange: { type: Boolean, default: true },
            // {{name}} {{orderId}} {{total}} {{status}} are substituted at send time.
            orderTemplate: {
                type: String,
                default: 'Hi {{name}}, thanks for your order {{orderId}} ({{total}}). We will confirm shortly.',
            },
            statusTemplate: {
                type: String,
                default: 'Hi {{name}}, your order {{orderId}} is now {{status}}.',
            },
        },

        // ── Storefront appearance / theme ──────────────────────────────────
        // Admin-selectable colours applied across the storefront via CSS custom
        // properties injected server-side in the root layout. Navbar and footer
        // are ALWAYS rendered as gradients (three stops each); the home page gets
        // a soft background wash. `primary`/`accent` drive buttons, links and the
        // gold highlights. Defaults reproduce the original emerald/amber brand so
        // nothing changes visually until an admin customises it.
        theme: {
            // Navbar gradient (left → right) + a legible text/icon colour on top.
            navbarFrom: { type: String, default: '#065f46' },
            navbarVia: { type: String, default: '#047857' },
            navbarTo: { type: String, default: '#064e3b' },
            navbarText: { type: String, default: '#ecfdf5' },
            // Footer gradient (top → bottom).
            footerFrom: { type: String, default: '#064e3b' },
            footerVia: { type: String, default: '#065f46' },
            footerTo: { type: String, default: '#022c22' },
            // Home / storefront background wash (top tint → base).
            homeFrom: { type: String, default: '#ecfdf5' },
            homeTo: { type: String, default: '#ffffff' },
            // Brand accents reused across the UI.
            primary: { type: String, default: '#047857' },
            accent: { type: String, default: '#f59e0b' },
        },

        // ── Online payments ────────────────────────────────────────────────
        // SSLCommerz gateway (Bangladesh aggregator: cards + bKash/Nagad/Rocket
        // and bank in one integration). Disabled until an admin enters store
        // credentials and flips `enabled`. `storeId` and `storePassword` are
        // SECRETS — the public site-settings endpoint strips both so neither ever
        // reaches the browser; only `enabled`/`provider`/`sandbox` are exposed so
        // the storefront knows whether to offer the "Pay online" option.
        payment: {
            provider: { type: String, enum: ['sslcommerz'], default: 'sslcommerz' },
            enabled: { type: Boolean, default: false },
            sandbox: { type: Boolean, default: true }, // sandbox creds until live
            storeId: { type: String, default: '' },
            storePassword: { type: String, default: '' },
        },

        maintenanceMode: { type: Boolean, default: false },
    },
    { timestamps: true },
);

siteSettingsSchema.plugin(tenantPlugin);

// One settings document PER TENANT (was a single global singleton).
siteSettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
