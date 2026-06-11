import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../lib/ApiResponse.js';
import CustomerModel from '../models/customer.model.js';
import CartModel from '../models/cart.model.js';
import WishlistModel from '../models/wishlist.model.js';
import OrderModel from '../models/order.model.js';

const BCRYPT_ROUNDS = 10;
// Storefront sessions are long-lived (unlike the 12h admin session) so shoppers
// stay signed in across visits. The live-record reload in the middleware still
// enforces deactivation immediately.
const TOKEN_TTL = '30d';

const signToken = (customer) =>
    jwt.sign(
        { sub: customer._id.toString(), type: 'customer', email: customer.email },
        env.JWT_SECRET,
        { expiresIn: TOKEN_TTL },
    );

// Shape returned to the client — never includes passwordHash.
const publicCustomer = (c) => ({
    id: c._id,
    name: c.name,
    email: c.email,
    phone: c.phone || '',
    guestId: c.guestId,
    addresses: c.addresses || [],
    createdAt: c.createdAt,
});

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

// -------------------------------------------------------------------------
// Guest cart / wishlist merge.
// On sign-in we fold whatever the shopper had collected anonymously (keyed by
// the `guest-id` header) into their account cart/wishlist (keyed by the stable
// customer.guestId), then delete the anonymous copy. Best-effort: a merge
// failure must never block authentication.
// -------------------------------------------------------------------------
const recomputeCartTotal = (items) =>
    items.reduce((total, item) => {
        const discounted = item.price - (item.price * (item.discountPercent || 0) / 100);
        return total + discounted * item.quantity;
    }, 0);

const mergeGuestCart = async (fromGuestId, toGuestId) => {
    if (!fromGuestId || fromGuestId === toGuestId) return;
    const src = await CartModel.findOne({ guestId: fromGuestId });
    if (!src) return;
    if (src.items.length) {
        let dest = await CartModel.findOne({ guestId: toGuestId });
        if (!dest) dest = new CartModel({ guestId: toGuestId, items: [], totalAmount: 0 });
        for (const item of src.items) {
            const i = dest.items.findIndex(
                (d) => d.productId === item.productId && d.weightIndex === item.weightIndex,
            );
            if (i > -1) {
                dest.items[i].quantity += item.quantity;
                if (item.discountPercent) dest.items[i].discountPercent = item.discountPercent;
            } else {
                dest.items.push({
                    productId: item.productId,
                    productName: item.productName,
                    productImage: item.productImage,
                    quantity: item.quantity,
                    weight: item.weight,
                    weightIndex: item.weightIndex,
                    price: item.price,
                    discountPercent: item.discountPercent || 0,
                });
            }
        }
        dest.totalAmount = recomputeCartTotal(dest.items);
        await dest.save();
    }
    await CartModel.deleteOne({ _id: src._id });
};

const mergeGuestWishlist = async (fromGuestId, toGuestId) => {
    if (!fromGuestId || fromGuestId === toGuestId) return;
    const src = await WishlistModel.findOne({ guestId: fromGuestId });
    if (!src) return;
    if (src.items.length) {
        let dest = await WishlistModel.findOne({ guestId: toGuestId });
        if (!dest) dest = new WishlistModel({ guestId: toGuestId, items: [] });
        const seen = new Set(dest.items.map((it) => String(it.productId)));
        for (const item of src.items) {
            if (!seen.has(String(item.productId))) {
                dest.items.push(typeof item.toObject === 'function' ? item.toObject() : item);
                seen.add(String(item.productId));
            }
        }
        await dest.save();
    }
    await WishlistModel.deleteOne({ _id: src._id });
};

const mergeGuestData = async (req, customer) => {
    const guestId = req.headers['guest-id'] || null;
    if (!guestId || guestId === customer.guestId) return;
    try { await mergeGuestCart(guestId, customer.guestId); } catch { /* non-fatal */ }
    try { await mergeGuestWishlist(guestId, customer.guestId); } catch { /* non-fatal */ }
};

// -------------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------------
export const register = asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!name) throw ApiError.badRequest('Please enter your name.');
    if (!isEmail(email)) throw ApiError.badRequest('Please enter a valid email address.');
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters.');

    const exists = await CustomerModel.findOne({ email }).select('_id');
    if (exists) throw ApiError.conflict('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const customer = await CustomerModel.create({ name, email, phone, passwordHash });

    await mergeGuestData(req, customer);
    customer.lastLoginAt = new Date();
    await customer.save();

    const token = signToken(customer);
    return created(res, { token, customer: publicCustomer(customer) }, 'Account created');
});

