"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    FiFileText, FiSave, FiExternalLink, FiCheck, FiAlertCircle, FiLock, FiEdit3,
} from "react-icons/fi";
import { getPages, getPage, updatePage } from "@/services/pages";
import { useAdminAuth } from "@/context/AdminAuthContext";

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function AdminPagesPage() {
    const { can } = useAdminAuth();
    const editable = can("content:write");

    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSlug, setActiveSlug] = useState(null);
    const [form, setForm] = useState(null);
    const [loadingForm, setLoadingForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getPages();
        if (res?.success) setPages(res.data?.pages || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const openPage = useCallback(async (slug) => {
        setActiveSlug(slug);
        setForm(null);
        setMsg({ type: "", text: "" });
        setLoadingForm(true);
        const res = await getPage(slug);
        if (res?.success) setForm(res.data);
        else setMsg({ type: "error", text: res?.message || "Could not load page" });
        setLoadingForm(false);
    }, []);

    const setField = (patch) => setForm((p) => ({ ...p, ...patch }));

    const save = async () => {
        if (!form) return;
        setSaving(true); setMsg({ type: "", text: "" });
        try {
            const res = await updatePage(form.slug, {
                title: form.title || "",
                body: form.body || "",
                seoTitle: form.seoTitle || "",
                seoDescription: form.seoDescription || "",
                isPublished: form.isPublished !== false,
            });
            if (res?.success) {
                setMsg({ type: "success", text: "Page saved. Live in ~1 minute." });
                load();
            } else {
                setMsg({ type: "error", text: res?.message || "Failed to save page" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiFileText className="text-indigo-600" /> Pages
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Page routes are fixed in code; their content is editable here. Leave a page&apos;s
                        content empty to fall back to the built-in default design.
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-[18rem_1fr] gap-6">
                {/* Page list */}
                <div className="space-y-2">
                    {pages.map((p) => {
                        const isActive = p.slug === activeSlug;
                        const base = "w-full text-left px-4 py-3 rounded-xl border transition-colors";
                        if (!p.editable) {
                            return (
                                <div key={p.slug} className={`${base} border-gray-100 bg-gray-50 text-gray-400 cursor-default`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium">{p.label}</span>
                                        <FiLock className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs">{p.path} · managed elsewhere</span>
                                </div>
                            );
                        }
                        return (
                            <button key={p.slug} type="button" onClick={() => openPage(p.slug)}
                                className={`${base} ${isActive ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`text-sm font-medium ${isActive ? "text-indigo-700" : "text-gray-800"}`}>{p.label}</span>
                                    {p.customised ? (
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                            {p.isPublished ? "Custom" : "Draft"}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Default</span>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400">{p.path}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Editor */}
                <div className="min-h-[20rem]">
                    {!activeSlug && (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl p-10">
                            <FiEdit3 className="w-8 h-8 mb-3" />
                            <p className="text-sm">Select a page on the left to edit its content.</p>
                        </div>
                    )}

                    {activeSlug && loadingForm && (
                        <div className="h-64 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    )}

                    {activeSlug && form && !loadingForm && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">{form.label}</h2>
                                    <p className="text-xs text-gray-400">{form.path}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={form.path} target="_blank"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 border border-gray-200 rounded-xl">
                                        <FiExternalLink className="w-4 h-4" /> View
                                    </Link>
                                    {editable && (
                                        <button onClick={save} disabled={saving}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-xl">
                                            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                                            Save
                                        </button>
                                    )}
                                </div>
                            </div>

                            {msg.text && (
                                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                    {msg.type === "success" ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                                    {msg.text}
                                </div>
                            )}

                            <fieldset disabled={!editable} className="space-y-5 disabled:opacity-70">
                                <label className="block">
                                    <span className="block text-sm font-medium text-gray-700 mb-1">Page title</span>
                                    <input className={inputCls} value={form.title || ""} placeholder="e.g. About Us"
                                        onChange={(e) => setField({ title: e.target.value })} />
                                    <span className="block text-xs text-gray-400 mt-1">Shown as the page heading. Leave empty to use the built-in default.</span>
                                </label>

                                <label className="block">
                                    <span className="block text-sm font-medium text-gray-700 mb-1">Content (HTML)</span>
                                    <textarea rows={16} className={`${inputCls} font-mono text-xs leading-relaxed`}
                                        value={form.body || ""}
                                        placeholder="Leave empty to keep the built-in default design. Supports HTML: <h2>, <p>, <ul><li>, <a href>, <strong>, etc."
                                        onChange={(e) => setField({ body: e.target.value })} />
                                    <span className="block text-xs text-gray-400 mt-1">
                                        Basic HTML is supported (headings, paragraphs, lists, links, bold). When empty, the page shows its original built-in content.
                                    </span>
                                </label>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className="block text-sm font-medium text-gray-700 mb-1">SEO title</span>
                                        <input className={inputCls} value={form.seoTitle || ""}
                                            onChange={(e) => setField({ seoTitle: e.target.value })} />
                                    </label>
                                    <label className="block">
                                        <span className="block text-sm font-medium text-gray-700 mb-1">SEO description</span>
                                        <input className={inputCls} value={form.seoDescription || ""}
                                            onChange={(e) => setField({ seoDescription: e.target.value })} />
                                    </label>
                                </div>

                                <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Published</p>
                                        <p className="text-xs text-gray-400">When off, the page falls back to its built-in default content.</p>
                                    </div>
                                    <button type="button" onClick={() => setField({ isPublished: !(form.isPublished !== false) })}
                                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.isPublished !== false ? "bg-indigo-600" : "bg-gray-300"}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.isPublished !== false ? "translate-x-5" : ""}`} />
                                    </button>
                                </div>
                            </fieldset>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
