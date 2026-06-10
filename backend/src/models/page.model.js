import mongoose from 'mongoose';

// An admin override for one of the site's fixed content pages (see
// lib/cmsPages.js). A document only exists once an admin has customised that
// page; until then the frontend route renders its built-in default content.
const pageSchema = new mongoose.Schema(
    {
        // One of the registry slugs (e.g. 'privacy-policy'). The route/path is
        // fixed in the frontend code; only the content here is editable.
        slug: { type: String, required: true, unique: true, trim: true, index: true },

        title: { type: String, default: '', trim: true },
        // Rich HTML body rendered inside a styled prose container on the page.
        body: { type: String, default: '' },

        // Optional SEO overrides for the page <head>.
        seoTitle: { type: String, default: '', trim: true },
        seoDescription: { type: String, default: '', trim: true },

        // When false the override is ignored and the built-in default shows.
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export const Page = mongoose.model('Page', pageSchema);
