"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
    FiSettings, FiImage, FiUpload, FiTrash2, FiPlus, FiCheck, FiAlertCircle,
    FiType, FiPhone, FiShare2, FiSearch, FiLayout, FiSave, FiX,
} from "react-icons/fi";
import { getSiteSettings, updateSiteSettings, uploadSiteImage } from "@/services/siteSettings";
import { getFooterSettings, updateFooterSettings } from "@/services/footer";
import { useAdminAuth } from "@/context/AdminAuthContext";

const TABS = [
    { id: "branding", label: "Branding", icon: <FiType className="w-4 h-4" /> },
    { id: "contact", label: "Contact & Social", icon: <FiPhone className="w-4 h-4" /> },
    { id: "seo", label: "SEO & Currency", icon: <FiSearch className="w-4 h-4" /> },
    { id: "footer", label: "Footer", icon: <FiLayout className="w-4 h-4" /> },
];

function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            {children}
            {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
        </label>
    );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Toggle({ checked, onChange, label, hint }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1">
            <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                {hint && <p className="text-xs text-gray-400">{hint}</p>}
            </div>
            <button type="button" onClick={() => onChange(!checked)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-indigo-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : ""}`} />
            </button>
        </div>
    );
}

function ImageUpload({ label, value, onChange, hint }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const pick = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true); setErr("");
        try {
            const res = await uploadSiteImage(file);
            if (res?.success && res.data?.url) onChange(res.data.url);
            else setErr(res?.message || "Upload failed");
        } catch { setErr("Upload failed"); }
        finally { setBusy(false); e.target.value = ""; }
    };
    return (
        <Field label={label} hint={hint}>
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {value ? (
                        <Image src={value} alt={label} width={80} height={80} className="object-contain w-full h-full" unoptimized />
                    ) : (
                        <FiImage className="w-7 h-7 text-gray-300" />
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl cursor-pointer w-fit">
                        {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiUpload className="w-4 h-4" />}
                        {busy ? "Uploading..." : "Upload"}
                        <input type="file" accept="image/*" onChange={pick} className="hidden" disabled={busy} />
                    </label>
                    {value && (
                        <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 w-fit">
                            <FiTrash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                    )}
                    {err && <span className="text-xs text-red-500">{err}</span>}
                </div>
            </div>
        </Field>
    );
}

export default function SettingsPage() {
    const { can } = useAdminAuth();
    const editable = can("content:write");
    const [tab, setTab] = useState("branding");
    const [settings, setSettings] = useState(null);
    const [footer, setFooter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const load = useCallback(async () => {
        setLoading(true);
        const [s, f] = await Promise.all([getSiteSettings(), getFooterSettings()]);
        if (s?.success) setSettings(s.data);
        if (f?.success) setFooter(f.data);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const setS = (patch) => setSettings((p) => ({ ...p, ...patch }));
    const setSeo = (patch) => setSettings((p) => ({ ...p, seo: { ...(p.seo || {}), ...patch } }));
    const setF = (patch) => setFooter((p) => ({ ...p, ...patch }));

    const save = async () => {
        setSaving(true); setMsg({ type: "", text: "" });
        try {
            const sPayload = {
                siteName: settings.siteName || "",
                tagline: settings.tagline || "",
                description: settings.description || "",
                logoUrl: settings.logoUrl || "",
                faviconUrl: settings.faviconUrl || "",
                contactEmail: settings.contactEmail || "",
                contactPhone: settings.contactPhone || "",
                contactAddress: settings.contactAddress || "",
                socialLinks: (settings.socialLinks || []).filter((l) => l.platform?.trim() && l.url?.trim()),
                currencyCode: (settings.currencyCode || "USD").toUpperCase().slice(0, 3),
                currencySymbol: settings.currencySymbol || "$",
                seo: {
                    defaultTitle: settings.seo?.defaultTitle || "",
                    defaultDescription: settings.seo?.defaultDescription || "",
                    defaultKeywords: settings.seo?.defaultKeywords || "",
                    ogImage: settings.seo?.ogImage || "",
                },
                maintenanceMode: !!settings.maintenanceMode,
            };
            const fPayload = {
                aboutText: footer.aboutText || "",
                copyrightText: footer.copyrightText || "",
                showNewsletter: !!footer.showNewsletter,
                newsletterTitle: footer.newsletterTitle || "",
                newsletterDescription: footer.newsletterDescription || "",
                showPaymentBadges: !!footer.showPaymentBadges,
                columns: (footer.columns || []).map((c) => ({
                    title: c.title || "",
                    order: c.order || 0,
                    links: (c.links || []).filter((l) => l.label?.trim() && l.url?.trim())
                        .map((l) => ({ label: l.label, url: l.url, openInNewTab: !!l.openInNewTab, order: l.order || 0 })),
                })).filter((c) => c.title.trim()),
                bottomLinks: (footer.bottomLinks || []).filter((l) => l.label?.trim() && l.url?.trim())
                    .map((l) => ({ label: l.label, url: l.url, openInNewTab: !!l.openInNewTab, order: l.order || 0 })),
            };
            const [r1, r2] = await Promise.all([updateSiteSettings(sPayload), updateFooterSettings(fPayload)]);
            if (r1?.success && r2?.success) {
                if (r1.data) setSettings(r1.data);
                if (r2.data) setFooter(r2.data);
                setMsg({ type: "success", text: "Settings saved successfully" });
            } else {
                setMsg({ type: "error", text: r1?.message || r2?.message || "Failed to save settings" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings || !footer) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FiSettings className="text-indigo-600" /> Site Settings
                </h1>
                {editable && (
                    <button onClick={save} disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-xl">
                        {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                        Save changes
                    </button>
                )}
            </div>

            {msg.text && (
                <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {msg.type === "success" ? <FiCheck className="w-5 h-5 shrink-0" /> : <FiAlertCircle className="w-5 h-5 shrink-0" />}
                    <span>{msg.text}</span>
                </div>
            )}
            {!editable && (
                <div className="mb-4 p-3 rounded-xl text-sm bg-amber-50 text-amber-700 border border-amber-200">
                    You have read-only access to settings.
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto mb-5 border-b border-gray-100 -mx-1 px-1">
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <fieldset disabled={!editable} className="space-y-5">
                {tab === "branding" && (
                    <>
                        <Field label="Company name" hint="Shown in the navbar, footer and page titles.">
                            <input className={inputCls} value={settings.siteName || ""} onChange={(e) => setS({ siteName: e.target.value })} placeholder="Your company" />
                        </Field>
                        <Field label="Tagline">
                            <input className={inputCls} value={settings.tagline || ""} onChange={(e) => setS({ tagline: e.target.value })} placeholder="Quality products online" />
                        </Field>
                        <Field label="Description" hint="A short sentence about your store.">
                            <textarea rows={3} className={inputCls} value={settings.description || ""} onChange={(e) => setS({ description: e.target.value })} />
                        </Field>
                        <ImageUpload label="Company logo" value={settings.logoUrl} onChange={(url) => setS({ logoUrl: url })} hint="PNG or SVG, transparent background recommended." />
                        <ImageUpload label="Favicon" value={settings.faviconUrl} onChange={(url) => setS({ faviconUrl: url })} hint="Small square icon shown in the browser tab." />
                    </>
                )}

                {tab === "contact" && (
                    <>
                        <Field label="Contact email">
                            <input type="email" className={inputCls} value={settings.contactEmail || ""} onChange={(e) => setS({ contactEmail: e.target.value })} placeholder="store@example.com" />
                        </Field>
                        <Field label="Contact phone">
                            <input className={inputCls} value={settings.contactPhone || ""} onChange={(e) => setS({ contactPhone: e.target.value })} placeholder="+1 555 000 0000" />
                        </Field>
                        <Field label="Address">
                            <textarea rows={2} className={inputCls} value={settings.contactAddress || ""} onChange={(e) => setS({ contactAddress: e.target.value })} />
                        </Field>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><FiShare2 className="w-4 h-4" /> Social links</span>
                                <button type="button" onClick={() => setS({ socialLinks: [...(settings.socialLinks || []), { platform: "", url: "" }] })}
                                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                    <FiPlus className="w-4 h-4" /> Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(settings.socialLinks || []).length === 0 && <p className="text-xs text-gray-400">No social links yet.</p>}
                                {(settings.socialLinks || []).map((l, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className={`${inputCls} flex-1`} placeholder="Platform (e.g. Facebook)" value={l.platform || ""}
                                            onChange={(e) => { const arr = [...settings.socialLinks]; arr[i] = { ...arr[i], platform: e.target.value }; setS({ socialLinks: arr }); }} />
                                        <input className={`${inputCls} flex-[2]`} placeholder="https://..." value={l.url || ""}
                                            onChange={(e) => { const arr = [...settings.socialLinks]; arr[i] = { ...arr[i], url: e.target.value }; setS({ socialLinks: arr }); }} />
                                        <button type="button" onClick={() => setS({ socialLinks: settings.socialLinks.filter((_, j) => j !== i) })}
                                            className="px-2.5 text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {tab === "seo" && (
                    <>
                        <Field label="Default meta title">
                            <input className={inputCls} value={settings.seo?.defaultTitle || ""} onChange={(e) => setSeo({ defaultTitle: e.target.value })} />
                        </Field>
                        <Field label="Default meta description">
                            <textarea rows={2} className={inputCls} value={settings.seo?.defaultDescription || ""} onChange={(e) => setSeo({ defaultDescription: e.target.value })} />
                        </Field>
                        <Field label="Default keywords" hint="Comma-separated.">
                            <input className={inputCls} value={settings.seo?.defaultKeywords || ""} onChange={(e) => setSeo({ defaultKeywords: e.target.value })} />
                        </Field>
                        <ImageUpload label="Social share image (OG image)" value={settings.seo?.ogImage} onChange={(url) => setSeo({ ogImage: url })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Currency code" hint="3 letters, e.g. USD">
                                <input maxLength={3} className={`${inputCls} uppercase`} value={settings.currencyCode || ""} onChange={(e) => setS({ currencyCode: e.target.value.toUpperCase() })} />
                            </Field>
                            <Field label="Currency symbol">
                                <input maxLength={5} className={inputCls} value={settings.currencySymbol || ""} onChange={(e) => setS({ currencySymbol: e.target.value })} />
                            </Field>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <Toggle label="Maintenance mode" hint="Show a maintenance notice to visitors." checked={!!settings.maintenanceMode} onChange={(v) => setS({ maintenanceMode: v })} />
                        </div>
                    </>
                )}

                {tab === "footer" && (
                    <>
                        <Field label="Footer about text">
                            <textarea rows={3} className={inputCls} value={footer.aboutText || ""} onChange={(e) => setF({ aboutText: e.target.value })} />
                        </Field>
                        <Field label="Copyright text" hint="Leave blank to auto-generate from the company name.">
                            <input className={inputCls} value={footer.copyrightText || ""} onChange={(e) => setF({ copyrightText: e.target.value })} />
                        </Field>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                            <Toggle label="Show newsletter signup" checked={!!footer.showNewsletter} onChange={(v) => setF({ showNewsletter: v })} />
                            {footer.showNewsletter && (
                                <div className="grid gap-2 pt-2">
                                    <input className={inputCls} placeholder="Newsletter title" value={footer.newsletterTitle || ""} onChange={(e) => setF({ newsletterTitle: e.target.value })} />
                                    <input className={inputCls} placeholder="Newsletter description" value={footer.newsletterDescription || ""} onChange={(e) => setF({ newsletterDescription: e.target.value })} />
                                </div>
                            )}
                            <Toggle label="Show payment badges" checked={!!footer.showPaymentBadges} onChange={(v) => setF({ showPaymentBadges: v })} />
                        </div>

                        {/* Footer columns */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Footer link columns</span>
                                <button type="button" onClick={() => setF({ columns: [...(footer.columns || []), { title: "", links: [] }] })}
                                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><FiPlus className="w-4 h-4" /> Add column</button>
                            </div>
                            <div className="space-y-3">
                                {(footer.columns || []).length === 0 && <p className="text-xs text-gray-400">No columns yet.</p>}
                                {(footer.columns || []).map((col, ci) => (
                                    <div key={ci} className="border border-gray-200 rounded-xl p-3 space-y-2">
                                        <div className="flex gap-2">
                                            <input className={`${inputCls} flex-1 font-medium`} placeholder="Column title" value={col.title || ""}
                                                onChange={(e) => { const arr = [...footer.columns]; arr[ci] = { ...arr[ci], title: e.target.value }; setF({ columns: arr }); }} />
                                            <button type="button" onClick={() => setF({ columns: footer.columns.filter((_, j) => j !== ci) })}
                                                className="px-2.5 text-gray-400 hover:text-red-500"><FiTrash2 className="w-4 h-4" /></button>
                                        </div>
                                        <div className="space-y-2 pl-1">
                                            {(col.links || []).map((lnk, li) => (
                                                <div key={li} className="flex gap-2">
                                                    <input className={`${inputCls} flex-1`} placeholder="Label" value={lnk.label || ""}
                                                        onChange={(e) => { const arr = [...footer.columns]; const links = [...(arr[ci].links || [])]; links[li] = { ...links[li], label: e.target.value }; arr[ci] = { ...arr[ci], links }; setF({ columns: arr }); }} />
                                                    <input className={`${inputCls} flex-[2]`} placeholder="/path or https://..." value={lnk.url || ""}
                                                        onChange={(e) => { const arr = [...footer.columns]; const links = [...(arr[ci].links || [])]; links[li] = { ...links[li], url: e.target.value }; arr[ci] = { ...arr[ci], links }; setF({ columns: arr }); }} />
                                                    <button type="button" onClick={() => { const arr = [...footer.columns]; arr[ci] = { ...arr[ci], links: arr[ci].links.filter((_, j) => j !== li) }; setF({ columns: arr }); }}
                                                        className="px-2 text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => { const arr = [...footer.columns]; arr[ci] = { ...arr[ci], links: [...(arr[ci].links || []), { label: "", url: "" }] }; setF({ columns: arr }); }}
                                                className="text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"><FiPlus className="w-3.5 h-3.5" /> Add link</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bottom links */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Bottom bar links</span>
                                <button type="button" onClick={() => setF({ bottomLinks: [...(footer.bottomLinks || []), { label: "", url: "" }] })}
                                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><FiPlus className="w-4 h-4" /> Add</button>
                            </div>
                            <div className="space-y-2">
                                {(footer.bottomLinks || []).map((l, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className={`${inputCls} flex-1`} placeholder="Label" value={l.label || ""}
                                            onChange={(e) => { const arr = [...footer.bottomLinks]; arr[i] = { ...arr[i], label: e.target.value }; setF({ bottomLinks: arr }); }} />
                                        <input className={`${inputCls} flex-[2]`} placeholder="/path or https://..." value={l.url || ""}
                                            onChange={(e) => { const arr = [...footer.bottomLinks]; arr[i] = { ...arr[i], url: e.target.value }; setF({ bottomLinks: arr }); }} />
                                        <button type="button" onClick={() => setF({ bottomLinks: footer.bottomLinks.filter((_, j) => j !== i) })}
                                            className="px-2.5 text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </fieldset>
        </div>
    );
}
