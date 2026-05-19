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

        maintenanceMode: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
