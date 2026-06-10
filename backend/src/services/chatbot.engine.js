// Rule-based product-ordering chatbot engine.
//
// Fully self-contained, no external AI service. Designed to run on the VPS with
// only the existing MongoDB. The browser widget holds the conversation state
// (passed back and forth as `context`) so the backend stays stateless and
// horizontally scalable. All prices, stock and totals are recomputed
// server-side from the database on every turn — the client value is never
// trusted.

import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import OrderModel from '../models/order.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { recordStockMovements } from '../lib/stockLedger.js';

// ---- constants ----------------------------------------------------------

// Delivery charges mirror the existing checkout flow (clientOrder.route.js).
const DELIVERY = { local: 70, regional: 100, international: 130 };
const DELIVERY_LABEL = {
    local: 'Inside city (local)',
    regional: 'Outside city (regional)',
    international: 'International',
};

const MAX_CART_LINES = 50;
const MAX_QTY = 99;
const SEARCH_LIMIT = 6;

const STAGES = new Set([
    'start', 'browsing', 'ask_name', 'ask_phone', 'ask_address', 'ask_area', 'confirm', 'done',
]);

// ---- small helpers ------------------------------------------------------

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clampQty = (n) => Math.max(1, Math.min(MAX_QTY, Math.floor(Number(n) || 1)));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const productName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'Product';
const unitPrice = (w) => round2((Number(w?.price) || 0) * (1 - (Number(w?.discountPercent) || 0) / 100));
const variantImage = (p, idx) =>
    p?.cover_image || p?.weights?.[idx]?.images?.[0] || p?.weights?.[0]?.images?.[0] || '';

// Cached site settings (currency + name) so we don't query every turn.
let _settings = { at: 0, symbol: '$', siteName: 'our store' };
async function getSettings() {
    if (Date.now() - _settings.at < 5 * 60 * 1000) return _settings;
    try {
        const s = await SiteSettings.findOne({ key: 'global' }).lean();
        _settings = {
            at: Date.now(),
            symbol: s?.currencySymbol || '$',
            siteName: s?.siteName || 'our store',
        };
    } catch {
        _settings.at = Date.now();
    }
    return _settings;
}

const money = (n, symbol) => {
    const v = round2(n);
    const str = Number.isInteger(v) ? String(v) : v.toFixed(2);
    return `${symbol}${str}`;
};

// ---- context sanitisation ----------------------------------------------

