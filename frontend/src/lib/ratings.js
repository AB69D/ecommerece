// Client-side batching loader for per-product rating summaries.
//
// A product grid can mount dozens of <ProductRating> components at once. Instead
// of firing one request per card, each subscription is queued and flushed in a
// single bulk call to `/api/client/review/summary?productIds=...` (chunked).
// Results are cached in-memory for the page lifetime so re-mounting a card (e.g.
// carousel paging) is instant.

const cache = new Map(); // productId -> { average, count }
const subscribers = new Map(); // productId -> Set<callback>
let pending = new Set();
let timer = null;

const CHUNK_SIZE = 60;
const FLUSH_DELAY = 60; // ms — let a render pass collect all card ids first

function notify(id, summary) {
    const subs = subscribers.get(id);
    if (subs) subs.forEach((cb) => cb(summary));
}

async function flush() {
    timer = null;
    const ids = Array.from(pending);
    pending = new Set();
    if (ids.length === 0) return;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        let data = {};
        try {
            const res = await fetch(`/api/client/review/summary?productIds=${encodeURIComponent(chunk.join(","))}`);
            if (res.ok) {
                const json = await res.json();
                data = json?.data || {};
            }
        } catch {
            data = {};
        }
        chunk.forEach((id) => {
            const summary = data[id] || { average: 0, count: 0 };
            cache.set(id, summary);
            notify(id, summary);
        });
    }
}

// Subscribe a card to its product's rating summary. Returns an unsubscribe fn.
export function subscribeRating(productId, cb) {
    if (!productId) return () => {};

    if (cache.has(productId)) {
        cb(cache.get(productId));
        return () => {};
    }

    if (!subscribers.has(productId)) subscribers.set(productId, new Set());
    subscribers.get(productId).add(cb);

    pending.add(productId);
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY);

    return () => {
        const subs = subscribers.get(productId);
        if (subs) subs.delete(cb);
    };
}

// Drop a cached summary so the next subscribe refetches it (e.g. after a user
// submits a new review on the product page).
export function invalidateRating(productId) {
    if (productId) cache.delete(productId);
}
