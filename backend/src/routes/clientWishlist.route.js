import { Router } from 'express';
import WishlistModel from '../models/wishlist.model.js';

// Public storefront wishlist. Like the cart, it is keyed by the anonymous
// `guest-id` header (no customer login required) and echoes that id back so a
// freshly-minted guest keeps the same identity for subsequent calls.
const clientWishlistRouter = Router();

const getGuestId = (req) => req.headers['guest-id'] || null;

const ensureWishlist = async (guestId) => {
    let wishlist = await WishlistModel.findOne({ guestId });
    if (!wishlist) wishlist = new WishlistModel({ guestId, items: [] });
    return wishlist;
};

// GET /get — fetch (and lazily create) the guest's wishlist.
clientWishlistRouter.get('/get', async (req, res) => {
    try {
        let guestId = getGuestId(req);
        if (!guestId) guestId = `guest_${Date.now()}`;

        const wishlist = await ensureWishlist(guestId);
        if (wishlist.isNew) await wishlist.save();

        res.setHeader('guest-id', guestId);
        res.json({ message: 'Wishlist data', data: wishlist, error: false, success: true });
    } catch (error) {
        console.error('Wishlist get error:', error);
        res.status(500).json({ message: error.message, error: true, success: false });
    }
});

// POST /toggle — add the product if absent, remove it if present. Returns the
// updated wishlist plus `added` so the client knows which way it went.
clientWishlistRouter.post('/toggle', async (req, res) => {
    try {
        const { productId, productName, productImage, category, price = 0, discountPercent = 0 } = req.body;
        let guestId = getGuestId(req);
        if (!guestId) guestId = `guest_${Date.now()}`;

        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required', error: true, success: false });
        }

        const wishlist = await ensureWishlist(guestId);
        const idx = wishlist.items.findIndex((it) => String(it.productId) === String(productId));

        let added;
        if (idx > -1) {
            wishlist.items.splice(idx, 1);
            added = false;
        } else {
            wishlist.items.push({
                productId: String(productId),
                productName: productName || '',
                productImage: productImage || '',
                category: category || '',
                price: Number(price) || 0,
                discountPercent: Number(discountPercent) || 0,
                addedAt: new Date(),
            });
            added = true;
        }

        await wishlist.save();
        res.setHeader('guest-id', guestId);
        res.json({
            message: added ? 'Added to wishlist' : 'Removed from wishlist',
            data: wishlist,
            added,
            error: false,
            success: true,
        });
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({ message: error.message, error: true, success: false });
    }
});

// DELETE /remove/:productId — drop a single product.
clientWishlistRouter.delete('/remove/:productId', async (req, res) => {
    try {
        const guestId = getGuestId(req);
        if (!guestId) {
            return res.status(400).json({ message: 'Guest ID required', error: true, success: false });
        }
        const wishlist = await WishlistModel.findOne({ guestId });
        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found', error: true, success: false });
        }
        wishlist.items = wishlist.items.filter((it) => String(it.productId) !== String(req.params.productId));
        await wishlist.save();
        res.json({ message: 'Item removed', data: wishlist, error: false, success: true });
    } catch (error) {
        console.error('Wishlist remove error:', error);
        res.status(500).json({ message: error.message, error: true, success: false });
    }
});

// DELETE /clear — empty the wishlist.
clientWishlistRouter.delete('/clear', async (req, res) => {
    try {
        const guestId = getGuestId(req);
        if (!guestId) {
            return res.status(400).json({ message: 'Guest ID required', error: true, success: false });
        }
        const wishlist = await WishlistModel.findOne({ guestId });
        if (wishlist) {
            wishlist.items = [];
            await wishlist.save();
        }
        res.json({ message: 'Wishlist cleared', data: wishlist || { guestId, items: [] }, error: false, success: true });
    } catch (error) {
        console.error('Wishlist clear error:', error);
        res.status(500).json({ message: error.message, error: true, success: false });
    }
});

export default clientWishlistRouter;
