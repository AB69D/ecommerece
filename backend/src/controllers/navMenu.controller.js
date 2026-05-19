import { NavMenuItem } from '../models/navMenu.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created } from '../lib/ApiResponse.js';

const buildTree = (items) => {
    const byId = new Map(items.map((i) => [String(i._id), { ...i.toObject(), children: [] }]));
    const roots = [];
    for (const item of byId.values()) {
        if (item.parent && byId.has(String(item.parent))) {
            byId.get(String(item.parent)).children.push(item);
        } else {
            roots.push(item);
        }
    }
    const sort = (nodes) => {
        nodes.sort((a, b) => a.order - b.order);
        nodes.forEach((n) => sort(n.children));
    };
    sort(roots);
    return roots;
};

export const listMenu = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.location) filter.location = req.query.location;
    if (req.query.visible !== undefined) filter.isVisible = req.query.visible !== 'false';

    const items = await NavMenuItem.find(filter).sort({ location: 1, order: 1 });
    return ok(res, buildTree(items));
});

export const listMenuFlat = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.location) filter.location = req.query.location;
    const items = await NavMenuItem.find(filter).sort({ location: 1, order: 1 });
    return ok(res, items);
});

export const createMenuItem = asyncHandler(async (req, res) => {
    const item = await NavMenuItem.create(req.body);
    return created(res, item, 'Menu item created');
});

export const updateMenuItem = asyncHandler(async (req, res) => {
    const item = await NavMenuItem.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!item) throw ApiError.notFound('Menu item not found');
    return ok(res, item, 'Menu item updated');
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
    const item = await NavMenuItem.findByIdAndDelete(req.params.id);
    if (!item) throw ApiError.notFound('Menu item not found');
    // Also detach children so they don't orphan.
    await NavMenuItem.updateMany({ parent: req.params.id }, { $set: { parent: null } });
    return ok(res, { id: req.params.id }, 'Menu item deleted');
});

export const reorderMenu = asyncHandler(async (req, res) => {
    const { items } = req.body; // [{ id, order, parent? }]
    if (!Array.isArray(items)) throw ApiError.badRequest('items must be an array');
    await Promise.all(
        items.map((i) =>
            NavMenuItem.findByIdAndUpdate(i.id, {
                order: i.order,
                ...(i.parent !== undefined ? { parent: i.parent || null } : {}),
            }),
        ),
    );
    return ok(res, { updated: items.length }, 'Reorder complete');
});
