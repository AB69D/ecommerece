/**
 * Test infrastructure for Ab9dEcommerce
 *
 * Provides:
 *  - MongoMemoryServer lifecycle (call setupTestDb / teardownTestDb in
 *    beforeAll / afterAll, or use the self-contained `withTestDb` wrapper)
 *  - createTestTenant(overrides?)   — seeds a Tenant + owning Admin
 *  - createTestProduct(tenantId, overrides?) — seeds a Product
 *  - createTestCoupon(tenantId, overrides?) — seeds a Coupon
 *  - createTestCart(tenantId, guestId, items) — seeds a Cart
 *  - runAsTenant(tenantId, fn)      — re-exported from tenantContext
 *  - runAsSystem(fn)                — re-exported from tenantContext
 *
 * Design decisions
 * ─────────────────
 * • We use `mongoose.createConnection()` per suite (not the global mongoose
 *   singleton) to avoid model-registry collisions when tests run in parallel.
 *   All models created here are bound to the test connection.
 * • The default tenantId is reset to null before each suite so tests that
 *   rely on explicit `runAsTenant` calls are not polluted by a residual
 *   bootstrap default from server.js.
 * • Helpers return the created Mongoose document (not .lean()) so callers
 *   can read `._id` directly without extra casting.
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { tenantPlugin } from '../tenancy/tenantPlugin.js';
import {
    runAsTenant,
    runAsSystem,
    setDefaultTenantId,
} from '../tenancy/tenantContext.js';

// ── Re-exports so test files need only one import ──────────────────────────
export { runAsTenant, runAsSystem };

// ── Module-level state shared across helpers ────────────────────────────────
let _mongod = null;
let _conn   = null;

// Model registry keyed by connection uri so helpers always use the live conn.
const _models = {};

// ── Connection lifecycle ────────────────────────────────────────────────────

/**
 * Spin up an in-process MongoDB and open a Mongoose connection to it.
 * Call once in beforeAll. Returns { mongod, conn }.
 */
export const setupTestDb = async () => {
    _mongod = await MongoMemoryServer.create();
    _conn   = await mongoose
        .createConnection(_mongod.getUri(), { dbName: 'test_ab9d' })
        .asPromise();

    // Guarantee no legacy default tenant bleeds in from server.js bootstrap.
    setDefaultTenantId(null);

    _registerModels(_conn);

    return { mongod: _mongod, conn: _conn };
};

/**
 * Close connection and stop the in-process MongoDB.
 * Call once in afterAll.
 */
export const teardownTestDb = async () => {
    if (_conn)  await _conn.close();
    if (_mongod) await _mongod.stop();
    _conn  = null;
    _mongod = null;
};

/**
 * Drop every collection between tests (fast; cheaper than stopping/restarting
 * the server). Call in beforeEach.
 */
export const clearDb = async () => {
    if (!_conn) throw new Error('clearDb: call setupTestDb first');
    const collections = Object.values(_conn.collections);
    await Promise.all(collections.map((c) => c.deleteMany({}, { _tenantBypass: true })));
};

// ── Internal model registration ─────────────────────────────────────────────

