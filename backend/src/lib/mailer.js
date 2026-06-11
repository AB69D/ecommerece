import { logger } from './logger.js';

// Thin transactional-email abstraction over Brevo (the same provider the admin
// login OTP already uses). Centralised here so every email — OTP, order
// confirmation, future password-reset / shipping updates — shares one sender,
// one set of credentials, and one failure policy.

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

// Read the key at call time (not module load) so a late-injected env still works.
const brevoKey = () => process.env.API_KEY || process.env.SMTP_KEY || '';

// Is outbound email actually configured? (an API key + a verified sender)
export const emailEnabled = () => Boolean(brevoKey() && process.env.MAIL_FROM_ADDRESS);

// Send one transactional email. NEVER throws — returns a result object instead —
// so best-effort callers (order confirmations) can fire it without a try/catch,
// while callers that care about delivery (OTP) can inspect `ok`.
//
//   { to, toName?, subject, html, text?, replyTo? }  ->  { ok, skipped?, status?, error? }
export const sendEmail = async ({ to, toName, subject, html, text, replyTo }) => {
    const key = brevoKey();
    if (!key) {
        logger.warn('Email skipped: no Brevo key (API_KEY / SMTP_KEY) configured');
        return { ok: false, skipped: true, reason: 'no-key' };
    }
    const fromEmail = process.env.MAIL_FROM_ADDRESS;
    if (!fromEmail) {
        logger.warn('Email skipped: MAIL_FROM_ADDRESS not configured');
        return { ok: false, skipped: true, reason: 'no-sender' };
    }
    if (!to) return { ok: false, skipped: true, reason: 'no-recipient' };

    try {
        const res = await fetch(BREVO_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                accept: 'application/json',
                'api-key': key,
            },
            body: JSON.stringify({
                sender: { name: process.env.MAIL_FROM_NAME || 'Shop', email: fromEmail },
                to: [{ email: to, ...(toName ? { name: toName } : {}) }],
                subject,
                htmlContent: html,
                ...(text ? { textContent: text } : {}),
                ...(replyTo ? { replyTo: { email: replyTo } } : {}),
            }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            logger.error({ status: res.status, body }, 'Brevo email send failed');
            return { ok: false, status: res.status, error: body?.message || `HTTP ${res.status}` };
        }
        return { ok: true, status: res.status };
    } catch (err) {
        logger.error({ err }, 'Brevo email send threw');
        return { ok: false, error: err.message };
    }
};
