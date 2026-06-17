"use client";
import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import {
    FiPercent, FiSearch, FiDownload, FiEye, FiPrinter, FiX,
    FiCalendar, FiFileText, FiChevronLeft, FiChevronRight, FiAlertCircle,
} from "react-icons/fi";

const PAGE_SIZE = 20;

export default function AdminVatPage() {
    const { can } = useAdminAuth();
    const { symbol } = useCurrency();

    const [invoices, setInvoices] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });

    // Filters
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Invoice detail modal
    const [selectedInvoice, setSelectedInvoice] = useState(null); // { doc, html }
    const [modalLoading, setModalLoading] = useState(false);

    // Mushak 9.1 CSV export
    const [exportYear, setExportYear] = useState(new Date().getFullYear());
    const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
    const [exporting, setExporting] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setMsg({ type: "", text: "" });
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE });
            if (dateFrom) params.set("dateFrom", dateFrom);
            if (dateTo) params.set("dateTo", dateTo);

            const res = await authFetch(`/api/admin/vat/invoices?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setInvoices(data.data?.invoices || data.data || []);
                setTotal(data.data?.total ?? (Array.isArray(data.data) ? data.data.length : 0));
            } else {
                setMsg({ type: "error", text: data.message || "Failed to load invoices" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error loading invoices" });
        } finally {
            setLoading(false);
        }
    }, [page, dateFrom, dateTo]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const handleViewInvoice = async (invoice) => {
        setModalLoading(true);
        setSelectedInvoice({ doc: invoice, html: null });
        try {
            const res = await authFetch(`/api/admin/vat/invoices/${invoice._id}?format=html`);
            const data = await res.json();
            if (data.success) {
                setSelectedInvoice({ doc: invoice, html: data.data?.html || data.data });
            } else {
                setSelectedInvoice({ doc: invoice, html: null, error: data.message || "Could not load invoice HTML" });
            }
        } catch {
            setSelectedInvoice({ doc: invoice, html: null, error: "Network error loading invoice" });
        } finally {
            setModalLoading(false);
        }
    };

    const handlePrint = () => {
        if (!selectedInvoice?.html) return;
        const win = window.open("", "_blank");
        win.document.write(selectedInvoice.html);
        win.document.close();
        win.focus();
        win.print();
    };

    const handleExportMushak91 = async () => {
        setExporting(true);
        setMsg({ type: "", text: "" });
        try {
            const res = await authFetch(
                `/api/admin/vat/report/mushak91?year=${exportYear}&month=${exportMonth}`
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setMsg({ type: "error", text: err.message || "Export failed" });
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mushak91-${exportYear}-${String(exportMonth).padStart(2, "0")}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMsg({ type: "success", text: "Mushak 9.1 report downloaded" });
            setTimeout(() => setMsg({ type: "", text: "" }), 3000);
        } catch {
            setMsg({ type: "error", text: "Export failed. Please try again." });
        } finally {
            setExporting(false);
        }
    };

    const fmtDate = (iso) =>
        iso
            ? new Date(iso).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
              })
            : "—";

    const fmtAmt = (n) =>
        typeof n === "number" ? `${symbol}${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FiPercent className="text-indigo-600" /> VAT Invoices
                </h1>
                <p className="text-xs text-gray-400">Mushak 6.3 invoices auto-generated at order creation</p>
            </div>

            {/* Alert */}
            {msg.text && (
                <div className={`p-3 rounded-xl flex items-start gap-2 text-sm border ${
                    msg.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                }`}>
                    <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{msg.text}</span>
                </div>
            )}

            {/* Filters row */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <FiCalendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-sm font-medium text-gray-600">Filter by date:</span>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">To</label>
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    {(dateFrom || dateTo) && (
                        <button
                            type="button"
                            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"
                        >
                            <FiX className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Mushak 9.1 Export */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    <FiDownload className="w-4 h-4" /> Export Mushak 9.1 Purchase Register
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-indigo-700 font-medium">Year</label>
                        <select
                            value={exportYear}
                            onChange={(e) => setExportYear(Number(e.target.value))}
                            className="px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-indigo-700 font-medium">Month</label>
                        <select
                            value={exportMonth}
                            onChange={(e) => setExportMonth(Number(e.target.value))}
                            className="px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {[
                                "January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December",
                            ].map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportMushak91}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <FiDownload className="w-4 h-4" />
                        {exporting ? "Exporting..." : "Download CSV"}
                    </button>
                </div>
                <p className="text-xs text-indigo-600 mt-2">
                    Downloads a BOM-encoded CSV compatible with Microsoft Excel and NBR's reporting portal.
                </p>
            </div>

            {/* Invoices Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : invoices.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No VAT invoices found</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Invoices are auto-created when orders are placed with VAT enabled.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice No</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Buyer</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Taxable</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">VAT %</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">VAT Amt</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Grand Total</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.map((inv) => (
                                    <tr key={inv._id} className="hover:bg-indigo-50/40 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm font-semibold text-indigo-700">{inv.invoiceNo}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-emerald-700">
                                                {typeof inv.orderId === "object" ? inv.orderId?.orderId : inv.orderId}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{inv.buyerName || "—"}</p>
                                                <p className="text-xs text-gray-400">{inv.buyerPhone || ""}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmtAmt(inv.taxableAmount)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700">{inv.vatRate}%</td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-indigo-700">{fmtAmt(inv.vatAmount)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtAmt(inv.grandTotal)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewInvoice(inv)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    title="View invoice"
                                                >
                                                    <FiEye className="w-3.5 h-3.5" /> View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-500">
                                Page {page} of {totalPages} ({total} total)
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors"
                                >
                                    <FiChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors"
                                >
                                    <FiChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Modal header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <FiFileText className="text-indigo-600" /> Mushak 6.3 Invoice
                                </h3>
                                <p className="text-sm font-mono text-indigo-700">{selectedInvoice.doc.invoiceNo}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedInvoice.html && (
                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <FiPrinter className="w-4 h-4" /> Print
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoice(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <FiX className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Modal body */}
                        <div className="flex-1 overflow-auto p-2">
                            {modalLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                                </div>
                            ) : selectedInvoice.error ? (
                                <div className="p-6 text-center text-red-600">
                                    <FiAlertCircle className="w-8 h-8 mx-auto mb-2" />
                                    <p>{selectedInvoice.error}</p>
                                </div>
                            ) : selectedInvoice.html ? (
                                <iframe
                                    srcDoc={selectedInvoice.html}
                                    title={`Invoice ${selectedInvoice.doc.invoiceNo}`}
                                    className="w-full h-full min-h-[600px] border-0 rounded-xl"
                                    sandbox="allow-same-origin"
                                />
                            ) : (
                                <div className="p-6 text-center text-gray-400">No content available</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
