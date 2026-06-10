// Helpers for building wa.me click-to-chat links from the admin-configured
// business number. WhatsApp expects a bare international number with no "+",
// spaces, or punctuation (e.g. "8801712345678").

// Strip everything except digits. A leading "+" is dropped too since wa.me
// does not want it.
export const sanitizeWaNumber = (raw) => String(raw || "").replace(/[^\d]/g, "");

// Build a https://wa.me/<number> link, optionally pre-filling a message.
// Returns "" when there is no usable number so callers can hide the button.
export const waLink = (number, message = "") => {
    const n = sanitizeWaNumber(number);
    if (!n) return "";
    const base = `https://wa.me/${n}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

// Fill a {{token}} template with values. Unknown tokens are left blank so a
// half-configured template never leaks raw "{{...}}" to a customer.
export const fillTemplate = (template, vars = {}) =>
    String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
        const v = vars[key];
        return v === undefined || v === null ? "" : String(v);
    });
