/**
 * Warehouse Migration Script
 *
 * Run ONCE per tenant when enabling multi-warehouse inventory:
 *   node src/scripts/migrate-warehouse-vat.js <tenantId>
 *
 * What it does:
 *   1. Creates a "Default Warehouse" Location document for the tenant
 *   2. Seeds LocationStock records from the flat product.weights[i].stock values
 *   3. Enables features.multiWarehouse in SiteSettings and sets defaultLocationId
 *
 * Safe to re-run: uses $setOnInsert on LocationStock so existing docs are not touched.
 * Does NOT clear product.weights[i].stock — kept as read-only fallback for rollback.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import ProductModel from '../models/product.model.js';
import { LocationModel } from '../models/Location.model.js';
import { LocationStockModel } from '../models/LocationStock.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { runAsTenant } from '../tenancy/tenantContext.js';

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
    console.error('Usage: node src/scripts/migrate-warehouse-vat.js <tenantId>');
    process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(TENANT_ID)) {
    console.error(`Invalid tenantId: "${TENANT_ID}". Must be a 24-character hex ObjectId.`);
    process.exit(1);
}

async function migrate() {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await runAsTenant(TENANT_ID, async () => {
        console.log(`\nMigrating tenant: ${TENANT_ID}`);

        // ── 1. Guard: check if migration was already run ──────────────────────
        const existingSettings = await SiteSettings.findOne({
            tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        }).lean();

        if (existingSettings?.inventory?.defaultLocationId) {
            console.log(
                `\nSkipping: tenant already has defaultLocationId = ${existingSettings.inventory.defaultLocationId}`,
            );
            console.log('If you want to re-run, manually clear inventory.defaultLocationId in SiteSettings first.');
            await mongoose.disconnect();
            return;
        }

        // ── 2. Create or find "Default Warehouse" location ────────────────────
        let defaultLoc = await LocationModel.findOne({ isDefault: true });
        if (!defaultLoc) {
            defaultLoc = await LocationModel.create({
                name: 'Default Warehouse',
                code: 'DEFAULT',
                type: 'warehouse',
                isDefault: true,
                active: true,
            });
            console.log(`Created Default Warehouse: ${defaultLoc._id}`);
        } else {
            console.log(`Reusing existing default location: ${defaultLoc.name} (${defaultLoc._id})`);
        }

        // ── 3. Migrate product stock to LocationStock ─────────────────────────
        const products = await ProductModel.find({});
        console.log(`Found ${products.length} product(s) to process...`);

        let variantsInserted = 0;
        let variantsSkipped = 0;
        let productsProcessed = 0;
        const discrepancies = [];

        for (const product of products) {
            if (!Array.isArray(product.weights) || product.weights.length === 0) continue;

            productsProcessed++;
            for (let i = 0; i < product.weights.length; i++) {
                const variant = product.weights[i];
                const flatStock = typeof variant.stock === 'number' ? variant.stock : 0;

                if (flatStock <= 0) continue;

                // $setOnInsert ensures idempotency: if the doc already exists, nothing changes
                const result = await LocationStockModel.findOneAndUpdate(
                    {
                        productId: product._id,
                        weightIndex: i,
                        locationId: defaultLoc._id,
                    },
                    {
                        $setOnInsert: {
                            stock: flatStock,
                            reservedQty: 0,
                        },
                    },
                    { upsert: true, new: false },
                );

                if (result === null) {
                    // null means doc was newly inserted (upsert fired)
                    variantsInserted++;
                } else {
                    // doc already existed
                    variantsSkipped++;

                    // Parity check
                    if (result.stock !== flatStock) {
                        discrepancies.push({
                            productId: String(product._id),
                            productName: product.name,
                            weightIndex: i,
                            flatStock,
                            locationStock: result.stock,
                        });
                    }
                }
            }
        }

        console.log(`\nStock migration complete:`);
        console.log(`  Products processed : ${productsProcessed}`);
        console.log(`  Variants inserted  : ${variantsInserted}`);
        console.log(`  Variants skipped   : ${variantsSkipped} (already existed)`);

        // ── 4. Report stock discrepancies ─────────────────────────────────────
        if (discrepancies.length > 0) {
            console.warn(`\nWARNING: ${discrepancies.length} stock discrepancy/discrepancies found:`);
            for (const d of discrepancies) {
                console.warn(
                    `  Product "${d.productName}" (${d.productId}) variant ${d.weightIndex}:` +
                    ` flat=${d.flatStock}, locationStock=${d.locationStock}`,
                );
            }
            console.warn('Review and manually correct these before relying on multi-warehouse stock.');
        } else {
            console.log('  Stock parity      : OK (no discrepancies)');
        }

        // ── 5. Update SiteSettings ─────────────────────────────────────────────
        const updateResult = await SiteSettings.findOneAndUpdate(
            { tenantId: new mongoose.Types.ObjectId(TENANT_ID) },
            {
                $set: {
                    'inventory.defaultLocationId': defaultLoc._id,
                    'features.multiWarehouse': true,
                },
            },
            { new: true },
        );

        if (!updateResult) {
            console.error('\nERROR: SiteSettings document not found for this tenant. Migration incomplete.');
            process.exit(1);
        }

        console.log('\nSiteSettings updated:');
        console.log(`  features.multiWarehouse  = true`);
        console.log(`  inventory.defaultLocationId = ${defaultLoc._id}`);

        console.log(`\nMigration complete for tenant ${TENANT_ID}`);
        console.log('Next steps:');
        console.log('  1. Verify stock on the Locations page in Admin');
        console.log('  2. New orders will now use LocationStock for fulfillment');
        console.log('  3. product.weights[i].stock is preserved as read-only fallback');
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
}

migrate().catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
});
