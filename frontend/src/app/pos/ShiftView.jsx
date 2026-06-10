"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
    FiClock, FiPlay, FiSquare, FiDollarSign, FiCreditCard, FiArrowDownCircle,
    FiArrowUpCircle, FiPlusCircle, FiMinusCircle, FiCheckCircle, FiX, FiPrinter,
    FiAlertTriangle, FiTrendingUp,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import {
    getCurrentShift, openShift, addShiftMovement, closeShift, getShifts,
} from "@/services/pos";

// ---------------------------------------------------------------
// POS shift / cash-drawer view.
//
// No open shift -> "Open shift" card (starting float).
// Open shift    -> live drawer summary + cash pay-in/pay-out + close.
// Closing snapshots a Z-report (expected vs counted, over/short) which is
// shown in a printable modal.
// ---------------------------------------------------------------
export default function ShiftView({ notify, canManage }) {
    const { symbol } = useCurrency();
    const money = useCallback(
        (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        [symbol],
    );

    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(true);
    const [shift, setShift] = useState(null);
    const [summary, setSummary] = useState(null);
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);

    // Open-shift form.
    const [openingFloat, setOpeningFloat] = useState("");
    const [openNote, setOpenNote] = useState("");

    // Cash movement form.
    const [movType, setMovType] = useState("in");
    const [movAmount, setMovAmount] = useState("");
    const [movReason, setMovReason] = useState("");

    // Close-shift modal + the resulting Z-report.
    const [closeOpen, setCloseOpen] = useState(false);
    const [countedCash, setCountedCash] = useState("");
    const [closeNote, setCloseNote] = useState("");
    const [zReport, setZReport] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await getCurrentShift();
            if (res?.success) {
                setEnabled(res.data?.enabled !== false);
                setShift(res.data?.shift || null);
                setSummary(res.data?.summary || null);
            }
            const h = await getShifts({ limit: 8 });
            if (h?.success) setHistory(h.data || []);
        } catch {
            notify?.("error", "Failed to load shift");
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        load();
    }, [load]);

    const handleOpen = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await openShift({
                openingFloat: Number(openingFloat) || 0,
                note: openNote.trim() || undefined,
            });
            if (res?.success) {
                notify?.("success", "Shift opened");
                setOpeningFloat("");
                setOpenNote("");
                await load();
            } else {
                notify?.("error", res?.message || "Could not open shift");
            }
        } catch {
            notify?.("error", "Network error opening shift");
        } finally {
            setBusy(false);
        }
    };

    const handleMovement = async (e) => {
        e.preventDefault();
        const amount = Number(movAmount);
        if (!(amount > 0)) {
            notify?.("error", "Enter an amount greater than zero");
            return;
        }
        setBusy(true);
        try {
            const res = await addShiftMovement({
                type: movType,
                amount,
                reason: movReason.trim() || undefined,
            });
            if (res?.success) {
                notify?.("success", `Cash ${movType === "in" ? "paid in" : "paid out"}`);
                setMovAmount("");
                setMovReason("");
                setShift(res.data?.shift || shift);
                setSummary(res.data?.summary || summary);
            } else {
                notify?.("error", res?.message || "Could not record movement");
            }
        } catch {
            notify?.("error", "Network error recording movement");
        } finally {
            setBusy(false);
        }
    };

    const handleClose = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await closeShift({
                countedCash: Number(countedCash) || 0,
                note: closeNote.trim() || undefined,
            });
            if (res?.success) {
                notify?.("success", "Shift closed");
                setCloseOpen(false);
                setCountedCash("");
                setCloseNote("");
                setZReport(res.data || null);
                setShift(null);
                setSummary(null);
                await load();
            } else {
                notify?.("error", res?.message || "Could not close shift");
            }
        } catch {
            notify?.("error", "Network error closing shift");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!enabled) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <FiClock className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium text-slate-500">Shifts are turned off</p>
                <p className="text-xs mt-1">An admin can enable POS shifts in site settings.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-100">
            <div className="max-w-3xl mx-auto p-3 sm:p-5 space-y-4">
                {!shift ? (
                    <OpenShiftCard
                        openingFloat={openingFloat}
                        setOpeningFloat={setOpeningFloat}
                        openNote={openNote}
                        setOpenNote={setOpenNote}
                        onSubmit={handleOpen}
                        busy={busy}
                        symbol={symbol}
                    />
                ) : (
                    <OpenShiftPanel
                        shift={shift}
                        summary={summary}
                        money={money}
                        movType={movType}
                        setMovType={setMovType}
                        movAmount={movAmount}
                        setMovAmount={setMovAmount}
                        movReason={movReason}
                        setMovReason={setMovReason}
                        onMovement={handleMovement}
                        onAskClose={() => setCloseOpen(true)}
                        busy={busy}
                    />
                )}

                <ShiftHistory history={history} money={money} canManage={canManage} onView={setZReport} />
            </div>

            {closeOpen && shift && (
                <CloseShiftModal
                    summary={summary}
                    money={money}
                    countedCash={countedCash}
                    setCountedCash={setCountedCash}
                    closeNote={closeNote}
                    setCloseNote={setCloseNote}
                    onSubmit={handleClose}
                    onCancel={() => setCloseOpen(false)}
                    busy={busy}
                />
            )}

            {zReport && (
                <ZReportModal shift={zReport} money={money} onClose={() => setZReport(null)} />
            )}
        </div>
    );
}