function sanitizeContext(raw, guestId) {
    const ctx = raw && typeof raw === 'object' ? raw : {};
    const cartIn = Array.isArray(ctx.cart) ? ctx.cart : [];
    const cart = cartIn
        .slice(0, MAX_CART_LINES)
        .map((it) => ({
            productId: String(it?.productId || ''),
            weightIndex: Math.max(0, Math.floor(Number(it?.weightIndex) || 0)),
            quantity: clampQty(it?.quantity),
        }))
        .filter((it) => it.productId);

    const d = ctx.draft && typeof ctx.draft === 'object' ? ctx.draft : {};
    const draft = {
        customerName: typeof d.customerName === 'string' ? d.customerName.slice(0, 80) : '',
        customerPhone: typeof d.customerPhone === 'string' ? d.customerPhone.slice(0, 30) : '',
        customerEmail: typeof d.customerEmail === 'string' ? d.customerEmail.slice(0, 120) : '',
        shippingAddress: typeof d.shippingAddress === 'string' ? d.shippingAddress.slice(0, 400) : '',
        deliveryArea: ['local', 'regional', 'international'].includes(d.deliveryArea) ? d.deliveryArea : '',
        notes: typeof d.notes === 'string' ? d.notes.slice(0, 300) : '',
    };

    return {
        stage: STAGES.has(ctx.stage) ? ctx.stage : 'start',
        cart,
        draft,
        guestId: String(ctx.guestId || guestId || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    };
}

// ---- product lookups ----------------------------------------------------

async function findProducts(query) {
    const q = String(query || '').trim();
    let filter = {};
    if (q) {
        const rx = { $regex: escapeRegex(q), $options: 'i' };
        const cats = await CategoryModel.find({ category_name: rx }).select('_id').lean();
        const or = [{ firstName: rx }, { lastName: rx }, { description: rx }];
        if (cats.length) or.push({ category: { $in: cats.map((c) => c._id) } });
        filter = { $or: or };
    }
    return ProductModel.find(filter).sort({ createdAt: -1 }).limit(SEARCH_LIMIT).lean();
}

function buildCard(p, symbol) {
    const variants = (p.weights || []).map((w, i) => ({
        weightIndex: i,
        weight: w.weight,
        stock: Number(w.stock) || 0,
        price: unitPrice(w),
        priceLabel: money(unitPrice(w), symbol),
        discountPercent: Number(w.discountPercent) || 0,
        inStock: (Number(w.stock) || 0) > 0,
    }));
    const prices = variants.filter((v) => v.inStock).map((v) => v.price);
    return {
        id: String(p._id),
        name: productName(p),
        image: variantImage(p, 0),
        description: (p.description || '').slice(0, 140),
        variants,
        fromPrice: prices.length ? money(Math.min(...prices), symbol) : null,
        inStock: variants.some((v) => v.inStock),
    };
}

// Resolve the cart against live DB data: names, prices, stock, totals.
async function resolveCart(cart, symbol) {
    if (!cart.length) return { lines: [], subtotal: 0, subtotalLabel: money(0, symbol), count: 0, issues: [] };
    const ids = [...new Set(cart.map((c) => c.productId))];
    const products = await ProductModel.find({ _id: { $in: ids } }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    const issues = [];
    let subtotal = 0;
    for (const item of cart) {
        const p = byId.get(item.productId);
        const w = p?.weights?.[item.weightIndex];
        if (!p || !w) {
            issues.push('An item is no longer available and was skipped.');
            continue;
        }
        const stock = Number(w.stock) || 0;
        const qty = Math.min(item.quantity, Math.max(0, stock));
        const price = unitPrice(w);
        const lineTotal = round2(price * qty);
        if (stock <= 0) {
            issues.push(`${productName(p)} (${w.weight}) is out of stock.`);
        } else if (item.quantity > stock) {
            issues.push(`Only ${stock} of ${productName(p)} (${w.weight}) left — adjusted.`);
        }
        if (qty <= 0) continue;
        subtotal += lineTotal;
        lines.push({
            productId: item.productId,
            weightIndex: item.weightIndex,
            quantity: qty,
            name: productName(p),
            weight: w.weight,
            image: variantImage(p, item.weightIndex),
            unitPrice: price,
            unitPriceLabel: money(price, symbol),
            lineTotal,
            lineTotalLabel: money(lineTotal, symbol),
            stock,
        });
    }
    return {
        lines,
        subtotal: round2(subtotal),
        subtotalLabel: money(round2(subtotal), symbol),
        count: lines.reduce((s, l) => s + l.quantity, 0),
        issues,
    };
}

// ---- response builders --------------------------------------------------

function defaultQuickReplies(ctx, hasCart) {
    switch (ctx.stage) {
        case 'ask_name':
        case 'ask_phone':
        case 'ask_address':
            return [{ label: 'Cancel order', action: { type: 'cancel' } }];
        case 'ask_area':
            return [
                { label: `Local · ${DELIVERY.local}`, action: { type: 'set_area', area: 'local' } },
                { label: `Regional · ${DELIVERY.regional}`, action: { type: 'set_area', area: 'regional' } },
                { label: `International · ${DELIVERY.international}`, action: { type: 'set_area', area: 'international' } },
                { label: 'Cancel', action: { type: 'cancel' } },
            ];
        case 'confirm':
            return [
                { label: '✅ Confirm order', action: { type: 'confirm' } },
                { label: 'Cancel', action: { type: 'cancel' } },
            ];
        default: {
            const qr = [{ label: '🛍️ Browse products', action: { type: 'browse' } }];
            if (hasCart) qr.push({ label: '🛒 View cart', action: { type: 'view_cart' } });
            if (hasCart) qr.push({ label: '✅ Checkout', action: { type: 'checkout' } });
            qr.push({ label: 'Help', action: { text: 'help' } });
            return qr;
        }
    }
}

async function respond(text, ctx, symbol, opts = {}) {
    const snap = opts.cart !== undefined ? opts.cart : await resolveCart(ctx.cart, symbol);
    return {
        reply: text,
        context: ctx,
        cards: opts.cards || null,
        cart: snap,
        quickReplies: opts.quickReplies || defaultQuickReplies(ctx, snap.count > 0),
        order: opts.order || null,
    };
}

// ---- high-level flows ---------------------------------------------------

async function showSearch(query, ctx, symbol) {
    const products = await findProducts(query);
    if (!products.length) {
        return respond(
            `I couldn't find anything matching "${query}". Try another name, or tap Browse products to see what's available.`,
            ctx,
            symbol,
            { quickReplies: [{ label: '🛍️ Browse all', action: { type: 'browse' } }] },
        );
    }
    const cards = products.map((p) => buildCard(p, symbol));
    const head = query
        ? `Here's what I found for "${query}":`
        : 'Here are some of our products:';
    return respond(`${head} Tap **Add** on any item to start your order.`, ctx, symbol, { cards });
}

async function showCategories(ctx, symbol) {
    const cats = await CategoryModel.find().sort({ category_name: 1 }).limit(12).lean();
    const qr = cats.map((c) => ({ label: c.category_name, action: { type: 'category', categoryId: String(c._id) } }));
    qr.push({ label: 'Show all products', action: { type: 'category', categoryId: '' } });
    if (!cats.length) return showSearch('', ctx, symbol);
    return respond('What are you looking for? Pick a category:', ctx, symbol, { quickReplies: qr });
}

async function showCategoryProducts(categoryId, ctx, symbol) {
    const filter = categoryId ? { category: categoryId } : {};
    const products = await ProductModel.find(filter).sort({ createdAt: -1 }).limit(SEARCH_LIMIT).lean();
    if (!products.length) {
        return respond('No products in that category yet. Try another one.', ctx, symbol, {
            quickReplies: [{ label: '🛍️ Browse', action: { type: 'browse' } }],
        });
    }
    const cards = products.map((p) => buildCard(p, symbol));
    return respond('Tap **Add** on any item to add it to your order:', ctx, symbol, { cards });
}

async function addToCart(action, ctx, symbol) {
    const productId = String(action.productId || '');
    const weightIndex = Math.max(0, Math.floor(Number(action.weightIndex) || 0));
    const qty = clampQty(action.quantity || 1);
    if (!productId) return respond("I couldn't add that item — please pick one from the list.", ctx, symbol);

    const p = await ProductModel.findById(productId).lean().catch(() => null);
    const w = p?.weights?.[weightIndex];
    if (!p || !w) return respond('That product is no longer available.', ctx, symbol);
    if ((Number(w.stock) || 0) <= 0) {
        return respond(`Sorry, ${productName(p)} (${w.weight}) is out of stock right now.`, ctx, symbol);
    }

    const existing = ctx.cart.find((c) => c.productId === productId && c.weightIndex === weightIndex);
    if (existing) existing.quantity = clampQty(existing.quantity + qty);
    else ctx.cart.push({ productId, weightIndex, quantity: qty });
    ctx.cart = ctx.cart.slice(0, MAX_CART_LINES);

    const snap = await resolveCart(ctx.cart, symbol);
    return respond(
        `Added **${productName(p)} (${w.weight})** to your order. Your cart total is **${money(snap.subtotal, symbol)}**.`,
        ctx,
        symbol,
        { cart: snap, quickReplies: [
            { label: '🛒 View cart', action: { type: 'view_cart' } },
            { label: '✅ Checkout', action: { type: 'checkout' } },
            { label: '🛍️ Keep shopping', action: { type: 'browse' } },
        ] },
    );
}

async function modifyCart(action, ctx, symbol) {
    // Prefer matching by product + weight (stable); fall back to array index.
    let idx = -1;
    if (action.productId) {
        const wi = Math.max(0, Math.floor(Number(action.weightIndex) || 0));
        idx = ctx.cart.findIndex((c) => c.productId === String(action.productId) && c.weightIndex === wi);
    }
    if (idx < 0 && action.index !== undefined) idx = Math.floor(Number(action.index));
    if (!ctx.cart[idx]) return showCart(ctx, symbol);
    if (action.type === 'remove') ctx.cart.splice(idx, 1);
    else if (action.type === 'inc') ctx.cart[idx].quantity = clampQty(ctx.cart[idx].quantity + 1);
    else if (action.type === 'dec') {
        const next = ctx.cart[idx].quantity - 1;
        if (next <= 0) ctx.cart.splice(idx, 1);
        else ctx.cart[idx].quantity = next;
    }
    return showCart(ctx, symbol);
}

async function showCart(ctx, symbol) {
    const snap = await resolveCart(ctx.cart, symbol);
    if (!snap.count) {
        return respond("Your cart is empty. Tap Browse products to add something tasty!", ctx, symbol, {
            cart: snap,
            quickReplies: [{ label: '🛍️ Browse products', action: { type: 'browse' } }],
        });
    }
    const lines = snap.lines
        .map((l, i) => `${i + 1}. ${l.name} (${l.weight}) × ${l.quantity} = ${l.lineTotalLabel}`)
        .join('\n');
    const note = snap.issues.length ? `\n\n⚠️ ${snap.issues.join(' ')}` : '';
    return respond(
        `🛒 **Your order**\n${lines}\n\nSubtotal: **${money(snap.subtotal, symbol)}** (delivery added at checkout)${note}`,
        ctx,
        symbol,
        { cart: snap, quickReplies: [
            { label: '✅ Checkout', action: { type: 'checkout' } },
            { label: '🛍️ Keep shopping', action: { type: 'browse' } },
        ] },
    );
}

async function startCheckout(ctx, symbol) {
    const snap = await resolveCart(ctx.cart, symbol);
    if (!snap.count) {
        return respond('Your cart is empty — add a product before checking out.', ctx, symbol, {
            cart: snap,
            quickReplies: [{ label: '🛍️ Browse products', action: { type: 'browse' } }],
        });
    }
    ctx.stage = 'ask_name';
    return respond(
        `Great! Let's place your order (total so far **${money(snap.subtotal, symbol)}** + delivery).\n\nWhat's your **full name**?`,
        ctx,
        symbol,
        { cart: snap },
    );
}

async function buildConfirmSummary(ctx, symbol) {
    const snap = await resolveCart(ctx.cart, symbol);
    const charge = DELIVERY[ctx.draft.deliveryArea] ?? DELIVERY.local;
    const total = round2(snap.subtotal + charge);
    const items = snap.lines.map((l) => `• ${l.name} (${l.weight}) × ${l.quantity} = ${l.lineTotalLabel}`).join('\n');
    const text =
        `Please review your order:\n\n${items}\n\n` +
        `Subtotal: ${money(snap.subtotal, symbol)}\n` +
        `Delivery (${DELIVERY_LABEL[ctx.draft.deliveryArea]}): ${money(charge, symbol)}\n` +
        `**Total: ${money(total, symbol)}**\n\n` +
        `Name: ${ctx.draft.customerName}\nPhone: ${ctx.draft.customerPhone}\n` +
        `Address: ${ctx.draft.shippingAddress}\n\nPayment: Cash on delivery.\nShall I place the order?`;
    return respond(text, ctx, symbol, { cart: snap });
}

async function placeOrder(ctx, symbol) {
    const snap = await resolveCart(ctx.cart, symbol);
    if (!snap.count) {
        ctx.stage = 'start';
        return respond('Your cart is empty now, so I cannot place the order.', ctx, symbol);
    }
    // Hard stock re-check at the moment of ordering.
    if (snap.issues.length) {
        ctx.stage = 'browsing';
        return respond(
            `Some items changed since you started:\n${snap.issues.join('\n')}\n\nPlease review your cart and try again.`,
            ctx,
            symbol,
            { cart: snap, quickReplies: [{ label: '🛒 View cart', action: { type: 'view_cart' } }] },
        );
    }

    const area = ctx.draft.deliveryArea || 'local';
    const deliveryCharge = DELIVERY[area] ?? DELIVERY.local;
    const items = snap.lines.map((l) => ({
        productId: l.productId,
        productName: l.name,
        productImage: l.image,
        quantity: l.quantity,
        weight: l.weight,
        weightIndex: l.weightIndex,
        price: l.unitPrice,
        totalPrice: l.lineTotal,
    }));
    const subtotal = snap.subtotal;
    const totalAmount = round2(subtotal + deliveryCharge);
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = `GG-${ts}${rand}`;

    const order = new OrderModel({
        orderId,
        guestId: ctx.guestId,
        customerName: ctx.draft.customerName,
        customerPhone: ctx.draft.customerPhone,
        customerEmail: ctx.draft.customerEmail || '',
        shippingAddress: ctx.draft.shippingAddress,
        city: area,
        items,
        subtotal,
        deliveryCharge,
        totalAmount,
        paymentMethod: 'cash_on_delivery',
        notes: ctx.draft.notes || 'Placed via chat assistant',
    });
    await order.save();

    // Decrement stock (best-effort, mirrors existing checkout flow).
    for (const it of items) {
        await ProductModel.updateOne(
            { _id: it.productId },
            { $inc: { [`weights.${it.weightIndex}.stock`]: -it.quantity } },
        ).catch(() => {});
    }

    // Record the stock draw-down in the ledger (best-effort, feature-gated).
    await recordStockMovements(
        items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            weightIndex: it.weightIndex,
            weight: it.weight,
            delta: -it.quantity,
        })),
        { reason: 'sale', channel: 'chatbot', orderId: order.orderId },
    );

    const placed = {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        totalLabel: money(order.totalAmount, symbol),
        itemCount: snap.count,
        customerName: order.customerName,
        deliveryArea: area,
    };
    // Reset for a fresh conversation, keep the guestId.
    const fresh = sanitizeContext({ guestId: ctx.guestId, stage: 'done', cart: [], draft: {} }, ctx.guestId);
    return respond(
        `🎉 Order placed! Your order ID is **${order.orderId}**.\n\n` +
        `Total: **${money(order.totalAmount, symbol)}** (cash on delivery).\n` +
        `We'll call ${order.customerPhone} to confirm. Thank you, ${order.customerName}!`,
        fresh,
        symbol,
        { cart: { lines: [], subtotal: 0, subtotalLabel: money(0, symbol), count: 0, issues: [] }, order: placed, quickReplies: [
            { label: '🛍️ Shop again', action: { type: 'browse' } },
        ] },
    );
}

