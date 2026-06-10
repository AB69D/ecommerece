"use client";
import { useRef } from "react";
import { FiPrinter, FiX, FiCheckCircle } from "react-icons/fi";

// Renders a thermal-style receipt for a completed POS sale and prints it via a
// hidden iframe (popup-blocker safe, doesn't disturb the page). Layout/labels
// come from the admin's Site Settings → POS & Receipt config.
export default function ReceiptModal({ order, settings, symbol = "$", onClose }) {
    const ref = useRef(null);
    if (!order) return null;

    const receipt = settings?.receipt || {};
    const pos = settings?.pos || {};
    const widthMm = receipt.paperWidth === "58" ? 58 : 80;
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const items = order.items || [];
    const subtotal = Number(order.subtotal ?? order.totalAmount ?? 0);
    const total = Number(order.totalAmount ?? subtotal);

    // The POS stores tax-inclusive prices, so when the admin enables a tax line
    // we show the tax portion *contained* in the total (keeps totals consistent).
    const taxPercent = Number(pos.taxPercent) || 0;
    const showTax = !!receipt.showTax && taxPercent > 0;
    const taxAmount = showTax ? total - total / (1 + taxPercent / 100) : 0;
    const taxLabel = pos.taxLabel || "Tax";

    const when = order.createdAt ? new Date(order.createdAt) : new Date();
    const storeName = settings?.siteName || "Store";
    const seller = order.soldBy?.fullName || order.soldBy?.username || "";

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
            <title>Receipt ${order.orderId || ""}</title>
            <style>
                @page { size: ${widthMm}mm auto; margin: 0; }
                * { box-sizing: border-box; }
                body { margin: 0; }
                .rcpt {
                    width: ${widthMm}mm;
                    padding: 4mm 3mm;
                    font-family: "Courier New", ui-monospace, monospace;
                    color: #000;
                    font-size: ${widthMm === 58 ? "11px" : "12px"};
                    line-height: 1.35;
                }
                .rcpt .ctr { text-align: center; }
                .rcpt .b { font-weight: 700; }
                .rcpt .big { font-size: ${widthMm === 58 ? "14px" : "16px"}; }
                .rcpt img.logo { max-width: 60%; max-height: 60px; object-fit: contain; margin: 0 auto 4px; display: block; }
                .rcpt hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
                .rcpt table { width: 100%; border-collapse: collapse; }
                .rcpt td { vertical-align: top; padding: 1px 0; }
                .rcpt td.r { text-align: right; white-space: nowrap; }
                .rcpt .muted { color: #000; }
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
            <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between p-3 border-b border-slate-100 shrink-0">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                        <FiCheckCircle className="w-4 h-4 text-emerald-500" /> Sale complete
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* On-screen preview (mirrors the printed output) */}
                <div className="overflow-y-auto p-4 bg-slate-100">
                    <div ref={ref} className="mx-auto bg-white shadow-sm" style={{ width: `${widthMm}mm`, maxWidth: "100%" }}>
                        <div className="rcpt" style={{ padding: "4mm 3mm", fontFamily: '"Courier New", monospace', fontSize: widthMm === 58 ? 11 : 12, lineHeight: 1.35, color: "#000" }}>
                            <div className="ctr">
                                {receipt.showLogo !== false && settings?.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img className="logo" src={settings.logoUrl} alt={storeName} />
                                ) : null}
                                <div className="b big">{storeName}</div>
                                {receipt.header ? <div>{receipt.header}</div> : null}
                                {settings?.contactPhone ? <div>{settings.contactPhone}</div> : null}
                                {settings?.contactAddress ? <div>{settings.contactAddress}</div> : null}
                            </div>
                            <hr />
                            <div className="row"><span>Receipt</span><span className="b">{order.orderId}</span></div>
                            <div className="row"><span>{when.toLocaleDateString()}</span><span>{when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
                            {seller ? <div className="row"><span>Served by</span><span>{seller}</span></div> : null}
                            {order.customerName && order.customerName !== "Walk-in Customer"
                                ? <div className="row"><span>Customer</span><span>{order.customerName}</span></div> : null}
                            <hr />
                            <table>
                                <tbody>
                                    {items.map((it, i) => (
                                        <tr key={i}>
                                            <td>
                                                {it.productName}{it.weight ? ` (${it.weight})` : ""}<br />
                                                <span className="muted">{it.quantity} × {money(it.price)}</span>
                                            </td>
                                            <td className="r">{money(it.totalPrice ?? it.price * it.quantity)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <hr />
                            <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                            {showTax ? <div className="row"><span>{taxLabel} ({taxPercent}% incl.)</span><span>{money(taxAmount)}</span></div> : null}
                            <div className="row b big"><span>Total</span><span>{money(total)}</span></div>
                            <div className="row"><span>Paid</span><span style={{ textTransform: "capitalize" }}>{order.paymentMethod}</span></div>
                            <hr />
                            <div className="ctr">
                                {receipt.footerNote ? <div>{receipt.footerNote}</div> : null}
                                {receipt.returnPolicy ? <div className="muted" style={{ marginTop: 4 }}>{receipt.returnPolicy}</div> : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3 border-t border-slate-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                        New sale
                    </button>
                    <button onClick={printNow} className="flex-[2] py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold flex items-center justify-center gap-2">
                        <FiPrinter className="w-4 h-4" /> Print receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
