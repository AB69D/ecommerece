"use client";
import { authFetch } from "@/services/api";
import { getSiteSettings } from "@/services/siteSettings";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiSearch, FiPlus, FiX, FiPrinter, FiTag, FiTrash2, FiMinus } from "react-icons/fi";
import Barcode from "@/components/Barcode";

// Admin barcode-label sheet generator. Pick product variants, set how many
// labels of each you want, and print a tiled sheet sized to the label stock
// configured in Site Settings → Barcode (labelWidthMm × labelHeightMm).
export default function LabelsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expanded, setExpanded] = useState(null); // productId currently expanded
    const [queue, setQueue] = useState([]); // [{ key, name, weight, sku, barcode, price, qty }]
    const [cfg, setCfg] = useState({
        labelWidthMm: 40, labelHeightMm: 30, showName: true, showPrice: true, currencySymbol: "$",
    });
    const sheetRef = useRef(null);

    // Load barcode/label config + currency from site settings.
    useEffect(() => {
        getSiteSettings()
            .then((res) => {
                const s = res?.data || res || {};
                const b = s.barcode || {};
                setCfg({
                    labelWidthMm: Number(b.labelWidthMm) || 40,
                    labelHeightMm: Number(b.labelHeightMm) || 30,
                    showName: b.showName !== false,
                    showPrice: b.showPrice !== false,
                    currencySymbol: s.currencySymbol || "$",
                });
            })
            .catch(() => { /* keep defaults */ });
    }, []);

    // Load products (search + paginated).
    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/product/get-all-product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page, limit: 12, search }),
                });
                const data = await res.json();
                if (data.success) {
                    setProducts(data.data || []);
                    setTotalPages(data.totalNoPage || 1);
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        };
        const t = setTimeout(run, 300);
        return () => clearTimeout(t);
    }, [page, search]);

    const money = useCallback(
        (v) => `${cfg.currencySymbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        [cfg.currencySymbol]
    );

    const addVariant = (product, w) => {
        const code = (w.barcode || w.sku || "").trim();
        if (!code) return;
        const key = `${product._id}:${w.barcode || w.sku}`;
        setQueue((prev) => {
            const existing = prev.find((q) => q.key === key);
            if (existing) {
                return prev.map((q) => (q.key === key ? { ...q, qty: q.qty + 1 } : q));
            }
            return [
                ...prev,
                {
                    key,
                    name: product.firstName || product.productName || "Product",
                    weight: w.weight || "",
                    sku: w.sku || "",
                    barcode: w.barcode || w.sku || "",
                    price: Number(w.price) || 0,
                    qty: 1,
                },
            ];
        });
    };

    const setQty = (key, qty) =>
        setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, qty: Math.max(1, qty) } : q)));
    const bump = (key, d) =>
        setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, qty: Math.max(1, q.qty + d) } : q)));
    const removeRow = (key) => setQueue((prev) => prev.filter((q) => q.key !== key));
    const clearAll = () => setQueue([]);

    const totalLabels = queue.reduce((s, q) => s + q.qty, 0);

    // Flatten the queue into one entry per physical label.
    const flatLabels = queue.flatMap((q) => Array.from({ length: q.qty }, () => q));

    const printSheet = () => {
        const node = sheetRef.current;
        if (!node || flatLabels.length === 0) return;
        const frame = document.createElement("iframe");
        Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
        document.body.appendChild(frame);
        const doc = frame.contentWindow?.document;
        if (!doc) { document.body.removeChild(frame); return; }
        const w = cfg.labelWidthMm;
        const h = cfg.labelHeightMm;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8" />
            <title>Barcode labels</title>
            <style>
                @page { margin: 5mm; }
                * { box-sizing: border-box; }
                body { margin: 0; font-family: "Courier New", ui-monospace, monospace; color: #000; }
                .sheet { display: flex; flex-wrap: wrap; gap: 2mm; align-content: flex-start; }
                .label {
                    width: ${w}mm; height: ${h}mm;
                    border: 0.2mm solid #eee;
                    padding: 1mm 1.5mm;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    overflow: hidden; text-align: center;
                    page-break-inside: avoid; break-inside: avoid;
                }
                .label .nm { font-size: 7pt; line-height: 1.1; max-width: 100%;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }
                .label .wt { font-size: 6pt; line-height: 1.1; }
                .label svg { display: block; }
                .label .code { font-size: 6pt; letter-spacing: 0.5px; margin-top: 0.3mm; }
                .label .pr { font-size: 8pt; font-weight: 700; }
            </style></head><body><div class="sheet">${node.innerHTML}</div></body></html>`);
        doc.close();
        const done = () => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { document.body.removeChild(frame); } catch { /* ignore */ } }, 800);
        };
        if (frame.contentWindow?.document?.readyState === "complete") setTimeout(done, 200);
        else frame.onload = () => setTimeout(done, 200);
    };

    // A single label cell (shared by on-screen preview and print clone). Sizes
    // are in mm so the print output matches the configured label stock exactly.
    const LabelCell = ({ item }) => (
        <div
            className="label"
            style={{
                width: `${cfg.labelWidthMm}mm`,
                height: `${cfg.labelHeightMm}mm`,
                border: "0.2mm solid #eee",
                padding: "1mm 1.5mm",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                textAlign: "center",
            }}
        >
            {cfg.showName && (
                <div className="nm" style={{ fontSize: "7pt", fontWeight: 700, lineHeight: 1.1, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                </div>
            )}
            {item.weight ? (
                <div className="wt" style={{ fontSize: "6pt", lineHeight: 1.1 }}>{item.weight}</div>
            ) : null}
            <Barcode value={item.barcode} height={34} />
            <div className="code" style={{ fontSize: "6pt", letterSpacing: "0.5px", marginTop: "0.3mm" }}>
                {item.barcode}
            </div>
            {cfg.showPrice && (
                <div className="pr" style={{ fontSize: "8pt", fontWeight: 700 }}>{money(item.price)}</div>
            )}
        </div>
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiTag className="text-indigo-600" /> Barcode Labels
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Build a printable label sheet — {cfg.labelWidthMm}×{cfg.labelHeightMm}mm per label (set in Site Settings).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {queue.length > 0 && (
                        <button onClick={clearAll} className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 rounded-lg border border-gray-200 hover:border-red-200 transition-colors flex items-center gap-1.5">
                            <FiTrash2 className="w-4 h-4" /> Clear
                        </button>
                    )}
                    <button
                        onClick={printSheet}
                        disabled={totalLabels === 0}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <FiPrinter className="w-4 h-4" /> Print {totalLabels > 0 ? `(${totalLabels})` : ""}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Product picker */}
                <div>
                    <div className="relative mb-4">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search products…"
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : products.length === 0 ? (
                        <p className="text-center text-gray-400 py-16 text-sm">No products found.</p>
                    ) : (
                        <div className="space-y-2">
                            {products.map((p) => {
                                const isOpen = expanded === p._id;
                                const variants = p.weights || [];
                                return (
                                    <div key={p._id} className="border border-gray-200 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setExpanded(isOpen ? null : p._id)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            {p.cover_image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={p.cover_image} alt={p.firstName} className="w-10 h-10 object-cover rounded-lg shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <FiTag className="text-gray-300" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-gray-800 text-sm truncate">{p.firstName}</p>
                                                <p className="text-xs text-gray-400">{variants.length} variant{variants.length === 1 ? "" : "s"}</p>
                                            </div>
                                            <span className="text-gray-400 text-xs">{isOpen ? "Hide" : "Show"}</span>
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-gray-100 divide-y divide-gray-50">
                                                {variants.length === 0 && (
                                                    <p className="p-3 text-xs text-gray-400">No variants.</p>
                                                )}
                                                {variants.map((w, i) => {
                                                    const code = (w.barcode || w.sku || "").trim();
                                                    return (
                                                        <div key={i} className="flex items-center gap-3 p-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm text-gray-700">
                                                                    {w.weight || "—"} · <span className="text-gray-500">{money(w.price)}</span>
                                                                </p>
                                                                <p className="text-[11px] text-gray-400 font-mono truncate">
                                                                    {w.barcode || "no barcode"}{w.sku ? ` · ${w.sku}` : ""}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => addVariant(p, w)}
                                                                disabled={!code}
                                                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                                                            >
                                                                <FiPlus className="w-3.5 h-3.5" /> Add
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40">Prev</button>
                            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
                        </div>
                    )}
                </div>

                {/* Queue + preview */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">
                        Label queue {queue.length > 0 && <span className="text-gray-400 font-normal">· {totalLabels} label{totalLabels === 1 ? "" : "s"}</span>}
                    </h2>

                    {queue.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                            <FiTag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Add product variants to build your label sheet.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2 mb-5">
                                {queue.map((q) => (
                                    <div key={q.key} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-xl">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-gray-800 truncate">{q.name}{q.weight ? ` · ${q.weight}` : ""}</p>
                                            <p className="text-[11px] text-gray-400 font-mono truncate">{q.barcode}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => bump(q.key, -1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><FiMinus className="w-3.5 h-3.5" /></button>
                                            <input
                                                type="number"
                                                min={1}
                                                value={q.qty}
                                                onChange={(e) => setQty(q.key, parseInt(e.target.value, 10) || 1)}
                                                className="w-12 text-center text-sm border border-gray-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button onClick={() => bump(q.key, 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><FiPlus className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <button onClick={() => removeRow(q.key)} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0"><FiX className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>

                            <h2 className="text-sm font-semibold text-gray-700 mb-3">Preview</h2>
                            <div className="bg-slate-100 rounded-xl p-3 overflow-auto max-h-[480px]">
                                <div
                                    ref={sheetRef}
                                    className="sheet bg-white p-2 rounded-lg"
                                    style={{ display: "flex", flexWrap: "wrap", gap: "2mm", alignContent: "flex-start" }}
                                >
                                    {flatLabels.map((item, i) => (
                                        <LabelCell key={i} item={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