// ---- Open-shift card (no shift running) ----
function OpenShiftCard({ openingFloat, setOpeningFloat, openNote, setOpenNote, onSubmit, busy, symbol }) {
    return (
        <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                    <FiClock className="w-6 h-6 text-teal-500" />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800">Start a shift</h2>
                    <p className="text-xs text-slate-500">Count the cash in the drawer to begin.</p>
                </div>
            </div>

            <label className="block text-xs font-medium text-slate-500 mb-1">Opening cash float</label>
            <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{symbol}</span>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
            </div>

            <label className="block text-xs font-medium text-slate-500 mb-1">Note (optional)</label>
            <input
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="e.g. Morning shift"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
            />

            <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"
            >
                {busy ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiPlay className="w-5 h-5" /> Open shift</>}
            </button>
        </form>
    );
}

// ---- Open-shift panel (shift running) ----
function OpenShiftPanel(props) {
    const {
        shift, summary, money, movType, setMovType, movAmount, setMovAmount,
        movReason, setMovReason, onMovement, onAskClose, busy,
    } = props;
    const s = summary || {};
    const openedAt = shift.openedAt ? new Date(shift.openedAt) : null;

    return (
        <>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white">
                    <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="font-bold leading-tight">Shift open</p>
                            <p className="text-[11px] text-teal-50">
                                {shift.cashier?.fullName || shift.cashier?.username}
                                {openedAt ? ` · since ${openedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onAskClose}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold"
                    >
                        <FiSquare className="w-4 h-4" /> Close
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-100">
                    <Stat label="Opening float" value={money(shift.openingFloat)} icon={<FiDollarSign className="w-4 h-4 text-slate-400" />} />
                    <Stat label="Cash sales" value={money(s.cashSales)} icon={<FiDollarSign className="w-4 h-4 text-emerald-500" />} />
                    <Stat label="Card sales" value={money(s.cardSales)} icon={<FiCreditCard className="w-4 h-4 text-sky-500" />} />
                    <Stat label="Cash in" value={money(s.cashIn)} icon={<FiArrowDownCircle className="w-4 h-4 text-emerald-500" />} />
                    <Stat label="Cash out" value={money(s.cashOut)} icon={<FiArrowUpCircle className="w-4 h-4 text-rose-500" />} />
                    <Stat label="Orders" value={s.orderCount ?? 0} icon={<FiTrendingUp className="w-4 h-4 text-slate-400" />} />
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Expected cash in drawer</span>
                    <span className="text-2xl font-bold text-slate-900">{money(s.expectedCash)}</span>
                </div>
            </div>

            {/* Cash movement */}
            <form onSubmit={onMovement} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Cash movement</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMovType("in")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${movType === "in" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                        <FiPlusCircle className="w-4 h-4" /> Pay in
                    </button>
                    <button
                        type="button"
                        onClick={() => setMovType("out")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${movType === "out" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                        <FiMinusCircle className="w-4 h-4" /> Pay out
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={movAmount}
                        onChange={(e) => setMovAmount(e.target.value)}
                        placeholder="Amount"
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                        value={movReason}
                        onChange={(e) => setMovReason(e.target.value)}
                        placeholder="Reason (e.g. petty cash)"
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                    >
                        Record
                    </button>
                </div>
                {Array.isArray(shift.movements) && shift.movements.length > 0 && (
                    <ul className="pt-1 space-y-1.5 max-h-40 overflow-y-auto">
                        {shift.movements.slice().reverse().map((m, i) => (
                            <li key={i} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                    {m.type === "in" ? <FiPlusCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <FiMinusCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                    <span className="truncate">{m.reason || (m.type === "in" ? "Pay in" : "Pay out")}</span>
                                </span>
                                <span className={`font-semibold shrink-0 ${m.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                                    {m.type === "in" ? "+" : "−"}{money(m.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </form>
        </>
    );
}

function Stat({ label, value, icon }) {
    return (
        <div className="bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                {icon} {label}
            </div>
            <p className="text-base font-bold text-slate-800">{value}</p>
        </div>
    );
}

// ---- Shift history ----
function ShiftHistory({ history, money, canManage, onView }) {
    if (!history || history.length === 0) return null;
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">
                    {canManage ? "Recent shifts (all cashiers)" : "Your recent shifts"}
                </h3>
            </div>
            <ul className="divide-y divide-slate-100">
                {history.map((sh) => {
                    const opened = sh.openedAt ? new Date(sh.openedAt) : null;
                    const isOpen = sh.status === "open";
                    const diff = sh.closing?.difference || 0;
                    return (
                        <li key={sh._id}>
                            <button
                                onClick={() => !isOpen && onView(sh)}
                                disabled={isOpen}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:hover:bg-white disabled:cursor-default"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                        {sh.cashier?.fullName || sh.cashier?.username || "Cashier"}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {opened ? opened.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    {isOpen ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Open
                                        </span>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-slate-700">{money(sh.closing?.totalSales)}</p>
                                            <p className={`text-[11px] font-medium ${diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                {diff === 0 ? "Balanced" : `${diff > 0 ? "Over" : "Short"} ${money(Math.abs(diff))}`}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ---- Close-shift modal (count cash) ----
function CloseShiftModal({ summary, money, countedCash, setCountedCash, closeNote, setCloseNote, onSubmit, onCancel, busy }) {
    const s = summary || {};
    const counted = Number(countedCash);
    const diff = countedCash === "" || Number.isNaN(counted) ? null : Math.round((counted - (s.expectedCash || 0)) * 100) / 100;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
            <form onSubmit={onSubmit} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FiSquare className="w-5 h-5 text-rose-500" /> Close shift
                    </h3>
                    <button type="button" onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Expected cash</span>
                        <span className="font-semibold text-slate-800">{money(s.expectedCash)}</span>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Counted cash in drawer</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            value={countedCash}
                            onChange={(e) => setCountedCash(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {diff !== null && (
                        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm ${diff === 0 ? "bg-slate-50 text-slate-600" : diff > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            <span className="flex items-center gap-1.5 font-medium">
                                {diff !== 0 && <FiAlertTriangle className="w-4 h-4" />}
                                {diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}
                            </span>
                            <span className="font-bold">{diff > 0 ? "+" : diff < 0 ? "−" : ""}{money(Math.abs(diff))}</span>
                        </div>
                    )}

                    <input
                        value={closeNote}
                        onChange={(e) => setCloseNote(e.target.value)}
                        placeholder="Closing note (optional)"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>
                <div className="p-4 border-t border-slate-100 flex gap-2">
                    <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || countedCash === ""}
                        className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
                    >
                        {busy ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiCheckCircle className="w-5 h-5" /> Close shift</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ---- Z-report (printable) ----
// Mirrors Receipt.jsx: an on-screen thermal-style preview that is printed via
// a hidden iframe (popup-blocker safe). The printable markup uses the same
// `.rcpt` / `.row` vocabulary defined in the iframe stylesheet below.
function ZReportModal({ shift, money, onClose }) {
    const ref = useRef(null);
    const c = shift.closing || {};
    const opened = shift.openedAt ? new Date(shift.openedAt) : null;
    const closed = shift.closedAt ? new Date(shift.closedAt) : null;
    const diff = c.difference || 0;
    const diffLabel = diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short";
    const diffValue = `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${money(Math.abs(diff))}`;

    const printNow = () => {
        const node = ref.current;
        if (!node) return;
        const frame = document.createElement("iframe");
        frame.style.position = "fixed";
        frame.style.right = "0";
        frame.style.bottom = "0";
        frame.style.width = "0";
        frame.style.height = "0";
        frame.style.border = "0";
        document.body.appendChild(frame);
        const doc = frame.contentWindow?.document;
        if (!doc) { document.body.removeChild(frame); return; }
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8" />
            <title>Z-Report ${shift._id || ""}</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                * { box-sizing: border-box; }
                body { margin: 0; }
                .rcpt { width: 80mm; padding: 4mm 3mm; font-family: "Courier New", ui-monospace, monospace; color: #000; font-size: 12px; line-height: 1.4; }
                .rcpt .ctr { text-align: center; }
                .rcpt .b { font-weight: 700; }
                .rcpt .big { font-size: 16px; }
                .rcpt hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
                .rcpt .row { display: flex; justify-content: space-between; gap: 8px; }
            </style></head><body>${node.innerHTML}</body></html>`);
        doc.close();
        const done = () => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { document.body.removeChild(frame); } catch { /* ignore */ } }, 800);
        };
        if (frame.contentWindow?.document?.readyState === "complete") setTimeout(done, 150);
        else frame.onload = () => setTimeout(done, 150);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between p-3 border-b border-slate-100 shrink-0">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                        <FiCheckCircle className="w-4 h-4 text-emerald-500" /> Shift closed
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* On-screen preview (mirrors the printed output) */}
                <div className="overflow-y-auto p-4 bg-slate-100">
                    <div ref={ref} className="mx-auto bg-white shadow-sm" style={{ width: "80mm", maxWidth: "100%" }}>
                        <div className="rcpt" style={{ padding: "4mm 3mm", fontFamily: '"Courier New", monospace', fontSize: 12, lineHeight: 1.4, color: "#000" }}>
                            <div className="ctr">
                                <div className="b big">SHIFT Z-REPORT</div>
                                <div>{shift.cashier?.fullName || shift.cashier?.username || "Cashier"}</div>
                                <div>{opened ? opened.toLocaleString() : ""}</div>
                                {closed ? <div>Closed {closed.toLocaleString()}</div> : null}
                            </div>
                            <hr />
                            <div className="row"><span>Opening float</span><span>{money(shift.openingFloat)}</span></div>
                            <div className="row"><span>Cash sales</span><span>{money(c.cashSales)}</span></div>
                            <div className="row"><span>Card sales</span><span>{money(c.cardSales)}</span></div>
                            {c.otherSales > 0 ? <div className="row"><span>Other sales</span><span>{money(c.otherSales)}</span></div> : null}
                            <div className="row"><span>Cash in</span><span>{money(c.cashIn)}</span></div>
                            <div className="row"><span>Cash out</span><span>-{money(c.cashOut)}</span></div>
                            <hr />
                            <div className="row b"><span>Total sales</span><span>{money(c.totalSales)}</span></div>
                            <div className="row"><span>Orders</span><span>{c.orderCount ?? 0}</span></div>
                            <hr />
                            <div className="row"><span>Expected cash</span><span>{money(c.expectedCash)}</span></div>
                            <div className="row"><span>Counted cash</span><span>{money(c.countedCash)}</span></div>
                            <div className="row b big"><span>{diffLabel}</span><span>{diffValue}</span></div>
                            {shift.note ? (<><hr /><div style={{ whiteSpace: "pre-line" }}>{shift.note}</div></>) : null}
                        </div>
                    </div>
                </div>

                <div className="p-3 border-t border-slate-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                        Done
                    </button>
                    <button onClick={printNow} className="flex-[2] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                        <FiPrinter className="w-4 h-4" /> Print Z-Report
                    </button>
                </div>
            </div>
        </div>
    );
}
