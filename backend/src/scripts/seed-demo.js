// ---------------------------------------------------------------------------
// Demo data seeder
// ---------------------------------------------------------------------------
// Replaces the placeholder catalogue with a realistic storefront so the admin
// dashboard and profit report show meaningful numbers:
//   • 4 categories  : Men's Fashion, Women's Fashion, Mobiles, Headphones
//   • 16 products   : priced in BDT with per-variant cost prices (for margin)
//   • ~55 orders    : spread across the last 30 days, with per-line cost
//                     snapshots, a realistic status mix and a few POS sales
//
// DESTRUCTIVE. Clears products, categories, orders, carts, wishlists, reviews
// and stock movements. It NEVER touches admins, site settings, pages, footer,
// nav menu, headers or coupons. Guarded behind --force so it cannot run by
// accident.
//
// Run inside the backend container (it already has MONGODB_URI + DB access):
//   docker compose exec backend node src/scripts/seed-demo.js --force
// ---------------------------------------------------------------------------

import mongoose from 'mongoose';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import OrderModel from '../models/order.model.js';
import CartModel from '../models/cart.model.js';
import WishlistModel from '../models/wishlist.model.js';
import ReviewModel from '../models/review.model.js';
import StockMovementModel from '../models/stockMovement.model.js';

const FORCE = process.argv.includes('--force') || process.env.SEED_FORCE === '1';

// --- small helpers ---------------------------------------------------------
const img = (id) => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const chance = (p) => Math.random() < p;
const DAY = 86400000;

// Weighted random status picker.
const weightedPick = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [val, w] of pairs) {
        if ((r -= w) <= 0) return val;
    }
    return pairs[0][0];
};

// Pick n distinct entries from arr.
const pickDistinct = (arr, n) => {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < n && copy.length; i += 1) {
        out.push(copy.splice(rnd(0, copy.length - 1), 1)[0]);
    }
    return out;
};

