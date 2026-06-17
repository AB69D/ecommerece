import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import connectDB from './config/connectDB.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import requireAuth from './middlewares/auth.middleware.js';
import { auditMutations } from './lib/audit.js';
import AdminModel from './models/admin.model.js';
import { runAsSystem, withTenant } from './tenancy/tenantContext.js';
import { resolveTenant } from './tenancy/resolveTenant.js';
import { requireTenant } from './tenancy/requireTenant.js';
import { bootstrapTenancy } from './tenancy/bootstrapTenancy.js';
import { addVersionHeader, markDeprecated } from './middlewares/apiVersion.middleware.js';

import healthRouter from './routes/health.route.js';
import categoryRouter from './routes/category.route.js';
import productRouter from './routes/product.route.js';
import headerRouter from './routes/header.route.js';
import clientHeaderRouter from './routes/clientHeader.route.js';
import clientProductRouter from './routes/clientProduct.route.js';
import clientCartRouter from './routes/clientCart.route.js';
import clientWishlistRouter from './routes/clientWishlist.route.js';
import clientOrderRouter from './routes/clientOrder.route.js';
import clientPaymentRouter from './routes/clientPayment.route.js';
import clientAuthRouter from './routes/clientAuth.route.js';
import orderRouter from './routes/order.route.js';
import contactMessageRouter from './routes/contactMessage.route.js';
import reviewRouter from './routes/review.route.js';
import clientReviewRouter from './routes/clientReview.route.js';
import clientCategoryRouter from './routes/clientCategory.route.js';
import authRouter from './routes/auth.route.js';
import adminMgmtRouter from './routes/adminMgmt.route.js';
import siteSettingsRouter from './routes/siteSettings.route.js';
import footerRouter from './routes/footer.route.js';
import pageRouter from './routes/page.route.js';
import navMenuRouter from './routes/navMenu.route.js';
import rbacRouter from './routes/rbac.route.js';
import auditLogRouter from './routes/auditLog.route.js';
import analyticsRouter from './routes/analytics.route.js';
import chatbotRouter from './routes/chatbot.route.js';
import trackingRouter from './routes/tracking.route.js';
import customerRouter from './routes/customer.route.js';
import clientCheckoutRouter from './routes/clientCheckout.route.js';
import posRouter from './routes/pos.route.js';
import couponRouter from './routes/coupon.route.js';
import stockRouter from './routes/stock.route.js';
import billingRouter from './routes/billing.route.js';
import announcementRouter from './routes/announcement.route.js';
import platformRouter from './routes/platform.route.js';
import notificationRouter from './routes/notification.route.js';
import flashSaleRouter from './routes/flashSale.route.js';
import courierRouter from './routes/courier.route.js';
import vatConfigRouter from './routes/vatConfig.route.js';
import locationRouter from './routes/location.route.js';
import stockTransferRouter from './routes/stockTransfer.route.js';
import { recoverAbandonedCarts } from './lib/abandonedCart.js';

const app = express();

app.set('trust proxy', 1);

// CSP/CORP defaults are for HTML pages. This is a JSON API consumed by
// a frontend on a different origin (Vercel), so we relax those two.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
    }),
);
app.use(
    cors({
        origin: env.FRONTEND_URL ? [env.FRONTEND_URL, env.FRONTEND_URL.replace(/\/$/, '')] : true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'guest-id', 'Authorization', 'X-Tenant'],
        credentials: true,
    }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());
app.use(hpp());

app.use(
    pinoHttp({
        logger,
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        autoLogging: {
            ignore: (req) =>
                req.url === '/healthz' ||
                req.url === '/readyz' ||
                req.url === '/api/v1/health' ||
                req.url === '/api/health',
        },
    }),
);

const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    // Public storefront READS (GET /api/client/* and GET /api/v1/client/*) are
    // server-rendered by the frontend from a handful of shared CDN / serverless
    // egress IPs. A per-IP cap therefore throttles SSR for ALL visitors at once
    // the moment traffic rises (every store page would 404/degrade). These reads
    // are cheap, cacheable and not a meaningful abuse vector, so exempt them
    // here — writes, auth, admin and platform calls stay fully rate-limited.
    skip: (req) =>
        req.method === 'GET' &&
        (req.originalUrl.startsWith('/api/client/') ||
            req.originalUrl.startsWith('/api/v1/client/')),
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

