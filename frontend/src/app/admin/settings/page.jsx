"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
    FiSettings, FiImage, FiUpload, FiTrash2, FiPlus, FiCheck, FiAlertCircle,
    FiType, FiPhone, FiShare2, FiSearch, FiLayout, FiSave, FiX,
    FiToggleRight, FiPrinter, FiTag, FiActivity, FiDroplet, FiRotateCcw,
} from "react-icons/fi";
import { getSiteSettings, updateSiteSettings, uploadSiteImage } from "@/services/siteSettings";
import { getFooterSettings, updateFooterSettings } from "@/services/footer";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { SITE_PAGES, PAGE_BY_PATH } from "@/lib/sitePages";

const TABS = [
    { id: "branding", label: "Branding", icon: <FiType className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <FiDroplet className="w-4 h-4" /> },
    { id: "contact", label: "Contact & Social", icon: <FiPhone className="w-4 h-4" /> },
    { id: "seo", label: "SEO & Currency", icon: <FiSearch className="w-4 h-4" /> },
    { id: "features", label: "Features", icon: <FiToggleRight className="w-4 h-4" /> },
    { id: "pos", label: "POS & Receipt", icon: <FiPrinter className="w-4 h-4" /> },
    { id: "barcode", label: "Barcode & Labels", icon: <FiTag className="w-4 h-4" /> },
    { id: "integrations", label: "Analytics & WhatsApp", icon: <FiActivity className="w-4 h-4" /> },
    { id: "footer", label: "Footer", icon: <FiLayout className="w-4 h-4" /> },
];

// Master feature switches rendered on the Features tab.
const FEATURE_FLAGS = [
    ["barcode", "Barcode & SKU scanning", "Scan products at the POS and print labels."],
    ["coupons", "Coupons & discount codes", "Let customers and cashiers apply promo codes."],
    ["wishlist", "Wishlist", "Shoppers can save products to a wishlist."],
    ["receiptPrinting", "Receipt printing", "Print / share a receipt after every POS sale."],
    ["labelPrinting", "Label printing", "Generate barcode label sheets from the catalogue."],
    ["posShift", "POS shifts & cash drawer", "Open/close cash shifts with an end-of-day report."],
    ["profitReporting", "Profit & cost reporting", "Track margin using each variant's cost price."],
    ["stockLedger", "Stock ledger", "Record every stock movement for an audit trail."],
    ["pwa", "Installable app (PWA)", "Allow installing the store / POS as an app."],
    ["whatsapp", "WhatsApp notifications", "Send order updates over WhatsApp."],
    ["analytics", "Web analytics", "Inject GA4 / Pixel / GTM tags into the storefront."],
    ["productReviews", "Product reviews", "Let shoppers rate and review products."],
];

// Common currencies for the settings dropdown. Picking one auto-fills BOTH the
// ISO code and the display symbol; "Custom" reveals the manual code/symbol
// fields for anything not listed here. The symbol is what shows before prices.
const CURRENCIES = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "CAD", symbol: "$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "$", name: "Australian Dollar" },
    { code: "SGD", symbol: "$", name: "Singapore Dollar" },
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
    { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "KRW", symbol: "₩", name: "South Korean Won" },
    { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
    { code: "NPR", symbol: "Rs", name: "Nepalese Rupee" },
];

// Storefront theme defaults — mirror the backend model so "Reset to brand
// defaults" and any missing swatch fall back to the original emerald/amber look.
const THEME_DEFAULTS = {
    navbarFrom: "#065f46", navbarVia: "#047857", navbarTo: "#064e3b", navbarText: "#ecfdf5",
    footerFrom: "#064e3b", footerVia: "#065f46", footerTo: "#022c22",
    homeFrom: "#ecfdf5", homeTo: "#ffffff",
    primary: "#047857", accent: "#f59e0b",
};
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Guarantee every colour sent to the API is a valid hex so one bad field can
// never 422 the whole settings save; invalid/blank values revert to default.
const sanitizeTheme = (t = {}) => {
    const out = {};
    for (const k of Object.keys(THEME_DEFAULTS)) {
        const v = (t[k] || "").trim();
        out[k] = HEX_RE.test(v) ? v : THEME_DEFAULTS[k];
    }
    return out;
};

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

