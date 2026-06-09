"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
    FiMessageCircle, FiX, FiSend, FiShoppingBag, FiPlus, FiMinus, FiTrash2, FiCheckCircle,
} from "react-icons/fi";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { sendChatMessage } from "@/services/chatbot";

const CTX_KEY = "gg_chat_ctx";
const GUEST_KEY = "gg_chat_guest";
const WHATSAPP_NUMBER = "10000000000";

let _idSeq = 0;
const uid = () => `m${Date.now()}_${_idSeq++}`;

// Minimal **bold** + newline renderer for bot replies.
function RichText({ text }) {
    const lines = String(text || "").split("\n");
    return lines.map((line, i) => (
        <span key={i} className="block">
            {line.split("**").map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>,
            )}
        </span>
    ));
}

function ProductCard({ card, onAdd, disabled }) {
    return (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="flex gap-3 p-2.5">
                {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={card.image}
                        alt={card.name}
                        loading="lazy"
                        className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0">
                        <FiShoppingBag className="w-6 h-6" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2">{card.name}</p>
                    {card.fromPrice && (
                        <p className="text-xs text-gray-500 mt-0.5">from {card.fromPrice}</p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
                {card.variants.map((v) => (
                    <button
                        key={v.weightIndex}
                        type="button"
                        disabled={disabled || !v.inStock}
                        onClick={() => onAdd(card, v)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                            v.inStock
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                        <FiPlus className="inline w-3 h-3 mr-1 -mt-0.5" />
                        {v.weight} · {v.priceLabel}
                        {!v.inStock && " (out)"}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function OrderChatbot() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [context, setContext] = useState(null);
    const [guestId, setGuestId] = useState(null);
    const [cart, setCart] = useState({ lines: [], count: 0, subtotal: 0, subtotalLabel: "" });
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);

    const ctxRef = useRef(null);
    const guestRef = useRef(null);
    const loadingRef = useRef(false);
    const greetedRef = useRef(false);
    const scrollRef = useRef(null);

    // Restore persisted conversation state.
    useEffect(() => {
        try {
            const g = localStorage.getItem(GUEST_KEY);
            if (g) { guestRef.current = g; setGuestId(g); }
            const c = localStorage.getItem(CTX_KEY);
            if (c) { const parsed = JSON.parse(c); ctxRef.current = parsed; setContext(parsed); }
        } catch { /* ignore */ }
    }, []);

    // Persist conversation state.
    useEffect(() => {
        try {
            if (context) localStorage.setItem(CTX_KEY, JSON.stringify(context));
            if (guestId) localStorage.setItem(GUEST_KEY, guestId);
        } catch { /* ignore */ }
    }, [context, guestId]);

    const send = useCallback(async ({ message, action, userText } = {}) => {
        if (loadingRef.current) return;
        if (userText) setMessages((m) => [...m, { id: uid(), from: "user", text: userText }]);
        setLoading(true);
        loadingRef.current = true;
        try {
            const data = await sendChatMessage({
                message,
                action,
                context: ctxRef.current,
                guestId: guestRef.current,
            });
            ctxRef.current = data.context;
            setContext(data.context);
            if (data.context?.guestId) { guestRef.current = data.context.guestId; setGuestId(data.context.guestId); }
            if (data.cart) setCart(data.cart);
            setMessages((m) => [
                ...m,
                {
                    id: uid(),
                    from: "bot",
                    text: data.reply,
                    cards: data.cards || null,
                    quickReplies: data.quickReplies || null,
                    order: data.order || null,
                },
            ]);
        } catch {
            setMessages((m) => [
                ...m,
                { id: uid(), from: "bot", text: "Sorry, I hit a snag. Please try again in a moment." },
            ]);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    // Greet when the panel is first opened.
    useEffect(() => {
        if (open && messages.length === 0 && !greetedRef.current) {
            greetedRef.current = true;
            send({ action: { type: "start" } });
        }
    }, [open, messages.length, send]);

    // Auto-scroll to the latest message.
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, loading, open, cartOpen]);

    if (pathname?.startsWith("/admin") || pathname?.startsWith("/pos")) return null;

    const onSubmit = (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;
        setInput("");
        send({ message: text, userText: text });
    };

    const onQuick = (qr) => {
        if (!qr?.action) return;
        if (qr.action.type) send({ action: qr.action, userText: qr.label });
        else if (qr.action.text) send({ message: qr.action.text, userText: qr.label });
    };

    const onAdd = (card, variant) =>
        send({
            action: { type: "add", productId: card.id, weightIndex: variant.weightIndex },
            userText: `Add ${card.name} (${variant.weight})`,
        });

    const cartLineAction = (type, line) =>
        send({ action: { type, productId: line.productId, weightIndex: line.weightIndex } });

    const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'd like to order a product.")}`;

    return (
        <>
            {/* Launcher */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    aria-label="Open ordering assistant"
                >
                    <FiMessageCircle className="w-7 h-7" />
                    {cart.count > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {cart.count}
                        </span>
                    )}
                </button>
            )}

            {/* Panel */}
            {open && (
                <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:h-[600px] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <FiShoppingBag className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight">Ordering Assistant</p>
                                <p className="text-[11px] text-emerald-100 leading-tight">Order right here in chat</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-white/15 rounded-lg transition-colors"
                                aria-label="Chat on WhatsApp"
                                title="Chat on WhatsApp"
                            >
                                <PiWhatsappLogoBold className="w-5 h-5" />
                            </a>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 hover:bg-white/15 rounded-lg transition-colors"
                                aria-label="Close chat"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
                        {messages.map((m) =>
                            m.from === "user" ? (
                                <div key={m.id} className="flex justify-end">
                                    <div className="max-w-[80%] bg-emerald-600 text-white text-sm px-3 py-2 rounded-2xl rounded-br-sm whitespace-pre-wrap break-words">
                                        {m.text}
                                    </div>
                                </div>
                            ) : (
                                <div key={m.id} className="flex justify-start">
                                    <div className="max-w-[88%] w-full">
                                        <div className="bg-white text-gray-800 text-sm px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 leading-relaxed">
                                            <RichText text={m.text} />
                                        </div>
                                        {m.order && (
                                            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
                                                <FiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                                <div className="text-xs text-emerald-800">
                                                    <p className="font-semibold">Order {m.order.orderId}</p>
                                                    <p>{m.order.itemCount} item(s) · {m.order.totalLabel} · Cash on delivery</p>
                                                </div>
                                            </div>
                                        )}
                                        {m.cards?.map((card) => (
                                            <ProductCard key={card.id} card={card} onAdd={onAdd} disabled={loading} />
                                        ))}
                                        {m.quickReplies?.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {m.quickReplies.map((qr, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => onQuick(qr)}
                                                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                                    >
                                                        {qr.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ),
                        )}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white px-3 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                                    <span className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cart bar */}
                    {cart.count > 0 && (
                        <div className="border-t border-gray-200 bg-white shrink-0">
                            <button
                                type="button"
                                onClick={() => setCartOpen((o) => !o)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm"
                            >
                                <span className="flex items-center gap-2 font-medium text-gray-700">
                                    <FiShoppingBag className="w-4 h-4 text-emerald-600" />
                                    {cart.count} item(s)
                                </span>
                                <span className="font-semibold text-gray-800">{cart.subtotalLabel}</span>
                            </button>
                            {cartOpen && (
                                <div className="max-h-44 overflow-y-auto px-3 pb-2 space-y-1.5">
                                    {cart.lines.map((line) => (
                                        <div key={`${line.productId}_${line.weightIndex}`} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                                            <span className="flex-1 min-w-0 truncate text-gray-700">{line.name} · {line.weight}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button type="button" disabled={loading} onClick={() => cartLineAction("dec", line)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50" aria-label="Decrease">
                                                    <FiMinus className="w-3 h-3" />
                                                </button>
                                                <span className="w-5 text-center font-medium">{line.quantity}</span>
                                                <button type="button" disabled={loading} onClick={() => cartLineAction("inc", line)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50" aria-label="Increase">
                                                    <FiPlus className="w-3 h-3" />
                                                </button>
                                                <button type="button" disabled={loading} onClick={() => cartLineAction("remove", line)} className="w-6 h-6 rounded-md border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 disabled:opacity-50" aria-label="Remove">
                                                    <FiTrash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => { setCartOpen(false); send({ action: { type: "checkout" }, userText: "Checkout" }); }}
                                        className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Checkout · {cart.subtotalLabel}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    <form onSubmit={onSubmit} className="flex items-center gap-2 p-3 border-t border-gray-200 bg-white shrink-0">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a product or message…"
                            className="flex-1 min-w-0 text-sm px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                            aria-label="Message"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="w-10 h-10 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                            aria-label="Send"
                        >
                            <FiSend className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