// Liveness: proves only that the process is up and serving HTTP.
app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Readiness: checks MongoDB connectivity + replica-set health + optional Redis.
//
// Response shapes:
//   200 { status: 'ready',    ... }              — fully healthy
//   200 { status: 'degraded', warnings: [...] }  — functional but impaired
//   503 { status: 'not-ready', ... }             — cannot serve traffic
//
// "Degraded" lets orchestrators / uptime checks distinguish a soft impairment
// (e.g. a secondary is down but the primary is reachable) from a hard failure
// (primary unreachable) without false-alerting a 503.
app.get('/readyz', async (_req, res) => {
    const warnings = [];
    const checks = {};

    // ── 1. Basic Mongoose connection state ───────────────────────────────────
    if (mongoose.connection?.readyState !== 1) {
        return res.status(503).json({
            status: 'not-ready',
            db: 'disconnected',
            readyState: mongoose.connection?.readyState ?? null,
        });
    }

    // ── 2. MongoDB ping ──────────────────────────────────────────────────────
    try {
        await mongoose.connection.db.admin().ping();
        checks.db = 'connected';
    } catch {
        return res.status(503).json({ status: 'not-ready', db: 'ping-failed' });
    }

    // ── 3. Replica-set status (primary reachability) ─────────────────────────
    try {
        const rsStatus = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
        const members = rsStatus.members ?? [];
        const primary = members.find((m) => m.stateStr === 'PRIMARY');
        const healthyCount = members.filter((m) => m.health === 1).length;

        checks.replicaSet = {
            set: rsStatus.set,
            myState: rsStatus.myState,          // 1 = PRIMARY, 2 = SECONDARY
            myStateStr: rsStatus.myStateStr,
            primaryReachable: !!primary,
            membersTotal: members.length,
            membersHealthy: healthyCount,
        };

        if (!primary) {
            // No primary means writes will fail — hard failure.
            return res.status(503).json({
                status: 'not-ready',
                db: 'no-primary',
                checks,
            });
        }
        if (healthyCount < members.length) {
            warnings.push(
                `replica set degraded: ${healthyCount}/${members.length} members healthy`,
            );
        }
    } catch (err) {
        // replSetGetStatus fails on a standalone node (code 76).
        // Treat that as a warning (not a hard failure) so the app stays
        // ready if someone removes the replica set config without updating
        // the health check. Any other error is flagged as a warning too —
        // the ping above already confirmed the DB is reachable.
        const isNotReplSet = err?.codeName === 'NotYetInitialized' || err?.code === 76;
        warnings.push(
            isNotReplSet
                ? 'replica set not yet initiated — running as standalone'
                : `replica set status check failed: ${err?.message}`,
        );
        checks.replicaSet = { error: err?.message };
    }

    // ── 4. Redis (optional) ──────────────────────────────────────────────────
    if (process.env.REDIS_URL) {
        try {
            // Lazy-import so the heavy client is only loaded when REDIS_URL is set.
            // Works with both 'redis' (v4) and 'ioredis' packages.
            // We try a raw TCP connect + PING rather than importing a full client
            // to avoid coupling server.js to a specific Redis package.
            const { createClient } = await import('redis').catch(() => null)
                ?? await import('ioredis').catch(() => null)
                ?? {};

            if (createClient) {
                const tmp = createClient({ url: process.env.REDIS_URL });
                await tmp.connect?.();          // redis v4 needs explicit connect
                await tmp.ping();
                await tmp.quit?.() ?? tmp.disconnect?.();
                checks.redis = 'connected';
            } else {
                warnings.push('REDIS_URL is set but no redis/ioredis package found');
                checks.redis = 'package-missing';
            }
        } catch (err) {
            warnings.push(`redis ping failed: ${err?.message}`);
            checks.redis = 'ping-failed';
        }
    }

    // ── Response ─────────────────────────────────────────────────────────────
    if (warnings.length > 0) {
        return res.json({
            status: 'degraded',
            warnings,
            checks,
            uptime: process.uptime(),
        });
    }

    return res.json({ status: 'ready', checks, uptime: process.uptime() });
});

app.get('/', (_req, res) =>
    res.json({ success: true, message: 'Ab9dEcommerce API', env: env.NODE_ENV }),
);

// ── API versioning headers ────────────────────────────────────────────────────
// Stamp every /api/* and /api/v1/* response with X-API-Version so clients can
// inspect which version they're talking to. Legacy /api/* responses additionally
// get Deprecation + Sunset + Link headers (see apiVersion.middleware.js).
app.use('/api/v1', addVersionHeader);
app.use('/api', addVersionHeader);