export const login = asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) throw ApiError.badRequest('Email and password are required.');

    const customer = await CustomerModel.findOne({ email }).select('+passwordHash');
    // Same generic message for "no such email" and "wrong password" so the
    // endpoint can't be used to enumerate which emails have accounts.
    if (!customer) throw ApiError.unauthorized('Invalid email or password.');
    if (!customer.isActive) throw ApiError.forbidden('This account has been deactivated.');

    const passwordOk = await bcrypt.compare(password, customer.passwordHash);
    if (!passwordOk) throw ApiError.unauthorized('Invalid email or password.');

    await mergeGuestData(req, customer);
    customer.lastLoginAt = new Date();
    await customer.save();

    const token = signToken(customer);
    return ok(res, { token, customer: publicCustomer(customer) }, 'Signed in');
});

export const me = asyncHandler(async (req, res) =>
    ok(res, { customer: publicCustomer(req.customer) }, 'Profile'),
);

export const updateProfile = asyncHandler(async (req, res) => {
    const customer = req.customer;
    if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) throw ApiError.badRequest('Name cannot be empty.');
        customer.name = name;
    }
    if (req.body.phone !== undefined) customer.phone = String(req.body.phone).trim();
    await customer.save();
    return ok(res, { customer: publicCustomer(customer) }, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) throw ApiError.badRequest('New password must be at least 8 characters.');

    const customer = await CustomerModel.findById(req.customer._id).select('+passwordHash');
    const passwordOk = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!passwordOk) throw ApiError.unauthorized('Current password is incorrect.');

    customer.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await customer.save();
    return ok(res, {}, 'Password updated');
});

// Order history. Scoped strictly to orders linked to this account — either
// stamped with customerId at checkout, or carrying the customer's stable
// guestId. We deliberately do NOT match on phone/email (those are unverified
// and would let one account read another's orders).
export const orders = asyncHandler(async (req, res) => {
    const c = req.customer;
    const list = await OrderModel.find({
        $or: [{ customerId: c._id.toString() }, { guestId: c.guestId }],
    }).sort({ createdAt: -1 });
    return ok(res, list, 'Order history');
});

// -------------------------------------------------------------------------
// Saved addresses
// -------------------------------------------------------------------------
const sanitizeAddress = (body) => ({
    label: String(body.label || 'Home').trim() || 'Home',
    fullName: String(body.fullName || '').trim(),
    phone: String(body.phone || '').trim(),
    addressLine: String(body.addressLine || '').trim(),
    city: String(body.city || '').trim(),
    area: ['local', 'regional', 'international'].includes(body.area) ? body.area : 'local',
    notes: String(body.notes || '').trim(),
});

export const listAddresses = asyncHandler(async (req, res) =>
    ok(res, req.customer.addresses || [], 'Addresses'),
);

export const addAddress = asyncHandler(async (req, res) => {
    const customer = req.customer;
    const addr = sanitizeAddress(req.body);
    if (!addr.addressLine) throw ApiError.badRequest('Address line is required.');
    // First address (or an explicit request) becomes the default.
    const makeDefault = req.body.isDefault === true || customer.addresses.length === 0;
    if (makeDefault) customer.addresses.forEach((a) => { a.isDefault = false; });
    customer.addresses.push({ ...addr, isDefault: makeDefault });
    await customer.save();
    return created(res, customer.addresses, 'Address added');
});

export const updateAddress = asyncHandler(async (req, res) => {
    const customer = req.customer;
    const a = customer.addresses.id(req.params.addressId);
    if (!a) throw ApiError.notFound('Address not found.');
    Object.assign(a, sanitizeAddress({ ...a.toObject(), ...req.body }));
    if (req.body.isDefault === true) {
        customer.addresses.forEach((x) => { x.isDefault = false; });
        a.isDefault = true;
    }
    await customer.save();
    return ok(res, customer.addresses, 'Address updated');
});

export const deleteAddress = asyncHandler(async (req, res) => {
    const customer = req.customer;
    const a = customer.addresses.id(req.params.addressId);
    if (!a) throw ApiError.notFound('Address not found.');
    const wasDefault = a.isDefault;
    a.deleteOne();
    // Keep exactly one default when any addresses remain.
    if (wasDefault && customer.addresses.length) customer.addresses[0].isDefault = true;
    await customer.save();
    return ok(res, customer.addresses, 'Address removed');
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
    const customer = req.customer;
    const a = customer.addresses.id(req.params.addressId);
    if (!a) throw ApiError.notFound('Address not found.');
    customer.addresses.forEach((x) => { x.isDefault = false; });
    a.isDefault = true;
    await customer.save();
    return ok(res, customer.addresses, 'Default address set');
});
