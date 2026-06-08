"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiShoppingCart, FiPlus, FiMinus, FiTrash2, FiArrowLeft } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";

export default function CartPage() {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updating, setUpdating] = useState(false);
    const { symbol } = useCurrency();
    const router = useRouter();

    // Get or create guestId
    const getGuestId = () => {
        if (typeof window === 'undefined') return null;
        
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = `guest_${Date.now()}`;
            localStorage.setItem('guestId', guestId);
        }
        return guestId;
    };

    useEffect(() => {
        fetchCart();
    }, []);

    const fetchCart = async () => {
        try {
            const guestId = getGuestId();
            console.log('Fetching cart with guestId:', guestId);
            
            const res = await fetch(`/api/client/cart/get`, {
                headers: { 
                    'guest-id': guestId,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await res.json();
            console.log('Cart response:', data);
            
            if (data.success) {
                setCart(data.data);
            } else {
                setError(data.message || 'Failed to load cart');
            }
        } catch (err) {
            console.error('Fetch cart error:', err);
            setError("Failed to load cart: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (itemId, quantity) => {
        setUpdating(true);
        try {
            const guestId = getGuestId();
            const res = await fetch(`/api/client/cart/update`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'guest-id': guestId
                },
                body: JSON.stringify({ itemId, quantity })
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const removeItem = async (itemId) => {
        setUpdating(true);
        try {
            const guestId = getGuestId();
            const res = await fetch(`/api/client/cart/remove/${itemId}`, {
                method: 'DELETE',
                headers: { 'guest-id': guestId }
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-gray-500">Loading cart...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-20 flex items-center justify-center">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    const items = cart?.items || [];
    
    const getItemDiscount = (item) => {
        if (!item.discountPercent) return 0;
        return (item.price * item.quantity * item.discountPercent) / 100;
    };
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + getItemDiscount(item), 0);
    const afterDiscount = subtotal - totalDiscount;
    
    if (items.length === 0) {
        return (
            <div className="w-full py-20 flex flex-col items-center justify-center">
                <FiShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 mb-4">Add some products to get started</p>
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
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Shopping Cart</h1>
                <span className="text-gray-500">{items.length} items</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    {items.map((item) => (
                        <div key={item._id} className="bg-white border rounded-lg p-4 flex gap-4">
                            <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                {item.productImage ? (
                                    <img
                                        src={item.productImage}
                                        alt={item.productName}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        No Image
                                    </div>
                                )}
                            </div>
                             <div className="flex-1">
                                 <h3 className="font-semibold text-gray-800">{item.productName}</h3>
                                 {item.weight && (
                                     <p className="text-sm text-gray-500">{item.weight}</p>
                                 )}
                                 {item.discountPercent > 0 ? (
                                     <div className="flex items-center gap-2 mt-1">
                                         <p className="text-sm text-gray-400 line-through">{symbol}{item.price}</p>
                                         <p className="text-emerald-600 font-bold">
                                             {symbol}{(item.price - (item.price * item.discountPercent / 100)).toFixed(0)}
                                         </p>
                                         <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                             -{item.discountPercent}%
                                         </span>
                                     </div>
                                 ) : (
                                     <p className="text-emerald-600 font-bold mt-1">{symbol}{item.price}</p>
                                 )}
                                 <div className="flex items-center gap-3 mt-2">
                                     <button
                                         onClick={() => updateQuantity(item._id, item.quantity - 1)}
                                         disabled={updating}
                                         className="p-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                                     >
                                         <FiMinus className="w-4 h-4" />
                                     </button>
                                     <span className="w-8 text-center">{item.quantity}</span>
                                     <button
                                         onClick={() => updateQuantity(item._id, item.quantity + 1)}
                                         disabled={updating}
                                         className="p-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                                     >
                                         <FiPlus className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>
                             <div className="flex flex-col items-end justify-between">
                                 <button
                                     onClick={() => removeItem(item._id)}
                                     disabled={updating}
                                     className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                 >
                                     <FiTrash2 className="w-5 h-5" />
                                 </button>
                                 {item.discountPercent > 0 ? (
                                     <div className="text-right">
                                         <p className="text-xs text-gray-400 line-through">{symbol}{item.price * item.quantity}</p>
                                         <p className="font-bold text-gray-800">
                                             {symbol}{((item.price - (item.price * item.discountPercent / 100)) * item.quantity).toFixed(0)}
                                         </p>
                                     </div>
                                 ) : (
                                     <p className="font-bold text-gray-800">
                                         {symbol}{item.price * item.quantity}
                                     </p>
                                 )}
                             </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white border rounded-lg p-6 h-fit">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>
                    <div className="space-y-2 text-gray-600">
                         <div className="flex justify-between">
                             <span>Subtotal</span>
                             <span>{symbol}{subtotal}</span>
                         </div>
                         {totalDiscount > 0 && (
                             <div className="flex justify-between text-emerald-600">
                                 <span>Discount</span>
                                 <span>-{symbol}{totalDiscount.toFixed(0)}</span>
                             </div>
                         )}
                         <div className="flex justify-between">
                             <span>Shipping</span>
                             <span>To be calculated at checkout</span>
                         </div>
                         <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                             <span>Total</span>
                             <span>{symbol}{afterDiscount}</span>
                         </div>
                     </div>
                    <button
                        onClick={() => router.push('/checkout')}
                        disabled={updating}
                        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg mt-4 hover:bg-emerald-700 disabled:opacity-50"
                    >
                        Proceed to Checkout
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg mt-2 hover:bg-gray-50 flex items-center justify-center gap-2"
                    >
                        <FiArrowLeft className="w-4 h-4" />
                        Continue Shopping
                    </button>
                </div>
            </div>
        </div>
    );
}