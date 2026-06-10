import { Page } from '../models/page.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { ApiError } from '../lib/ApiError.js';
import { PAGE_REGISTRY, PAGE_BY_SLUG, isKnownPage, isEditablePage } from '../lib/cmsPages.js';

// GET /api/client/page/:slug
// Public. Returns the admin override for a fixed page, or null when none has
// been saved (the frontend then renders its built-in default content). An
// unpublished override is treated as "no override".
export const getPublicPage = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    if (!isKnownPage(slug)) throw ApiError.notFound('Unknown page');
    const doc = await Page.findOne({ slug, isPublished: true });
    if (!doc) return ok(res, null);
    return ok(res, {
        slug: doc.slug,
        title: doc.title,
        body: doc.body,
        seoTitle: doc.seoTitle,
        seoDescription: doc.seoDescription,
        updatedAt: doc.updatedAt,
    });
});

// GET /api/admin/page
// Admin. Lists every fixed page (from the registry) merged with any saved
// override, so the editor always shows the full, stable set of pages.
export const listPages = asyncHandler(async (_req, res) => {
    const docs = await Page.find({});
    const bySlug = Object.fromEntries(docs.map((d) => [d.slug, d]));
    const pages = PAGE_REGISTRY.map((reg) => {
        const d = bySlug[reg.slug];
        return {
            ...reg,
            customised: !!d,
            isPublished: d ? d.isPublished : true,
            title: d?.title || '',
            updatedAt: d?.updatedAt || null,
        };
    });
    return ok(res, { pages });
});

// GET /api/admin/page/:slug
export const getAdminPage = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const reg = PAGE_BY_SLUG[slug];
    if (!reg) throw ApiError.notFound('Unknown page');
    const doc = await Page.findOne({ slug });
    return ok(res, {
        slug: reg.slug,
        label: reg.label,
        path: reg.path,
        editable: reg.editable,
        title: doc?.title || '',
        body: doc?.body || '',
        seoTitle: doc?.seoTitle || '',
        seoDescription: doc?.seoDescription || '',
        isPublished: doc ? doc.isPublished : true,
        customised: !!doc,
        updatedAt: doc?.updatedAt || null,
    });
});

// PUT /api/admin/page/:slug — upsert the override for an editable fixed page.
export const updatePage = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    if (!isKnownPage(slug)) throw ApiError.notFound('Unknown page');
    if (!isEditablePage(slug)) throw ApiError.badRequest('This page is not editable from the CMS');

    const { title, body, seoTitle, seoDescription, isPublished } = req.body;
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (body !== undefined) patch.body = body;
    if (seoTitle !== undefined) patch.seoTitle = seoTitle;
    if (seoDescription !== undefined) patch.seoDescription = seoDescription;
    if (isPublished !== undefined) patch.isPublished = isPublished;

    const doc = await Page.findOneAndUpdate(
        { slug },
        { $set: patch, $setOnInsert: { slug } },
        { new: true, upsert: true, runValidators: true },
    );
    req.audit?.({
        action: 'page.update',
        resource: 'Page',
        resourceId: doc._id,
        message: `Updated page content: ${slug}`,
        after: patch,
    });
    return ok(res, doc, 'Page updated');
});
