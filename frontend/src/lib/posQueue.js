// IndexedDB-backed queue for POS sales made while offline.
//
// When the terminal can't reach the server, the cashier's completed sale is
// stashed here instead of being lost. Once connectivity returns the app flushes
// the queue back through the normal create-sale endpoint.
//
// All functions are no-ops / resolve empty when IndexedDB is unavailable (SSR,
// private-mode quirks) so callers never need to feature-detect.

const DB_NAME = "pos-offline";
const STORE = "sales";
const DB_VERSION = 1;

const hasIDB = () => typeof indexedDB !== "undefined";

function openDb() {
    return new Promise((resolve, reject) => {
        if (!hasIDB()) return reject(new Error("no-indexeddb"));
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "localId" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function tx(db, mode) {
    const t = db.transaction(STORE, mode);
    return { store: t.objectStore(STORE), done: txDone(t) };
}

function txDone(t) {
    return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    });
}

const reqPromise = (req) =>
    new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

// Add a sale payload to the queue. Returns the stored record (with localId).
export async function enqueueSale(payload) {
    const record = {
        localId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        payload,
        createdAt: new Date().toISOString(),
    };
    try {
        const db = await openDb();
        const { store, done } = tx(db, "readwrite");
        store.put(record);
        await done;
        db.close();
    } catch {
        // Swallow — the caller already told the cashier the sale was saved; a
        // failure here is rare and there is no better local fallback.
    }
    return record;
}

export async function getQueuedSales() {
    try {
        const db = await openDb();
        const { store } = tx(db, "readonly");
        const all = await reqPromise(store.getAll());
        db.close();
        return (all || []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    } catch {
        return [];
    }
}

export async function countQueued() {
    try {
        const db = await openDb();
        const { store } = tx(db, "readonly");
        const n = await reqPromise(store.count());
        db.close();
        return n || 0;
    } catch {
        return 0;
    }
}

export async function removeSale(localId) {
    try {
        const db = await openDb();
        const { store, done } = tx(db, "readwrite");
        store.delete(localId);
        await done;
        db.close();
    } catch {
        // ignore
    }
}

// Flush queued sales through `submit(payload)`.
//
// `submit` should resolve to the parsed API response. We treat:
//   - resolves { success: true }  → synced, remove from queue
//   - resolves { success: false } → server rejected it (stock/coupon/etc); it
//     can never succeed on retry, so remove it and report it as failed
//   - throws                      → network still down; stop and keep the rest
//
// Returns { synced, failed, remaining }.
export async function flushQueue(submit) {
    let synced = 0;
    let failed = 0;
    const pending = await getQueuedSales();
    for (const record of pending) {
        let res;
        try {
            res = await submit(record.payload);
        } catch {
            // Network error — stop here, leave this and the rest for next time.
            return { synced, failed, remaining: pending.length - synced - failed };
        }
        if (res && res.success) {
            await removeSale(record.localId);
            synced += 1;
        } else {
            // Permanent server rejection — drop it so it can't block the queue.
            await removeSale(record.localId);
            failed += 1;
        }
    }
    return { synced, failed, remaining: 0 };
}
