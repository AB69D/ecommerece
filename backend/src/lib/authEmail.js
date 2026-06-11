import { sendEmail } from './mailer.js';
import { logger } from './logger.js';
import { esc, loadBrand, wrap } from './emailLayout.js';

// Branded "reset your password" email for the customer storefront. The caller
// generates a one-time reset link (token embedded) and a human-readable expiry
// label; this module only renders + sends it.
//
// Best-effort: never throws, returns a result object instead, so the
// forgot-password handler can fire it without a try/catch and still return its
// generic (enumeration-safe) response.
export const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInLabel = '1 hour' }) => {
    try {
        if (!to || !resetUrl) return { ok: false, skipped: true, reason: 'missing-args' };

        const brand = await loadBrand();
        const { siteName, primary } = brand;

        const inner = `
              <h1 style="margin:0 0 10px;color:#111;font-size:22px;">Reset your password</h1>
              <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">
                Hi ${esc(name || 'there')}, we received a request to reset the password for your
                ${esc(siteName)} account. Click the button below to choose a new password.
                This link expires in ${esc(expiresInLabel)}.
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${esc(resetUrl)}" style="background:${primary};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block;">Reset password</a>
              </div>
              <p style="margin:8px 0 0;color:#888;font-size:12px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <span style="color:${primary};word-break:break-all;">${esc(resetUrl)}</span>
              </p>
              <p style="margin:16px 0 0;color:#888;font-size:12px;line-height:1.6;">
                If you didn't request this, you can safely ignore this email — your password
                won't change.
              </p>`;

        const html = wrap(brand, inner);

        const text =
            `Reset your password\n\n` +
            `We received a request to reset your ${siteName} account password.\n` +
            `Open this link to choose a new password (expires in ${expiresInLabel}):\n` +
            `${resetUrl}\n\n` +
            `If you didn't request this, you can safely ignore this email.\n`;

        return await sendEmail({
            to,
            toName: name,
            subject: `Reset your password · ${siteName}`,
            html,
            text,
        });
    } catch (err) {
        logger.error({ err }, 'Password reset email failed');
        return { ok: false, error: err.message };
    }
};