function _registerModels(conn) {
    // ---- Tenant (not tenant-owned; no plugin) ----------------------------
    if (!_models.Tenant) {
        const tenantSchema = new mongoose.Schema({
            businessName: { type: String, required: true, trim: true },
            subdomain: {
                type: String, required: true, unique: true,
                lowercase: true, trim: true,
            },
            status: {
                type: String,
                enum: ['pending', 'approved', 'suspended', 'rejected'],
                default: 'approved',
            },
            isPrimary: { type: Boolean, default: false },
            ownerAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            ownerEmail: { type: String, trim: true, lowercase: true },
            billing: {
                status: { type: String, default: 'active' },
                currentPeriodSales: { type: Number, default: 0 },
                balanceDue: { type: Number, default: 0 },
            },
        }, { timestamps: true });

        _models.Tenant = conn.model('Tenant', tenantSchema);
    }

    // ---- Admin (tenant-scoped) -------------------------------------------
    if (!_models.Admin) {
        const adminSchema = new mongoose.Schema({
            username: {
                type: String, required: true, lowercase: true, trim: true,
                minlength: 3, maxlength: 64,
            },
            passwordHash: { type: String, required: true, select: false },
            email: { type: String, lowercase: true, trim: true },
            fullName: { type: String, default: '', trim: true },
            role: {
                type: String,
                enum: ['super-admin', 'admin', 'moderator', 'salesman'],
                default: 'admin',
            },
            permissions: { type: [String], default: [] },
            isActive: { type: Boolean, default: true },
            isPlatformOwner: { type: Boolean, default: false },
        }, { timestamps: true });
        adminSchema.plugin(tenantPlugin);
        adminSchema.index({ username: 1 }, { unique: true });
        _models.Admin = conn.model('Admin', adminSchema);
    }

    // ---- Category (required FK for products) ----------------------------
    if (!_models.Category) {
        const catSchema = new mongoose.Schema({
            category_name: { type: String },
            category_image: { type: String },
        }, { timestamps: true });
        catSchema.plugin(tenantPlugin);
        _models.Category = conn.model('category', catSchema);
    }

    // ---- Product ---------------------------------------------------------
    if (!_models.Product) {
        const weightSchema = new mongoose.Schema({
            weight:          { type: String, required: true },
            stock:           { type: Number, default: 0 },
            price:           { type: Number, required: true },
            discountPercent: { type: Number, default: 0, min: 0, max: 100 },
            costPrice:       { type: Number, default: 0 },
            sku:             { type: String, default: '', trim: true },
            barcode:         { type: String, default: '', trim: true },
            images:          { type: Array, default: [] },
        }, { _id: false });

        const productSchema = new mongoose.Schema({
            cover_image: { type: String, default: '' },
            firstName:   { type: String, required: true },
            lastName:    { type: String, default: '' },
            category:    { type: mongoose.Schema.Types.ObjectId, ref: 'category', required: true },
            weights:     [weightSchema],
            description: { type: String, default: '' },
            showInEcommerce: { type: Boolean, default: true },
        }, { timestamps: true });
        productSchema.plugin(tenantPlugin);
        _models.Product = conn.model('product', productSchema);
    }

    // ---- Order -----------------------------------------------------------
    if (!_models.Order) {
        const orderItemSchema = new mongoose.Schema({
            productId:   { type: String, default: '' },
            productName: { type: String, default: '' },
            productImage:{ type: String, default: '' },
            quantity:    { type: Number, required: true, min: 1 },
            weight:      { type: String, default: '' },
            price:       { type: Number, required: true },
            totalPrice:  { type: Number, required: true },
            costPrice:   { type: Number, default: 0 },
            weightIndex: { type: Number, default: 0 },
        });

        const orderSchema = new mongoose.Schema({
            orderId:         { type: String, required: true },
            source:          { type: String, enum: ['ecommerce', 'pos'], default: 'ecommerce' },
            guestId:         { type: String, required: true },
            customerName:    { type: String, required: true },
            customerPhone:   { type: String, required: true },
            customerEmail:   String,
            shippingAddress: { type: String, required: true },
            city:            String,
            items:           [orderItemSchema],
            subtotal:        { type: Number, required: true },
            deliveryCharge:  { type: Number, default: 0 },
            couponCode:      { type: String, default: '' },
            discount:        { type: Number, default: 0 },
            totalAmount:     { type: Number, required: true },
            paymentMethod: {
                type: String,
                enum: ['cash_on_delivery', 'online', 'cash', 'card', 'bkash', 'nagad', 'rocket'],
                default: 'cash_on_delivery',
            },
            paymentStatus: {
                type: String,
                enum: ['pending', 'paid', 'failed', 'refunded'],
                default: 'pending',
            },
            orderStatus: {
                type: String,
                enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
                default: 'pending',
            },
            idempotencyKey: { type: String },
            customerId:     { type: String, default: null },
            notes:          String,
        }, { timestamps: true });

        orderSchema.plugin(tenantPlugin);
        orderSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });
        orderSchema.index(
            { tenantId: 1, idempotencyKey: 1 },
            { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
        );
        _models.Order = conn.model('Order', orderSchema);
    }

    // ---- Coupon ---------------------------------------------------------
    if (!_models.Coupon) {
        const couponSchema = new mongoose.Schema({
            code:        { type: String, required: true, uppercase: true, trim: true },
            description: { type: String, default: '' },
            type:        { type: String, enum: ['percent', 'fixed'], default: 'percent' },
            value:       { type: Number, required: true, min: 0 },
            minSubtotal: { type: Number, default: 0 },
            maxDiscount: { type: Number, default: 0 },
            startsAt:    { type: Date, default: null },
            expiresAt:   { type: Date, default: null },
            usageLimit:  { type: Number, default: 0 },
            usedCount:   { type: Number, default: 0 },
            channels:    { type: [{ type: String, enum: ['ecommerce', 'pos'] }], default: ['ecommerce', 'pos'] },
            active:      { type: Boolean, default: true },
        }, { timestamps: true });
        couponSchema.plugin(tenantPlugin);
        couponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
        _models.Coupon = conn.model('Coupon', couponSchema);
    }

    // ---- Cart -----------------------------------------------------------
    if (!_models.Cart) {
        const cartItemSchema = new mongoose.Schema({
            productId:      { type: String, default: null },
            productName:    { type: String, default: '' },
            productImage:   { type: String, default: '' },
            quantity:       { type: Number, default: 1, min: 1 },
            weight:         { type: String, default: '' },
            weightIndex:    { type: Number, default: 0 },
            price:          { type: Number, default: 0 },
            discountPercent:{ type: Number, default: 0 },
        }, { _id: true });

        const cartSchema = new mongoose.Schema({
            guestId:     { type: String, required: true },
            items:       [cartItemSchema],
            totalAmount: { type: Number, default: 0 },
        }, { timestamps: true });
        cartSchema.plugin(tenantPlugin);
        cartSchema.index({ tenantId: 1, guestId: 1 }, { unique: true });
        _models.Cart = conn.model('Cart', cartSchema);
    }

    // ---- SiteSettings ---------------------------------------------------
    if (!_models.SiteSettings) {
        const ssSchema = new mongoose.Schema({
            key: { type: String, default: 'global', immutable: true },
            delivery: {
                localCharge:    { type: Number, default: 70 },
                regionalCharge: { type: Number, default: 100 },
            },
            features: {
                coupons:      { type: Boolean, default: true },
                stockLedger:  { type: Boolean, default: false }, // off in tests: no StockMovement model
            },
            pos: {
                allowNegativeStock: { type: Boolean, default: false },
            },
        }, { timestamps: true });
        ssSchema.plugin(tenantPlugin);
        ssSchema.index({ tenantId: 1, key: 1 }, { unique: true });
        _models.SiteSettings = conn.model('SiteSettings', ssSchema);
    }
}

