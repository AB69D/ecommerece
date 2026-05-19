"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiCheck } from "react-icons/fi";

export default function CheckoutPage() {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const router = useRouter();

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
        inside_dhaka: 70,
        outside_dhaka: 100
    };

    const deliveryLabels = {
        inside_dhaka: 'Inside Dhaka',
        outside_dhaka: 'Outside Dhaka'
    };
    
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        shippingAddress: '',
        deliveryArea: 'inside_dhaka',
        paymentMethod: 'cash_on_delivery',
        notes: ''
    });

    useEffect(() => {
        fetchCart();
    }, []);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPlacingOrder(true);

        try {
            const guestId = getGuestId();
            const res = await fetch(`/api/client/order/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'guest-id': guestId
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                setOrderPlaced(true);
                setOrderData(data.data);
                localStorage.removeItem('guestId');
                
                // Generate new guest ID for future orders
                const newGuestId = `guest_${Date.now()}`;
                localStorage.setItem('guestId', newGuestId);
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
    
    const totalAmount = afterDiscount + deliveryCharges[formData.deliveryArea];

    if (orderPlaced && orderData) {
        return (
            <div className="w-full py-12 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <FiCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Order Successfully Placed!</h1>
                <p className="text-gray-600 mb-2">Your order is waiting for confirmation.</p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 mb-1">Your Order ID</p>
                    <p className="font-mono text-xl font-bold text-emerald-700">{orderData.orderId}</p>
                </div>
                <p className="text-sm text-gray-500 mb-6 text-center">
                    Track your order using your phone number: <strong>{orderData.customerPhone}</strong>
                </p>
                <div className="flex gap-4">
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
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="w-full py-20 flex flex-col items-center justify-center">
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
                        <div className="bg-white border rounded-lg p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Delivery Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        placeholder="your@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Area</label>
                                    <select
                                        name="deliveryArea"
                                        value={formData.deliveryArea}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="inside_dhaka">Inside Dhaka (70৳)</option>
                                        <option value="outside_dhaka">Outside Dhaka (100৳)</option>
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                            {placingOrder ? 'Placing Order...' : `Place Order - ৳${totalAmount}`}
                        </button>
                    </form>
                </div>

                <div>
                    <div className="bg-white border rounded-lg p-6 sticky top-24">
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
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                        {item.discountPercent > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-gray-400 line-through">৳{item.price * item.quantity}</p>
                                                <p className="text-sm font-bold text-emerald-600">
                                                    ৳{(item.price - (item.price * item.discountPercent / 100)) * item.quantity}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold">৳{item.price * item.quantity}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t mt-4 pt-4 space-y-2">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>৳{subtotal}</span>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Discount</span>
                                    <span>-৳{totalDiscount.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600">
                                <span>Shipping ({deliveryLabels[formData.deliveryArea]})</span>
                                <span>৳{deliveryCharges[formData.deliveryArea]}</span>
                            </div>
                            <div className="flex justify-between font-bold text-gray-800 text-lg">
                                <span>Total</span>
                                <span>৳{totalAmount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
