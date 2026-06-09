"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
    FiSearch, FiPlus, FiMinus, FiTrash2, FiShoppingCart, FiX, FiPackage,
    FiCreditCard, FiDollarSign, FiUser, FiPhone, FiCheckCircle,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosProducts, createPosSale } from "@/services/pos";

const lineKey = (productId, weightIndex) => `${productId}::${weightIndex}`;

export default function SellView({ mode, notify }) {
    const { symbol } = useCurrency();
    const isWholesale = mode === "wholesale";
    const money = useCallback((v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, [symbol]);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [categoryId, setCategoryId] = useState("all");
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [submitting, setSubmitting] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPosProducts({ search: debounced });
            if (res?.success) setProducts(res.data || []);
        } catch {
            notify("error", "Failed to load products");
        } finally {
            setLoading(false);
        }
    }, [debounced, notify]);

    useEffect(() => { load(); }, [load]);

    const categories = useMemo(() => {
        const map = new Map();
        products.forEach((p) => { if (p.categoryId) map.set(p.categoryId, p.category); });
        return [...map.entries()].map(([id, name]) => ({ id, name }));
    }, [products]);

    const visibleProducts = useMemo(
        () => (categoryId === "all" ? products : products.filter((p) => p.categoryId === categoryId)),
        [products, categoryId],
    );

    const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
    const lineUnit = useCallback((l) => (isWholesale ? Number(l.unitPrice) || 0 : l.salePrice), [isWholesale]);
    const subtotal = cart.reduce((s, l) => s + lineUnit(l) * l.quantity, 0);

    const addToCart = (product, variant) => {
        if (variant.stock <= 0) return;
        const key = lineKey(product._id, variant.weightIndex);
        setCart((prev) => {
            const existing = prev.find((l) => l.key === key);
            if (existing) {
                if (existing.quantity >= variant.stock) return prev;
                return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
            }
            return [
                ...prev,
                {
                    key,
                    productId: product._id,
                    weightIndex: variant.weightIndex,
                    name: product.name,
                    weight: variant.weight,
                    image: variant.image || product.coverImage,
                    stock: variant.stock,
                    salePrice: variant.salePrice,
                    unitPrice: variant.salePrice,
                    quantity: 1,
                },
            ];
        });
    };

    const changeQty = (key, delta) =>
        setCart((prev) =>
            prev.map((l) => {
                if (l.key !== key) return l;
                const q = Math.min(l.stock, Math.max(1, l.quantity + delta));
                return { ...l, quantity: q };
            }),
        );

    const setUnitPrice = (key, value) =>
        setCart((prev) => prev.map((l) => (l.key === key ? { ...l, unitPrice: value } : l)));

    const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));
    const clearCart = () => { setCart([]); setCustomerName(""); setCustomerPhone(""); };

    const completeSale = async () => {
        if (cart.length === 0) return;
        if (isWholesale && cart.some((l) => !(Number(l.unitPrice) >= 0))) {
            notify("error", "Enter a valid price for every line");
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                saleType: mode,
                paymentMethod,
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                items: cart.map((l) => ({
                    productId: l.productId,
                    weightIndex: l.weightIndex,
                    quantity: l.quantity,
                    ...(isWholesale ? { unitPrice: Number(l.unitPrice) } : {}),
                })),
            };
            const res = await createPosSale(payload);
            if (res?.success) {
                notify("success", `Sale ${res.data?.orderId} completed · ${money(res.data?.totalAmount)}`);
                clearCart();
                setCartOpen(false);
                load();
            } else {
                notify("error", res?.message || "Could not complete sale");
            }
        } catch {
            notify("error", "Network error completing sale");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-full flex">
            {/* Catalog */}
            <section className="flex-1 min-w-0 flex flex-col h-full">
                <div className="p-3 sm:p-4 bg-white border-b border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search products…"
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        {isWholesale && (
                            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">
                                Wholesale pricing
                            </span>
                        )}
                    </div>
                    {categories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            <CatChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>All</CatChip>
                            {categories.map((c) => (
                                <CatChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>{c.name}</CatChip>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-9 h-9 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                        </div>
                    ) : visibleProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <FiPackage className="w-12 h-12 mb-3" />
                            <p className="text-sm">No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {visibleProducts.map((p) => (
                                <ProductCard key={p._id} product={p} onAdd={addToCart} money={money} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Cart — desktop sidebar */}
            <aside className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200 bg-white flex-col h-full">
                <CartPanel
                    mode={mode}
                    cart={cart}
                    money={money}
                    lineUnit={lineUnit}
                    subtotal={subtotal}
                    cartCount={cartCount}
                    changeQty={changeQty}
                    removeLine={removeLine}
                    setUnitPrice={setUnitPrice}
                    clearCart={clearCart}
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    customerPhone={customerPhone}
                    setCustomerPhone={setCustomerPhone}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    submitting={submitting}
                    completeSale={completeSale}
                />
            </aside>

            {/* Cart — mobile floating button */}
            {cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="lg:hidden fixed bottom-20 right-4 z-[65] flex items-center gap-2 px-5 py-3.5 rounded-full bg-teal-500 text-white font-semibold shadow-xl shadow-teal-500/30"
                >
                    <FiShoppingCart className="w-5 h-5" />
                    {cartCount} · {money(subtotal)}
                </button>
            )}

            {/* Cart — mobile drawer */}
            {cartOpen && (
                <div className="lg:hidden fixed inset-0 z-[66] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
                    <div className="relative bg-white rounded-t-3xl max-h-[88%] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FiShoppingCart className="w-5 h-5 text-teal-500" /> Cart
                            </h3>
                            <button onClick={() => setCartOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <CartPanel
                            mode={mode}
                            cart={cart}
                            money={money}
                            lineUnit={lineUnit}
                            subtotal={subtotal}
                            cartCount={cartCount}
                            changeQty={changeQty}
                            removeLine={removeLine}
                            setUnitPrice={setUnitPrice}
                            clearCart={clearCart}
                            customerName={customerName}
                            setCustomerName={setCustomerName}
                            customerPhone={customerPhone}
                            setCustomerPhone={setCustomerPhone}
                            paymentMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
                            submitting={submitting}
                            completeSale={completeSale}
                            embedded
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function CatChip({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
        >
            {children}
        </button>
    );
}

function ProductCard({ product, onAdd, money }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="relative aspect-square bg-slate-100">
                {product.coverImage ? (
                    <Image src={product.coverImage} alt={product.name} fill sizes="200px" className="object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <FiPackage className="w-8 h-8" />
                    </div>
                )}
            </div>
            <div className="p-2.5 flex-1 flex flex-col">
                <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">{product.name}</p>
                <p className="text-[11px] text-slate-400 mb-2">{product.category}</p>
                <div className="mt-auto space-y-1.5">
                    {product.variants.map((v) => {
                        const out = v.stock <= 0;
                        return (
                            <button
                                key={v.weightIndex}
                                disabled={out}
                                onClick={() => onAdd(product, v)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                                    out
                                        ? "border-slate-100 text-slate-300 cursor-not-allowed"
                                        : "border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-slate-700"
                                }`}
                            >
                                <span className="font-medium truncate">{v.weight}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-semibold">{money(v.salePrice)}</span>
                                    <span className={`text-[10px] ${out ? "text-red-300" : "text-slate-400"}`}>
                                        {out ? "0 left" : `${v.stock}`}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function CartPanel(props) {
    const {
        mode, cart, money, lineUnit, subtotal, cartCount, changeQty, removeLine, setUnitPrice,
        clearCart, customerName, setCustomerName, customerPhone, setCustomerPhone,
        paymentMethod, setPaymentMethod, submitting, completeSale, embedded,
    } = props;
    const isWholesale = mode === "wholesale";

    return (
        <>
            {!embedded && (
                <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FiShoppingCart className="w-5 h-5 text-teal-500" /> Cart
                        {cartCount > 0 && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{cartCount}</span>}
                    </h3>
                    {cart.length > 0 && (
                        <button onClick={clearCart} className="text-xs text-slate-400 hover:text-red-500">Clear</button>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                        <FiShoppingCart className="w-10 h-10 mb-2" />
                        <p className="text-sm">Tap a product to add it</p>
                    </div>
                ) : (
                    cart.map((l) => (
                        <div key={l.key} className="flex gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                {l.image ? (
                                    <Image src={l.image} alt={l.name} fill sizes="48px" className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><FiPackage className="w-5 h-5" /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                    <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-1">{l.name}</p>
                                    <button onClick={() => removeLine(l.key)} className="text-slate-300 hover:text-red-500 shrink-0">
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400">{l.weight}</p>
                                <div className="flex items-center justify-between mt-1.5 gap-2">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => changeQty(l.key, -1)} className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                                            <FiMinus className="w-3 h-3" />
                                        </button>
                                        <span className="w-7 text-center text-sm font-semibold">{l.quantity}</span>
                                        <button onClick={() => changeQty(l.key, 1)} disabled={l.quantity >= l.stock} className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                                            <FiPlus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {isWholesale ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400">@</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={l.unitPrice}
                                                onChange={(e) => setUnitPrice(l.key, e.target.value)}
                                                className="w-20 px-2 py-1 text-sm text-right border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-sm font-semibold text-slate-700">{money(lineUnit(l) * l.quantity)}</span>
                                    )}
                                </div>
                                {isWholesale && (
                                    <p className="text-[11px] text-slate-400 text-right mt-1">
                                        Line: {money(lineUnit(l) * l.quantity)} · was {money(l.salePrice)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Checkout footer */}
            <div className="shrink-0 border-t border-slate-100 p-3 space-y-3 bg-white">
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer"
                            className="w-full pl-8 pr-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                        />
                    </div>
                    <div className="relative">
                        <FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Phone"
                            className="w-full pl-8 pr-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <PayBtn active={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} icon={<FiDollarSign className="w-4 h-4" />} label="Cash" />
                    <PayBtn active={paymentMethod === "card"} onClick={() => setPaymentMethod("card")} icon={<FiCreditCard className="w-4 h-4" />} label="Card" />
                </div>

                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total</span>
                    <span className="text-xl font-bold text-slate-900">{money(subtotal)}</span>
                </div>

                <button
                    onClick={completeSale}
                    disabled={cart.length === 0 || submitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
                >
                    {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <><FiCheckCircle className="w-5 h-5" /> Complete {isWholesale ? "wholesale " : ""}sale</>
                    )}
                </button>
            </div>
        </>
    );
}

function PayBtn({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                active ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
        >
            {icon} {label}
        </button>
    );
}
