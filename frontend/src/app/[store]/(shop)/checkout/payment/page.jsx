"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStorePush } from "@/components/StoreLink";
import { FiCheck, FiX, FiLoader, FiRefreshCw } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { trackPurchase } from "@/lib/tracking";

// Where the SSLCommerz gateway sends the shopper's browser back to. The order was
// already placed (stock committed) before the redirect; here we confirm the
// outcome by polling the backend's authoritative status (it only reports `paid`
// after validating the transaction against the gateway). We deliberately do NOT
// trust the `status` query hint on its own.
function PaymentResultInner() {
    const goTo = useStorePush();
    const params = useSearchParams();
    const orderId = params.get("order") || "";
    const hint = params.get("status") || ""; // success | failed | cancelled (advisory)

    const { code, symbol } = useCurrency();
    const { customer } = useCustomerAuth();

    const [phase, setPhase] = useState("checking"); // checking | paid | failed
    const [order, setOrder] = useState(null);
    const [retrying, setRetrying] = useState(false);

    const settledRef = useRef(false);
    const trackedRef = useRef(false);

    // After a confirmed payment, reset the guest session the same way the COD
    // flow does: a signed-in shopper keeps their account guestId; a guest gets a
    // fresh anonymous id. (Deferred until here so the order fetch above can still
    // match the original guestId.)
    const resetGuestSession = () => {
        if (typeof window === "undefined") return;
        if (customer?.guestId) {
            localStorage.setItem("guestId", customer.guestId);
        } else {
            localStorage.removeItem("guestId");
            localStorage.setItem("guestId", `guest_${Date.now()}`);
        }
        window.dispatchEvent(new Event("cart-updated"));
    };

    const fetchOrder = async () => {
        try {
            const guestId = typeof window !== "undefined" ? localStorage.getItem("guestId") : null;
            const res = await fetch(`/api/client/order/${encodeURIComponent(orderId)}`, {
                headers: guestId ? { "guest-id": guestId } : {},
            });
            const data = await res.json();
            if (data.success && data.data) return data.data;
        } catch {
            /* ignore — we can still show success from the status payload */
        }
        return null;
    };

    const onPaid = async (statusData) => {
        if (settledRef.current) return;
        settledRef.current = true;
        const full = await fetchOrder();
        setOrder(full || { orderId, totalAmount: statusData?.totalAmount });
        if (!trackedRef.current) {
            trackedRef.current = true;
            trackPurchase({
                items: full?.items || [],
                value: full?.totalAmount ?? statusData?.totalAmount ?? 0,
                currency: code,
                orderId,
                email: full?.customerEmail,
                phone: full?.customerPhone,
                firstName: full?.customerName,
            });
        }
        resetGuestSession();
        setPhase("paid");
    };

    // Poll the backend until the order is paid or we give up. A "success" hint
    // gets a longer budget (settlement may briefly trail the redirect when only
    // the IPN confirms); a "failed"/"cancelled" hint resolves quickly.
    useEffect(() => {
        if (!orderId) {
            setPhase("failed");
            return undefined;
        }
        let cancelled = false;
        let attempts = 0;
        const maxAttempts = hint === "success" ? 20 : 5; // ~40s vs ~10s at 2s

        const poll = async () => {
            attempts += 1;
            try {
                const res = await fetch(`/api/client/payment/status/${encodeURIComponent(orderId)}`);
                const data = await res.json();
                if (cancelled) return;
                if (data.success && data.data) {
                    if (data.data.paid) {
                        await onPaid(data.data);
                        return;
                    }
                    const att = data.data.attemptStatus;
                    if ((att === "failed" || att === "cancelled") && hint !== "success") {
                        setPhase("failed");
                        return;
                    }
                }
            } catch {
                /* transient — keep polling */
            }
            if (cancelled) return;
            if (attempts >= maxAttempts) {
                setPhase("failed");
                return;
            }
            setTimeout(poll, 2000);
        };
        poll();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    // Re-initiate the gateway for the same (still-unpaid) order.
    const retryPayment = async () => {
        if (!orderId) return;
        setRetrying(true);
        try {
            const guestId = typeof window !== "undefined" ? localStorage.getItem("guestId") : null;
            const token = typeof window !== "undefined" ? localStorage.getItem("customer_token") : null;
            const headers = { "Content-Type": "application/json" };
            if (guestId) headers["guest-id"] = guestId;
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/client/payment/init`, {
                method: "POST",
                headers,
                body: JSON.stringify({ orderId }),
            });
            const data = await res.json();
            if (data.success && data.data?.gatewayUrl) {
                window.location.href = data.data.gatewayUrl;
                return;
            }
            alert(data.message || "Could not restart payment. Please try again.");
        } catch {
            alert("Could not restart payment. Please try again.");
        } finally {
            setRetrying(false);
        }
    };

    if (phase === "checking") {
        return (
            <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center">
                <FiLoader className="w-10 h-10 text-emerald-600 animate-spin mb-5" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Confirming your payment…</h1>
                <p className="text-gray-500 max-w-md">
                    Please wait while we confirm your payment with the gateway. This only takes a moment — don&apos;t close this page.
                </p>
            </div>
        );
    }

    if (phase === "paid") {
        return (
            <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <FiCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
                <p className="text-gray-600 mb-4">Thank you — your payment has been received and your order is confirmed.</p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 mb-1">Your Order ID</p>
                    <p className="font-mono text-xl font-bold text-emerald-700">{order?.orderId || orderId}</p>
                    {order?.totalAmount != null && (
                        <p className="text-sm text-gray-600 mt-2">
                            Paid: <strong>{symbol}{order.totalAmount}</strong>
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    {order?.customerPhone && (
                        <button
                            onClick={() => goTo(`/track-order?phone=${order.customerPhone}`)}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700"
                        >
                            Track Order
                        </button>
                    )}
                    <button
                        onClick={() => goTo("/")}
                        className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
                    >
                        Continue Shopping
                    </button>
                </div>
            </div>
        );
    }

    // phase === "failed"
    return (
        <div className="w-full py-12 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <FiX className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Payment Not Completed</h1>
            <p className="text-gray-600 mb-2 max-w-md">
                We couldn&apos;t confirm your payment{hint === "cancelled" ? " (it was cancelled)" : ""}. Your order is
                still reserved{orderId ? "" : ""} — you can try paying again or pay on delivery.
            </p>
            {orderId && (
                <div className="bg-gray-50 rounded-lg p-4 my-4">
                    <p className="text-sm text-gray-500 mb-1">Your Order ID</p>
                    <p className="font-mono text-lg font-bold text-gray-700">{orderId}</p>
                </div>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
                {orderId && (
                    <button
                        onClick={retryPayment}
                        disabled={retrying}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
                        {retrying ? "Starting…" : "Retry Payment"}
                    </button>
                )}
                <button
                    onClick={() => goTo("/")}
                    className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
                >
                    Continue Shopping
                </button>
            </div>
        </div>
    );
}

export default function PaymentResultPage() {
    return (
        <Suspense
            fallback={
                <div className="w-full py-16 flex items-center justify-center">
                    <FiLoader className="w-8 h-8 text-emerald-600 animate-spin" />
                </div>
            }
        >
            <PaymentResultInner />
        </Suspense>
    );
}