// ---- collecting customer details ---------------------------------------

async function handleCollecting(text, ctx, symbol) {
    const value = String(text || '').trim();
    if (ctx.stage === 'ask_name') {
        if (value.length < 2) return respond('Please tell me your full name so we can address the delivery.', ctx, symbol);
        ctx.draft.customerName = value.slice(0, 80);
        ctx.stage = 'ask_phone';
        return respond(`Thanks ${ctx.draft.customerName.split(' ')[0]}! What's the best **phone number** to reach you?`, ctx, symbol);
    }
    if (ctx.stage === 'ask_phone') {
        const digits = (value.match(/\d/g) || []).join('');
        if (digits.length < 6 || digits.length > 15) {
            return respond('That phone number looks off. Please enter a valid number (6–15 digits).', ctx, symbol);
        }
        ctx.draft.customerPhone = value.slice(0, 30);
        ctx.stage = 'ask_address';
        return respond('Got it. What is your full **delivery address** (house/road/area)?', ctx, symbol);
    }
    if (ctx.stage === 'ask_address') {
        if (value.length < 5) return respond('Please share a complete delivery address.', ctx, symbol);
        ctx.draft.shippingAddress = value.slice(0, 400);
        ctx.stage = 'ask_area';
        return respond(
            `Where should we deliver? Choose your zone:\n` +
            `• Local (inside city) — ${money(DELIVERY.local, symbol)}\n` +
            `• Regional (outside city) — ${money(DELIVERY.regional, symbol)}\n` +
            `• International — ${money(DELIVERY.international, symbol)}`,
            ctx,
            symbol,
        );
    }
    if (ctx.stage === 'ask_area') {
        const t = value.toLowerCase();
        let area = '';
        if (/local|inside|city|dhaka/.test(t)) area = 'local';
        else if (/region|outside|district|nation/.test(t)) area = 'regional';
        else if (/inter|abroad|foreign|overseas/.test(t)) area = 'international';
        if (!area) return respond('Please pick a delivery zone: Local, Regional, or International.', ctx, symbol);
        ctx.draft.deliveryArea = area;
        ctx.stage = 'confirm';
        return buildConfirmSummary(ctx, symbol);
    }
    return respond("Let's continue with your order.", ctx, symbol);
}

