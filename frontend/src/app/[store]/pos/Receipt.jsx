"use client";
import { useRef, useState } from "react";
import { FiPrinter, FiX, FiCheckCircle } from "react-icons/fi";

// Renders a completed POS sale as either a thermal-printer receipt (58/80mm)
// or a full A4 invoice, and prints the active one via a hidden iframe
// (popup-blocker safe, doesn't disturb the page). Layout/labels come from the
// admin's Site Settings → POS & Receipt config.
export default function ReceiptModal({ order, settings, symbol = "$", onClose }) {
    const ref = useRef(null);
    const [format, setFormat] = useState("thermal"); // 'thermal' | 'a4'
    if (!order) return null;

    const receipt = settings?.receipt || {};
    const pos = settings?.pos || {};
    const widthMm = receipt.paperWidth === "58" ? 58 : 80;
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const items = order.items || [];
    const subtotal = Number(order.subtotal ?? order.totalAmount ?? 0);
    const total = Number(order.totalAmount ?? subtotal);
    const discount = Number(order.discount || 0);
    const couponCode = order.couponCode || "";

    // The order's `discount` total folds in both a coupon and any manual markdown
    // the cashier applied. Split them so the receipt itemises each one; the coupon
    // portion is whatever's left after the manual discount.
    const manual = order.manualDiscount || null;
    const manualAmount = Number(manual?.amount || 0);
    const couponDiscount = Math.max(0, discount - manualAmount);
    const manualLabel = manual?.type === "percent"
        ? `Discount (${Number(manual.value)}%)`
        : "Discount";

    // The POS stores tax-inclusive prices, so when the admin enables a tax line
    // we show the tax portion *contained* in the total (keeps totals consistent).
    const taxPercent = Number(pos.taxPercent) || 0;
    const showTax = !!receipt.showTax && taxPercent > 0;
    const taxAmount = showTax ? total - total / (1 + taxPercent / 100) : 0;
    const taxLabel = pos.taxLabel || "Tax";

    const when = order.createdAt ? new Date(order.createdAt) : new Date();
    const storeName = settings?.siteName || "Store";
    const seller = order.soldBy?.fullName || order.soldBy?.username || "";
    const hasCustomer = order.customerName && order.customerName !== "Walk-in Customer";

    const thermalCss = `
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
    `;

    const a4Css = `
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .inv {
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            font-size: 13px;
            line-height: 1.5;
        }
        .inv .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .inv .brand img { max-height: 56px; max-width: 200px; object-fit: contain; margin-bottom: 8px; display: block; }
        .inv .brand .name { font-size: 22px; font-weight: 700; color: #0f172a; }
        .inv .brand .meta { color: #64748b; font-size: 12px; margin-top: 2px; }
        .inv .doc { text-align: right; }
        .inv .doc .title { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #0f172a; }
        .inv .doc .meta { color: #64748b; font-size: 12px; margin-top: 4px; }
        .inv .doc .meta b { color: #1e293b; }
        .inv hr { border: none; border-top: 2px solid #0f172a; margin: 16px 0; }
        .inv .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
        .inv .parties .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
        .inv table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .inv table.items thead th { background: #0f172a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
        .inv table.items thead th.r { text-align: right; }
        .inv table.items tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .inv table.items tbody td.r { text-align: right; white-space: nowrap; }
        .inv table.items tbody tr:nth-child(even) { background: #f8fafc; }
        .inv .totals { width: 280px; margin-left: auto; margin-top: 14px; }
        .inv .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
        .inv .totals .row.grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; font-size: 18px; font-weight: 800; color: #0f172a; }
        .inv .totals .row .disc { color: #0f766e; }
        .inv .pay { margin-top: 18px; color: #475569; font-size: 12px; }
        .inv .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
    `;

    const printNow = () => {
        const node = ref.current;
        if (!node) return;
        const css = format === "a4" ? a4Css : thermalCss;
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
            <title>${format === "a4" ? "Invoice" : "Receipt"} ${order.orderId || ""}</title>
            <style>${css}</style></head><body>${node.innerHTML}</body></html>`);
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
            <div className={`relative w-full ${format === "a4" ? "max-w-2xl" : "max-w-sm"} bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-[max-width]`}>
                <div className="flex items-center justify-between p-3 border-b border-slate-100 shrink-0">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                        <FiCheckCircle className="w-4 h-4 text-emerald-500" /> Sale complete
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Format switch — thermal receipt vs A4 invoice */}
                <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 shrink-0">
                    <FormatBtn active={format === "thermal"} onClick={() => setFormat("thermal")} label={`Thermal ${widthMm}mm`} />
                    <FormatBtn active={format === "a4"} onClick={() => setFormat("a4")} label="A4 invoice" />
                </div>

                {/* On-screen preview (mirrors the printed output) */}
                <div className="overflow-y-auto p-4 bg-slate-100">
                    {format === "thermal" ? (
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
                                {hasCustomer ? <div className="row"><span>Customer</span><span>{order.customerName}</span></div> : null}
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
                                {couponDiscount > 0 ? (
                                    <div className="row"><span>Coupon{couponCode ? ` (${couponCode})` : ""}</span><span>-{money(couponDiscount)}</span></div>
                                ) : null}
                                {manualAmount > 0 ? (
                                    <div className="row"><span>{manualLabel}</span><span>-{money(manualAmount)}</span></div>
                                ) : null}
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
                    ) : (
                        <div ref={ref} className="mx-auto bg-white shadow-sm" style={{ width: "210mm", maxWidth: "100%" }}>
                            <div className="inv" style={{ padding: "16mm", fontFamily: "Arial, Helvetica, sans-serif", color: "#1e293b", fontSize: 13, lineHeight: 1.5 }}>
                                <div className="top">
                                    <div className="brand">
                                        {receipt.showLogo !== false && settings?.logoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={settings.logoUrl} alt={storeName} />
                                        ) : null}
                                        <div className="name">{storeName}</div>
                                        {receipt.header ? <div className="meta">{receipt.header}</div> : null}
                                        {settings?.contactPhone ? <div className="meta">{settings.contactPhone}</div> : null}
                                        {settings?.contactEmail ? <div className="meta">{settings.contactEmail}</div> : null}
                                        {settings?.contactAddress ? <div className="meta">{settings.contactAddress}</div> : null}
                                    </div>
                                    <div className="doc">
                                        <div className="title">INVOICE</div>
                                        <div className="meta"><b>{order.orderId}</b></div>
                                        <div className="meta">{when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                                        {order.saleType ? <div className="meta" style={{ textTransform: "capitalize" }}>{order.saleType} sale</div> : null}
                                    </div>
                                </div>
                                <hr />
                                <div className="parties">
                                    <div>
                                        <div className="label">Billed to</div>
                                        <div><b>{hasCustomer ? order.customerName : "Walk-in customer"}</b></div>
                                        {order.customerPhone ? <div>{order.customerPhone}</div> : null}
                                        {order.customerEmail ? <div>{order.customerEmail}</div> : null}
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        {seller ? <><div className="label">Served by</div><div>{seller}</div></> : null}
                                    </div>
                                </div>
                                <table className="items">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "40px" }}>#</th>
                                            <th>Description</th>
                                            <th className="r">Qty</th>
                                            <th className="r">Unit price</th>
                                            <th className="r">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, i) => (
                                            <tr key={i}>
                                                <td>{i + 1}</td>
                                                <td>{it.productName}{it.weight ? ` (${it.weight})` : ""}</td>
                                                <td className="r">{it.quantity}</td>
                                                <td className="r">{money(it.price)}</td>
                                                <td className="r">{money(it.totalPrice ?? it.price * it.quantity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="totals">
                                    <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                                    {couponDiscount > 0 ? (
                                        <div className="row"><span>Coupon{couponCode ? ` (${couponCode})` : ""}</span><span className="disc">-{money(couponDiscount)}</span></div>
                                    ) : null}
                                    {manualAmount > 0 ? (
                                        <div className="row"><span>{manualLabel}</span><span className="disc">-{money(manualAmount)}</span></div>
                                    ) : null}
                                    {showTax ? <div className="row"><span>{taxLabel} ({taxPercent}% incl.)</span><span>{money(taxAmount)}</span></div> : null}
                                    <div className="row grand"><span>Total</span><span>{money(total)}</span></div>
                                </div>
                                <div className="pay">
                                    Payment: <b style={{ textTransform: "capitalize" }}>{order.paymentMethod}</b>
                                    {order.paymentStatus ? <span style={{ textTransform: "capitalize" }}> · {order.paymentStatus}</span> : null}
                                </div>
                                <div className="foot">
                                    {receipt.footerNote ? <div>{receipt.footerNote}</div> : null}
                                    {receipt.returnPolicy ? <div style={{ marginTop: 4 }}>{receipt.returnPolicy}</div> : null}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-slate-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                        New sale
                    </button>
                    <button onClick={printNow} className="flex-[2] py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold flex items-center justify-center gap-2">
                        <FiPrinter className="w-4 h-4" /> Print {format === "a4" ? "invoice" : "receipt"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormatBtn({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? "bg-white text-teal-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
            }`}
        >
            {label}
        </button>
    );
}
