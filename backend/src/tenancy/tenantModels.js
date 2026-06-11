// ── Tenant model registry (the Phase 1 plan, as code) ───────────────────────
// Single source of truth for WHICH collections are partitioned per tenant and
// WHAT index changes each one needs. Phase 0 only declares this; Phase 1 applies
// the tenant plugin to each model below, runs the data back-fill, and converts
// the listed global-unique indexes into compound { tenantId, field } indexes.
//
// Keeping this as a checked-in list means the migration scope is explicit and
// reviewable, and a future automated leak test can iterate over it.

// Collections that belong to ONE tenant. Each gets `tenantId` + the scoping
// plugin in Phase 1. `indexChanges` documents the global-unique indexes that
// must become per-tenant (or the singleton -> per-tenant uniqueness change).
export const TENANT_OWNED_MODELS = [
    { model: 'Admin', file: 'admin.model.js', indexChanges: ['username -> {tenantId, username}', 'email -> {tenantId, email}'] },
    { model: 'Customer', file: 'customer.model.js', indexChanges: ['email -> {tenantId, email}', 'guestId -> {tenantId, guestId}'] },
    { model: 'product', file: 'product.model.js', indexChanges: ['weights.barcode/sku scoped', 'category+createdAt browse index gains tenantId', 'text search runs scoped'] },
    { model: 'category', file: 'category.model.js', indexChanges: ['add tenantId (slug is derived, no unique index today)'] },
    { model: 'Order', file: 'order.model.js', indexChanges: ['orderId -> {tenantId, orderId}', 'idempotencyKey partial -> {tenantId, idempotencyKey}'] },
    { model: 'Payment', file: 'payment.model.js', indexChanges: ['tranId -> {tenantId, tranId}'] },
    { model: 'Coupon', file: 'coupon.model.js', indexChanges: ['code -> {tenantId, code}'] },
    { model: 'Cart', file: 'cart.model.js', indexChanges: ['guestId -> {tenantId, guestId}'] },
    { model: 'Wishlist', file: 'wishlist.model.js', indexChanges: ['guestId -> {tenantId, guestId}'] },
    { model: 'review', file: 'review.model.js', indexChanges: ['scoped to tenant products'] },
    { model: 'Page', file: 'page.model.js', indexChanges: ['slug -> {tenantId, slug}'] },
    { model: 'SiteSettings', file: 'siteSettings.model.js', indexChanges: ['singleton per tenant: key unique -> tenantId unique'] },
    { model: 'Footer', file: 'footer.model.js', indexChanges: ['singleton per tenant: key unique -> tenantId unique'] },
    { model: 'header', file: 'header.model.js', indexChanges: ['singleton per tenant'] },
    { model: 'NavMenuItem', file: 'navMenu.model.js', indexChanges: ['location/parent/order index gains tenantId'] },
    { model: 'Shift', file: 'shift.model.js', indexChanges: ['open-shift unique -> {tenantId, cashier.id} partial'] },
    { model: 'StockMovement', file: 'stockMovement.model.js', indexChanges: ['scoped; reports filter by tenant'] },
    { model: 'AuditLog', file: 'auditLog.model.js', indexChanges: ['tenant-scoped; platform actions logged separately'] },
    { model: 'Otp', file: 'otp.model.js', indexChanges: ['scoped to tenant'] },
    { model: 'CheckoutLead', file: 'checkoutLead.model.js', indexChanges: ['guestId -> {tenantId, guestId}'] },
    { model: 'ContactMessage', file: 'contactMessage.model.js', indexChanges: ['scoped to tenant'] },
];

// Platform-level collections: shared across all tenants, NEVER auto-scoped.
// Accessed only in system context (super-admin / platform code).
export const PLATFORM_MODELS = [
    { model: 'Plan', file: 'plan.model.js', note: 'subscription plans offered to tenants' },
    { model: 'Tenant', file: 'tenant.model.js', note: 'the tenant registry itself' },
    { model: 'Subscription', file: 'subscription.model.js', note: 'tenant<->plan link; carries tenantId as a plain FK' },
    // Legacy/minimal placeholder ({ name, email, password, role:['user','admin'] }).
    // Not used for real auth (Admin + Customer are). Confirm it is dead and
    // remove it, rather than scope it. Tracked as an open item.
    { model: 'User', file: 'user.model.js', note: 'legacy placeholder — verify unused, then delete' },
];

export const tenantOwnedModelNames = () => TENANT_OWNED_MODELS.map((m) => m.model);