// ── Exported model accessor ─────────────────────────────────────────────────
// Tests import getModels() instead of the real model files so everything
// resolves against the in-memory connection (not the real DB singleton).

export const getModels = () => {
    if (!_conn) throw new Error('getModels: call setupTestDb first');
    return _models;
};

// ── Seed helpers ────────────────────────────────────────────────────────────

let _tenantSeq = 0;

/**
 * createTestTenant(overrides?)
 *
 * Creates a Tenant document plus an owning Admin scoped to it.
 * Returns { tenant, admin }.
 *
 * The Admin is created inside a runAsTenant() call so the tenantPlugin stamps
 * the correct tenantId. The Tenant itself is not tenant-owned (it IS the
 * tenant), so it is created outside any ALS context.
 */
export const createTestTenant = async (overrides = {}) => {
    const { Tenant, Admin } = _models;
    if (!Tenant || !Admin) throw new Error('createTestTenant: call setupTestDb first');

    const seq = ++_tenantSeq;
    const subdomain = overrides.subdomain ?? `test-store-${seq}-${Date.now()}`;

    const tenant = await Tenant.create({
        businessName: overrides.businessName ?? `Test Store ${seq}`,
        subdomain,
        status: 'approved',
        ownerEmail: overrides.ownerEmail ?? `owner${seq}@test.com`,
        ...overrides,
    });

    // Admin must be created in the tenant's ALS context so tenantPlugin stamps it.
    const admin = await runAsTenant(tenant._id, () =>
        Admin.create({
            username:     overrides.adminUsername ?? `admin${seq}${Date.now()}`,
            passwordHash: bcrypt.hashSync('test-password', 1), // rounds=1: fast for tests
            email:        overrides.ownerEmail ?? `owner${seq}@test.com`,
            fullName:     `Admin ${seq}`,
            role:         'super-admin',
        }),
    );

    // Back-link tenant -> admin.
    await Tenant.updateOne({ _id: tenant._id }, { ownerAdminId: admin._id });

    return { tenant, admin };
};

/**
 * createTestProduct(tenantId, overrides?)
 *
 * Creates a Product document with sensible defaults inside tenantId's context.
 * `overrides.weights` can replace the single default variant entirely.
 *
 * Returns the created Product document.
 */
