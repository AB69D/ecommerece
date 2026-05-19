import mongoose from 'mongoose';

const linkSchema = new mongoose.Schema(
    {
        label: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        openInNewTab: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
    },
    { _id: true },
);

const columnSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        order: { type: Number, default: 0 },
        links: { type: [linkSchema], default: [] },
    },
    { _id: true },
);

const footerSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'global', unique: true, immutable: true },

        aboutText: { type: String, default: '', trim: true },

        columns: { type: [columnSchema], default: [] },

        showNewsletter: { type: Boolean, default: false },
        newsletterTitle: { type: String, default: 'Subscribe to our newsletter' },
        newsletterDescription: { type: String, default: '' },

        copyrightText: { type: String, default: '' },
        showPaymentBadges: { type: Boolean, default: true },

        bottomLinks: { type: [linkSchema], default: [] },
    },
    { timestamps: true },
);

export const Footer = mongoose.model('Footer', footerSchema);
