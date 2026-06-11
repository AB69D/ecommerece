import mongoose from "mongoose";
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const weightSchema = new mongoose.Schema({
    weight: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Cost price for this variant — used for profit / margin reporting (Phase 2).
    costPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    // Stock-keeping unit + scannable barcode (Phase 1). Both optional; a barcode
    // is auto-generated on save when left blank so every variant is scannable.
    sku: {
        type: String,
        default: '',
        trim: true
    },
    barcode: {
        type: String,
        default: '',
        trim: true
    },
    images: {
        type: Array,
        default: []
    }
}, { _id: false });

const qaSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    }
}, { _id: true });

const productSchema = new mongoose.Schema({
    cover_image: {
        type: String,
        default: ""
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        default: ""
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'category',
        required: true
    },
    weights: [weightSchema],
    description: {
        type: String,
        default: ""
    },
    qa: [qaSchema],
    // When false, the product is hidden from the public e-commerce storefront
    // but still sellable at the POS terminal. Defaults to true so existing
    // products (and the common case) stay visible online.
    showInEcommerce: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});

productSchema.index({
    firstName: "text",
    lastName: "text",
    description: 'text'
});

// Fast scanner lookups by barcode / SKU (sparse-ish; blanks are filtered out
// at query time so empty strings don't all collide on a unique index).
productSchema.index({ tenantId: 1, 'weights.barcode': 1 });
productSchema.index({ tenantId: 1, 'weights.sku': 1 });

// Storefront browse paths, both of which sort newest-first:
//   - category page:  find({ category, showInEcommerce }).sort({ createdAt: -1 })
//   - default list:   find({ showInEcommerce }).sort({ createdAt: -1 })
// The compound index serves the category filter + sort together; the standalone
// createdAt index serves the unfiltered newest-first listing.
productSchema.index({ tenantId: 1, category: 1, createdAt: -1 });
productSchema.index({ tenantId: 1, createdAt: -1 });

// Build a GS1 "internal use" (prefix 2) numeric barcode that any CODE128
// reader can scan. Kept self-contained so every variant is always scannable
// even if the admin never types one in.
const genBarcode = (index = 0) => {
    const ts = String(Date.now()).slice(-8);
    const rand = String(Math.floor(Math.random() * 90) + 10); // 2 digits
    const idx = String(index % 100).padStart(2, '0');
    return `2${ts}${rand}${idx}`; // 13 digits
};

const slug3 = (s = '') => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'PRD';

// Fill a single variant's blank barcode / SKU in place and return it. Shared
// by the pre('save') hook and the update controller (updateOne skips hooks),
// so a variant is guaranteed scannable however it was written.
const ensureVariantCodes = (w, index = 0, firstName = '') => {
    if (!w || typeof w !== 'object') return w;
    if (!w.barcode || !String(w.barcode).trim()) {
        w.barcode = genBarcode(index);
    }
    if (!w.sku || !String(w.sku).trim()) {
        const wt = String(w.weight || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        w.sku = `${slug3(firstName)}-${wt || index + 1}-${String(w.barcode).slice(-4)}`;
    }
    return w;
};

// Auto-fill blank barcode / SKU before saving so the catalogue is scannable.
productSchema.pre('save', function autoCodes(next) {
    if (Array.isArray(this.weights)) {
        this.weights.forEach((w, i) => ensureVariantCodes(w, i, this.firstName));
    }
    next();
});

productSchema.plugin(tenantPlugin);
// NB: the $text index above stays global; tenant isolation on search is still
// enforced because the plugin appends { tenantId } to the query filter. A
// compound text index ({ tenantId, ...text }) is a later perf optimization.

const ProductModel = mongoose.model('product', productSchema);

export { genBarcode, ensureVariantCodes };
export default ProductModel;