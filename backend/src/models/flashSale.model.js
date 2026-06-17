import mongoose, { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// Each item in a flash sale is a specific product variant (productId + weightIndex)
// sold at a reduced salePrice. maxQty caps how many units can be sold at the flash
// price across all orders; null means unlimited. soldQty is atomically incremented
// at checkout — never decremented — so the counter is monotonically correct even
// under concurrent load.
const flashSaleItemSchema = new Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'product',
            required: true,
        },
        // Snapshot of the product name at the time the item was added to the sale
        // so the admin list still shows something useful even if the product is later
        // renamed or deleted.
        productName: { type: String, default: '' },
        weightIndex: { type: Number, required: true },   // index into product.weights[]
        weightLabel: { type: String, default: '' },       // snapshot of product.weights[weightIndex].weight
        salePrice: { type: Number, required: true, min: 0 },
        maxQty: { type: Number, default: null },          // null = unlimited
        soldQty: { type: Number, default: 0, min: 0 },   // atomically incremented at checkout
    },
    { _id: true },
);

const flashSaleSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        startsAt: { type: Date, required: true },
        endsAt: { type: Date, required: true },
        // Master toggle — an admin can disable a sale early without deleting it.
        active: { type: Boolean, default: true },
        items: [flashSaleItemSchema],
    },
    { timestamps: true },
);

flashSaleSchema.plugin(tenantPlugin);

// Fast queries for "what flash sales are live right now?"
flashSaleSchema.index({ tenantId: 1, startsAt: 1, endsAt: 1, active: 1 });

// Fast lookup by product: "does this product have a live flash price?"
flashSaleSchema.index({ tenantId: 1, 'items.productId': 1, endsAt: 1 });

const FlashSaleModel = model('FlashSale', flashSaleSchema);

export default FlashSaleModel;
