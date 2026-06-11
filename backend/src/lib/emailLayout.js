import { getSettings } from './siteSettings.js';
import { env } from '../config/env.js';

// Shared branded-email building blocks, used by every transactional email
// (order confirmation, order status, password reset) so they all look like one
// brand and pull their colours / logo / support contact from one place.

// HTML-escape any value interpolated into an email body (names, addresses,
// product titles, links) so a stray < or & can't break the markup.
export const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]));

export const money = (symbol, n) =>
    `${symbol}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// Load the storefront branding used by every email (name, logo, colours,
// support contact, currency). Settings are cached, so this is cheap; falls back
// to env / sensible defaults if settings can't be read.
export const loadBrand = async () => {
    const s = (await getSettings().catch(() => null)) || {};
    return {
        siteName: s.siteName || process.env.MAIL_FROM_NAME || 'Our Shop',
        symbol: s.currencySymbol || '$',
        primary: s.theme?.primary || '#047857',
        accent: s.theme?.accent || '#f59e0b',
        logo: s.logoUrl || '',
        footerNote: s.receipt?.footerNote || 'Thank you for shopping with us!',
        supportEmail: s.contactEmail || process.env.MAIL_FROM_ADDRESS || '',
        supportPhone: s.contactPhone || '',
        frontend: (env.FRONTEND_URL || '').replace(/\/$/, ''),
    };
};

// Shared header (logo + store name) and footer (note + support) so every email
// looks like one brand. `inner` is the HTML between them.
export const wrap = (brand, inner) => `
        <div style="background:#f6f7f9;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
            <div style="background:${brand.primary};padding:24px;text-align:center;">
              ${brand.logo ? `<img src="${esc(brand.logo)}" alt="${esc(brand.siteName)}" style="max-height:44px;margin-bottom:8px;" />` : ''}
              <div style="color:#fff;font-size:20px;font-weight:bold;">${esc(brand.siteName)}</div>
            </div>
            <div style="padding:24px;">${inner}</div>
            <div style="padding:18px 24px;background:#fafafa;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;line-height:1.6;">
              ${esc(brand.footerNote)}<br/>
              ${brand.supportEmail ? `Questions? ${esc(brand.supportEmail)}` : ''}${brand.supportPhone ? ` &middot; ${esc(brand.supportPhone)}` : ''}
            </div>
          </div>
        </div>`;
