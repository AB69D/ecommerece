"use client";
import { useState, useEffect, useRef } from "react";
import { useStorePush } from "@/components/StoreLink";
import { useParams } from "next/navigation";
import { FiArrowLeft, FiCheck, FiTag, FiX, FiMapPin } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";
import { validateCouponPublic } from "@/services/coupons";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { customerFetch } from "@/services/api";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function CheckoutPage() {
    const wa = useWhatsApp();
    const { store = "" } = useParams() || {};
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
    const goTo = useStorePush();
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

    // Online payment availability comes from admin site-settings; when off, only
    // Cash on Delivery is offered. A failed gateway hand-off leaves a note on the
    // confirmation screen (the order is still placed, just unpaid).
    const settings = useSiteSettings();
    const onlinePaymentEnabled = Boolean(settings?.payment?.enabled);
    const [onlineNote, setOnlineNote] = useState("");

    // COD partial deposit state — customer can opt in when feature is enabled.
    const [depositOptIn, setDepositOptIn] = useState(false);
    const [depositMethod, setDepositMethod] = useState('bkash');
    const [depositTxId, setDepositTxId] = useState('');

    // COD OTP verification state — only active when the server returns
    // requiresOtpVerification === true in the order create response.
    const [otpStep, setOtpStep] = useState(false);          // true = show OTP screen
    const [otpOrderId, setOtpOrderId] = useState(null);     // human-readable GG-XXXX
    const [otpOrderData, setOtpOrderData] = useState(null); // full order snapshot
    const [otpCode, setOtpCode] = useState('');
    const [otpMsg, setOtpMsg] = useState({ type: '', text: '' });
    const [otpSubmitting, setOtpSubmitting] = useState(false);
    const [otpResendCooldown, setOtpResendCooldown] = useState(0); // seconds remaining

    const paymentMethods = settings?.paymentMethods || {};
    const codEnabled = paymentMethods?.cod?.enabled !== false;
    const bkashEnabled = Boolean(paymentMethods?.bkash?.enabled && paymentMethods?.bkash?.number);
    const nagadEnabled = Boolean(paymentMethods?.nagad?.enabled && paymentMethods?.nagad?.number);
    const rocketEnabled = Boolean(paymentMethods?.rocket?.enabled && paymentMethods?.rocket?.number);

    // COD partial deposit feature
    const codDepositEnabled = Boolean(settings?.features?.codPartialDeposit);
    const codDepositAmount = settings?.codDeposit?.amount ?? 100;
    const codDepositInstructions = settings?.codDeposit?.instructions || '';

    const minimumOrder = settings?.minimumOrder || {};
    const trustBadges = settings?.trustBadges || {};

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
        local: settings?.delivery?.localCharge ?? 70,
        regional: settings?.delivery?.regionalCharge ?? 100,
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
                headers: { 'Content-Type': 'application/json', 'guest-id': guestId, ...(store ? { 'X-Tenant': store } : {}) },
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
                headers: { 'guest-id': guestId, ...(store ? { 'X-Tenant': store } : {}) }
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
            const res = await validateCouponPublic(code, base, "ecommerce", store);
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

        if (minimumOrder?.enabled && minimumOrder?.amount > 0) {
            const cartNetTotal = afterDiscount - couponDiscount;
            if (cartNetTotal < minimumOrder.amount) {
                const msg = (minimumOrder.message || "Minimum order amount is {amount}.")
                    .replace("{amount}", `${symbol}${minimumOrder.amount}`);
                alert(msg);
                return;
            }
        }

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
                'idempotency-key': idempotencyKeyRef.current,
                ...(store ? { 'X-Tenant': store } : {}),
            };
            // Attach the customer token (when signed in) so the backend stamps
            // this order with customerId and it shows up in their order history.
            const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            // Include deposit fields only when the customer opted in.
            const depositPayload =
                codDepositEnabled &&
                formData.paymentMethod === 'cash_on_delivery' &&
                depositOptIn &&
                depositTxId.trim().length >= 4
                    ? { depositPaymentMethod: depositMethod, depositTransactionId: depositTxId.trim() }
                    : {};

            const res = await fetch(`/api/client/order/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...formData, couponCode: appliedCoupon?.code || "", ...depositPayload })
            });
            const data = await res.json();

            if (data.success) {
                const placedOrder = data.data;

                // The server cleared the cart for this guestId. For a signed-in
                // shopper, keep their account guestId so the (now empty) cart stays
                // bound to the account; for a guest, mint a fresh anonymous id so the
                // next order starts clean. For ONLINE payment this is deferred to the
                // result page (so the gateway round-trip can still match this guest).
                const resetGuestSession = () => {
                    if (customer?.guestId) {
                        localStorage.setItem('guestId', customer.guestId);
                    } else {
                        localStorage.removeItem('guestId');
                        localStorage.setItem('guestId', `guest_${Date.now()}`);
                    }
                    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart-updated'));
                };

                // ── Online payment: hand the placed order off to the gateway. ──
                // The order already exists (stock committed) exactly like COD; we
                // just need it paid. Defer the Purchase pixel + guest reset to the
                // result page, which fires them only once the gateway confirms.
                if (formData.paymentMethod === 'online' && onlinePaymentEnabled) {
                    try {
                        const initRes = await fetch(`/api/client/payment/init`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ orderId: placedOrder?.orderId }),
                        });
                        const initData = await initRes.json();
                        if (initData.success && initData.data?.gatewayUrl) {
                            // Leaving the storefront for the gateway; keep the button
                            // disabled (don't reset guest/cart here).
                            window.location.href = initData.data.gatewayUrl;
                            return;
                        }
                        setOnlineNote(
                            initData.message ||
                                "We couldn't start online payment. Your order is placed — you can pay on delivery.",
                        );
                    } catch {
                        setOnlineNote(
                            "We couldn't start online payment. Your order is placed — you can pay on delivery.",
                        );
                    }
                    // Gateway hand-off failed: show the confirmation screen (unpaid).
                    // No Purchase pixel — the payment didn't complete.
                    setOrderPlaced(true);
                    setOrderData(placedOrder);
                    resetGuestSession();
                    return;
                }

                // ── COD OTP verification required ─────────────────────────────
                // The server created the order and sent a WhatsApp OTP. Show the
                // verification screen instead of the success screen; the success
                // screen appears only after the customer submits the correct code.
                if (placedOrder?.requiresOtpVerification) {
                    setOtpOrderId(placedOrder.orderId);
                    setOtpOrderData(placedOrder);
                    setOtpStep(true);
                    resetGuestSession();
                    return;
                }

                // ── Cash on Delivery (and any non-online method): finalize now. ──
                // Meta Pixel "Purchase" (browser + server-side). Customer
                // email/phone are hashed server-side for better match quality.
                trackPurchase({
                    items,
                    value: placedOrder?.totalAmount ?? totalAmount,
                    currency: code,
                    orderId: placedOrder?.orderId,
                    email: formData.customerEmail,
                    phone: formData.customerPhone,
                    firstName: formData.customerName,
                });
                setOrderPlaced(true);
                setOrderData(placedOrder);
                resetGuestSession();
            } else {
                setOtpMsg({ type: 'error', text: data.message || 'Failed to place order' });
            }
        } catch (err) {
            setOtpMsg({ type: 'error', text: 'Failed to place order. Please try again.' });
        } finally {
            setPlacingOrder(false);
        }
    };

    // Submit the 6-digit OTP the customer received on WhatsApp.
    const handleOtpVerify = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setOtpMsg({ type: 'error', text: 'Please enter the 6-digit code.' });
            return;
        }
        setOtpSubmitting(true);
        setOtpMsg({ type: '', text: '' });
        try {
            const res = await fetch(`/api/client/order/${otpOrderId}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(store ? { 'X-Tenant': store } : {}) },
                body: JSON.stringify({ code: otpCode }),
            });
            const data = await res.json();
            if (data.success) {
                // Verification passed — fire pixel and show the normal success screen.
                trackPurchase({
                    items,
                    value: otpOrderData?.totalAmount ?? totalAmount,
                    currency: code,
                    orderId: otpOrderData?.orderId,
                    email: formData.customerEmail,
                    phone: formData.customerPhone,
                    firstName: formData.customerName,
                });
                setOtpStep(false);
                setOrderPlaced(true);
                setOrderData(otpOrderData);
            } else {
                setOtpMsg({ type: 'error', text: data.message || 'Incorrect code. Please try again.' });
            }
        } catch {
            setOtpMsg({ type: 'error', text: 'Could not verify. Please check your connection and try again.' });
        } finally {
            setOtpSubmitting(false);
        }
    };

    // Request a fresh OTP (called from the OTP screen's Resend button).
    const handleOtpResend = async () => {
        if (otpResendCooldown > 0) return;
        setOtpMsg({ type: '', text: '' });
        try {
            const res = await fetch(`/api/client/order/${otpOrderId}/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(store ? { 'X-Tenant': store } : {}) },
            });
            const data = await res.json();
            if (data.success) {
                setOtpMsg({ type: 'success', text: 'A new code has been sent to your WhatsApp.' });
                // 60-second cooldown to prevent spam.
                setOtpResendCooldown(60);
                const interval = setInterval(() => {
                    setOtpResendCooldown((s) => {
                        if (s <= 1) { clearInterval(interval); return 0; }
                        return s - 1;
                    });
                }, 1000);
            } else {
                setOtpMsg({ type: 'error', text: data.message || 'Could not resend code.' });
            }
        } catch {
            setOtpMsg({ type: 'error', text: 'Could not resend code. Please try again.' });
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
                {onlineNote && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 max-w-md">
                        {onlineNote}
                    </p>
                )}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 mb-1">Your Order ID</p>
                    <p className="font-mono text-xl font-bold text-emerald-700">{orderData.orderId}</p>
                </div>
                <p className="text-sm text-gray-500 mb-6 text-center">
                    Track your order using your phone number: <strong>{orderData.customerPhone}</strong>
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <button
                        onClick={() => goTo(`/track-order?phone=${orderData.customerPhone}`)}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700"
                    >
                        Track Order
                    </button>
                    <button
                        onClick={() => goTo('/')}
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

    // ── OTP verification screen ───────────────────────────────────────────────
    // Shown after a COD order is placed when the server requires phone confirmation.
    if (otpStep && otpOrderId) {
        const maskedPhone = (() => {
            const p = formData.customerPhone || '';
            if (p.length < 5) return p;
            return p.slice(0, 3) + '****' + p.slice(-3);
        })();
        return (
            <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
                    </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Verify Your Phone</h1>
                <p className="text-gray-600 mb-1">Order <span className="font-mono font-bold text-emerald-700">{otpOrderId}</span> has been placed.</p>
                <p className="text-sm text-gray-500 mb-6">
                    A 6-digit code was sent to your WhatsApp at <strong>{maskedPhone}</strong>. Enter it below to confirm your order.
                </p>
                <div className="w-full max-w-xs space-y-3">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpMsg({ type: '', text: '' }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleOtpVerify(); }}
                        placeholder="Enter 6-digit code"
                        className="w-full text-center text-2xl font-mono tracking-widest px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        autoFocus
                    />
                    {otpMsg.text && (
                        <p className={`text-sm px-3 py-2 rounded-lg ${otpMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                            {otpMsg.text}
                        </p>
                    )}
                    <button
                        onClick={handleOtpVerify}
                        disabled={otpSubmitting || otpCode.length !== 6}
                        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {otpSubmitting ? 'Verifying...' : 'Verify & Confirm Order'}
                    </button>
                    <button
                        onClick={handleOtpResend}
                        disabled={otpResendCooldown > 0}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                        {otpResendCooldown > 0 ? `Resend code in ${otpResendCooldown}s` : 'Resend code via WhatsApp'}
                    </button>
                </div>
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
                    onClick={() => goTo('/')}
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
                onClick={() => goTo('/cart')}
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
                                        <option value="local">Local Delivery ({symbol}{deliveryCharges.local})</option>
                                        <option value="regional">Regional Delivery ({symbol}{deliveryCharges.regional})</option>
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

                        <div className="bg-white border rounded-lg p-4 sm:p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Payment Method</h2>
                            <div className="space-y-3">
                                {codEnabled && (
                                    <label
                                        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                                            formData.paymentMethod === 'cash_on_delivery'
                                                ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50'
                                                : 'border-gray-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="cash_on_delivery"
                                            checked={formData.paymentMethod === 'cash_on_delivery'}
                                            onChange={handleChange}
                                            className="mt-1 accent-emerald-600"
                                        />
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-800">Cash on Delivery</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                {paymentMethods?.cod?.instructions || "Pay in cash when your order is delivered."}
                                            </span>
                                        </span>
                                    </label>
                                )}

                                {bkashEnabled && (
                                    <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${formData.paymentMethod === 'bkash' ? 'border-pink-500 ring-1 ring-pink-500 bg-pink-50/50' : 'border-gray-200 hover:border-pink-300'}`}>
                                        <input type="radio" name="paymentMethod" value="bkash" checked={formData.paymentMethod === 'bkash'} onChange={handleChange} className="mt-1 accent-pink-600" />
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-800">bKash</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                {paymentMethods?.bkash?.instructions || `Send payment to ${paymentMethods?.bkash?.number} and attach the transaction screenshot.`}
                                            </span>
                                            {formData.paymentMethod === 'bkash' && (
                                                <span className="block text-xs font-semibold text-pink-700 mt-1">Number: {paymentMethods?.bkash?.number}</span>
                                            )}
                                        </span>
                                    </label>
                                )}

                                {nagadEnabled && (
                                    <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${formData.paymentMethod === 'nagad' ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50/50' : 'border-gray-200 hover:border-orange-300'}`}>
                                        <input type="radio" name="paymentMethod" value="nagad" checked={formData.paymentMethod === 'nagad'} onChange={handleChange} className="mt-1 accent-orange-600" />
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-800">Nagad</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                {paymentMethods?.nagad?.instructions || `Send payment to ${paymentMethods?.nagad?.number} and attach the transaction screenshot.`}
                                            </span>
                                            {formData.paymentMethod === 'nagad' && (
                                                <span className="block text-xs font-semibold text-orange-700 mt-1">Number: {paymentMethods?.nagad?.number}</span>
                                            )}
                                        </span>
                                    </label>
                                )}

                                {rocketEnabled && (
                                    <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${formData.paymentMethod === 'rocket' ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-50/50' : 'border-gray-200 hover:border-purple-300'}`}>
                                        <input type="radio" name="paymentMethod" value="rocket" checked={formData.paymentMethod === 'rocket'} onChange={handleChange} className="mt-1 accent-purple-600" />
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-800">Rocket</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                {paymentMethods?.rocket?.instructions || `Send payment to ${paymentMethods?.rocket?.number} and attach the transaction screenshot.`}
                                            </span>
                                            {formData.paymentMethod === 'rocket' && (
                                                <span className="block text-xs font-semibold text-purple-700 mt-1">Number: {paymentMethods?.rocket?.number}</span>
                                            )}
                                        </span>
                                    </label>
                                )}

                                {onlinePaymentEnabled && (
                                    <label
                                        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                                            formData.paymentMethod === 'online'
                                                ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50'
                                                : 'border-gray-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="online"
                                            checked={formData.paymentMethod === 'online'}
                                            onChange={handleChange}
                                            className="mt-1 accent-emerald-600"
                                        />
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-800">Pay Online</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                Card, bKash, Nagad, Rocket &amp; more — securely via SSLCommerz. You&apos;ll be redirected to complete payment.
                                            </span>
                                        </span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* COD partial deposit — optional advance payment to secure the order */}
                        {codDepositEnabled && formData.paymentMethod === 'cash_on_delivery' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800">
                                            Pay {symbol}{codDepositAmount} advance to secure your order
                                        </p>
                                        <p className="text-xs text-amber-700 mt-0.5">
                                            {codDepositInstructions || "Send a small deposit now via bKash, Nagad, or Rocket. Our team will verify within 30 minutes."}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDepositOptIn((v) => !v)}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            depositOptIn
                                                ? 'bg-amber-600 text-white border-amber-600'
                                                : 'bg-white text-amber-700 border-amber-400 hover:bg-amber-100'
                                        }`}
                                    >
                                        {depositOptIn ? 'Yes, I will pay' : 'Pay deposit'}
                                    </button>
                                </div>

                                {depositOptIn && (
                                    <div className="space-y-3 pt-1">
                                        {/* Method select — only show methods whose numbers are configured */}
                                        <div>
                                            <label className="block text-xs font-medium text-amber-800 mb-1">Send via</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[
                                                    { key: 'bkash', label: 'bKash', number: paymentMethods?.bkash?.number },
                                                    { key: 'nagad', label: 'Nagad', number: paymentMethods?.nagad?.number },
                                                    { key: 'rocket', label: 'Rocket', number: paymentMethods?.rocket?.number },
                                                ].filter((m) => m.number).map(({ key, label, number }) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setDepositMethod(key)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                            depositMethod === key
                                                                ? 'bg-amber-600 text-white border-amber-600'
                                                                : 'bg-white text-amber-700 border-amber-300 hover:border-amber-500'
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                                {/* Fallback: if no numbers configured, show all three */}
                                                {!paymentMethods?.bkash?.number && !paymentMethods?.nagad?.number && !paymentMethods?.rocket?.number && (
                                                    ['bkash', 'nagad', 'rocket'].map((key) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => setDepositMethod(key)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                                                                depositMethod === key
                                                                    ? 'bg-amber-600 text-white border-amber-600'
                                                                    : 'bg-white text-amber-700 border-amber-300 hover:border-amber-500'
                                                            }`}
                                                        >
                                                            {key === 'bkash' ? 'bKash' : key.charAt(0).toUpperCase() + key.slice(1)}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Show the merchant's number for the chosen method */}
                                        {paymentMethods?.[depositMethod]?.number && (
                                            <p className="text-xs font-semibold text-amber-800 bg-white border border-amber-200 rounded-lg px-3 py-2">
                                                Send {symbol}{codDepositAmount} to:{' '}
                                                <span className="font-mono tracking-wide">{paymentMethods[depositMethod].number}</span>
                                            </p>
                                        )}

                                        <div>
                                            <label className="block text-xs font-medium text-amber-800 mb-1">
                                                Transaction ID <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={depositTxId}
                                                onChange={(e) => setDepositTxId(e.target.value)}
                                                placeholder="e.g. ABC123DEF45"
                                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                            />
                                            <p className="text-xs text-amber-600 mt-1">
                                                Enter the transaction ID shown in your {depositMethod === 'bkash' ? 'bKash' : depositMethod.charAt(0).toUpperCase() + depositMethod.slice(1)} app after sending.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {trustBadges?.enabled && (trustBadges?.items || []).some((b) => b.enabled) && (
                            <div className="flex flex-wrap gap-3 py-2">
                                {(trustBadges?.items || []).filter((b) => b.enabled).map((badge) => (
                                    <div key={badge.key} className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                        {badge.icon && <span>{badge.icon}</span>}
                                        <span>{badge.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={placingOrder}
                            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {placingOrder
                                ? (formData.paymentMethod === 'online' ? 'Starting payment…' : 'Placing Order...')
                                : (formData.paymentMethod === 'online'
                                    ? `Pay Online - ${symbol}${totalAmount}`
                                    : `Place Order - ${symbol}${totalAmount}`)}
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
