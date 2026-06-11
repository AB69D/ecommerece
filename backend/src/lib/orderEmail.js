import { sendEmail } from './mailer.js';
import { logger } from './logger.js';
import { esc, money, loadBrand, wrap } from './emailLayout.js';

const PAYMENT_LABEL = {
    cash_on_delivery: 'Cash on Delivery',
    online: 'Paid online',
    cash: 'Cash',
    card: 'Card',
};

// Customer-facing status changes worth an email, with their copy. Statuses not
// listed here (pending / confirmed / processing / return_requested) don't email.
const STATUS_EMAIL = {
    shipped: { subject: 'Your order is on the way', heading: 'Your order has shipped! 🚚', body: "Good news — your order is on its way to you." },
    delivered: { subject: 'Your order was delivered', heading: 'Delivered ✅', body: 'Your order has been delivered. We hope you love it!' },
    cancelled: { subject: 'Your order was cancelled', heading: 'Order cancelled', body: 'Your order has been cancelled. If this is unexpected, please get in touch.' },
    returned: { subject: 'Your return is complete', heading: 'Return processed', body: 'Your return has been processed.' },
};

// Build and send a branded order-confirmation / receipt email for one order.
//
// Best-effort: never throws and no-ops cleanly when the order carries no email
// address or outbound mail isn't configured, so it's safe to fire-and-forget
// from a checkout or payment-callback handler without blocking the response.
export const sendOrderConfirmationEmail = async (order) => {
    try {
        if (!order || !order.customerEmail) return { ok: false, skipped: true, reason: 'no-email' };

        const brand = await loadBrand();
        const { siteName, symbol, primary, accent, frontend } = brand;

        const trackUrl = order.customerPhone
            ? `${frontend}/track-order?phone=${encodeURIComponent(order.customerPhone)}`
            : frontend;

        const paid = order.paymentStatus === 'paid';
        const paymentLabel = PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod || '';

        const rows = (order.items || [])
            .map(
                (it) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;font-size:14px;">
                ${esc(it.productName)}${it.weight ? ` <span style="color:#888;">(${esc(it.weight)})</span>` : ''}
                <span style="color:#888;"> &times; ${Number(it.quantity)}</span>
              </td>
              <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;font-size:14px;text-align:right;white-space:nowrap;">
                ${money(symbol, it.totalPrice != null ? it.totalPrice : it.price * it.quantity)}
              </td>
            </tr>`,
            )
            .join('');

        const inner = `
              <h1 style="margin:0 0 4px;color:#111;font-size:22px;">Thank you for your order!</h1>
              <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">
                Hi ${esc(order.customerName || 'there')}, we&#39;ve received your order and it&#39;s now
                <strong>${esc(order.orderStatus || 'pending')}</strong>.${paid ? ' Your payment has been confirmed.' : ''}
              </p>
              <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
                <div style="color:#888;font-size:12px;">Order ID</div>
                <div style="color:${primary};font-size:18px;font-weight:bold;font-family:monospace;">${esc(order.orderId)}</div>
              </div>
              <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">${rows}</table>
              <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                <tr><td style="color:#666;font-size:14px;padding:2px 0;">Subtotal</td><td style="text-align:right;color:#666;font-size:14px;">${money(symbol, order.subtotal)}</td></tr>
                ${
                    order.discount
                        ? `<tr><td style="color:#666;font-size:14px;padding:2px 0;">Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</td><td style="text-align:right;color:#16a34a;font-size:14px;">&minus;${money(symbol, order.discount)}</td></tr>`
                        : ''
                }
                <tr><td style="color:#666;font-size:14px;padding:2px 0;">Delivery</td><td style="text-align:right;color:#666;font-size:14px;">${money(symbol, order.deliveryCharge)}</td></tr>
                <tr><td style="color:#111;font-size:16px;font-weight:bold;padding:10px 0 0;border-top:2px solid #eee;">Total</td><td style="text-align:right;color:${accent};font-size:18px;font-weight:bold;padding:10px 0 0;border-top:2px solid #eee;">${money(symbol, order.totalAmount)}</td></tr>
              </table>
              <div style="margin-top:18px;color:#555;font-size:13px;line-height:1.7;">
                <strong>Payment:</strong> ${esc(paymentLabel)}${!paid && order.paymentMethod === 'cash_on_delivery' ? ' &mdash; pay when your order arrives' : ''}<br/>
                <strong>Ship to:</strong> ${esc(order.shippingAddress)}${order.city ? `, ${esc(order.city)}` : ''}
              </div>
              ${
                  order.customerPhone
                      ? `<div style="text-align:center;margin-top:24px;">
                <a href="${esc(trackUrl)}" style="background:${primary};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block;">Track your order</a>
              </div>`
                      : ''
              }`;

        const html = wrap(brand, inner);

        const text =
            `Thank you for your order!\n` +
            `Order ${order.orderId}\n` +
            `Total: ${money(symbol, order.totalAmount)}\n` +
            `Status: ${order.orderStatus}\n` +
            (trackUrl ? `Track: ${trackUrl}\n` : '');

        return await sendEmail({
            to: order.customerEmail,
            toName: order.customerName,
            subject: `Order Confirmed — ${order.orderId} · ${siteName}`,
            html,
            text,
        });
    } catch (err) {
        logger.error({ err, orderId: order?.orderId }, 'Order confirmation email failed');
        return { ok: false, error: err.message };
    }
};

// Email the customer when their order moves to a status worth telling them about
// (shipped / delivered / cancelled / returned — see STATUS_EMAIL). Quietly
// no-ops for every other status (pending / confirmed / processing /
// return_requested) and when the order has no email on file.
//
// Same best-effort contract as the confirmation email: never throws, so it's
// safe to fire-and-forget from the admin status-update handler without a
// try/catch and without blocking the response.
export const sendOrderStatusEmail = async (order) => {
    try {
        if (!order || !order.customerEmail) return { ok: false, skipped: true, reason: 'no-email' };

        const copy = STATUS_EMAIL[order.orderStatus];
        if (!copy) return { ok: false, skipped: true, reason: 'no-copy' };

        const brand = await loadBrand();
        const { siteName, symbol, primary, frontend } = brand;

        const trackUrl = order.customerPhone
            ? `${frontend}/track-order?phone=${encodeURIComponent(order.customerPhone)}`
            : frontend;

        const inner = `
              <h1 style="margin:0 0 10px;color:#111;font-size:22px;">${esc(copy.heading)}</h1>
              <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">
                Hi ${esc(order.customerName || 'there')}, ${esc(copy.body)}
              </p>
              <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:8px;">
                <div style="color:#888;font-size:12px;">Order ID</div>
                <div style="color:${primary};font-size:18px;font-weight:bold;font-family:monospace;">${esc(order.orderId)}</div>
              </div>
              <div style="color:#666;font-size:14px;margin-top:8px;">Order total: <strong>${money(symbol, order.totalAmount)}</strong></div>
              ${
                  order.customerPhone
                      ? `<div style="text-align:center;margin-top:24px;">
                <a href="${esc(trackUrl)}" style="background:${primary};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block;">Track your order</a>
              </div>`
                      : ''
              }`;

        const html = wrap(brand, inner);

        const text =
            `${copy.heading}\n` +
            `Order ${order.orderId}\n` +
            `${copy.body}\n` +
            (trackUrl ? `Track: ${trackUrl}\n` : '');

        return await sendEmail({
            to: order.customerEmail,
            toName: order.customerName,
            subject: `${copy.subject} — ${order.orderId} · ${siteName}`,
            html,
            text,
        });
    } catch (err) {
        logger.error({ err, orderId: order?.orderId }, 'Order status email failed');
        return { ok: false, error: err.message };
    }
};
