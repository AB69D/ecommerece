"use client";
import { useState, useEffect, useCallback } from "react";
import {
    FiPlus, FiEdit2, FiTrash2, FiX, FiZap, FiSearch,
    FiCalendar, FiPackage, FiToggleLeft, FiToggleRight,
} from "react-icons/fi";
import {
    listFlashSales,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
} from "@/services/flashSales";
import { authFetch } from "@/services/api";
import { useCurrency } from "@/context/CurrencyContext";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const toDatetimeLocal = (v) => {
    if (!v) return "";
    const d = new Date(v);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const statusOf = (sale) => {
    if (!sale.active) return { label: "Inactive", cls: "bg-gray-100 text-gray-500" };
    const now = Date.now();
    const start = new Date(sale.startsAt).getTime();
    const end = new Date(sale.endsAt).getTime();
    if (now < start) return { label: "Upcoming", cls: "bg-amber-100 text-amber-700" };
    if (now > end) return { label: "Ended", cls: "bg-red-100 text-red-600" };
    return { label: "Live", cls: "bg-emerald-100 text-emerald-700" };
};

const fmtDate = (v) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

const BLANK_FORM = {
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    active: true,
    items: [],
};

const BLANK_ITEM = {
    productId: "",
    productName: "",
    weightIndex: 0,
    weightLabel: "",
    salePrice: "",
    maxQty: "",
};

// ------------------------------------------------------------------
// Product search mini-picker (inline, no external modal dependency)
// ------------------------------------------------------------------
function ProductPicker({ onSelect, store }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/client/product/products?search=${encodeURIComponent(q)}&limit=20`, {
                headers: store ? { "X-Tenant": store } : {},
            });
            const data = await res.json();
            setResults(data?.data || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [store]);

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
                            <p className="text-sm font-medium text-gray-800 truncate">{p.firstName} {p.lastName || ""}</p>
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
                                                weightLabel: w.weight,
                                                regularPrice: w.price,
                                                salePrice: "",
                                                maxQty: "",
                                            });
                                            setQuery("");
                                            setResults([]);
                                        }}
                                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs rounded-md"
                                    >
                                        {w.weight} — regular price added
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

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------
export default function FlashSalesPage() {
    const { symbol } = useCurrency();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [modal, setModal] = useState({ show: false, editing: null, form: BLANK_FORM });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);

    // Derive store from URL so the product picker can scope searches.
    const store = typeof window !== "undefined"
        ? (window.location.pathname.split("/")[1] || "")
        : "";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listFlashSales({ status: statusFilter || undefined, limit: 100 });
            if (res?.success) setSales(res.data?.sales || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    const flash = (m) => { setMessage(m); setTimeout(() => setMessage(""), 2500); };

    const openCreate = () => {
        setError("");
        setModal({ show: true, editing: null, form: { ...BLANK_FORM, items: [] } });
    };

    const openEdit = (sale) => {
        setError("");
        setModal({
            show: true,
            editing: sale,
            form: {
                title: sale.title || "",
                description: sale.description || "",
                startsAt: toDatetimeLocal(sale.startsAt),
                endsAt: toDatetimeLocal(sale.endsAt),
                active: sale.active !== false,
                items: (sale.items || []).map((it) => ({
                    _id: it._id,
                    productId: String(it.productId),
                    productName: it.productName || "",
                    weightIndex: it.weightIndex,
                    weightLabel: it.weightLabel || "",
                    salePrice: String(it.salePrice),
                    maxQty: it.maxQty != null ? String(it.maxQty) : "",
                    soldQty: it.soldQty || 0,
                })),
            },
        });
    };

    const closeModal = () => setModal({ show: false, editing: null, form: BLANK_FORM });

    const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

    const addItem = (picked) => {
        setModal((m) => ({
            ...m,
            form: {
                ...m.form,
                items: [
                    ...m.form.items,
                    {
                        productId: picked.productId,
                        productName: picked.productName,
                        weightIndex: picked.weightIndex,
                        weightLabel: picked.weightLabel,
                        salePrice: picked.salePrice || "",
                        maxQty: "",
                        soldQty: 0,
                    },
                ],
            },
        }));
    };

    const updateItem = (idx, key, value) => {
        setModal((m) => {
            const items = [...m.form.items];
            items[idx] = { ...items[idx], [key]: value };
            return { ...m, form: { ...m.form, items } };
        });
    };

    const removeItem = (idx) => {
        setModal((m) => ({
            ...m,
            form: { ...m.form, items: m.form.items.filter((_, i) => i !== idx) },
        }));
    };

    const save = async () => {
        setError("");
        const f = modal.form;

        if (!f.title.trim()) { setError("Title is required."); return; }
        if (!f.startsAt) { setError("Start date is required."); return; }
        if (!f.endsAt) { setError("End date is required."); return; }
        if (new Date(f.endsAt) <= new Date(f.startsAt)) {
            setError("End date must be after start date.");
            return;
        }
        if (!f.items.length) { setError("Add at least one product item."); return; }

        for (let i = 0; i < f.items.length; i++) {
            const it = f.items[i];
            if (!it.productId) { setError(`Item ${i + 1}: select a product.`); return; }
            if (!it.salePrice || Number(it.salePrice) <= 0) {
                setError(`Item ${i + 1}: enter a valid sale price.`);
                return;
            }
        }

        const payload = {
            title: f.title.trim(),
            description: f.description.trim(),
            startsAt: new Date(f.startsAt).toISOString(),
            endsAt: new Date(f.endsAt).toISOString(),
            active: !!f.active,
            items: f.items.map((it) => ({
                productId: it.productId,
                productName: it.productName,
                weightIndex: Number(it.weightIndex),
                weightLabel: it.weightLabel,
                salePrice: Number(it.salePrice),
                maxQty: it.maxQty !== "" ? Number(it.maxQty) : null,
                soldQty: it.soldQty || 0,
            })),
        };

        setSaving(true);
        try {
            const res = modal.editing
                ? await updateFlashSale(modal.editing._id, payload)
                : await createFlashSale(payload);
            if (res?.success) {
                closeModal();
                flash(modal.editing ? "Flash sale updated" : "Flash sale created");
                load();
            } else {
                setError(res?.message || "Could not save flash sale.");
            }
        } catch {
            setError("Could not save flash sale.");
        } finally {
            setSaving(false);
        }
    };

    const doDelete = async (sale) => {
        try {
            const res = await deleteFlashSale(sale._id);
            if (res?.success) { flash("Flash sale deleted"); load(); }
        } catch {
            /* ignore */
        } finally {
            setConfirmDelete(null);
        }
    };

    const toggleActive = async (sale) => {
        try {
            await updateFlashSale(sale._id, { active: !sale.active });
            load();
        } catch {
            /* ignore */
        }
    };

    const STATUS_TABS = [
        { value: "", label: "All" },
        { value: "active", label: "Live" },
        { value: "upcoming", label: "Upcoming" },
        { value: "ended", label: "Ended" },
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiZap className="text-amber-500" /> Flash Sales
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Time-limited promotions with per-variant sale prices and countdown timers.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                >
                    <FiPlus className="w-4 h-4" /> New flash sale
                </button>
            </div>

            {message && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                    {message}
                </div>
            )}

            {/* Status tabs */}
            <div className="flex gap-1 mb-5 border border-gray-200 rounded-xl p-1 w-fit">
                {STATUS_TABS.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => setStatusFilter(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            statusFilter === t.value
                                ? "bg-indigo-600 text-white"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="py-16 flex justify-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : sales.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiZap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No flash sales yet. Create your first promotion.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sales.map((sale) => {
                        const st = statusOf(sale);
                        return (
                            <div
                                key={sale._id}
                                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3 flex-wrap"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-gray-800 truncate">{sale.title}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                                            {st.label}
                                        </span>
                                    </div>
                                    {sale.description && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{sale.description}</p>
                                    )}
                                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <FiCalendar className="w-3.5 h-3.5" />
                                            {fmtDate(sale.startsAt)} — {fmtDate(sale.endsAt)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FiPackage className="w-3.5 h-3.5" />
                                            {sale.items?.length || 0} variant{sale.items?.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    {/* Item preview */}
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {(sale.items || []).slice(0, 4).map((it) => (
                                            <span
                                                key={it._id || it.productId}
                                                className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-100"
                                            >
                                                {it.productName || "Product"}{it.weightLabel ? ` (${it.weightLabel})` : ""} — {symbol}{it.salePrice}
                                                {it.maxQty ? ` / max ${it.maxQty}` : ""}
                                            </span>
                                        ))}
                                        {(sale.items || []).length > 4 && (
                                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-md">
                                                +{sale.items.length - 4} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                        onClick={() => toggleActive(sale)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            sale.active
                                                ? "text-emerald-600 hover:bg-emerald-50"
                                                : "text-gray-400 hover:bg-gray-50"
                                        }`}
                                        title={sale.active ? "Deactivate" : "Activate"}
                                    >
                                        {sale.active ? (
                                            <FiToggleRight className="w-5 h-5" />
                                        ) : (
                                            <FiToggleLeft className="w-5 h-5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openEdit(sale)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        <FiEdit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(sale)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit modal */}
            {modal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800">
                                {modal.editing ? "Edit flash sale" : "New flash sale"}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-5">
                            {error && (
                                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
                            )}

                            {/* Basic fields */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                                    <input
                                        value={modal.form.title}
                                        onChange={(e) => setField("title", e.target.value)}
                                        placeholder="Summer Flash Sale"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Description (optional)
                                    </label>
                                    <input
                                        value={modal.form.description}
                                        onChange={(e) => setField("description", e.target.value)}
                                        placeholder="Limited time offer on selected items"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            Start date &amp; time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={modal.form.startsAt}
                                            onChange={(e) => setField("startsAt", e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            End date &amp; time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={modal.form.endsAt}
                                            onChange={(e) => setField("endsAt", e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={modal.form.active}
                                        onChange={(e) => setField("active", e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Active</span>
                                </label>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                    Sale Items
                                </h4>

                                {modal.form.items.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {modal.form.items.map((it, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-end gap-2 bg-gray-50 rounded-lg p-2.5 flex-wrap"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 truncate">
                                                        {it.productName || "Product"}
                                                        {it.weightLabel ? ` — ${it.weightLabel}` : ""}
                                                    </p>
                                                    {it.soldQty > 0 && (
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {it.soldQty} sold
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="w-24">
                                                    <label className="block text-[10px] text-gray-400 mb-0.5">
                                                        Sale price ({symbol})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={it.salePrice}
                                                        onChange={(e) => updateItem(idx, "salePrice", e.target.value)}
                                                        placeholder="0"
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <label className="block text-[10px] text-gray-400 mb-0.5">
                                                        Max qty (blank = ∞)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={it.maxQty}
                                                        onChange={(e) => updateItem(idx, "maxQty", e.target.value)}
                                                        placeholder="∞"
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(idx)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md flex-shrink-0"
                                                >
                                                    <FiX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <ProductPicker onSelect={addItem} store={store} />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-2">
                            <button
                                onClick={closeModal}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={save}
                                disabled={saving}
                                className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? "Saving…" : modal.editing ? "Save changes" : "Create flash sale"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Delete flash sale?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Delete <strong>&ldquo;{confirmDelete.title}&rdquo;</strong>? This cannot be undone and
                            all sale items and sold counters will be lost.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => doDelete(confirmDelete)}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
