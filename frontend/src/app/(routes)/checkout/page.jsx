"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiCheck, FiTag, FiX, FiMapPin } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";
import { validateCouponPublic } from "@/services/coupons";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { customerFetch } from "@/services/api";

export default function CheckoutPage() {
    const wa = useWhatsApp();
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, description }
    const [couponError, setCouponError] = useState("");
    const [couponLoading, setCouponLoading] = useState(false);
    const { symbol, code } = useCurrency();
    const router = useRouter();
    const checkoutTracked = useRef(false);
    // Stable per-attempt idempotency key so a retried/double-tapped submit can't
    // create a duplicate order (the server returns the original instead).
    const idempotencyKeyRef = useRef(null);

    // Signed-in shopper (if any): prefill their contact details and offer their
    // saved addresses. Guests are unaffected — everything below stays optional.
    const { customer } = useCustomerAuth();
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const prefilledRef = useRef(false);

    const getGuestId = () => {
        if (typeof window === 'undefined') return null;
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = `guest_${Date.now()}`;
            localStorage.setItem('guestId', guestId);
        }
        return guestId;
    };
    
    const deliveryCharges = {
        local: 70,
        regional: 100
    };

    const deliveryLabels = {
        local: 'Local Delivery',
        regional: 'Regional Delivery'
    };
    
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        shippingAddress: '',
        deliveryArea: 'local',
        paymentMethod: 'cash_on_delivery',
        notes: ''
    });

    useEffect(() => {
        fetchCart();
    }, []);

    // Compose a saved address into the checkout form. `force` overwrites what's
    // there (used when the shopper taps an address card); without it we only
    // fill blanks (used for the initial default-address prefill so we never
    // stomp something already typed). The storefront delivery selector only
    // offers local/regional, so an "international" address keeps the current area.
    const applyAddress = (a, { force = false } = {}) => {
        const composed = [a.addressLine, a.city].filter(Boolean).join(", ");
        setFormData((f) => ({
            ...f,
            shippingAddress: force || !f.shippingAddress ? composed : f.shippingAddress,
            deliveryArea: a.area === "local" || a.area === "regional" ? a.area : f.deliveryArea,
            customerName: force ? a.fullName || f.customerName : f.customerName || a.fullName || "",
            customerPhone: force ? a.phone || f.customerPhone : f.customerPhone || a.phone || "",
        }));
        setSelectedAddressId(a._id);
    };

    // Once the auth context resolves a signed-in customer, prefill their contact
    // details and load saved addresses (defaulting to their default address).
    useEffect(() => {
        if (!customer || prefilledRef.current) return;
        prefilledRef.current = true;
        setFormData((f) => ({
            ...f,
            customerName: f.customerName || customer.name || "",
            customerPhone: f.customerPhone || customer.phone || "",
            customerEmail: f.customerEmail || customer.email || "",
        }));
        (async () => {
            try {
                const res = await customerFetch("/api/client/auth/addresses");
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length) {
                    setSavedAddresses(data.data);
                    const def = data.data.find((x) => x.isDefault) || data.data[0];
                    if (def) applyAddress(def);
                }
            } catch {
                /* non-fatal: shopper can still type an address */
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer]);

    // Abandoned-checkout capture: once the customer has typed a name or phone,
    // debounce-save their progress so the admin can follow up even if they never
    // complete the order. The backend marks this lead "converted" on order create.
    useEffect(() => {
        if (orderPlaced) return undefined;
        const hasContact = formData.customerName.trim() || formData.customerPhone.trim();
        if (!hasContact) return undefined;

        const timer = setTimeout(() => {
            const guestId = getGuestId();
            fetch(`/api/client/checkout/lead`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'guest-id': guestId },
                body: JSON.stringify({
                    customerName: formData.customerName,
                    customerPhone: formData.customerPhone,
                    customerEmail: formData.customerEmail,
                    shippingAddress: formData.shippingAddress,
                    deliveryArea: formData.deliveryArea
                })
            }).catch(() => {});
        }, 1200);

        return () => clearTimeout(timer);
    }, [formData, orderPlaced]);

    // Fire Meta Pixel "InitiateCheckout" once, as soon as the cart has loaded
    // with items (browser + server-side via the shared tracking helper).
    useEffect(() => {
        const its = cart?.items || [];
        if (checkoutTracked.current || its.length === 0) return;
        checkoutTracked.current = true;
        const value = its.reduce(
            (sum, i) => sum + i.price * i.quantity * (1 - (i.discountPercent || 0) / 100),
            0,
        );
        trackInitiateCheckout({ items: its, value, currency: code });
    }, [cart, code]);

    const fetchCart = async () => {
        try {
            const guestId = getGuestId();
            const res = await fetch(`/api/client/cart/get`, {
                headers: { 'guest-id': guestId }
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Coupon base = the cart's after-item-discount total (matches the value the
    // backend treats as the order subtotal when recomputing the discount).
    const applyCoupon = async () => {
        const code = couponInput.trim();
        if (!code) return;
        setCouponError("");
        setCouponLoading(true);
        try {
            const base = cart?.totalAmount ?? 0;
            const res = await validateCouponPublic(code, base, "ecommerce");
            if (res?.success && res.data?.valid && res.data.coupon) {
                setAppliedCoupon(res.data.coupon);
                setCouponInput("");
            } else {
                setAppliedCoupon(null);
                setCouponError(res?.data?.reason || res?.message || "Invalid coupon code");
            }
        } catch {
            setCouponError("Could not validate coupon");
        } finally {
            setCouponLoading(false);
        }
    };

    const removeCoupon = () => { setAppliedCoupon(null); setCouponError(""); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPlacingOrder(true);

        // Generate the idempotency key once and reuse it across retries of this
        // same checkout, so a network retry or double-tap can't duplicate the order.
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current =
                (typeof crypto !== "undefined" && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        }

        try {
            const guestId = getGuestId();
            const headers = {
                'Content-Type': 'application/json',
                'guest-id': guestId,
                'idempotency-key': idempotencyKeyRef.current
            };
            // Attach the customer token (when signed in) so the backend stamps
            // this order with customerId and it shows up in their order history.
            const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`/api/client/order/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...formData, couponCode: appliedCoupon?.code || "" })
            });
            const data = await res.json();

            if (data.success) {
                // Meta Pixel "Purchase" (browser + server-side). Customer
                // email/phone are hashed server-side for better match quality.
                trackPurchase({
                    items,
                    value: data.data?.totalAmount ?? totalAmount,
                    currency: code,
                    orderId: data.data?.orderId,
                    email: formData.customerEmail,
                    phone: formData.customerPhone,
                    firstName: formData.customerName,
                });
                setOrderPlaced(true);
                setOrderData(data.data);

                // The server cleared the cart for this guestId. For a signed-in
                // shopper, keep their account guestId so the (now empty) cart stays
                // bound to the account; for a guest, mint a fresh anonymous id so the
                // next order starts clean.
                if (customer?.guestId) {
                    localStorage.setItem('guestId', customer.guestId);
                } else {
                    localStorage.removeItem('guestId');
                    const newGuestId = `guest_${Date.now()}`;
                    localStorage.setItem('guestId', newGuestId);
                }
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart-updated'));
            } else {
                alert(data.message || 'Failed to place order');
            }
        } catch (err) {
            alert('Failed to place order');
        } finally {
            setPlacingOrder(false);
        }
    };

    const items = cart?.items || [];
    
    const getItemDiscount = (item) => {
        if (!item.discountPercent) return 0;
        return (item.price * item.quantity * item.discountPercent) / 100;
    };
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + getItemDiscount(item), 0);
    const afterDiscount = subtotal - totalDiscount;

    const couponDiscount = Math.min(appliedCoupon?.discount || 0, afterDiscount);
    const totalAmount = Math.max(0, afterDiscount - couponDiscount) + deliveryCharges[formData.deliveryArea];

    if (orderPlaced && orderData) {
        return (
            <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <FiCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Order Successfully Placed!</h1>
                <p className="text-gray-600 mb-2">Your order is waiting for confirmation.</p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 mb-1">Your Order ID</p>
                    <p className="font-mono text-xl font-bold text-emerald-700">{orderData.orderId}</p>
                </div>
                <p className="text-sm text-gray-500 mb-6 text-center">
                    Track your order using your phone number: <strong>{orderData.customerPhone}</strong>
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <button
                        onClick={() => router.push(`/track-order?phone=${orderData.customerPhone}`)}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700"
                    >
                        Track Order
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
                    >
                        Continue Shopping
                    </button>
                </div>
                {wa.enabled && (
                    <a
                        href={wa.chatUrl(
                            wa.orderTemplate
                                ? wa.fillTemplate(wa.orderTemplate, {
                                      name: orderData.customerName,
                                      orderId: orderData.orderId,
                                      total: `${symbol}${orderData.totalAmount}`,
                                  })
                                : `Hi, I just placed order ${orderData.orderId}. I'd like to confirm it.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold shadow-sm hover:shadow-md transition-all"
                    >
                        <PiWhatsappLogoBold className="w-5 h-5" />
                        Confirm on WhatsApp
                    </a>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full py-12 sm:py-20 flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="w-full py-12 sm:py-20 flex flex-col items-center justify-center px-4 text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
                <button
                    onClick={() => router.push('/')}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
                >
                    Continue Shopping
                </button>
            </div>
        );
    }

    return (
        <div className="w-full py-8">
            <button
                onClick={() => router.push('/cart')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
            >
                <FiArrowLeft className="w-4 h-4" />
                Back to Cart
            </button>

            <h1 className="text-2xl font-bold text-gray-800 mb-6">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white border rounded-lg p-4 sm:p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Delivery Information</h2>

                            {customer && savedAddresses.length > 0 && (
                                <div className="mb-5">
                                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                        <FiMapPin className="w-4 h-4 text-emerald-600" /> Deliver to a saved address
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {savedAddresses.map((a) => {
                                            const active = selectedAddressId === a._id;
                                            return (
                                                <button
                                                    type="button"
                                                    key={a._id}
                                                    onClick={() => applyAddress(a, { force: true })}
                                                    className={`text-left rounded-xl border p-3 transition-all ${
                                                        active
                                                            ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50"
                                                            : "border-gray-200 hover:border-emerald-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold text-gray-800 truncate">{a.label}</span>
                                                        {a.isDefault && <span className="text-[11px] font-semibold text-amber-600 shrink-0">Default</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                        {[a.addressLine, a.city].filter(Boolean).join(", ")}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedAddressId(""); setFormData((f) => ({ ...f, shippingAddress: "" })); }}
                                            className={`text-left rounded-xl border border-dashed p-3 transition-all ${
                                                selectedAddressId === ""
                                                    ? "border-emerald-400 bg-emerald-50/40"
                                                    : "border-gray-300 hover:border-emerald-300"
                                            }`}
                                        >
                                            <span className="text-sm font-medium text-emerald-700">+ Use a new address</span>
                                            <p className="text-xs text-gray-400 mt-0.5">Enter the details below</p>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                        placeholder="Your full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="customerPhone"
                                        value={formData.customerPhone}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                        placeholder="01XXXXXXXXX"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                                    <input
                                        type="email"
                                        name="customerEmail"
                                        value={formData.customerEmail}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                        placeholder="your@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Area</label>
                                    <select
                                        name="deliveryArea"
                                        value={formData.deliveryArea}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                    >
                                        <option value="local">Local Delivery ({symbol}70)</option>
                                        <option value="regional">Regional Delivery ({symbol}100)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                                    <textarea
                                        name="shippingAddress"
                                        value={formData.shippingAddress}
                                        onChange={handleChange}
                                        required
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                        placeholder="Full delivery address"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={placingOrder}
                            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {placingOrder ? 'Placing Order...' : `Place Order - ${symbol}${totalAmount}`}
                        </button>
                    </form>
                </div>

                <div>
                    <div className="bg-white border rounded-lg p-5 sm:p-6 lg:sticky lg:top-24">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {items.map((item) => (
                                <div key={item._id} className="flex gap-3">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        {item.productImage ? (
                                            <img src={item.productImage} alt={item.productName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                        {item.discountPercent > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-gray-400 line-through">{symbol}{item.price * item.quantity}</p>
                                                <p className="text-sm font-bold text-emerald-600">
                                                    {symbol}{(item.price - (item.price * item.discountPercent / 100)) * item.quantity}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold">{symbol}{item.price * item.quantity}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Coupon code */}
                        <div className="border-t mt-4 pt-4">
                            {appliedCoupon ? (
                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FiTag className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="text-sm font-semibold text-emerald-700 font-mono truncate">{appliedCoupon.code}</span>
                                    </div>
                                    <button type="button" onClick={removeCoupon} className="text-emerald-700 hover:text-emerald-900 p-1" aria-label="Remove coupon">
                                        <FiX className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex gap-2">
                                        <input
                                            value={couponInput}
                                            onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                                            placeholder="Coupon code"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
                                            {couponLoading ? "…" : "Apply"}
                                        </button>
                                    </div>
                                    {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
                                </div>
                            )}
                        </div>

                        <div className="border-t mt-4 pt-4 space-y-2">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>{symbol}{subtotal}</span>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Discount</span>
                                    <span>-{symbol}{totalDiscount.toFixed(0)}</span>
                                </div>
                            )}
                            {couponDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Coupon ({appliedCoupon?.code})</span>
                                    <span>-{symbol}{couponDiscount.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600">
                                <span>Shipping ({deliveryLabels[formData.deliveryArea]})</span>
                                <span>{symbol}{deliveryCharges[formData.deliveryArea]}</span>
                            </div>
                            <div className="flex justify-between font-bold text-gray-800 text-lg">
                                <span>Total</span>
                                <span>{symbol}{totalAmount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
