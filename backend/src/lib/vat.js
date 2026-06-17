/**
 * VAT utility library — Mushak 6.3 invoice generation for Bangladesh VAT compliance.
 *
 * Three exported functions:
 *   calculateVat        — compute taxable amount and VAT amount from order totals
 *   generateMushakInvoiceNo — format a sequential Mushak invoice number
 *   generateMushak63Html    — produce a print-ready A4 HTML Mushak 6.3 invoice
 */

/**
 * Calculate VAT components from order totals.
 *
 * @param {number} subtotal       - Pre-discount order total (sum of line prices × qty)
 * @param {number} discountAmount - Total discount applied (coupon + manual)
 * @param {number} vatRate        - VAT rate as a percentage, e.g. 15 for 15%
 * @returns {{ taxableAmount: number, vatAmount: number }}
 */
export function calculateVat(subtotal, discountAmount, vatRate) {
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const vatAmount = Math.round(taxableAmount * vatRate / 100 * 100) / 100;
    return { taxableAmount, vatAmount };
}

/**
 * Generate a formatted Mushak invoice number.
 *
 * @param {string} prefix   - Store-configured prefix, e.g. 'MSHK' or 'INV'
 * @param {number} counter  - Atomically incremented counter stored in SiteSettings
 * @returns {string}  e.g. "MSHK-2026-000001"
 */
export function generateMushakInvoiceNo(prefix, counter) {
    const year = new Date().getFullYear();
    return `${prefix || 'MSHK'}-${year}-${String(counter).padStart(6, '0')}`;
}

/**
 * Generate a print-ready A4 Mushak 6.3 HTML invoice (Bengali + English bilingual).
 *
 * @param {object} invoice  - VatInvoice document (plain object or Mongoose doc)
 * @returns {string}  Full <!DOCTYPE html> string
 */
export function generateMushak63Html(invoice) {
    const items = invoice.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>৳${Number(item.unitPrice).toFixed(2)}</td>
      <td>৳${Number(item.discountAmount).toFixed(2)}</td>
      <td>৳${Number(item.taxableAmount).toFixed(2)}</td>
      <td>${item.vatRate}%</td>
      <td>৳${Number(item.vatAmount).toFixed(2)}</td>
      <td>৳${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

    return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<title>Mushak 6.3 - ${invoice.invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Noto Sans Bengali', sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header h2 { font-size: 14px; color: #444; margin-top: 4px; }
  .mushak-title { background: #1a5f3f; color: white; text-align: center; padding: 8px; font-weight: 700; font-size: 14px; margin-bottom: 16px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .party-box { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
  .party-box h3 { font-weight: 700; margin-bottom: 8px; color: #1a5f3f; }
  .party-box p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a5f3f; color: white; padding: 8px 6px; text-align: right; font-size: 11px; }
  th:first-child, th:nth-child(2) { text-align: left; }
  td { padding: 6px; border-bottom: 1px solid #eee; text-align: right; }
  td:first-child, td:nth-child(2) { text-align: left; }
  .totals { width: 300px; margin-left: auto; border: 1px solid #ccc; }
  .totals td { padding: 6px 10px; }
  .totals .label { font-weight: 600; }
  .totals .grand { background: #1a5f3f; color: white; font-weight: 700; font-size: 14px; }
  .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .sign-box { border-top: 1px solid #000; padding-top: 8px; text-align: center; font-size: 11px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${invoice.sellerName}</h1>
    <p>${invoice.sellerAddress}</p>
    <p>e-BIN: <strong>${invoice.sellerBin}</strong></p>
  </div>
  <div class="mushak-title">মূসক-৬.৩ (সরবরাহের কর চালানপত্র) / Tax Invoice (Mushak 6.3)</div>
  <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
    <div><strong>Invoice No:</strong> ${invoice.invoiceNo}</div>
    <div><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-BD')}</div>
    <div><strong>Order:</strong> ${invoice.orderId}</div>
  </div>
  <div class="parties">
    <div class="party-box">
      <h3>বিক্রেতা / Seller</h3>
      <p>${invoice.sellerName}</p>
      <p>${invoice.sellerAddress}</p>
      <p>e-BIN: ${invoice.sellerBin}</p>
    </div>
    <div class="party-box">
      <h3>ক্রেতা / Buyer</h3>
      <p>${invoice.buyerName}</p>
      <p>${invoice.buyerPhone}</p>
      <p>${invoice.buyerAddress}</p>
      ${invoice.buyerBin ? '<p>e-BIN: ' + invoice.buyerBin + '</p>' : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>পণ্য / Item</th><th>পরিমাণ / Qty</th>
        <th>একক মূল্য / Unit</th><th>ছাড় / Discount</th>
        <th>করযোগ্য / Taxable</th><th>ভ্যাট হার / Rate</th>
        <th>ভ্যাট / VAT</th><th>মোট / Total</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>
  <table class="totals">
    <tr><td class="label">উপমোট / Subtotal</td><td>৳${Number(invoice.subtotal).toFixed(2)}</td></tr>
    <tr><td class="label">ছাড় / Discount</td><td>-৳${Number(invoice.discountAmount).toFixed(2)}</td></tr>
    <tr><td class="label">করযোগ্য / Taxable</td><td>৳${Number(invoice.taxableAmount).toFixed(2)}</td></tr>
    <tr><td class="label">ভ্যাট ${invoice.vatRate}% / VAT</td><td>৳${Number(invoice.vatAmount).toFixed(2)}</td></tr>
    <tr><td class="label">ডেলিভারি / Delivery</td><td>৳${Number(invoice.deliveryCharge).toFixed(2)}</td></tr>
    <tr class="grand"><td>সর্বমোট / Grand Total</td><td>৳${Number(invoice.grandTotal).toFixed(2)}</td></tr>
  </table>
  <div class="footer">
    <div class="sign-box">বিক্রেতার স্বাক্ষর<br>Seller Signature</div>
    <div class="sign-box">ক্রেতার স্বাক্ষর<br>Buyer Signature</div>
  </div>
  <p style="text-align:center; margin-top:24px; font-size:10px; color:#666;">
    This is a computer-generated invoice. | Ab9dEcommerce Platform
  </p>
</body>
</html>`;
}
