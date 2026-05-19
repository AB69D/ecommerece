import { SiteSettings } from '../models/siteSettings.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';

const getOrCreate = async () => {
    let doc = await SiteSettings.findOne({ key: 'global' });
    if (!doc) doc = await SiteSettings.create({ key: 'global' });
    return doc;
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
        { $set: patch },
        { new: true, upsert: true, runValidators: true },
    );
    return ok(res, doc, 'Settings updated');
});