// ---------------------------------------------------------------------------
// Catalogue definition. `weight` is repurposed as the variant label (clothing
// size / storage). costPrice drives the profit/margin reporting.
// ---------------------------------------------------------------------------
const CATALOG = [
    {
        name: "Men's Fashion",
        image: img('1490578474895-699cd4e2cf59'),
        products: [
            {
                name: 'Classic Cotton Panjabi',
                cover: img('1602810318383-e386cc2a3ccf'),
                description:
                    'Hand-finished 100% combed-cotton panjabi with subtle chikan embroidery on the placket. Breathable, pre-shrunk and colour-fast — an everyday festive staple.',
                qa: [{ question: 'Is the fabric pre-shrunk?', answer: 'Yes, it is pre-shrunk and colour-fast, so it keeps its shape after washing.' }],
                variants: [
                    { weight: 'M', price: 1450, costPrice: 800, stock: 42 },
                    { weight: 'L', price: 1450, costPrice: 800, stock: 38 },
                    { weight: 'XL', price: 1550, costPrice: 860, stock: 24 },
                ],
            },
            {
                name: 'Slim-Fit Formal Shirt',
                cover: img('1473966968600-fa801b869a1a'),
                description:
                    'Wrinkle-resistant slim-fit formal shirt in premium Egyptian cotton. Mother-of-pearl buttons and a tailored cut that takes you from office to dinner.',
                qa: [{ question: 'Does it need ironing?', answer: 'It is wrinkle-resistant; a quick steam keeps it crisp all day.' }],
                variants: [
                    { weight: 'S', price: 1150, costPrice: 620, stock: 4 },
                    { weight: 'M', price: 1150, costPrice: 620, stock: 50 },
                    { weight: 'L', price: 1150, costPrice: 620, stock: 46 },
                    { weight: 'XL', price: 1250, costPrice: 670, stock: 30 },
                ],
            },
            {
                name: 'Premium Denim Jeans',
                cover: img('1542272604-787c3835535d'),
                description:
                    'Mid-rise stretch denim with a clean straight leg. 12oz fabric with just enough give for all-day comfort and a fade that ages beautifully.',
                variants: [
                    { weight: '30', price: 1890, costPrice: 1050, stock: 26 },
                    { weight: '32', price: 1890, costPrice: 1050, stock: 40 },
                    { weight: '34', price: 1890, costPrice: 1050, stock: 33 },
                    { weight: '36', price: 1950, costPrice: 1090, stock: 18 },
                ],
            },
            {
                name: 'Casual Polo T-Shirt',
                cover: img('1521572163474-6864f9cf17ab'),
                description:
                    'Soft pique-knit polo with a ribbed collar and a two-button placket. Holds colour wash after wash — your go-to smart-casual tee.',
                discountPercent: 10,
                variants: [
                    { weight: 'S', price: 750, costPrice: 360, stock: 60 },
                    { weight: 'M', price: 750, costPrice: 360, stock: 72 },
                    { weight: 'L', price: 750, costPrice: 360, stock: 55 },
                    { weight: 'XL', price: 790, costPrice: 380, stock: 34 },
                ],
            },
        ],
    },
    {
        name: "Women's Fashion",
        image: img('1483985988355-763728e1935b'),
        products: [
            {
                name: 'Embroidered Three-Piece',
                cover: img('1490481651871-ab68de25d43d'),
                description:
                    'Unstitched three-piece set in soft georgette with intricate thread embroidery and a printed dupatta. Festive elegance ready for your tailor.',
                qa: [{ question: 'Is it stitched?', answer: 'It comes unstitched so you can tailor it to your exact measurements.' }],
                variants: [
                    { weight: 'S', price: 2650, costPrice: 1500, stock: 28 },
                    { weight: 'M', price: 2650, costPrice: 1500, stock: 32 },
                    { weight: 'L', price: 2750, costPrice: 1560, stock: 20 },
                ],
            },
            {
                name: 'Cotton Kurti',
                cover: img('1572804013309-59a88b7e92f1'),
                description:
                    'Breathable block-printed cotton kurti with a relaxed A-line silhouette and side slits. Effortless daily wear that stays cool in the heat.',
                discountPercent: 15,
                variants: [
                    { weight: 'S', price: 1250, costPrice: 690, stock: 44 },
                    { weight: 'M', price: 1250, costPrice: 690, stock: 52 },
                    { weight: 'L', price: 1250, costPrice: 690, stock: 38 },
                    { weight: 'XL', price: 1320, costPrice: 730, stock: 25 },
                ],
            },
            {
                name: 'Designer Silk Saree',
                cover: img('1469334031218-e382a71b716b'),
                description:
                    'Lustrous half-silk saree with a contrast zari border and matching blouse piece. A timeless drape for weddings and celebrations.',
                qa: [{ question: 'Does it include a blouse piece?', answer: 'Yes, an unstitched matching blouse piece is included.' }],
                variants: [{ weight: 'Free Size', price: 3450, costPrice: 2050, stock: 2 }],
            },
            {
                name: 'A-Line Maxi Dress',
                cover: img('1595777457583-95e059d581b8'),
                description:
                    'Flowy floral maxi dress in crinkle-rayon with a smocked waist and three-quarter sleeves. Comfortable, photogenic and easy to style.',
                variants: [
                    { weight: 'S', price: 1950, costPrice: 1080, stock: 30 },
                    { weight: 'M', price: 1950, costPrice: 1080, stock: 36 },
                    { weight: 'L', price: 1950, costPrice: 1080, stock: 22 },
                ],
            },
        ],
    },
    {
        name: 'Mobiles',
        image: img('1511707171634-5f897ff02aa9'),
        products: [
            {
                name: 'Samsung Galaxy A15',
                cover: img('1574944985070-8f3ebc6b79d2'),
                description:
                    '6.5" Super AMOLED display, 50MP triple camera and a 5000mAh battery with 25W fast charging. Official Samsung Bangladesh warranty.',
                qa: [{ question: 'Is it official warranty?', answer: 'Yes, it carries the official Samsung Bangladesh 1-year warranty.' }],
                variants: [
                    { weight: '128GB', price: 22999, costPrice: 19800, stock: 24 },
                    { weight: '256GB', price: 25999, costPrice: 22600, stock: 15 },
                ],
            },
            {
                name: 'Xiaomi Redmi Note 13',
                cover: img('1580910051074-3eb694886505'),
                description:
                    '120Hz AMOLED screen, 108MP main camera and a 5000mAh battery with 33W charging. Flagship-grade specs at a mid-range price.',
                variants: [
                    { weight: '128GB', price: 20999, costPrice: 17900, stock: 30 },
                    { weight: '256GB', price: 24499, costPrice: 21300, stock: 17 },
                ],
            },
            {
                name: 'Apple iPhone 13',
                cover: img('1598327105666-5b89351aff97'),
                description:
                    'A15 Bionic chip, dual 12MP cameras with Cinematic mode and the Super Retina XDR display. Boxed with full accessories and warranty.',
                qa: [{ question: 'Is it brand new?', answer: 'Yes, it is brand-new, factory-sealed with international warranty.' }],
                variants: [{ weight: '128GB', price: 74999, costPrice: 68500, stock: 3 }],
            },
            {
                name: 'Realme C67',
                cover: img('1592750475338-74b7b21085ab'),
                description:
                    '108MP camera, 90Hz display and a 5000mAh battery with 33W SUPERVOOC charging. Sleek design with a premium leather-finish back.',
                discountPercent: 8,
                variants: [{ weight: '128GB', price: 18499, costPrice: 15600, stock: 21 }],
            },
        ],
    },
    {
        name: 'Headphones',
        image: img('1505740420928-5e560c06d30e'),
        products: [
            {
                name: 'Sony WH-CH520 Wireless',
                cover: img('1583394838336-acd977736f90'),
                description:
                    'Up to 50 hours of battery, DSEE upscaling and multipoint connection. Lightweight on-ear design tuned with Sony’s signature sound.',
                qa: [{ question: 'How long does the battery last?', answer: 'Up to 50 hours on a full charge, with quick-charge for 1.5 hours in 3 minutes.' }],
                variants: [{ weight: 'Standard', price: 5490, costPrice: 3850, stock: 40 }],
            },
            {
                name: 'JBL Tune 510BT',
                cover: img('1484704849700-f032a568e944'),
                description:
                    'JBL Pure Bass sound, 40-hour battery and Speed Charge. Foldable, lightweight and ready to pair with two devices at once.',
                discountPercent: 12,
                variants: [{ weight: 'Standard', price: 4290, costPrice: 2950, stock: 55 }],
            },
            {
                name: 'boAt Rockerz 450',
                cover: img('1599669454699-248893623440'),
                description:
                    '40mm drivers with boAt Signature Sound, up to 15 hours of playback and plush ear-cushions. The everyday wireless workhorse.',
                variants: [{ weight: 'Standard', price: 2190, costPrice: 1320, stock: 70 }],
            },
            {
                name: 'Soundcore Life Q30',
                cover: img('1577174881658-0f30ed549adc'),
                description:
                    'Hybrid active noise cancellation, Hi-Res certified drivers and a 40-hour battery. Custom EQ via the Soundcore app.',
                qa: [{ question: 'Does it have noise cancellation?', answer: 'Yes, it features hybrid active noise cancellation with multiple modes.' }],
                variants: [{ weight: 'Standard', price: 7990, costPrice: 5500, stock: 5 }],
            },
        ],
    },
];

