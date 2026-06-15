/**
 * GET /api/v1/health
 *
 * Combined liveness + readiness probe as a single JSON endpoint.
 *
 * Response shape (always 200 unless the process cannot serve at all):
 *   {
 *     version: "1",
 *     uptime: <seconds>,
 *     db: "ok" | "degraded" | "not-ready",
 *     ready: boolean
 *   }
 *
 * The endpoint intentionally returns HTTP 200 even for a "degraded" DB so that
 * load-balancer health checks (which typically only check the status code) keep
 * the instance in rotation for read traffic.  Callers that need granular state
 * should inspect the `ready` and `db` fields.
 *
 * A hard DB failure (primary unreachable / ping failed) sets `ready: false` and
 * returns HTTP 503 so orchestrators can pull the pod immediately.
 */

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', async (_req, res) => {
    const payload = {
        version: '1',
        uptime: process.uptime(),
        db: 'ok',
        ready: true,
    };

    // 1. Basic Mongoose connection state.
    if (mongoose.connection?.readyState !== 1) {
        return res.status(503).json({ ...payload, db: 'not-ready', ready: false });
    }

    // 2. MongoDB ping — proves the connection can actually execute commands.
    try {
        await mongoose.connection.db.admin().ping();
    } catch {
        return res.status(503).json({ ...payload, db: 'not-ready', ready: false });
    }

    // 3. Replica-set primary check — optional (standalone nodes skip gracefully).
    try {
        const rsStatus = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
        const members = rsStatus.members ?? [];
        const hasPrimary = members.some((m) => m.stateStr === 'PRIMARY');
        const healthyCount = members.filter((m) => m.health === 1).length;

        if (!hasPrimary) {
            // No primary means writes will fail — treat as degraded not hard-fail
            // so reads can still be served.
            payload.db = 'degraded';
            payload.ready = false;
        } else if (healthyCount < members.length) {
            // Some secondaries down but primary is reachable — degraded but ready.
            payload.db = 'degraded';
        }
    } catch (err) {
        const isStandalone = err?.codeName === 'NotYetInitialized' || err?.code === 76;
        if (!isStandalone) {
            // Unexpected RS error — mark degraded, still ready.
            payload.db = 'degraded';
        }
        // Standalone node: leave db: 'ok', ready: true.
    }

    const statusCode = payload.ready ? 200 : 503;
    return res.status(statusCode).json(payload);
});

export default router;
