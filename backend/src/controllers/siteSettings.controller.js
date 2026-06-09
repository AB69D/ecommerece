import { SiteSettings } from '../models/siteSettings.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { ApiError } from '../lib/ApiError.js';

const getOrCreate = async () => {
    let doc = await SiteSettings.findOne({ key: 'global' });
    if (!doc) doc = await SiteSettings.create({ key: 'global' });
    return doc;
};

// Flatten a nested patch into Mongo dot-paths so a partial update (e.g.
// toggling a single feature flag) never clobbers sibling keys. Arrays are
// treated as leaves and set wholesale.
const flattenForSet = (obj, prefix = '', out = {}) => {
    for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            flattenForSet(v, path, out);
        } else {
            out[path] = v;
        }
    }
    return out;
};

export const getPublicSettings = asyncHandler(async (_req, res) => {
    const doc = await getOrCreate();
    const { _id, key, createdAt, updatedAt, __v, ...publicView } = doc.toObject();
    return ok(res, publicView);
});

export const getAdminSettings = asyncHandler(async (_req, res) => {
    const doc = await getOrCreate();
    return ok(res, doc);
});

export const updateSettings = asyncHandler(async (req, res) => {
    const { key: _ignoredKey, _id: _ignoredId, ...patch } = req.body;
    const doc = await SiteSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: flattenForSet(patch) },
        { new: true, upsert: true, runValidators: true },
    );
    req.audit?.({
        action: 'settings.update',
        resource: 'SiteSettings',
        resourceId: doc._id,
        message: 'Updated site settings',
        after: patch,
    });
    return ok(res, doc, 'Settings updated');
});

// POST /api/admin/site-settings/upload — upload a logo / favicon / og image.
// The cloudinary middleware has already streamed the file and set req.file.path
// to the hosted URL; we just hand that URL back so the form can save it.
export const uploadSettingsImage = asyncHandler(async (req, res) => {
    if (!req.file?.path) throw ApiError.badRequest('No image was uploaded');
    req.audit?.({
        action: 'settings.upload_image',
        resource: 'SiteSettings',
        message: 'Uploaded a settings image',
        meta: { url: req.file.path },
    });
    return ok(res, { url: req.file.path }, 'Image uploaded');
});
