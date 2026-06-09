import mongoose from 'mongoose';

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
        // Singleton — there should only ever be one document.
        key: { type: String, default: 'global', unique: true, immutable: true },

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
        },

        // Web analytics (injected into the storefront <head> when set).
        analytics: {
            ga4Id: { type: String, default: '' },     // G-XXXXXXXXXX
            metaPixelId: { type: String, default: '' },
            gtmId: { type: String, default: '' },     // GTM-XXXXXXX
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

        maintenanceMode: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