// --- order-generation reference data ---------------------------------------
const NAMES = [
    'Rahim Uddin', 'Karim Hossain', 'Abdullah Al Mamun', 'Tanvir Ahmed', 'Sadia Islam',
    'Nusrat Jahan', 'Mehedi Hasan', 'Farhana Akter', 'Imran Khan', 'Sumaiya Akter',
    'Rakibul Islam', 'Jannatul Ferdous', 'Shahriar Kabir', 'Mitu Rani Das', 'Asif Iqbal',
    'Nabila Rahman', 'Saiful Islam', 'Tania Sultana', 'Arif Mahmud', 'Rifat Chowdhury',
    'Maliha Anjum', 'Fahim Reza', 'Sharmin Akhter', 'Naimul Hoque', 'Ishrat Jahan',
];
const CITIES = ['Dhaka', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh', 'Cumilla', 'Narayanganj'];
const AREAS = ['Dhanmondi', 'Gulshan', 'Mirpur', 'Uttara', 'Banani', 'Mohakhali', 'Bashundhara', 'Agrabad', 'Zindabazar', 'Khalishpur'];
const COUPONS = [
    { code: 'EID150', type: 'flat', value: 150 },
    { code: 'SAVE100', type: 'flat', value: 100 },
    { code: 'FLAT200', type: 'flat', value: 200 },
    { code: 'WELCOME10', type: 'percent', value: 10 },
];
const CASHIERS = [
    { id: 'seed-pos-01', username: 'rahim.pos', fullName: 'Rahim Uddin' },
    { id: 'seed-pos-02', username: 'sadia.pos', fullName: 'Sadia Islam' },
];

const phone = () => `01${rnd(3, 9)}${String(rnd(0, 99999999)).padStart(8, '0')}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

// ---------------------------------------------------------------------------
async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('✖ MONGODB_URI is not set in the environment. Aborting.');
        process.exit(1);
    }
    if (!FORCE) {
        console.error('✖ Refusing to run without --force (this wipes demo catalogue + orders).');
        console.error('  Run:  node src/scripts/seed-demo.js --force');
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✔ Connected to MongoDB');

    const before = {
        products: await ProductModel.countDocuments(),
        categories: await CategoryModel.countDocuments(),
        orders: await OrderModel.countDocuments(),
    };
    console.log(`  Existing → products: ${before.products}, categories: ${before.categories}, orders: ${before.orders}`);

    // 1) Wipe demo catalogue + order-related data (config left untouched).
    await Promise.all([
        ProductModel.deleteMany({}),
        CategoryModel.deleteMany({}),
        OrderModel.deleteMany({}),
        CartModel.deleteMany({}),
        WishlistModel.deleteMany({}),
        ReviewModel.deleteMany({}),
        StockMovementModel.deleteMany({}),
    ]);
    console.log('✔ Cleared products, categories, orders, carts, wishlists, reviews, stock movements');

    // 2) Categories.
    const sellable = []; // flat list of purchasable variants for order generation
    let productCount = 0;
    for (const cat of CATALOG) {
        const categoryDoc = await CategoryModel.create({
            category_name: cat.name,
            category_image: cat.image,
        });

        // 3) Products under this category (saved individually so the pre-save
        //    hook auto-generates a scannable barcode/SKU per variant).
        for (const p of cat.products) {
            const dp = p.discountPercent || 0;
            const weights = p.variants.map((v) => ({
                weight: v.weight,
                stock: v.stock,
                price: v.price,
                discountPercent: dp,
                costPrice: v.costPrice,
                images: [],
            }));
            const doc = await new ProductModel({
                cover_image: p.cover,
                firstName: p.name,
                lastName: '',
                category: categoryDoc._id,
                weights,
                description: p.description,
                qa: p.qa || [],
                showInEcommerce: true,
            }).save();
            productCount += 1;

            doc.weights.forEach((w, idx) => {
                sellable.push({
                    productId: doc._id.toString(),
                    productName: doc.firstName,
                    productImage: doc.cover_image,
                    weight: w.weight,
                    weightIndex: idx,
                    // unit price actually charged (after the product's discount)
                    price: Math.round(w.price * (1 - (w.discountPercent || 0) / 100)),
                    costPrice: w.costPrice,
                });
            });
        }
    }
    console.log(`✔ Seeded ${CATALOG.length} categories and ${productCount} products`);

    // 4) Orders across the last 30 days. Inserted via the native driver so the
    //    explicit createdAt timestamps are preserved (Mongoose timestamps would
    //    otherwise overwrite them), giving a continuous daily chart.
    const now = Date.now();
    const orders = [];
    let seq = 100001;

    for (let day = 29; day >= 0; day -= 1) {
        const ordersToday = rnd(1, 3);
        for (let k = 0; k < ordersToday; k += 1) {
            let created = new Date(now - day * DAY - rnd(0, 23) * 3600000 - rnd(0, 59) * 60000);
            if (created.getTime() > now) created = new Date(now - rnd(1, 6) * 3600000);

            const lines = pickDistinct(sellable, rnd(1, 3)).map((s) => {
                const quantity = rnd(1, 3);
                return {
                    productId: s.productId,
                    productName: s.productName,
                    productImage: s.productImage,
                    quantity,
                    weight: s.weight,
                    price: s.price,
                    totalPrice: s.price * quantity,
                    costPrice: s.costPrice,
                    weightIndex: s.weightIndex,
                };
            });
            const subtotal = lines.reduce((a, i) => a + i.totalPrice, 0);

            const isPos = chance(0.18);
            const customerName = pick(NAMES);
            const status = isPos
                ? 'delivered'
                : weightedPick([
                      ['delivered', 50],
                      ['shipped', 12],
                      ['processing', 10],
                      ['confirmed', 8],
                      ['pending', 7],
                      ['cancelled', 7],
                      ['returned', 6],
                  ]);

            // Discounts (coupon for some e-commerce orders; wholesale markdown
            // for some POS orders) so net profit < gross profit in the report.
            let discount = 0;
            let couponCode = '';
            let manualDiscount = { type: null, value: 0, amount: 0 };
            let saleType = null;

            if (isPos) {
                saleType = chance(0.25) ? 'wholesale' : 'retail';
                if (saleType === 'wholesale') {
                    const valPct = pick([5, 8, 10]);
                    discount = Math.round((subtotal * valPct) / 100);
                    manualDiscount = { type: 'percent', value: valPct, amount: discount };
                }
            } else if (chance(0.28)) {
                const c = pick(COUPONS);
                couponCode = c.code;
                discount = c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : c.value;
                if (discount >= subtotal) discount = Math.round(subtotal * 0.1);
            }

            const deliveryCharge = isPos ? 0 : pick([60, 60, 70, 80, 100]);
            const totalAmount = Math.max(0, subtotal + deliveryCharge - discount);

            let paymentMethod;
            if (isPos) paymentMethod = chance(0.7) ? 'cash' : 'card';
            else paymentMethod = chance(0.7) ? 'cash_on_delivery' : 'online';

            const prepaid = paymentMethod === 'online' || paymentMethod === 'card';
            let paymentStatus = 'pending';
            if (status === 'delivered') paymentStatus = 'paid';
            else if (status === 'returned') paymentStatus = 'refunded';
            else if (status === 'cancelled') paymentStatus = prepaid ? 'refunded' : 'failed';
            else if (prepaid) paymentStatus = 'paid';

            // Lifecycle timestamps.
            let confirmedAt = null;
            let deliveredAt = null;
            let cancelledAt = null;
            let cancelledReason = '';
            if (['confirmed', 'processing', 'shipped', 'delivered', 'returned'].includes(status)) {
                confirmedAt = new Date(created.getTime() + rnd(1, 8) * 3600000);
            }
            if (status === 'delivered' || status === 'returned') {
                deliveredAt = new Date(Math.min(now, created.getTime() + rnd(2, 5) * DAY));
            }
            if (status === 'cancelled') {
                cancelledAt = new Date(created.getTime() + rnd(2, 24) * 3600000);
                cancelledReason = pick(['Customer changed mind', 'Out of stock', 'Wrong item ordered', 'Duplicate order']);
            }
            const updatedAt = deliveredAt || cancelledAt || confirmedAt || created;

            const hasEmail = chance(0.6);
            orders.push({
                orderId: `ORD-${seq++}`,
                source: isPos ? 'pos' : 'ecommerce',
                saleType,
                soldBy: isPos ? pick(CASHIERS) : { id: null, username: null, fullName: null },
                shiftId: null,
                guestId: `guest_seed_${seq}`,
                customerName,
                customerPhone: phone(),
                customerEmail: hasEmail ? `${slug(customerName)}@gmail.com` : undefined,
                shippingAddress: `House ${rnd(1, 99)}, Road ${rnd(1, 27)}, ${pick(AREAS)}`,
                city: isPos ? '' : pick(CITIES),
                items: lines,
                subtotal,
                deliveryCharge,
                couponCode,
                discount,
                manualDiscount,
                totalAmount,
                paymentMethod,
                paymentStatus,
                orderStatus: status,
                deliveryDate: null,
                returnAvailableUntil: null,
                confirmedAt,
                deliveredAt,
                cancelledAt,
                cancelledReason,
                notes: '',
                adminNotes: '',
                createdAt: created,
                updatedAt,
            });
        }
    }

    await OrderModel.collection.insertMany(orders);

    // Quick revenue/profit sanity figures (mirrors the dashboard math).
    const revenueStatuses = new Set(['cancelled', 'failed', 'returned']);
    let revenue = 0;
    let cost = 0;
    let discounts = 0;
    for (const o of orders) {
        if (revenueStatuses.has(o.orderStatus)) continue;
        revenue += o.totalAmount;
        discounts += o.discount;
        for (const it of o.items) cost += it.costPrice * it.quantity;
    }
    const itemRevenue = orders
        .filter((o) => !revenueStatuses.has(o.orderStatus))
        .reduce((a, o) => a + o.items.reduce((b, it) => b + it.totalPrice, 0), 0);
    const grossProfit = itemRevenue - cost;

    console.log(`✔ Inserted ${orders.length} orders across 30 days`);
    console.log('  ── dashboard preview (revenue-counting orders only) ──');
    console.log(`     Total revenue (totalAmount) : ৳${revenue.toLocaleString()}`);
    console.log(`     Item revenue (line totals)  : ৳${itemRevenue.toLocaleString()}`);
    console.log(`     COGS                        : ৳${cost.toLocaleString()}`);
    console.log(`     Gross profit                : ৳${grossProfit.toLocaleString()}`);
    console.log(`     Coupon/markdown discounts   : ৳${discounts.toLocaleString()}`);
    console.log(`     Net profit                  : ৳${(grossProfit - discounts).toLocaleString()}`);

    await mongoose.disconnect();
    console.log('✔ Done. Disconnected.');
    process.exit(0);
}

run().catch(async (err) => {
    console.error('✖ Seed failed:', err);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
