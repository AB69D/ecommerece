"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import {
    FiSearch, FiPlus, FiMinus, FiTrash2, FiShoppingCart, FiX, FiPackage,
    FiCreditCard, FiDollarSign, FiUser, FiPhone, FiCheckCircle, FiCamera, FiTag,
    FiWifiOff, FiRefreshCw,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosProducts, createPosSale, lookupPosProductByCode, getPosSettings } from "@/services/pos";
import { validateCouponAdmin } from "@/services/coupons";
import { enqueueSale, countQueued, flushQueue } from "@/lib/posQueue";
import ReceiptModal from "./Receipt.jsx";

// Small inline barcode glyph (no extra icon dependency).
function BarcodeGlyph({ className = "" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
            <path d="M3 5v14M6 5v14M9 5v9M12 5v14M15.5 5v14M19 5v9M21 5v14"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

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

    // Cart-level coupon (retail only — wholesale already uses custom pricing).
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState("");
    const [couponLoading, setCouponLoading] = useState(false);

    // Manual order-level discount (percent or flat). The headline tool for
    // wholesale, where a blanket markdown is the norm; also usable at retail.
    const [discountType, setDiscountType] = useState("percent");
    const [discountValue, setDiscountValue] = useState("");

    // Barcode scanner: USB/manual input + optional camera (native BarcodeDetector).
    const [scanCode, setScanCode] = useState("");
    const [scanning, setScanning] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraSupported, setCameraSupported] = useState(false);
    const lastScanRef = useRef({ code: "", at: 0 });

    // Admin-configurable site settings (receipt layout, feature flags, tax…).
    const [settings, setSettings] = useState(null);
    const [receiptOrder, setReceiptOrder] = useState(null);
    const barcodeEnabled = settings?.features?.barcode !== false;
    const receiptEnabled = settings?.features?.receiptPrinting !== false;
    const pwaEnabled = settings?.features?.pwa !== false;

    // Offline sales queue (only meaningful when the PWA feature is on).
    const [online, setOnline] = useState(true);
    const [queuedCount, setQueuedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        setCameraSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
        getPosSettings().then((res) => {
            if (!res?.success) return;
            setSettings(res.data);
            // Pre-fill the configured default wholesale discount so the cashier
            // doesn't have to type it on every wholesale sale.
            const wpct = Number(res.data?.pos?.wholesaleDiscountPercent) || 0;
            if (isWholesale && wpct > 0) {
                setDiscountType("percent");
                setDiscountValue(String(wpct));
            }
        }).catch(() => {});
    }, [isWholesale]);

    const refreshQueue = useCallback(async () => {
        setQueuedCount(await countQueued());
    }, []);

    // Push any queued offline sales back to the server, one at a time.
    const syncQueue = useCallback(async (silent = false) => {
        if (syncing) return;
        const pending = await countQueued();
        if (pending === 0) { setQueuedCount(0); return; }
        setSyncing(true);
        try {
            const { synced, failed } = await flushQueue(createPosSale);
            if (synced > 0) notify("success", `${synced} offline sale${synced > 1 ? "s" : ""} synced`);
            if (failed > 0) notify("error", `${failed} offline sale${failed > 1 ? "s" : ""} could not be synced`);
            await refreshQueue();
            if (synced > 0) load();
        } catch {
            if (!silent) notify("error", "Could not sync offline sales");
        } finally {
            setSyncing(false);
        }
        // load is stable enough; intentionally not a dep to avoid resync loops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncing, notify, refreshQueue]);

    // Track connectivity and auto-sync when the connection returns.
    useEffect(() => {
        if (!pwaEnabled) return;
        const update = () => setOnline(navigator.onLine);
        update();
        refreshQueue();
        const onOnline = () => { setOnline(true); syncQueue(true); };
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [pwaEnabled, refreshQueue, syncQueue]);

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

    const couponsEnabled = !isWholesale && settings?.features?.coupons !== false;
    const couponDiscount = couponsEnabled ? Math.min(appliedCoupon?.discount || 0, subtotal) : 0;

    // Manual discount amount derived from the cashier's percent/flat input,
    // mirroring the server-side clamp (never below zero, never double-counting
    // whatever the coupon already removed).
    const manualDiscountAmount = useMemo(() => {
        const v = Number(discountValue);
        if (!Number.isFinite(v) || v <= 0) return 0;
        const raw = discountType === "percent" ? subtotal * (Math.min(v, 100) / 100) : v;
        const room = Math.max(0, subtotal - couponDiscount);
        return Math.min(Math.round(raw * 100) / 100, room);
    }, [discountValue, discountType, subtotal, couponDiscount]);

    const total = Math.max(0, subtotal - couponDiscount - manualDiscountAmount);

    const applyCoupon = useCallback(async (rawCode) => {
        const code = String(rawCode || "").trim();
        if (!code) return;
        setCouponLoading(true);
        setCouponError("");
        try {
            const res = await validateCouponAdmin(code, subtotal, "pos");
            if (res?.valid && res.coupon) {
                setAppliedCoupon(res.coupon);
                setCouponInput("");
                notify("success", `Coupon ${res.coupon.code} applied`);
            } else {
                setAppliedCoupon(null);
                setCouponError(res?.reason || "Invalid coupon");
            }
        } catch {
            setCouponError("Could not validate coupon");
        } finally {
            setCouponLoading(false);
        }
    }, [subtotal, notify]);

    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponError("");
    }, []);

    // Re-validate an applied coupon when the cart subtotal changes — a minimum
    // spend may no longer be met after removing items. Silently drops the coupon
    // and surfaces the reason so the cashier isn't surprised at total time.
    useEffect(() => {
        if (!appliedCoupon?.code) return;
        if (!couponsEnabled) { setAppliedCoupon(null); return; }
        let cancelled = false;
        (async () => {
            try {
                const res = await validateCouponAdmin(appliedCoupon.code, subtotal, "pos");
                if (cancelled) return;
                if (res?.valid && res.coupon) {
                    setAppliedCoupon(res.coupon);
                } else {
                    setAppliedCoupon(null);
                    setCouponError(res?.reason || "Coupon no longer valid");
                    notify("info", `Coupon removed: ${res?.reason || "no longer valid"}`);
                }
            } catch { /* keep current coupon on transient errors */ }
        })();
        return () => { cancelled = true; };
        // Re-run only when the subtotal or applied code changes (not on every
        // appliedCoupon object identity change) to avoid an update loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtotal, appliedCoupon?.code, couponsEnabled]);

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

    // Resolve a scanned barcode / typed SKU to a product+variant and drop it
    // into the cart. Debounced so a camera reading the same code across frames
    // (or a double-trigger USB scanner) only adds once.
    const handleScan = useCallback(async (raw) => {
        const code = String(raw || "").trim();
        if (!code) return;
        const now = Date.now();
        if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1200) return;
        lastScanRef.current = { code, at: now };

        setScanning(true);
        try {
            const res = await lookupPosProductByCode(code);
            if (res?.success && res.data?.variant) {
                const d = res.data;
                const v = d.variant;
                if ((v.stock || 0) <= 0) {
                    notify("error", `${d.name} (${v.weight}) is out of stock`);
                } else {
                    addToCart({ _id: d.productId, name: d.name, coverImage: d.coverImage }, v);
                    notify("success", `Added ${d.name} · ${v.weight}`);
                }
            } else {
                notify("error", res?.message || `No product for "${code}"`);
            }
        } catch {
            notify("error", "Scan lookup failed");
        } finally {
            setScanning(false);
        }
        // addToCart only uses setCart (stable functional updates), safe to omit.
    }, [notify]);

    const onScanSubmit = (e) => {
        e.preventDefault();
        const code = scanCode;
        setScanCode("");
        handleScan(code);
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
    const clearCart = () => {
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponError("");
        // Reset the discount, re-applying the wholesale default for the next sale.
        const wpct = Number(settings?.pos?.wholesaleDiscountPercent) || 0;
        setDiscountType("percent");
        setDiscountValue(isWholesale && wpct > 0 ? String(wpct) : "");
    };

    const completeSale = async () => {
        if (cart.length === 0) return;
        if (isWholesale && cart.some((l) => !(Number(l.unitPrice) >= 0))) {
            notify("error", "Enter a valid price for every line");
            return;
        }
        setSubmitting(true);
        const payload = {
            saleType: mode,
            paymentMethod,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            ...(couponsEnabled && appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
            ...(manualDiscountAmount > 0 ? { discountType, discountValue: Number(discountValue) } : {}),
            items: cart.map((l) => ({
                productId: l.productId,
                weightIndex: l.weightIndex,
                quantity: l.quantity,
                ...(isWholesale ? { unitPrice: Number(l.unitPrice) } : {}),
            })),
        };

        // Save the sale locally and finish the transaction without waiting for
        // the server. It will be replayed when the connection returns.
        const queueOffline = async (msg) => {
            await enqueueSale(payload);
            await refreshQueue();
            notify("info", msg);
            clearCart();
            setCartOpen(false);
        };

        // Known-offline: don't even attempt the network round-trip.
        if (pwaEnabled && typeof navigator !== "undefined" && navigator.onLine === false) {
            await queueOffline("Offline — sale saved, will sync when back online");
            setSubmitting(false);
            return;
        }

        try {
            const res = await createPosSale(payload);
            if (res?.success) {
                notify("success", `Sale ${res.data?.orderId} completed · ${money(res.data?.totalAmount)}`);
                clearCart();
                setCartOpen(false);
                if (receiptEnabled && res.data) setReceiptOrder(res.data);
                load();
            } else {
                notify("error", res?.message || "Could not complete sale");
            }
        } catch {
            // The request itself failed (likely offline). Queue rather than lose
            // the sale when the PWA feature is on; otherwise surface the error.
            if (pwaEnabled) {
                await queueOffline("Network issue — sale queued for sync");
            } else {
                notify("error", "Network error completing sale");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const coupon = {
        enabled: couponsEnabled,
        input: couponInput,
        setInput: setCouponInput,
        applied: appliedCoupon,
        error: couponError,
        loading: couponLoading,
        apply: applyCoupon,
        remove: removeCoupon,
        discount: couponDiscount,
        total,
    };

    const discount = {
        type: discountType,
        setType: setDiscountType,
        value: discountValue,
        setValue: setDiscountValue,
        amount: manualDiscountAmount,
        isWholesale,
    };

    return (
        <div className="h-full flex">
            {/* Catalog */}
            <section className="flex-1 min-w-0 flex flex-col h-full">
                <div className="p-3 sm:p-4 bg-white border-b border-slate-200 space-y-3">
                    {/* Offline / pending-sync banner. */}
                    {pwaEnabled && (!online || queuedCount > 0) && (
                        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm ${
                            online ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-800 text-slate-100"
                        }`}>
                            <span className="flex items-center gap-2 min-w-0">
                                <FiWifiOff className="w-4 h-4 shrink-0" />
                                <span className="truncate">
                                    {online
                                        ? `${queuedCount} sale${queuedCount > 1 ? "s" : ""} waiting to sync`
                                        : queuedCount > 0
                                            ? `Offline · ${queuedCount} sale${queuedCount > 1 ? "s" : ""} saved locally`
                                            : "Offline · sales will be saved on this device"}
                                </span>
                            </span>
                            {online && queuedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => syncQueue(false)}
                                    disabled={syncing}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-400 disabled:opacity-50"
                                >
                                    <FiRefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                                    {syncing ? "Syncing…" : "Sync now"}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Barcode / SKU scanner — works with USB scanners, manual typing,
                        and (where supported) the device camera. */}
                    {barcodeEnabled && (
                    <form onSubmit={onScanSubmit} className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <BarcodeGlyph className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500" />
                            <input
                                value={scanCode}
                                onChange={(e) => setScanCode(e.target.value)}
                                placeholder="Scan barcode / SKU — or type a code and press Enter"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                className="w-full pl-9 pr-9 py-2.5 bg-teal-50/60 border border-teal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            {scanning && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={!scanCode.trim() || scanning}
                            className="shrink-0 px-3.5 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-400 disabled:opacity-50"
                        >
                            Add
                        </button>
                        {cameraSupported && (
                            <button
                                type="button"
                                onClick={() => setCameraOpen(true)}
                                title="Scan with camera"
                                className="shrink-0 px-3 py-2.5 rounded-xl border border-teal-200 text-teal-600 hover:bg-teal-50"
                            >
                                <FiCamera className="w-4 h-4" />
                            </button>
                        )}
                    </form>
                    )}

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
                    coupon={coupon}
                    discount={discount}
                    total={total}
                />
            </aside>

            {/* Camera barcode scanner */}
            {cameraOpen && (
                <CameraScanModal onClose={() => setCameraOpen(false)} onDetect={handleScan} />
            )}

            {/* Post-sale receipt */}
            {receiptOrder && (
                <ReceiptModal
                    order={receiptOrder}
                    settings={settings}
                    symbol={symbol}
                    onClose={() => setReceiptOrder(null)}
                />
            )}

            {/* Cart — mobile floating button */}
            {cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="lg:hidden fixed bottom-20 right-4 z-[65] flex items-center gap-2 px-5 py-3.5 rounded-full bg-teal-500 text-white font-semibold shadow-xl shadow-teal-500/30"
                >
                    <FiShoppingCart className="w-5 h-5" />
                    {cartCount} · {money(total)}
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
                            coupon={coupon}
                            discount={discount}
                            total={total}
                            embedded
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Camera-based scanner using the browser's native BarcodeDetector (Chrome /
// Android). Stays open so the cashier can scan several items in a row; the
// parent debounces duplicate reads. Falls back to a clear message where the
// API is unavailable (e.g. desktop Safari) — the USB/manual input still works.
function CameraScanModal({ onClose, onDetect }) {
    const videoRef = useRef(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        let stream;
        let raf;
        let cancelled = false;

        const start = async () => {
            try {
                if (!("BarcodeDetector" in window)) {
                    setErr("Camera scanning isn't supported on this browser. Use a USB scanner or type the code.");
                    return;
                }
                let formats = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "qr_code"];
                try {
                    const supported = await window.BarcodeDetector.getSupportedFormats?.();
                    if (Array.isArray(supported) && supported.length) {
                        formats = formats.filter((f) => supported.includes(f));
                        if (!formats.length) formats = supported;
                    }
                } catch { /* use defaults */ }
                const detector = new window.BarcodeDetector({ formats });

                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                const v = videoRef.current;
                if (v) {
                    v.srcObject = stream;
                    await v.play().catch(() => {});
                }

                const tick = async () => {
                    if (cancelled || !videoRef.current) return;
                    try {
                        const codes = await detector.detect(videoRef.current);
                        if (codes && codes.length && codes[0].rawValue) {
                            onDetect(codes[0].rawValue);
                        }
                    } catch { /* transient detect error, keep scanning */ }
                    raf = requestAnimationFrame(tick);
                };
                raf = requestAnimationFrame(tick);
            } catch {
                setErr("Couldn't access the camera. Check the browser's camera permission and try again.");
            }
        };

        start();
        return () => {
            cancelled = true;
            if (raf) cancelAnimationFrame(raf);
            if (stream) stream.getTracks().forEach((t) => t.stop());
        };
    }, [onDetect]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                        <FiCamera className="w-4 h-4 text-teal-500" /> Scan a barcode
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                <div className="relative aspect-[4/3] bg-black">
                    {err ? (
                        <div className="absolute inset-0 flex items-center justify-center text-center text-slate-200 text-sm p-6">
                            {err}
                        </div>
                    ) : (
                        <>
                            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="w-3/4 h-1/3 border-2 border-teal-400/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                            </div>
                        </>
                    )}
                </div>
                <div className="p-3 text-center text-xs text-slate-500">
                    Point the camera at a product barcode. Items are added to the cart automatically.
                </div>
            </div>
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
        paymentMethod, setPaymentMethod, submitting, completeSale, coupon, discount, total, embedded,
    } = props;
    const isWholesale = mode === "wholesale";
    const couponEnabled = coupon?.enabled;
    const couponApplied = coupon?.applied;
    const couponDiscount = coupon?.discount || 0;
    const manualDiscount = discount?.amount || 0;
    // The parent computes the authoritative total (subtotal − coupon − manual
    // discount, clamped at zero); fall back to subtotal if it wasn't passed.
    const grandTotal = total ?? subtotal;

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

                {couponEnabled && cart.length > 0 && (
                    <div className="space-y-1.5">
                        {couponApplied ? (
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 min-w-0">
                                    <FiTag className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{couponApplied.code}</span>
                                    {couponApplied.type === "percent" && (
                                        <span className="text-emerald-500 font-normal">({couponApplied.value}% off)</span>
                                    )}
                                </span>
                                <button
                                    onClick={coupon.remove}
                                    className="text-emerald-500 hover:text-red-500 shrink-0"
                                    title="Remove coupon"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => { e.preventDefault(); coupon.apply(coupon.input); }}
                                className="flex items-center gap-2"
                            >
                                <div className="relative flex-1">
                                    <FiTag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        value={coupon.input}
                                        onChange={(e) => coupon.setInput(e.target.value.toUpperCase())}
                                        placeholder="Coupon code"
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="w-full pl-8 pr-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 uppercase"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!coupon.input.trim() || coupon.loading}
                                    className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-50"
                                >
                                    {coupon.loading ? "…" : "Apply"}
                                </button>
                            </form>
                        )}
                        {coupon.error && !couponApplied && (
                            <p className="text-[11px] text-red-500">{coupon.error}</p>
                        )}
                    </div>
                )}

                {/* Manual order-level discount (percent / flat). The headline tool
                    for wholesale, where a blanket markdown is expected. */}
                {discount && cart.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                                <button
                                    type="button"
                                    onClick={() => discount.setType("percent")}
                                    className={`px-2.5 py-2 text-xs font-semibold transition-colors ${
                                        discount.type === "percent" ? "bg-amber-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    %
                                </button>
                                <button
                                    type="button"
                                    onClick={() => discount.setType("flat")}
                                    className={`px-2.5 py-2 text-xs font-semibold border-l border-slate-200 transition-colors ${
                                        discount.type === "flat" ? "bg-amber-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    {money(0).replace(/[0-9.,\s]/g, "") || "$"}
                                </button>
                            </div>
                            <div className="relative flex-1">
                                <FiTag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discount.value}
                                    onChange={(e) => discount.setValue(e.target.value)}
                                    placeholder={discount.type === "percent" ? "Discount %" : "Discount amount"}
                                    className="w-full pl-8 pr-2 py-2 text-xs bg-amber-50/50 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                            </div>
                            {Number(discount.value) > 0 && (
                                <button
                                    type="button"
                                    onClick={() => discount.setValue("")}
                                    className="shrink-0 text-slate-300 hover:text-red-500"
                                    title="Clear discount"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-1 text-sm">
                    {(couponDiscount > 0 || manualDiscount > 0) && (
                        <div className="flex items-center justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>{money(subtotal)}</span>
                        </div>
                    )}
                    {couponEnabled && couponDiscount > 0 && (
                        <div className="flex items-center justify-between text-emerald-600">
                            <span>Coupon discount</span>
                            <span>−{money(couponDiscount)}</span>
                        </div>
                    )}
                    {manualDiscount > 0 && (
                        <div className="flex items-center justify-between text-amber-600">
                            <span>
                                Discount
                                {discount?.type === "percent" && Number(discount?.value) > 0 && (
                                    <span className="text-amber-400 font-normal"> ({Number(discount.value)}%)</span>
                                )}
                            </span>
                            <span>−{money(manualDiscount)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total</span>
                        <span className="text-xl font-bold text-slate-900">{money(grandTotal)}</span>
                    </div>
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
