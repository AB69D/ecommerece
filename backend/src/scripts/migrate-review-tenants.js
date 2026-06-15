/**
 * One-time migration: re-assign reviews to the correct tenant.
 *
 * Before the multer/AsyncLocalStorage fix (commit 2ef0653), reviews submitted
 * from any storefront were silently saved under the PRIMARY tenant instead of
 * the storefront's own tenant. This script fixes those misrouted records by
 * looking up each review's product → reading the product's tenantId → updating
 * the review to match.
 *
 * Safe to run multiple times (idempotent: skips reviews that already have the
 * correct tenantId).
 *
 * Run from the backend directory:
 *   node src/scripts/migrate-review-tenants.js
 *
 * Dry-run (preview only, no DB writes):
 *   DRY_RUN=true node src/scripts/migrate-review-tenants.js
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';

const DRY_RUN = process.env.DRY_RUN === 'true';

const reviewSchema = new mongoose.Schema({
    tenantId: mongoose.Types.ObjectId,
    product: mongoose.Types.ObjectId,
}, { collection: 'reviews', strict: false });

const productSchema = new mongoose.Schema({
    tenantId: mongoose.Types.ObjectId,
}, { collection: 'products', strict: false });

async function main() {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Review = mongoose.model('_MigReview', reviewSchema);
    const Product = mongoose.model('_MigProduct', productSchema);

    const reviews = await Review.find({}).lean();
    console.log(`Found ${reviews.length} total review(s)`);

    let fixed = 0;
    let skipped = 0;

    for (const review of reviews) {
        if (!review.product) { skipped++; continue; }

        const product = await Product.findById(review.product).lean();
        if (!product) { skipped++; continue; }

        const correctTenantId = product.tenantId;
        if (!correctTenantId) { skipped++; continue; }

        if (String(review.tenantId) === String(correctTenantId)) {
            skipped++;
            continue;
        }

        console.log(
            `Review ${review._id}: tenantId ${review.tenantId} → ${correctTenantId}` +
            ` (product ${review.product}, reviewer: ${review.name || 'anon'})`
        );

        if (!DRY_RUN) {
            await Review.updateOne({ _id: review._id }, { $set: { tenantId: correctTenantId } });
        }
        fixed++;
    }

    console.log(`\nDone. Fixed: ${fixed}, already-correct/skipped: ${skipped}${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);
    await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
