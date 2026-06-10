"use client";
import { useState, useEffect, useCallback } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiTag, FiSearch, FiPercent, FiDollarSign } from "react-icons/fi";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "@/services/coupons";
import { getSiteSettings } from "@/services/siteSettings";

const BLANK = {
    code: "",
    description: "",
    type: "percent",
    value: "",
    minSubtotal: "",
    maxDiscount: "",
    startsAt: "",
    expiresAt: "",
    usageLimit: "",
    channels: ["ecommerce", "pos"],
    active: true,
};

// Convert a stored ISO date to the value an <input type="date"> expects.
const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export default function CouponsPage() {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [symbol, setSymbol] = useState("$");
    const [modal, setModal] = useState({ show: false, editing: null, form: BLANK });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listCoupons({ search, limit: 100 });
            if (res?.success) setCoupons(res.data?.coupons || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    useEffect(() => {
        getSiteSettings()
            .then((res) => setSymbol((res?.data || res)?.currencySymbol || "$"))
            .catch(() => {});
    }, []);

    const flash = (m) => { setMessage(m); setTimeout(() => setMessage(""), 2500); };

    const openCreate = () => { setError(""); setModal({ show: true, editing: null, form: { ...BLANK } }); };
    const openEdit = (c) => {
        setError("");
        setModal({
            show: true,
            editing: c,
            form: {
                code: c.code || "",
                description: c.description || "",
                type: c.type || "percent",
                value: c.value ?? "",
                minSubtotal: c.minSubtotal ?? "",
                maxDiscount: c.maxDiscount ?? "",
                startsAt: toDateInput(c.startsAt),
                expiresAt: toDateInput(c.expiresAt),
                usageLimit: c.usageLimit ?? "",
                channels: Array.isArray(c.channels) && c.channels.length ? c.channels : ["ecommerce", "pos"],
                active: c.active !== false,
            },
        });
    };
    const closeModal = () => setModal({ show: false, editing: null, form: BLANK });

    const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));
    const toggleChannel = (ch) =>
        setModal((m) => {
            const has = m.form.channels.includes(ch);
            const next = has ? m.form.channels.filter((c) => c !== ch) : [...m.form.channels, ch];
            return { ...m, form: { ...m.form, channels: next.length ? next : m.form.channels } };
        });

    const save = async () => {
        setError("");
        const f = modal.form;
        if (!f.code || f.code.trim().length < 2) { setError("Enter a coupon code (min 2 characters)."); return; }
        if (f.value === "" || Number(f.value) < 0) { setError("Enter a valid discount value."); return; }
        if (f.type === "percent" && Number(f.value) > 100) { setError("Percent discount cannot exceed 100."); return; }

        const payload = {
            code: f.code.trim().toUpperCase(),
            description: f.description.trim(),
            type: f.type,
            value: Number(f.value),
            minSubtotal: Number(f.minSubtotal) || 0,
            maxDiscount: f.type === "percent" ? Number(f.maxDiscount) || 0 : 0,
            startsAt: f.startsAt || "",
            expiresAt: f.expiresAt || "",
            usageLimit: Number(f.usageLimit) || 0,
            channels: f.channels,
            active: !!f.active,
        };

        setSaving(true);
        try {
            const res = modal.editing
                ? await updateCoupon(modal.editing._id, payload)
                : await createCoupon(payload);
            if (res?.success) {
                closeModal();
                flash(modal.editing ? "Coupon updated" : "Coupon created");
                load();
            } else {
                setError(res?.message || "Could not save coupon.");
            }
        } catch {
            setError("Could not save coupon.");
        } finally {
            setSaving(false);
        }
    };

    const doDelete = async (c) => {
        try {
            const res = await deleteCoupon(c._id);
            if (res?.success) { flash("Coupon deleted"); load(); }
        } catch {
            /* ignore */
        } finally {
            setConfirmDelete(null);
        }
    };

    const fmtVal = (c) => (c.type === "percent" ? `${c.value}%` : `${symbol}${c.value}`);
    const statusOf = (c) => {
        if (!c.active) return { label: "Inactive", cls: "bg-gray-100 text-gray-500" };
        const now = Date.now();
        if (c.startsAt && now < new Date(c.startsAt).getTime()) return { label: "Scheduled", cls: "bg-amber-100 text-amber-700" };
        if (c.expiresAt && now > new Date(c.expiresAt).getTime()) return { label: "Expired", cls: "bg-red-100 text-red-600" };
        if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return { label: "Used up", cls: "bg-red-100 text-red-600" };
        return { label: "Active", cls: "bg-emerald-100 text-emerald-700" };
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiTag className="text-indigo-600" /> Coupons
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Cart-level discount codes for the storefront and POS.</p>
                </div>
                <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2">
                    <FiPlus className="w-4 h-4" /> New coupon
                </button>
            </div>

            {message && <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{message}</div>}

            <div className="relative mb-4 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code or description…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {loading ? (
                <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : coupons.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiTag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No coupons yet. Create your first code.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400 border-b border-gray-100">
                                <th className="py-2.5 px-3 font-medium">Code</th>
                                <th className="py-2.5 px-3 font-medium">Discount</th>
                                <th className="py-2.5 px-3 font-medium">Min spend</th>
                                <th className="py-2.5 px-3 font-medium">Channels</th>
                                <th className="py-2.5 px-3 font-medium">Used</th>
                                <th className="py-2.5 px-3 font-medium">Status</th>
                                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((c) => {
                                const st = statusOf(c);
                                return (
                                    <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                                        <td className="py-2.5 px-3">
                                            <span className="font-mono font-semibold text-gray-800">{c.code}</span>
                                            {c.description ? <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">{c.description}</p> : null}
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-700">
                                            {fmtVal(c)}
                                            {c.type === "percent" && c.maxDiscount > 0 ? <span className="text-xs text-gray-400"> (max {symbol}{c.maxDiscount})</span> : null}
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-600">{c.minSubtotal > 0 ? `${symbol}${c.minSubtotal}` : "—"}</td>
                                        <td className="py-2.5 px-3 text-gray-500 capitalize text-xs">{(c.channels || []).join(", ")}</td>
                                        <td className="py-2.5 px-3 text-gray-600">{c.usedCount || 0}{c.usageLimit > 0 ? ` / ${c.usageLimit}` : ""}</td>
                                        <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit(c)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiEdit2 className="w-4 h-4" /></button>
                                                <button onClick={() => setConfirmDelete(c)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / edit modal */}
            {modal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
                    <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800">{modal.editing ? "Edit coupon" : "New coupon"}</h3>
                            <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                    <input value={modal.form.code} onChange={(e) => setField("code", e.target.value.toUpperCase())} placeholder="SAVE10" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                        <button type="button" onClick={() => setField("type", "percent")} className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${modal.form.type === "percent" ? "bg-indigo-600 text-white" : "text-gray-600"}`}><FiPercent className="w-3.5 h-3.5" /> %</button>
                                        <button type="button" onClick={() => setField("type", "fixed")} className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${modal.form.type === "fixed" ? "bg-indigo-600 text-white" : "text-gray-600"}`}><FiDollarSign className="w-3.5 h-3.5" /> {symbol}</button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                                <input value={modal.form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Spring sale" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{modal.form.type === "percent" ? "Percent off" : "Amount off"}</label>
                                    <input type="number" min={0} value={modal.form.value} onChange={(e) => setField("value", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                {modal.form.type === "percent" && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Max discount ({symbol}, 0 = none)</label>
                                        <input type="number" min={0} value={modal.form.maxDiscount} onChange={(e) => setField("maxDiscount", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Min spend ({symbol}, 0 = none)</label>
                                    <input type="number" min={0} value={modal.form.minSubtotal} onChange={(e) => setField("minSubtotal", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Usage limit (0 = ∞)</label>
                                    <input type="number" min={0} value={modal.form.usageLimit} onChange={(e) => setField("usageLimit", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Starts (optional)</label>
                                    <input type="date" value={modal.form.startsAt} onChange={(e) => setField("startsAt", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Expires (optional)</label>
                                    <input type="date" value={modal.form.expiresAt} onChange={(e) => setField("expiresAt", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Valid channels</label>
                                <div className="flex gap-2">
                                    {[["ecommerce", "Online store"], ["pos", "POS terminal"]].map(([ch, lbl]) => (
                                        <button key={ch} type="button" onClick={() => toggleChannel(ch)} className={`px-3 py-1.5 rounded-lg text-sm border ${modal.form.channels.includes(ch) ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-gray-200 text-gray-500"}`}>{lbl}</button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={modal.form.active} onChange={(e) => setField("active", e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm text-gray-700">Active</span>
                            </label>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex gap-2">
                            <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={save} disabled={saving} className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : modal.editing ? "Save changes" : "Create coupon"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Delete coupon?</h3>
                        <p className="text-sm text-gray-500 mb-6">Delete <strong className="font-mono">{confirmDelete.code}</strong>? This cannot be undone.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={() => doDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