// ── /api/v1/health — combined liveness + readiness probe ────────────────────
// Returns { version, uptime, db, ready } as a single JSON object. The dedicated
// /healthz and /readyz routes above remain for backwards compatibility with
// existing monitoring integrations and Docker HEALTHCHECK directives.
app.use('/api/v1/health', healthRouter);

// ── Uploaded images (persistent volume) ─────────────────────────────────────
// Store images live on a VPS volume in per-tenant folders and are served
// read-only here, BEFORE tenant resolution / rate limiting (static assets must
// not be scoped or throttled). The storefront (HTTPS on Vercel) reaches them
// through its /api proxy, so the URLs stay relative and need no backend domain.
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';
app.use(
    '/api/uploads',
    express.static(UPLOADS_DIR, {
        maxAge: '30d',
        immutable: true,
        index: false,
        fallthrough: false, // a missing file 404s here instead of hitting the API
        setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
);
// Also serve uploads under the versioned prefix so /api/v1/uploads/* works.
app.use('/api/v1/uploads', express.static(UPLOADS_DIR, {
    maxAge: '30d',
    immutable: true,
    index: false,
    fallthrough: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

// ── Helper: mount all namespaced routes under a given API prefix ──────────────
// Accepts a prefix such as '/api' or '/api/v1' and registers every route under
// it.  Called twice: once for the canonical versioned prefix and once for the
// legacy prefix (which already has markDeprecated in its middleware chain).
//
// NOTE: Express Router instances are shared between the two mounts — no
// duplication of handler logic.  Both prefixes ultimately execute the same
// controller code; only the URL path presented to the client differs.
const mountApiRoutes = (prefix) => {
    // ── Platform (super-admin) API — Phase 3/4 ──────────────────────────────
    // Mounted BEFORE the per-tenant resolver below and wrapped in a SYSTEM
    // context so these routes are intentionally cross-tenant.
    app.use(`${prefix}/platform`, (req, _res, next) => runAsSystem(() => next()), platformRouter);

    // ── Tenant resolution + async context (Phase 2) ──────────────────────────
    app.use(prefix, resolveTenant, withTenant);

    // ── Mandatory tenant guard (Phase 2+) ────────────────────────────────────
    app.use(`${prefix}/client`, requireTenant);
    app.use(`${prefix}/admin`, (req, _res, next) =>
        req.path.startsWith('/auth/') ? next() : requireTenant(req, _res, next)
    );

    // Auth (stricter rate limit)
    app.use(`${prefix}/admin/auth`, authLimiter, authRouter);

    // API rate limit for everything else
    app.use(prefix, apiLimiter);

    // Audit trail for every state-changing admin request.
    app.use(`${prefix}/admin`, auditMutations);

    // Admin routes (require auth)
    app.use(`${prefix}/admin/category`, requireAuth, categoryRouter);
    app.use(`${prefix}/admin/product`, requireAuth, productRouter);
    app.use(`${prefix}/admin/header`, requireAuth, headerRouter);
    app.use(`${prefix}/admin/order`, requireAuth, orderRouter);
    app.use(`${prefix}/admin/review`, requireAuth, reviewRouter);
    app.use(`${prefix}/admin/admins`, requireAuth, adminMgmtRouter);
    app.use(`${prefix}/admin/rbac`, requireAuth, rbacRouter);
    app.use(`${prefix}/admin/audit-logs`, requireAuth, auditLogRouter);
    app.use(`${prefix}/admin/analytics`, requireAuth, analyticsRouter);
    app.use(`${prefix}/admin/pos`, requireAuth, posRouter);
    app.use(`${prefix}/admin/stock`, requireAuth, stockRouter);
    app.use(`${prefix}/admin/billing`, requireAuth, billingRouter);
    app.use(`${prefix}/admin/announcements`, requireAuth, announcementRouter);
    app.use(`${prefix}/admin/customer`, requireAuth, customerRouter);
    app.use(`${prefix}/admin/coupon`, requireAuth, couponRouter.admin);
    app.use(`${prefix}/admin/site-settings`, requireAuth, siteSettingsRouter.admin);
    app.use(`${prefix}/admin/footer`, requireAuth, footerRouter.admin);
    app.use(`${prefix}/admin/page`, requireAuth, pageRouter.admin);
    app.use(`${prefix}/admin/nav-menu`, requireAuth, navMenuRouter.admin);
    app.use(`${prefix}/admin/notifications`, requireAuth, notificationRouter);
    app.use(`${prefix}/admin/flash-sale`, requireAuth, flashSaleRouter.admin);
    app.use(`${prefix}/admin/courier`, requireAuth, courierRouter);
    app.use(`${prefix}/admin/vat`, requireAuth, vatConfigRouter);
    app.use(`${prefix}/admin/location`, requireAuth, locationRouter);
    app.use(`${prefix}/admin/stock-transfer`, requireAuth, stockTransferRouter);

    // Public / client routes
    // NOTE: multer-based routes must use wrapMulter() from tenantContext.js so
    // ALS is restored after busboy callbacks finish — see clientReview.route.js.
    app.use(`${prefix}/client/auth`, clientAuthRouter);
    app.use(`${prefix}/client/header`, clientHeaderRouter);
    app.use(`${prefix}/client/product`, clientProductRouter);
    app.use(`${prefix}/client/cart`, clientCartRouter);
    app.use(`${prefix}/client/wishlist`, clientWishlistRouter);
    app.use(`${prefix}/client/order`, clientOrderRouter);
    app.use(`${prefix}/client/payment`, clientPaymentRouter);
    app.use(`${prefix}/client/checkout`, clientCheckoutRouter);
    app.use(`${prefix}/client/contact`, contactMessageRouter);
    app.use(`${prefix}/client/review`, clientReviewRouter);
    app.use(`${prefix}/client/category`, clientCategoryRouter);
    app.use(`${prefix}/client/coupon`, couponRouter.client);
    app.use(`${prefix}/client/site-settings`, siteSettingsRouter.client);
    app.use(`${prefix}/client/footer`, footerRouter.client);
    app.use(`${prefix}/client/page`, pageRouter.client);
    app.use(`${prefix}/client/nav-menu`, navMenuRouter.client);
    app.use(`${prefix}/client/chatbot`, chatbotRouter);
    app.use(`${prefix}/client/track`, trackingRouter);
    app.use(`${prefix}/client/flash-sale`, flashSaleRouter.client);
};

// ── Primary versioned API: /api/v1/* ─────────────────────────────────────────
// All new clients should target this prefix. Breaking changes in a future v2
// will be added under /api/v2/* without touching this tree.
mountApiRoutes('/api/v1');

// ── Legacy un-versioned API: /api/* (deprecated alias) ───────────────────────
// Existing frontend and mobile clients continue to work unchanged. Every
// response carries Deprecation + Sunset + Link headers (injected by
// markDeprecated below) to encourage migration to /api/v1/*.
//
// The rate-limiter skip rule for /api/client/* GET reads (see apiLimiter above)
// deliberately matches both prefixes, so SSR traffic is not penalised under
// either path.
app.use('/api', markDeprecated);
mountApiRoutes('/api');

app.use(notFound);
app.use(errorHandler);

// Collapse the legacy six-role model down to the four roles the app now
// supports. Idempotent: only touches docs that still carry an old role.
const migrateRoles = async () => {
    try {
        const toModerator = await AdminModel.updateMany(
            { role: { $in: ['manager', 'support', 'viewer'] } },
            { $set: { role: 'moderator' } },
        );
        const toSalesman = await AdminModel.updateMany(
            { role: 'pos-seller' },
            { $set: { role: 'salesman' } },
        );
        const moved = (toModerator.modifiedCount || 0) + (toSalesman.modifiedCount || 0);
        if (moved > 0) {
            logger.info(
                `Role migration: ${toModerator.modifiedCount || 0} -> moderator, ${toSalesman.modifiedCount || 0} -> salesman`,
            );
        }
    } catch (err) {
        logger.error({ err }, 'Role migration failed (continuing startup)');
    }
};

const start = async () => {
    try {
        await connectDB();
        // Startup data tasks run in a platform (system) context so they stay
        // cross-tenant once the scoping plugin is enabled in Phase 1. The
        // tenancy bootstrap is idempotent and purely additive (see Phase 0).
        await runAsSystem(async () => {
            await bootstrapTenancy();
            await migrateRoles();
        });
        const server = app.listen(env.PORT, () => {
            logger.info(`Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
        });

        // Abandoned cart recovery — runs every 30 minutes.
        // Fire once after 1 minute on startup to catch leads from any downtime,
        // then repeat on the interval. Wrapped in a system context so the
        // cross-tenant aggregate inside the job bypasses the tenant plugin.
        const runRecovery = () =>
            recoverAbandonedCarts().catch((err) =>
                logger.error({ err }, 'Abandoned cart recovery job error'),
            );
        setTimeout(runRecovery, 60_000);
        setInterval(runRecovery, 30 * 60 * 1_000);

        const shutdown = (signal) => {
            logger.info(`${signal} received, shutting down gracefully`);
            server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 10000).unref();
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
};

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
});

start();
