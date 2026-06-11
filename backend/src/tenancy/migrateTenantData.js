import { logger } from '../lib/logger.js';

// Import every tenant-owned model directly. Two reasons:
//   1) It guarantees all 21 schemas are REGISTERED (and therefore carry the
//      tenant plugin + new indexes) by the time bootstrap runs — independent of
//      whichever controllers happen to have been imported.
//   2) We hold a direct reference to each model, so we never look one up by name
//      via mongoose.model('Name') — which would be fragile because a few models
//      register lowercase names ('product', 'category', 'review', 'header').
import AdminModel from '../models/admin.model.js';
import CustomerModel from '../models/customer.model.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import OrderModel from '../models/order.model.js';
import PaymentModel from '../models/payment.model.js';
import CouponModel from '../models/coupon.model.js';
import CartModel from '../models/cart.model.js';
import WishlistModel from '../models/wishlist.model.js';
import ReviewModel from '../models/review.model.js';
import { Page } from '../models/page.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { Footer } from '../models/footer.model.js';
import HeaderModel from '../models/header.model.js';
import { NavMenuItem } from '../models/navMenu.model.js';
import ShiftModel from '../models/shift.model.js';
import StockMovementModel from '../models/stockMovement.model.js';
import AuditLogModel from '../models/auditLog.model.js';
import OtpModel from '../models/otp.model.js';
import CheckoutLeadModel from '../models/checkoutLead.model.js';
import ContactMessageModel from '../models/contactMessage.model.js';

// The full set of tenant-owned models. MUST mirror TENANT_OWNED_MODELS in
// tenantModels.js (kept as references here, as names there).
const TENANT_MODELS = [
    AdminModel,
    CustomerModel,
    ProductModel,
    CategoryModel,
    OrderModel,
    PaymentModel,
    CouponModel,
    CartModel,
    WishlistModel,
    ReviewModel,
    Page,
    SiteSettings,
    Footer,
    HeaderModel,
    NavMenuItem,
    ShiftModel,
    StockMovementModel,
    AuditLogModel,
    OtpModel,
    CheckoutLeadModel,
    ContactMessageModel,
];

export const tenantModelCount = () => TENANT_MODELS.length;

// ── Phase 1 data migration: back-fill tenantId (idempotent) ─────────────────
// Stamp `tenantId` onto every legacy (pre-tenancy) document so the scoping
// plugin returns them under the primary tenant. Uses the NATIVE driver so it:
//   • bypasses the plugin's save/update hooks (no re-scoping, no surprises), and
//   • matches ONLY rows that still lack the field ({ $exists: false }), making
//     it a safe no-op on every subsequent boot.
//
// Runs BEFORE the server accepts traffic (called from bootstrap, pre-listen).
// Because the plugin is now active and a default tenant is set, an un-stamped
// document would be invisible to scoped reads — so if this throws, we WANT boot
// to fail loudly (the process restarts and retries) rather than serve a
// half-migrated database. We therefore do NOT swallow errors here.
export async function backfillTenantId(tenantId) {
    let total = 0;
    for (const Model of TENANT_MODELS) {
        const res = await Model.collection.updateMany(
            { tenantId: { $exists: false } },
            { $set: { tenantId } },
        );
        const n = res.modifiedCount || 0;
        if (n > 0) {
            logger.info(`Backfill: ${Model.modelName} += tenantId on ${n} doc(s)`);
            total += n;
        }
    }
    if (total > 0) {
        logger.info(`Backfill: stamped tenantId on ${total} legacy document(s) total`);
    }
    return total;
}

// ── Phase 1 index reconciliation ────────────────────────────────────────────
// Build the new { tenantId, ... } indexes and DROP the old global-unique ones
// that no longer match the schema (e.g. username_1 -> tenantId_1_username_1).
// syncIndexes() diffs the schema against the collection, creating the missing
// indexes and dropping the extras.
//
// Also runs pre-listen, so there is never a window under load where a uniqueness
// rule is missing. Non-fatal PER MODEL: a stale/old unique index that fails to
// drop is harmless while there is a single tenant (it still enforces the same
// constraint), so one collection's index hiccup must not block the whole boot.
export async function syncTenantIndexes() {
    let ok = 0;
    for (const Model of TENANT_MODELS) {
        try {
            await Model.syncIndexes();
            ok += 1;
        } catch (err) {
            logger.error({ err, model: Model.modelName }, 'syncIndexes failed (continuing)');
        }
    }
    logger.info(`Index sync: reconciled ${ok}/${TENANT_MODELS.length} tenant-owned models`);
    return ok;
}
