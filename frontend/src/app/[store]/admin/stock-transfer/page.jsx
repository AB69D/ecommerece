"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    FiPlus, FiX, FiSearch, FiArrowRight, FiPackage, FiCheck,
    FiAlertTriangle, FiRefreshCw,
} from "react-icons/fi";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const STATUS_BADGE = {
    draft: "bg-gray-100 text-gray-600",
    in_transit: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABEL = {
    draft: "Draft",
    in_transit: "In Transit",
    received: "Received",
    cancelled: "Cancelled",
};

const fmtDate = (v) =>
    v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

// ── Product search for transfer items ──────────────────────────────────────
function ProductSearch({ onSelect }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await authFetch(`/api/v1/admin/product/all-products?search=${encodeURIComponent(q)}&limit=15&page=1`);
            const d = await res.json();
            setResults(d?.data?.products || d?.data || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => search(query), 300);
        return () => clearTimeout(t);
    }, [query, search]);

    return (
        <div className="space-y-2">
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products to add…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            {loading && <p className="text-xs text-gray-400 pl-1">Searching…</p>}
            {results.length > 0 && (
                <div className="border border-gray-100 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {results.map((p) => (
                        <div key={p._id} className="p-2.5 hover:bg-gray-50">
                            <p className="text-sm font-medium text-gray-800 truncate">
                                {p.firstName}{p.lastName ? ` ${p.lastName}` : ""}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {(p.weights || []).map((w, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            onSelect({
                                                productId: p._id,
                                                productName: `${p.firstName}${p.lastName ? " " + p.lastName : ""}`,
                                                weightIndex: idx,
                                                weight: w.weight,
                                                sku: w.sku || "",
                                                requestedQty: 1,
                                            });
                                            setQuery("");
                                            setResults([]);
                                        }}
                                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs rounded-md"
                                    >
                                        {w.weight || `Variant ${idx + 1}`}
                                        {w.sku ? ` (${w.sku})` : ""}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Receive modal ───────────────────────────────────────────────────────────
function ReceiveModal({ transfer, onClose, onDone }) {
    const [qtys, setQtys] = useState(() =>
        (transfer.items || []).map((it) => ({
            productId: it.productId,
            weightIndex: it.weightIndex,
            receivedQty: it.shippedQty ?? it.requestedQty,
        }))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const submit = async () => {
        setError("");
        setSaving(true);
        try {
            const res = await authFetch(`/api/v1/admin/stock-transfer/${transfer._id}/receive`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: qtys }),
            });
            const d = await res.json();
            if (d?.success) {
                onDone();
            } else {
                setError(d?.message || "Could not receive transfer.");
            }
        } catch {
            setError("Could not receive transfer.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Receive Transfer — {transfer.transferNo}</h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto space-y-3">
                    {error && (
                        <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
                    )}
                    <p className="text-xs text-gray-400">Enter the actual quantity received for each item.</p>
                    {(transfer.items || []).map((it, i) => (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{it.productName}</p>
                                <p className="text-xs text-gray-400">
                                    {it.weight || `Variant ${it.weightIndex}`} &middot; Shipped: {it.shippedQty ?? it.requestedQty}
                                </p>
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] text-gray-400 mb-0.5">Received qty</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={qtys[i]?.receivedQty ?? ""}
                                    onChange={(e) => {
                                        const arr = [...qtys];
                                        arr[i] = { ...arr[i], receivedQty: Number(e.target.value) };
                                        setQtys(arr);
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-100 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="flex-[2] py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {saving ? "Receiving…" : "Confirm Receipt"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function StockTransferPage() {
    const { store } = useParams() || {};
    const router = useRouter();
    const { can } = useAdminAuth();
    const canWrite = can("inventory:write");

    const [activeTab, setActiveTab] = useState("history");
    const [locations, setLocations] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: "", ok: true });

    // Create transfer form
    const [form, setForm] = useState({
        fromLocationId: "",
        toLocationId: "",
        items: [],
        notes: "",
    });
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Receive modal
    const [receiveModal, setReceiveModal] = useState(null);

    const flash = (text, ok = true) => {
        setMessage({ text, ok });
        setTimeout(() => setMessage({ text: "", ok: true }), 3500);
    };

    const loadLocations = useCallback(async () => {
        try {
            const res = await authFetch("/api/v1/admin/location");
            const d = await res.json();
            if (d?.success) setLocations((d.data || []).filter((l) => l.active !== false));
        } catch {
            /* ignore */
        }
    }, []);

    const loadTransfers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch("/api/v1/admin/stock-transfer?limit=50");
            const d = await res.json();
            if (d?.success) setTransfers(d.data?.transfers || d.data || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLocations();
        loadTransfers();
    }, [loadLocations, loadTransfers]);

    const addItem = (picked) => {
        setForm((f) => ({
            ...f,
            items: [
                ...f.items,
                {
                    productId: picked.productId,
                    productName: picked.productName,
                    weightIndex: picked.weightIndex,
                    weight: picked.weight,
                    sku: picked.sku,
                    requestedQty: picked.requestedQty || 1,
                },
            ],
        }));
    };

    const updateItemQty = (idx, val) => {
        setForm((f) => {
            const items = [...f.items];
            items[idx] = { ...items[idx], requestedQty: Math.max(1, Number(val) || 1) };
            return { ...f, items };
        });
    };

    const removeItem = (idx) => {
        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    };

    const createTransfer = async () => {
        setFormError("");
        if (!form.fromLocationId) { setFormError("Select a source location."); return; }
        if (!form.toLocationId) { setFormError("Select a destination location."); return; }
        if (form.fromLocationId === form.toLocationId) { setFormError("Source and destination cannot be the same."); return; }
        if (form.items.length === 0) { setFormError("Add at least one item."); return; }

        setFormSaving(true);
        try {
            const res = await authFetch("/api/v1/admin/stock-transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fromLocationId: form.fromLocationId,
                    toLocationId: form.toLocationId,
                    items: form.items.map((it) => ({
                        productId: it.productId,
                        productName: it.productName,
                        weightIndex: it.weightIndex,
                        weight: it.weight,
                        requestedQty: Number(it.requestedQty),
                    })),
                    notes: form.notes.trim(),
                }),
            });
            const d = await res.json();
            if (d?.success) {
                flash("Transfer draft created");
                setForm({ fromLocationId: "", toLocationId: "", items: [], notes: "" });
                setActiveTab("history");
                loadTransfers();
            } else {
                setFormError(d?.message || "Could not create transfer.");
            }
        } catch {
            setFormError("Could not create transfer.");
        } finally {
            setFormSaving(false);
        }
    };

    const shipTransfer = async (id) => {
        try {
            const res = await authFetch(`/api/v1/admin/stock-transfer/${id}/ship`, { method: "PATCH" });
            const d = await res.json();
            if (d?.success) { flash("Transfer shipped — stock deducted from source."); loadTransfers(); }
            else flash(d?.message || "Could not ship transfer.", false);
        } catch {
            flash("Could not ship transfer.", false);
        }
    };

    const cancelTransfer = async (id) => {
        try {
            const res = await authFetch(`/api/v1/admin/stock-transfer/${id}/cancel`, { method: "PATCH" });
            const d = await res.json();
            if (d?.success) { flash("Transfer cancelled."); loadTransfers(); }
            else flash(d?.message || "Could not cancel transfer.", false);
        } catch {
            flash("Could not cancel transfer.", false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiRefreshCw className="text-indigo-500" /> Stock Transfers
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Move inventory between warehouses, stores and depots.
                    </p>
                </div>
            </div>

            {message.text && (
                <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
                    message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}>
                    {message.ok ? <FiCheck className="w-4 h-4" /> : <FiAlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border border-gray-200 rounded-xl p-1 w-fit">
                {[
                    { id: "history", label: "Transfer History" },
                    ...(canWrite ? [{ id: "create", label: "Create Transfer" }] : []),
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === t.id
                                ? "bg-indigo-600 text-white"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── CREATE TAB ─────────────────────────────────────────────────── */}
            {activeTab === "create" && canWrite && (
                <div className="space-y-5 max-w-2xl">
                    {formError && (
                        <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{formError}</div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">From Location</label>
                            <select
                                value={form.fromLocationId}
                                onChange={(e) => setForm((f) => ({ ...f, fromLocationId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Select source…</option>
                                {locations.map((l) => (
                                    <option key={l._id} value={l._id}>{l.name} ({l.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">To Location</label>
                            <select
                                value={form.toLocationId}
                                onChange={(e) => setForm((f) => ({ ...f, toLocationId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Select destination…</option>
                                {locations
                                    .filter((l) => l._id !== form.fromLocationId)
                                    .map((l) => (
                                        <option key={l._id} value={l._id}>{l.name} ({l.code})</option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {form.fromLocationId && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
                            <FiArrowRight className="w-3.5 h-3.5 shrink-0" />
                            Stock will be deducted from <strong>{locations.find((l) => l._id === form.fromLocationId)?.name}</strong> when you ship.
                        </div>
                    )}

                    {/* Items */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Items</h4>
                        {form.items.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {form.items.map((it, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{it.productName}</p>
                                            <p className="text-xs text-gray-400">
                                                {it.weight || `Variant ${it.weightIndex}`}
                                                {it.sku ? ` · ${it.sku}` : ""}
                                            </p>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-[10px] text-gray-400 mb-0.5">Qty</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={it.requestedQty}
                                                onChange={(e) => updateItemQty(idx, e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeItem(idx)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                        >
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <ProductSearch onSelect={addItem} />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Reason for transfer, reference number…"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>

                    <button
                        onClick={createTransfer}
                        disabled={formSaving}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 text-sm"
                    >
                        {formSaving ? "Creating…" : "Create Draft Transfer"}
                    </button>
                </div>
            )}

            {/* ── HISTORY TAB ───────────────────────────────────────────────── */}
            {activeTab === "history" && (
                <>
                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : transfers.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                            <FiRefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No transfers yet.</p>
                            {canWrite && (
                                <button
                                    onClick={() => setActiveTab("create")}
                                    className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2"
                                >
                                    <FiPlus className="w-4 h-4" /> Create Transfer
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transfers.map((tr) => (
                                <div
                                    key={tr._id}
                                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                                >
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <code className="text-sm font-mono font-semibold text-gray-800">
                                                    {tr.transferNo}
                                                </code>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[tr.status] || "bg-gray-100 text-gray-600"}`}>
                                                    {STATUS_LABEL[tr.status] || tr.status}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                                <span>{tr.fromLocation?.name || tr.fromLocationId || "—"}</span>
                                                <FiArrowRight className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{tr.toLocation?.name || tr.toLocationId || "—"}</span>
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {(tr.items || []).slice(0, 3).map((it, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-100"
                                                    >
                                                        {it.productName} ({it.weight || `v${it.weightIndex}`}) × {it.requestedQty}
                                                    </span>
                                                ))}
                                                {(tr.items || []).length > 3 && (
                                                    <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-md">
                                                        +{tr.items.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{fmtDate(tr.createdAt)}</p>
                                        </div>

                                        {canWrite && (
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {tr.status === "draft" && (
                                                    <>
                                                        <button
                                                            onClick={() => shipTransfer(tr._id)}
                                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
                                                        >
                                                            Ship
                                                        </button>
                                                        <button
                                                            onClick={() => cancelTransfer(tr._id)}
                                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}
                                                {tr.status === "in_transit" && (
                                                    <button
                                                        onClick={() => setReceiveModal(tr)}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                                                    >
                                                        Receive
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Receive modal */}
            {receiveModal && (
                <ReceiveModal
                    transfer={receiveModal}
                    onClose={() => setReceiveModal(null)}
                    onDone={() => {
                        setReceiveModal(null);
                        flash("Transfer received — stock added to destination.");
                        loadTransfers();
                    }}
                />
            )}
        </div>
    );
}
