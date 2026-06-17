"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    FiPlus, FiEdit2, FiTrash2, FiX, FiMapPin, FiPackage,
    FiToggleLeft, FiToggleRight, FiEye,
} from "react-icons/fi";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const LOCATION_TYPES = ["warehouse", "store", "outlet", "depot"];

const BLANK_FORM = {
    name: "",
    code: "",
    type: "warehouse",
    address: "",
    phone: "",
    managerName: "",
    active: true,
    isDefault: false,
};

function typeBadge(type) {
    const map = {
        warehouse: "bg-blue-50 text-blue-700",
        store: "bg-emerald-50 text-emerald-700",
        outlet: "bg-purple-50 text-purple-700",
        depot: "bg-amber-50 text-amber-700",
    };
    return map[type] || "bg-gray-50 text-gray-600";
}

export default function LocationsPage() {
    const router = useRouter();
    const { store } = useParams() || {};
    const { can } = useAdminAuth();
    const canWrite = can("inventory:write");

    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ show: false, editing: null, form: BLANK_FORM });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [confirmDeactivate, setConfirmDeactivate] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch("/api/v1/admin/location");
            const d = await res.json();
            if (d?.success) setLocations(d.data || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flash = (m) => { setMessage(m); setTimeout(() => setMessage(""), 3000); };

    const openCreate = () => {
        setError("");
        setModal({ show: true, editing: null, form: { ...BLANK_FORM } });
    };

    const openEdit = (loc) => {
        setError("");
        setModal({
            show: true,
            editing: loc,
            form: {
                name: loc.name || "",
                code: loc.code || "",
                type: loc.type || "warehouse",
                address: loc.address || "",
                phone: loc.phone || "",
                managerName: loc.managerName || "",
                active: loc.active !== false,
                isDefault: !!loc.isDefault,
            },
        });
    };

    const closeModal = () => setModal({ show: false, editing: null, form: BLANK_FORM });
    const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

    const save = async () => {
        setError("");
        const f = modal.form;
        if (!f.name.trim()) { setError("Name is required."); return; }
        if (!f.code.trim()) { setError("Code is required."); return; }

        const payload = {
            name: f.name.trim(),
            code: f.code.trim().toUpperCase(),
            type: f.type,
            address: f.address.trim(),
            phone: f.phone.trim(),
            managerName: f.managerName.trim(),
            active: f.active,
            isDefault: f.isDefault,
        };

        setSaving(true);
        try {
            const res = await authFetch(
                modal.editing
                    ? `/api/v1/admin/location/${modal.editing._id}`
                    : "/api/v1/admin/location",
                {
                    method: modal.editing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const d = await res.json();
            if (d?.success) {
                closeModal();
                flash(modal.editing ? "Location updated" : "Location created");
                load();
            } else {
                setError(d?.message || "Could not save location.");
            }
        } catch {
            setError("Could not save location.");
        } finally {
            setSaving(false);
        }
    };

    const deactivate = async (loc) => {
        try {
            const res = await authFetch(`/api/v1/admin/location/${loc._id}`, { method: "DELETE" });
            const d = await res.json();
            if (d?.success) {
                flash("Location deactivated");
                load();
            } else {
                flash(d?.message || "Could not deactivate location.");
            }
        } catch {
            flash("Could not deactivate location.");
        } finally {
            setConfirmDeactivate(null);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiMapPin className="text-indigo-500" /> Warehouses &amp; Locations
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage stock locations, warehouses, stores and depots.
                    </p>
                </div>
                {canWrite && (
                    <button
                        onClick={openCreate}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <FiPlus className="w-4 h-4" /> Add Location
                    </button>
                )}
            </div>

            {message && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                    {message}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="py-16 flex justify-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : locations.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiMapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No locations yet. Create your first warehouse or store.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                <th className="pb-3 pr-4">Name</th>
                                <th className="pb-3 pr-4">Code</th>
                                <th className="pb-3 pr-4">Type</th>
                                <th className="pb-3 pr-4">Address</th>
                                <th className="pb-3 pr-4">Manager</th>
                                <th className="pb-3 pr-4">Status</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {locations.map((loc) => (
                                <tr key={loc._id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-3 pr-4">
                                        <div className="font-medium text-gray-800">{loc.name}</div>
                                        {loc.isDefault && (
                                            <span className="text-[10px] text-indigo-600 font-semibold">DEFAULT</span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                                            {loc.code}
                                        </code>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeBadge(loc.type)}`}>
                                            {loc.type}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-gray-500 max-w-[160px] truncate">
                                        {loc.address || "—"}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-500">
                                        {loc.managerName || "—"}
                                    </td>
                                    <td className="py-3 pr-4">
                                        {loc.active !== false ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => router.push(`/${store}/admin/locations/${loc._id}/stock`)}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="View Stock"
                                            >
                                                <FiEye className="w-4 h-4" />
                                            </button>
                                            {canWrite && (
                                                <>
                                                    <button
                                                        onClick={() => openEdit(loc)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 className="w-4 h-4" />
                                                    </button>
                                                    {loc.active !== false && !loc.isDefault && (
                                                        <button
                                                            onClick={() => setConfirmDeactivate(loc)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                            title="Deactivate"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {modal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
                    <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800">
                                {modal.editing ? "Edit Location" : "Add Location"}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4">
                            {error && (
                                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                                    <input
                                        value={modal.form.name}
                                        onChange={(e) => setField("name", e.target.value)}
                                        placeholder="Main Warehouse"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                    <input
                                        value={modal.form.code}
                                        onChange={(e) => setField("code", e.target.value.toUpperCase())}
                                        placeholder="WH-MAIN"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                                <select
                                    value={modal.form.type}
                                    onChange={(e) => setField("type", e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {LOCATION_TYPES.map((t) => (
                                        <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                                <input
                                    value={modal.form.address}
                                    onChange={(e) => setField("address", e.target.value)}
                                    placeholder="123 Industrial Area, Dhaka"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                                    <input
                                        value={modal.form.phone}
                                        onChange={(e) => setField("phone", e.target.value)}
                                        placeholder="+880..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager Name</label>
                                    <input
                                        value={modal.form.managerName}
                                        onChange={(e) => setField("managerName", e.target.value)}
                                        placeholder="Karim Ahmed"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={modal.form.active}
                                        onChange={(e) => setField("active", e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Active</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={modal.form.isDefault}
                                        onChange={(e) => setField("isDefault", e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Set as default location</span>
                                </label>
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
                                {saving ? "Saving…" : modal.editing ? "Save changes" : "Create Location"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deactivate confirm */}
            {confirmDeactivate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDeactivate(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Deactivate location?</h3>
                        <p className="text-sm text-gray-500 mb-2">
                            Deactivate <strong>&ldquo;{confirmDeactivate.name}&rdquo;</strong>? It will be hidden from new transfers and orders.
                        </p>
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                            This will fail if the location has stock remaining or active orders assigned to it.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDeactivate(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deactivate(confirmDeactivate)}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                            >
                                Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