// ---- intent parsing (free text) ----------------------------------------

const GREETING = /\b(hi|hello|hey|yo|salam|assalam|start|good (morning|afternoon|evening))\b/i;
const HELP = /\b(help|how|what can you|menu|options)\b/i;
const CART_WORDS = /\b(cart|basket|my order|view order)\b/i;
const CHECKOUT_WORDS = /\b(checkout|place order|buy now|order now|confirm order|i want to order)\b/i;
const BROWSE_WORDS = /\b(browse|products|catalog|catalogue|shop|categories|category|show( me)?( all)?|list)\b/i;
const YES = /\b(yes|yeah|yep|confirm|ok|okay|sure|place it|do it|proceed)\b/i;
const NO = /\b(no|nope|cancel|stop|don'?t|abort)\b/i;

async function handleText(text, ctx, symbol, siteName) {
    const t = String(text || '').trim();

    // While collecting details, free text is the answer (unless they cancel).
    if (['ask_name', 'ask_phone', 'ask_address', 'ask_area'].includes(ctx.stage)) {
        if (NO.test(t) && /cancel|stop|abort/i.test(t)) return cancelOrder(ctx, symbol);
        return handleCollecting(t, ctx, symbol);
    }
    if (ctx.stage === 'confirm') {
        if (YES.test(t)) return placeOrder(ctx, symbol);
        if (NO.test(t)) return cancelOrder(ctx, symbol);
        return respond('Just say "yes" to place the order, or "cancel" to stop.', ctx, symbol);
    }

    if (!t) return greet(ctx, symbol, siteName);
    if (HELP.test(t)) return helpMessage(ctx, symbol);
    if (CHECKOUT_WORDS.test(t)) return startCheckout(ctx, symbol);
    if (CART_WORDS.test(t)) return showCart(ctx, symbol);
    if (GREETING.test(t) && t.split(/\s+/).length <= 3) return greet(ctx, symbol, siteName);
    if (BROWSE_WORDS.test(t)) return showCategories(ctx, symbol);

    // Otherwise treat the whole message as a product search query.
    return showSearch(t, ctx, symbol);
}

async function handleAction(action, ctx, symbol, siteName) {
    switch (action.type) {
        case 'start':
        case 'greet':
            return greet(ctx, symbol, siteName);
        case 'help':
            return helpMessage(ctx, symbol);
        case 'browse':
            return showCategories(ctx, symbol);
        case 'category':
            return showCategoryProducts(String(action.categoryId || ''), ctx, symbol);
        case 'search':
            return showSearch(String(action.query || ''), ctx, symbol);
        case 'add':
            return addToCart(action, ctx, symbol);
        case 'inc':
        case 'dec':
        case 'remove':
            return modifyCart(action, ctx, symbol);
        case 'view_cart':
            return showCart(ctx, symbol);
        case 'checkout':
            return startCheckout(ctx, symbol);
        case 'set_area': {
            if (!['ask_area', 'confirm'].includes(ctx.stage) && !ctx.draft.shippingAddress) {
                return startCheckout(ctx, symbol);
            }
            const area = ['local', 'regional', 'international'].includes(action.area) ? action.area : 'local';
            ctx.draft.deliveryArea = area;
            ctx.stage = 'confirm';
            return buildConfirmSummary(ctx, symbol);
        }
        case 'confirm':
            if (ctx.stage !== 'confirm') return respond('Let me get your details first.', ctx, symbol);
            return placeOrder(ctx, symbol);
        case 'cancel':
            return cancelOrder(ctx, symbol);
        default:
            return greet(ctx, symbol, siteName);
    }
}

function greet(ctx, symbol, siteName) {
    ctx.stage = ctx.stage === 'start' || ctx.stage === 'done' ? 'browsing' : ctx.stage;
    return respond(
        `👋 Hi! I'm the ordering assistant for **${siteName}**. ` +
        `I can help you find products and place an order right here in chat. ` +
        `What are you looking for today?`,
        ctx,
        symbol,
        { quickReplies: [
            { label: '🛍️ Browse products', action: { type: 'browse' } },
            { label: 'Help', action: { text: 'help' } },
        ] },
    );
}

function helpMessage(ctx, symbol) {
    return respond(
        `Here's how I can help:\n` +
        `• **Search** — just type a product name (e.g. "ghee", "honey").\n` +
        `• **Browse** — tap "Browse products" to see categories.\n` +
        `• **Add** items to your cart, then **Checkout**.\n` +
        `• I'll collect your name, phone & address and place a **cash-on-delivery** order.\n\n` +
        `What would you like to do?`,
        ctx,
        symbol,
    );
}

async function cancelOrder(ctx, symbol) {
    ctx.stage = 'browsing';
    ctx.draft = sanitizeContext({}, ctx.guestId).draft;
    return respond('No problem — I\'ve paused the checkout. Your cart is still saved whenever you\'re ready.', ctx, symbol, {
        quickReplies: [
            { label: '🛒 View cart', action: { type: 'view_cart' } },
            { label: '🛍️ Keep shopping', action: { type: 'browse' } },
        ],
    });
}

// ---- public entry point -------------------------------------------------

export async function handleTurn({ message, action, context, guestId } = {}) {
    const { symbol, siteName } = await getSettings();
    const ctx = sanitizeContext(context, guestId);

    let result;
    if (action && typeof action === 'object' && action.type) {
        result = await handleAction(action, ctx, symbol, siteName);
    } else if (typeof message === 'string' && message.trim()) {
        result = await handleText(message, ctx, symbol, siteName);
    } else {
        result = await greet(ctx, symbol, siteName);
    }

    // Always echo a clean, persisted context back to the client.
    result.context = sanitizeContext(result.context, ctx.guestId);
    return result;
}

export default { handleTurn };