// A swatch + hex input pair for picking a theme colour. The native colour input
// needs a 6-digit hex; the text field lets the admin paste any value (sanitised
// on save). Both edit the same value.
function ColorField({ label, value, onChange, hint }) {
    const safe = HEX_RE.test((value || "").trim()) && (value || "").length === 7 ? value : (value || "#000000");
    return (
        <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={safe}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-12 shrink-0 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"
                    aria-label={`${label} colour picker`}
                />
                <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#047857"
                    maxLength={7}
                    className={`${inputCls} font-mono uppercase`}
                />
            </div>
            {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
        </div>
    );
}

// Footer link picker: choose one of the site's fixed pages (path is locked to
// that page) or "Custom" to type any internal path / external URL by hand.
function PagePicker({ link, onPick }) {
    const known = link.url && PAGE_BY_PATH[link.url];
    return (
        <select
            className="px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 max-w-[8.5rem]"
            value={known ? link.url : ""}
            onChange={(e) => {
                const path = e.target.value;
                if (!path) { onPick({ url: "" }); return; }
                const page = PAGE_BY_PATH[path];
                const patch = { url: path };
                if (!link.label?.trim() && page?.label) patch.label = page.label;
                onPick(patch);
            }}
            title="Link to a fixed page (locks the path) or pick Custom for a free-form URL"
        >
            <option value="">Custom URL…</option>
            {SITE_PAGES.map((p) => (
                <option key={p.slug} value={p.path}>{p.label}</option>
            ))}
        </select>
    );
}

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
    // When true the manual code/symbol fields stay open (user picked "Custom").
    const [customCurrency, setCustomCurrency] = useState(false);

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
    const setFeature = (key, val) => setSettings((p) => ({ ...p, features: { ...(p.features || {}), [key]: val } }));
    const setReceipt = (patch) => setSettings((p) => ({ ...p, receipt: { ...(p.receipt || {}), ...patch } }));
    const setBarcodeCfg = (patch) => setSettings((p) => ({ ...p, barcode: { ...(p.barcode || {}), ...patch } }));
    const setPos = (patch) => setSettings((p) => ({ ...p, pos: { ...(p.pos || {}), ...patch } }));
    const setAnalytics = (patch) => setSettings((p) => ({ ...p, analytics: { ...(p.analytics || {}), ...patch } }));
    const setWhatsapp = (patch) => setSettings((p) => ({ ...p, whatsapp: { ...(p.whatsapp || {}), ...patch } }));
    const setTheme = (patch) => setSettings((p) => ({ ...p, theme: { ...(p.theme || {}), ...patch } }));
    const resetTheme = () => setSettings((p) => ({ ...p, theme: { ...THEME_DEFAULTS } }));

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
                features: { ...(settings.features || {}) },
                receipt: {
                    header: settings.receipt?.header || "",
                    footerNote: settings.receipt?.footerNote ?? "",
                    showLogo: settings.receipt?.showLogo !== false,
                    paperWidth: settings.receipt?.paperWidth === "58" ? "58" : "80",
                    showTax: !!settings.receipt?.showTax,
                    returnPolicy: settings.receipt?.returnPolicy || "",
                },
                barcode: {
                    symbology: settings.barcode?.symbology === "EAN13" ? "EAN13" : "CODE128",
                    prefix: settings.barcode?.prefix || "",
                    labelWidthMm: Number(settings.barcode?.labelWidthMm) || 40,
                    labelHeightMm: Number(settings.barcode?.labelHeightMm) || 30,
                    showPrice: settings.barcode?.showPrice !== false,
                    showName: settings.barcode?.showName !== false,
                },
                pos: {
                    lowStockThreshold: Number(settings.pos?.lowStockThreshold) || 0,
                    taxPercent: Number(settings.pos?.taxPercent) || 0,
                    taxLabel: settings.pos?.taxLabel || "VAT",
                    requireShift: !!settings.pos?.requireShift,
                    allowNegativeStock: !!settings.pos?.allowNegativeStock,
                    wholesaleDiscountPercent: Number(settings.pos?.wholesaleDiscountPercent) || 0,
                },
                analytics: {
                    ga4Id: settings.analytics?.ga4Id || "",
                    metaPixelId: settings.analytics?.metaPixelId || "",
                    gtmId: settings.analytics?.gtmId || "",
                    metaCapiToken: settings.analytics?.metaCapiToken || "",
                    metaTestEventCode: settings.analytics?.metaTestEventCode || "",
                },
                whatsapp: {
                    businessNumber: settings.whatsapp?.businessNumber || "",
                    notifyOnOrder: settings.whatsapp?.notifyOnOrder !== false,
                    notifyOnStatusChange: settings.whatsapp?.notifyOnStatusChange !== false,
                    orderTemplate: settings.whatsapp?.orderTemplate || "",
                    statusTemplate: settings.whatsapp?.statusTemplate || "",
                },
                theme: sanitizeTheme(settings.theme),
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
                // Broadcast the (possibly new) currency so every surface in this tab
                // — admin tables, POS, storefront — re-renders the symbol live,
                // without waiting for a full page reload.
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("currency-updated", {
                        detail: { symbol: sPayload.currencySymbol, code: sPayload.currencyCode },
                    }));
                }
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

    // Match the saved currency to a preset (by code + symbol). No match — or an
    // explicit "Custom" pick — reveals the manual code/symbol inputs.
    const knownCurrency = CURRENCIES.find(
        (c) => c.code === (settings.currencyCode || "").toUpperCase() && c.symbol === settings.currencySymbol,
    );
    const showCustomCurrency = customCurrency || !knownCurrency;

    // Resolved palette for the Appearance tab (saved overrides on top of brand
    // defaults) — drives both the colour pickers and the live preview.
    const theme = { ...THEME_DEFAULTS, ...(settings.theme || {}) };

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

                {tab === "appearance" && (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-xs text-gray-500">
                                Choose the storefront colours. The navbar and footer are always shown as
                                gradients; the home page gets a soft background wash. Changes go live within a
                                minute of saving.
                            </p>
                            <button
                                type="button"
                                onClick={resetTheme}
                                className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-gray-500 hover:text-indigo-600"
                            >
                                <FiRotateCcw className="w-3.5 h-3.5" /> Reset to brand
                            </button>
                        </div>

                        {/* Live preview */}
                        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div
                                className="h-14 flex items-center justify-between px-4"
                                style={{ backgroundImage: `linear-gradient(to right, ${theme.navbarFrom}, ${theme.navbarVia}, ${theme.navbarTo})` }}
                            >
                                <span className="text-sm font-semibold" style={{ color: theme.navbarText }}>Navbar preview</span>
                                <span className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
                                    <span className="text-xs" style={{ color: theme.navbarText }}>Cart · Search</span>
                                </span>
                            </div>
                            <div className="px-4 py-5 text-center text-xs text-gray-500" style={{ backgroundImage: `linear-gradient(180deg, ${theme.homeFrom}, ${theme.homeTo})` }}>
                                <span className="inline-flex items-center gap-2">
                                    <span className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow" style={{ backgroundColor: theme.primary }}>Primary button</span>
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold shadow" style={{ backgroundColor: theme.accent, color: "#3b2f00" }}>Accent</span>
                                </span>
                                <p className="mt-2">Home background wash</p>
                            </div>
                            <div
                                className="h-14 flex items-center px-4"
                                style={{ backgroundImage: `linear-gradient(to bottom, ${theme.footerFrom}, ${theme.footerVia}, ${theme.footerTo})` }}
                            >
                                <span className="text-sm font-semibold text-emerald-50">Footer preview</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FiLayout className="w-4 h-4" /> Navbar gradient</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <ColorField label="From" value={theme.navbarFrom} onChange={(v) => setTheme({ navbarFrom: v })} />
                                <ColorField label="Middle" value={theme.navbarVia} onChange={(v) => setTheme({ navbarVia: v })} />
                                <ColorField label="To" value={theme.navbarTo} onChange={(v) => setTheme({ navbarTo: v })} />
                            </div>
                            <ColorField label="Text & icon colour" value={theme.navbarText} onChange={(v) => setTheme({ navbarText: v })} hint="Use a light colour so links stay readable on the gradient." />
                        </div>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FiLayout className="w-4 h-4" /> Footer gradient</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <ColorField label="From (top)" value={theme.footerFrom} onChange={(v) => setTheme({ footerFrom: v })} />
                                <ColorField label="Middle" value={theme.footerVia} onChange={(v) => setTheme({ footerVia: v })} />
                                <ColorField label="To (bottom)" value={theme.footerTo} onChange={(v) => setTheme({ footerTo: v })} />
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Home page background</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ColorField label="Top tint" value={theme.homeFrom} onChange={(v) => setTheme({ homeFrom: v })} hint="A soft colour that fades down the page." />
                                <ColorField label="Base" value={theme.homeTo} onChange={(v) => setTheme({ homeTo: v })} hint="The main page colour (white keeps it clean)." />
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Brand accents</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ColorField label="Primary" value={theme.primary} onChange={(v) => setTheme({ primary: v })} hint="Buttons, section underlines, highlights." />
                                <ColorField label="Accent (gold)" value={theme.accent} onChange={(v) => setTheme({ accent: v })} hint="Top strips, badges, secondary highlights." />
                            </div>
                        </div>
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
                        <Field label="Currency" hint="Applies to every price across the storefront, POS and receipts.">
                            <select
                                className={inputCls}
                                value={showCustomCurrency ? "__custom__" : knownCurrency.code}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "__custom__") { setCustomCurrency(true); return; }
                                    const c = CURRENCIES.find((x) => x.code === val);
                                    if (c) { setCustomCurrency(false); setS({ currencyCode: c.code, currencySymbol: c.symbol }); }
                                }}
                            >
                                {CURRENCIES.map((c) => (
                                    <option key={c.code} value={c.code}>{c.name} — {c.code} ({c.symbol})</option>
                                ))}
                                <option value="__custom__">Custom…</option>
                            </select>
                        </Field>
                        {showCustomCurrency && (
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Currency code" hint="3 letters, e.g. USD">
                                    <input maxLength={3} className={`${inputCls} uppercase`} value={settings.currencyCode || ""} onChange={(e) => setS({ currencyCode: e.target.value.toUpperCase() })} />
                                </Field>
                                <Field label="Currency symbol" hint="Shown before every price, e.g. $ or ৳.">
                                    <input maxLength={5} className={inputCls} value={settings.currencySymbol || ""} onChange={(e) => setS({ currencySymbol: e.target.value })} />
                                </Field>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 -mt-2">
                            Preview: <span className="font-semibold text-gray-700">{settings.currencySymbol || "$"}1,250.00</span>
                            <span className="text-gray-400"> · {(settings.currencyCode || "USD").toUpperCase()}</span>
                        </p>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <Toggle label="Maintenance mode" hint="Show a maintenance notice to visitors." checked={!!settings.maintenanceMode} onChange={(v) => setS({ maintenanceMode: v })} />
                        </div>
                    </>
                )}

                {tab === "features" && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 divide-y divide-gray-100">
                        <p className="text-xs text-gray-400 pb-3">
                            Master switches for every advanced feature. Turning one off hides it across the storefront, admin and POS.
                        </p>
                        {FEATURE_FLAGS.map(([key, label, hint]) => (
                            <div key={key} className="py-1.5">
                                <Toggle
                                    label={label}
                                    hint={hint}
                                    checked={settings.features?.[key] !== false}
                                    onChange={(v) => setFeature(key, v)}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {tab === "pos" && (
                    <>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Receipt</h3>
                            <Field label="Receipt header" hint="Extra line under the store name (e.g. branch or VAT no.).">
                                <input className={inputCls} value={settings.receipt?.header || ""} onChange={(e) => setReceipt({ header: e.target.value })} />
                            </Field>
                            <Field label="Footer note" hint="Thank-you line at the bottom of the receipt.">
                                <input className={inputCls} value={settings.receipt?.footerNote ?? ""} onChange={(e) => setReceipt({ footerNote: e.target.value })} />
                            </Field>
                            <Field label="Return policy" hint="Optional small print under the footer note.">
                                <textarea rows={2} className={inputCls} value={settings.receipt?.returnPolicy || ""} onChange={(e) => setReceipt({ returnPolicy: e.target.value })} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Paper width">
                                    <select className={inputCls} value={settings.receipt?.paperWidth === "58" ? "58" : "80"} onChange={(e) => setReceipt({ paperWidth: e.target.value })}>
                                        <option value="80">80 mm</option>
                                        <option value="58">58 mm</option>
                                    </select>
                                </Field>
                            </div>
                            <Toggle label="Show logo on receipt" checked={settings.receipt?.showLogo !== false} onChange={(v) => setReceipt({ showLogo: v })} />
                            <Toggle label="Show tax line on receipt" checked={!!settings.receipt?.showTax} onChange={(v) => setReceipt({ showTax: v })} />
                        </div>

                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">POS behaviour</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Low-stock threshold" hint="Warn when stock drops to this level.">
                                    <input type="number" min="0" className={inputCls} value={settings.pos?.lowStockThreshold ?? 5} onChange={(e) => setPos({ lowStockThreshold: e.target.value })} />
                                </Field>
                                <Field label="Tax %" hint="Applied at the POS when tax is enabled.">
                                    <input type="number" min="0" max="100" step="0.01" className={inputCls} value={settings.pos?.taxPercent ?? 0} onChange={(e) => setPos({ taxPercent: e.target.value })} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Tax label" hint="e.g. VAT, GST, Sales Tax.">
                                    <input className={inputCls} value={settings.pos?.taxLabel || ""} onChange={(e) => setPos({ taxLabel: e.target.value })} />
                                </Field>
                                <Field label="Default wholesale discount %" hint="Pre-filled on wholesale sales. Cashier can edit or clear it. 0 = off.">
                                    <input type="number" min="0" max="100" step="0.01" className={inputCls} value={settings.pos?.wholesaleDiscountPercent ?? 0} onChange={(e) => setPos({ wholesaleDiscountPercent: e.target.value })} />
                                </Field>
                            </div>
                            <Toggle label="Require an open shift before selling" checked={!!settings.pos?.requireShift} onChange={(v) => setPos({ requireShift: v })} />
                            <Toggle label="Allow selling into negative stock" checked={!!settings.pos?.allowNegativeStock} onChange={(v) => setPos({ allowNegativeStock: v })} />
                        </div>
                    </>
                )}

                {tab === "barcode" && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Symbology" hint="Barcode format used on labels.">
                                <select className={inputCls} value={settings.barcode?.symbology === "EAN13" ? "EAN13" : "CODE128"} onChange={(e) => setBarcodeCfg({ symbology: e.target.value })}>
                                    <option value="CODE128">CODE128</option>
                                    <option value="EAN13">EAN-13</option>
                                </select>
                            </Field>
                            <Field label="Code prefix" hint="Optional prefix added to generated codes.">
                                <input className={inputCls} value={settings.barcode?.prefix || ""} onChange={(e) => setBarcodeCfg({ prefix: e.target.value })} />
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Label width (mm)">
                                <input type="number" min="10" max="200" className={inputCls} value={settings.barcode?.labelWidthMm ?? 40} onChange={(e) => setBarcodeCfg({ labelWidthMm: e.target.value })} />
                            </Field>
                            <Field label="Label height (mm)">
                                <input type="number" min="10" max="200" className={inputCls} value={settings.barcode?.labelHeightMm ?? 30} onChange={(e) => setBarcodeCfg({ labelHeightMm: e.target.value })} />
                            </Field>
                        </div>
                        <Toggle label="Show product name on label" checked={settings.barcode?.showName !== false} onChange={(v) => setBarcodeCfg({ showName: v })} />
                        <Toggle label="Show price on label" checked={settings.barcode?.showPrice !== false} onChange={(v) => setBarcodeCfg({ showPrice: v })} />
                    </div>
                )}

                {tab === "integrations" && (
                    <>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Web analytics</h3>
                            <Field label="Google Analytics 4 ID" hint="e.g. G-XXXXXXXXXX">
                                <input className={inputCls} value={settings.analytics?.ga4Id || ""} onChange={(e) => setAnalytics({ ga4Id: e.target.value })} />
                            </Field>
                            <Field label="Meta Pixel ID" hint="Used for browser-side Pixel + server-side Conversions API.">
                                <input className={inputCls} value={settings.analytics?.metaPixelId || ""} onChange={(e) => setAnalytics({ metaPixelId: e.target.value })} />
                            </Field>
                            <Field label="Meta Conversions API token" hint="Events Manager → Settings → Conversions API → Generate access token. Enables server-side tracking. Kept secret — never sent to the storefront.">
                                <input type="password" autoComplete="off" className={inputCls} value={settings.analytics?.metaCapiToken || ""} onChange={(e) => setAnalytics({ metaCapiToken: e.target.value })} placeholder="EAAG… (leave blank for browser-only)" />
                            </Field>
                            <Field label="Meta test event code" hint="Optional. From Events Manager → Test Events. Routes events to the Test tab while you verify setup, then clear it.">
                                <input className={inputCls} value={settings.analytics?.metaTestEventCode || ""} onChange={(e) => setAnalytics({ metaTestEventCode: e.target.value })} placeholder="TEST12345" />
                            </Field>
                            <Field label="Google Tag Manager ID" hint="e.g. GTM-XXXXXXX">
                                <input className={inputCls} value={settings.analytics?.gtmId || ""} onChange={(e) => setAnalytics({ gtmId: e.target.value })} />
                            </Field>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">WhatsApp notifications</h3>
                            <Field label="Business number" hint="E.164 without '+', e.g. 8801XXXXXXXXX.">
                                <input className={inputCls} value={settings.whatsapp?.businessNumber || ""} onChange={(e) => setWhatsapp({ businessNumber: e.target.value })} />
                            </Field>
                            <Toggle label="Notify on new order" checked={settings.whatsapp?.notifyOnOrder !== false} onChange={(v) => setWhatsapp({ notifyOnOrder: v })} />
                            <Toggle label="Notify on status change" checked={settings.whatsapp?.notifyOnStatusChange !== false} onChange={(v) => setWhatsapp({ notifyOnStatusChange: v })} />
                            <Field label="Order message template" hint="Placeholders: {{name}} {{orderId}} {{total}}.">
                                <textarea rows={2} className={inputCls} value={settings.whatsapp?.orderTemplate || ""} onChange={(e) => setWhatsapp({ orderTemplate: e.target.value })} />
                            </Field>
                            <Field label="Status message template" hint="Placeholders: {{name}} {{orderId}} {{status}}.">
                                <textarea rows={2} className={inputCls} value={settings.whatsapp?.statusTemplate || ""} onChange={(e) => setWhatsapp({ statusTemplate: e.target.value })} />
                            </Field>
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
                                            {(col.links || []).map((lnk, li) => {
                                                const patchLink = (p) => { const arr = [...footer.columns]; const links = [...(arr[ci].links || [])]; links[li] = { ...links[li], ...p }; arr[ci] = { ...arr[ci], links }; setF({ columns: arr }); };
                                                const locked = !!(lnk.url && PAGE_BY_PATH[lnk.url]);
                                                return (
                                                    <div key={li} className="flex gap-2">
                                                        <input className={`${inputCls} flex-1`} placeholder="Label" value={lnk.label || ""}
                                                            onChange={(e) => patchLink({ label: e.target.value })} />
                                                        <PagePicker link={lnk} onPick={patchLink} />
                                                        <input className={`${inputCls} flex-[2] ${locked ? "opacity-60 cursor-not-allowed" : ""}`} placeholder="/path or https://..." value={lnk.url || ""}
                                                            disabled={locked} readOnly={locked}
                                                            onChange={(e) => patchLink({ url: e.target.value })} />
                                                        <button type="button" onClick={() => { const arr = [...footer.columns]; arr[ci] = { ...arr[ci], links: arr[ci].links.filter((_, j) => j !== li) }; setF({ columns: arr }); }}
                                                            className="px-2 text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                                                    </div>
                                                );
                                            })}
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
                                {(footer.bottomLinks || []).map((l, i) => {
                                    const patchLink = (p) => { const arr = [...footer.bottomLinks]; arr[i] = { ...arr[i], ...p }; setF({ bottomLinks: arr }); };
                                    const locked = !!(l.url && PAGE_BY_PATH[l.url]);
                                    return (
                                        <div key={i} className="flex gap-2">
                                            <input className={`${inputCls} flex-1`} placeholder="Label" value={l.label || ""}
                                                onChange={(e) => patchLink({ label: e.target.value })} />
                                            <PagePicker link={l} onPick={patchLink} />
                                            <input className={`${inputCls} flex-[2] ${locked ? "opacity-60 cursor-not-allowed" : ""}`} placeholder="/path or https://..." value={l.url || ""}
                                                disabled={locked} readOnly={locked}
                                                onChange={(e) => patchLink({ url: e.target.value })} />
                                            <button type="button" onClick={() => setF({ bottomLinks: footer.bottomLinks.filter((_, j) => j !== i) })}
                                                className="px-2.5 text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </fieldset>
        </div>
    );
}
