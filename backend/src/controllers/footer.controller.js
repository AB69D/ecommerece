import { Footer } from '../models/footer.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';

const getOrCreate = async () => {
    let doc = await Footer.findOne({ key: 'global' });
    if (!doc) doc = await Footer.create({ key: 'global' });
    return doc;
};

export const getFooter = asyncHandler(async (_req, res) => {
    const doc = await getOrCreate();
    return ok(res, doc);
});

export const updateFooter = asyncHandler(async (req, res) => {
    const { key: _ignoredKey, _id: _ignoredId, ...patch } = req.body;
    const doc = await Footer.findOneAndUpdate(
        { key: 'global' },
        { $set: patch },
        { new: true, upsert: true, runValidators: true },
    );
    return ok(res, doc, 'Footer updated');
});
