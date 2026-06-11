import crypto from 'node:crypto';

// SSLCommerz REST integration (v4). Pure helpers — no Express / DB coupling — so
// the payment routes own all persistence and the gateway specifics stay here.
//
// The sandbox and live hosts share identical paths; only the hostname differs.
// Init is POST form-urlencoded; validation / refund are GET with `format=json`.
// Store credentials are passed in by the caller (they live in SiteSettings, set
// from the admin panel) — nothing is hardcoded here.

const host = (sandbox) =>
    sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

// Create a payment session. Returns the parsed gateway response; on success it
// carries `status: 'SUCCESS'`, a `GatewayPageURL` to redirect the shopper to,
// and a `sessionkey`. On failure `status` is 'FAILED' with `failedreason`.
export const initSession = async ({ sandbox, storeId, storePassword, payload }) => {
    const body = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePassword,
        ...payload,
    });
    const res = await fetch(`${host(sandbox)}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    return res.json();
};

// Authoritative settlement check. After a success callback / IPN we call this
// with the gateway-supplied `val_id` and trust ONLY its answer: a transaction is
// genuinely paid when `status` is 'VALID' or 'VALIDATED'. The caller must STILL
// match the returned `tran_id`, `amount` and `currency` to the local order so a
// forged callback for someone else's val_id can't settle this order.
export const validateTransaction = async ({ sandbox, storeId, storePassword, valId }) => {
    const qs = new URLSearchParams({
        val_id: valId,
        store_id: storeId,
        store_passwd: storePassword,
        v: '1',
        format: 'json',
    });
    const res = await fetch(
        `${host(sandbox)}/validator/api/validationserverAPI.php?${qs.toString()}`,
    );
    return res.json();
};

// Defense-in-depth check on the raw IPN / callback payload. SSLCommerz signs the
// notification with `verify_sign` (md5) computed over the comma-separated
// `verify_key` field list plus the md5 of the store password, sorted by key. We
// recompute and compare. A mismatch does NOT by itself reject the payment (the
// Validation API above is authoritative) but is logged as suspicious. Returns
// true only when the signature checks out.
export const verifyIpnHash = (body, storePassword) => {
    try {
        const verifySign = body.verify_sign;
        const verifyKey = body.verify_key;
        if (!verifySign || !verifyKey) return false;
        const pairs = String(verifyKey)
            .split(',')
            .filter(Boolean)
            .map((k) => [k, body[k] ?? '']);
        pairs.push(['store_passwd', md5(storePassword)]);
        // Mirror SSLCommerz's ksort(): order the params by key name only.
        pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        const hashString = pairs.map(([k, v]) => `${k}=${v}`).join('&');
        return md5(hashString) === verifySign;
    } catch {
        return false;
    }
};

// Issue a refund against a settled transaction, keyed by the gateway's
// `bank_tran_id` (captured at settlement). Returns the parsed response whose
// `status` ('success' | 'processing' | 'failed') and `refund_ref_id` indicate
// acceptance; the ref id can be used to poll the refund later.
export const refund = async ({ sandbox, storeId, storePassword, bankTranId, amount, remarks }) => {
    const qs = new URLSearchParams({
        bank_tran_id: bankTranId,
        refund_amount: String(amount),
        refund_remarks: remarks || 'Refund',
        store_id: storeId,
        store_passwd: storePassword,
        v: '1',
        format: 'json',
    });
    const res = await fetch(
        `${host(sandbox)}/validator/api/merchantTransIDvalidationAPI.php?${qs.toString()}`,
    );
    return res.json();
};
