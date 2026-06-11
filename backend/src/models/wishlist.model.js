import { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// A guest's saved-for-later products. Mirrors the cart's guestId-keyed model so
// the same anonymous identity (the `guest-id` header) carries the wishlist
// across visits without requiring a customer account. Items are stored at the
// product level (not per-weight): the heart on a card toggles the whole
// product, and the wishlist page links through to pick a variant.
const wishlistItemSchema = new Schema(
    {
        productId: { type: String, required: true },
        productName: { type: String, default: '' },
        productImage: { type: String, default: '' },
        category: { type: String, default: '' },
        // Snapshot of the representative (lowest) variant for list display.
        price: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const wishlistSchema = new Schema(
    {
        guestId: { type: String, required: true, index: true },
        items: [wishlistItemSchema],
    },
    { timestamps: true },
);

wishlistSchema.plugin(tenantPlugin);

// One wishlist per guest PER TENANT (was global-unique on guestId).
wishlistSchema.index({ tenantId: 1, guestId: 1 }, { unique: true });

const WishlistModel = model('Wishlist', wishlistSchema);

export default WishlistModel;
