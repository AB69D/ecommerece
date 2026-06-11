"use client";
import { useEffect, useState, useCallback } from "react";
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiStar, FiCheck, FiX, FiAlertCircle } from "react-icons/fi";
import AccountShell from "@/components/account/AccountShell";
import { customerFetch } from "@/services/api";

const AREAS = [
    { value: "local", label: "Local" },
    { value: "regional", label: "Regional" },
    { value: "international", label: "International" },
];

const EMPTY = { label: "Home", fullName: "", phone: "", addressLine: "", city: "", area: "local", notes: "", isDefault: false };

const inputClass =
    "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400";

function AddressesInner() {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    // editing: null = form closed, "new" = adding, "<id>" = editing that address
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await customerFetch("/api/client/auth/addresses");
            const data = await res.json();
            if (data.success) setAddresses(Array.isArray(data.data) ? data.data : []);
            else setError(data.message || "Could not load your addresses.");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setForm({ ...EMPTY, isDefault: addresses.length === 0 });
        setEditing("new");
    };
    const openEdit = (a) => {
        setForm({
            label: a.label || "Home",
            fullName: a.fullName || "",
            phone: a.phone || "",
            addressLine: a.addressLine || "",
            city: a.city || "",
            area: a.area || "local",
            notes: a.notes || "",
            isDefault: !!a.isDefault,
        });
        setEditing(a._id);
    };
    const closeForm = () => {
        setEditing(null);
        setForm(EMPTY);
    };

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async (e) => {
        e.preventDefault();
        if (!form.addressLine.trim()) {
            setError("Address line is required.");
            return;
        }
        setError("");
        setBusy(true);
        try {
            const isNew = editing === "new";
            const res = await customerFetch(
                isNew ? "/api/client/auth/addresses" : `/api/client/auth/addresses/${editing}`,
                {
                    method: isNew ? "POST" : "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                },
            );
            const data = await res.json();
            if (data.success) {
                setAddresses(Array.isArray(data.data) ? data.data : []);
                closeForm();
            } else {
                setError(data.message || "Could not save the address.");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id) => {
        if (typeof window !== "undefined" && !window.confirm("Remove this address?")) return;
        setBusy(true);
        try {
            const res = await customerFetch(`/api/client/auth/addresses/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) setAddresses(Array.isArray(data.data) ? data.data : []);
            else setError(data.message || "Could not remove the address.");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    const makeDefault = async (id) => {
        setBusy(true);
        try {
            const res = await customerFetch(`/api/client/auth/addresses/${id}/default`, { method: "PATCH" });
            const data = await res.json();
            if (data.success) setAddresses(Array.isArray(data.data) ? data.data : []);
        } catch {
            /* non-fatal */
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="py-16 flex justify-center">
                <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-xl flex items-start gap-2.5 text-sm bg-red-50 text-red-700 border border-red-200">
                    <FiAlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Form */}
            {editing && (
                <div className="bg-white rounded-2xl ring-1 ring-emerald-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-gray-900">
                            {editing === "new" ? "Add a new address" : "Edit address"}
                        </h2>
                        <button onClick={closeForm} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Label</label>
                            <input type="text" value={form.label} onChange={set("label")} placeholder="Home / Office" className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                            <input type="text" value={form.fullName} onChange={set("fullName")} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                            <input type="tel" value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery area</label>
                            <select value={form.area} onChange={set("area")} className={inputClass}>
                                {AREAS.map((a) => (
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address line</label>
                            <input type="text" value={form.addressLine} onChange={set("addressLine")} placeholder="House, road, area" className={inputClass} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                            <input type="text" value={form.city} onChange={set("city")} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="text" value={form.notes} onChange={set("notes")} placeholder="Landmark, instructions" className={inputClass} />
                        </div>
                        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 select-none">
                            <input
                                type="checkbox"
                                checked={form.isDefault}
                                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Set as default delivery address
                        </label>
                        <div className="sm:col-span-2 flex gap-3 pt-1">
                            <button
                                type="submit"
                                disabled={busy}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                {busy ? "Saving…" : editing === "new" ? "Add address" : "Save changes"}
                            </button>
                            <button type="button" onClick={closeForm} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Add button */}
            {!editing && (
                <button
                    onClick={openAdd}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 border-2 border-dashed border-emerald-200 rounded-2xl text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                    <FiPlus className="w-4 h-4" />
                    Add a new address
                </button>
            )}

            {/* List */}
            {addresses.length === 0 && !editing ? (
                <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-10 text-center">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                        <FiMapPin className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="mt-4 font-semibold text-gray-900">No saved addresses</h3>
                    <p className="text-sm text-gray-500 mt-1">Add an address to check out faster next time.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addresses.map((a) => (
                        <div key={a._id} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                        <FiMapPin className="w-4 h-4" />
                                    </span>
                                    <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                                </div>
                                {a.isDefault && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                                        <FiStar className="w-3 h-3" /> Default
                                    </span>
                                )}
                            </div>
                            <div className="mt-3 text-sm text-gray-600 space-y-0.5">
                                {a.fullName && <p className="font-medium text-gray-800">{a.fullName}</p>}
                                <p>{a.addressLine}</p>
                                <p>{[a.city, AREAS.find((x) => x.value === a.area)?.label].filter(Boolean).join(" · ")}</p>
                                {a.phone && <p>{a.phone}</p>}
                                {a.notes && <p className="text-gray-400">{a.notes}</p>}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-50">
                                {!a.isDefault && (
                                    <button
                                        onClick={() => makeDefault(a._id)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                        <FiCheck className="w-3.5 h-3.5" /> Set default
                                    </button>
                                )}
                                <button
                                    onClick={() => openEdit(a)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <FiEdit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                    onClick={() => remove(a._id)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" /> Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function AccountAddressesPage() {
    return (
        <AccountShell title="Addresses" subtitle="Manage your saved delivery addresses">
            <AddressesInner />
        </AccountShell>
    );
}