export const createTestProduct = async (tenantId, overrides = {}) => {
    const { Product, Category } = _models;
    if (!Product) throw new Error('createTestProduct: call setupTestDb first');

    // Ensure a category exists (required FK). Re-use if already present.
    let category = await runAsTenant(tenantId, () =>
        Category.findOne().lean(),
    );
    if (!category) {
        category = await runAsTenant(tenantId, () =>
            Category.create({ category_name: 'Test Category' }),
        );
    }

    const defaultWeights = [
        {
            weight:          overrides.weight ?? '1kg',
            stock:           overrides.stock  ?? 10,
            price:           overrides.price  ?? 100,
            discountPercent: overrides.discountPercent ?? 0,
            costPrice:       overrides.costPrice ?? 50,
            sku:             '',
            barcode:         '',
        },
    ];

    return runAsTenant(tenantId, () =>
        Product.create({
            firstName:   overrides.firstName ?? 'Test Product',
            lastName:    overrides.lastName  ?? '',
            category:    category._id,
            weights:     overrides.weights ?? defaultWeights,
            description: overrides.description ?? '',
            ...overrides,
            // Prevent stray overrides from being spread into the wrong fields:
            weight:      undefined,
            stock:       undefined,
            price:       undefined,
            discountPercent: undefined,
            costPrice:   undefined,
        }),
    );
};

/**
 * createTestCoupon(tenantId, overrides?)
 *
 * Creates a Coupon inside tenantId's context.
 * Key defaults: 10% percent coupon, active, unlimited usage.
 *
 * Returns the created Coupon document.
 */
export const createTestCoupon = async (tenantId, overrides = {}) => {
    const { Coupon } = _models;
    if (!Coupon) throw new Error('createTestCoupon: call setupTestDb first');

    return runAsTenant(tenantId, () =>
        Coupon.create({
            code:       overrides.code       ?? `TEST${Date.now()}`,
            type:       overrides.type       ?? 'percent',
            value:      overrides.value      ?? 10,
            active:     overrides.active     ?? true,
            usageLimit: overrides.usageLimit ?? 0,
            usedCount:  overrides.usedCount  ?? 0,
            channels:   overrides.channels   ?? ['ecommerce', 'pos'],
            minSubtotal:overrides.minSubtotal ?? 0,
            maxDiscount:overrides.maxDiscount ?? 0,
            ...overrides,
        }),
    );
};

/**
 * createTestCart(tenantId, guestId, items?)
 *
 * Seeds a Cart document for the given guest inside tenantId's context.
 * `items` is an array of cartItemSchema-compatible objects.
 * `totalAmount` is auto-summed from items if not supplied.
 *
 * Returns the created Cart document.
 */
export const createTestCart = async (tenantId, guestId, items = [], totalAmount = null) => {
    const { Cart } = _models;
    if (!Cart) throw new Error('createTestCart: call setupTestDb first');

    const computed = items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);

    return runAsTenant(tenantId, () =>
        Cart.create({
            guestId,
            items,
            totalAmount: totalAmount ?? computed,
        }),
    );
};

/**
 * placeOrder(tenantId, orderFields)
 *
 * Low-level helper: creates an Order directly via Mongoose (bypasses the HTTP
 * route) inside tenantId's ALS context. Useful for test setup and for tests
 * that verify model-layer behavior rather than the HTTP layer.
 *
 * Returns the saved Order document.
 */
export const placeOrder = async (tenantId, fields) => {
    const { Order } = _models;
    if (!Order) throw new Error('placeOrder: call setupTestDb first');

    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();

    return runAsTenant(tenantId, () =>
        Order.create({
            orderId:         fields.orderId         ?? `TEST-${ts}${rnd}`,
            guestId:         fields.guestId         ?? `guest-${ts}`,
            customerName:    fields.customerName    ?? 'Test Customer',
            customerPhone:   fields.customerPhone   ?? '01700000000',
            shippingAddress: fields.shippingAddress ?? '123 Test St',
            items:           fields.items           ?? [],
            subtotal:        fields.subtotal        ?? 0,
            deliveryCharge:  fields.deliveryCharge  ?? 0,
            totalAmount:     fields.totalAmount     ?? 0,
            paymentMethod:   fields.paymentMethod   ?? 'cash_on_delivery',
            ...fields,
        }),
    );
};
