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
import { runAsSystem, withTenant, reAttachTenant } from './tenancy/tenantContext.js';
import { resolveTenant } from './tenancy/resolveTenant.js';
import { requireTenant } from './tenancy/requireTenant.js';
import { bootstrapTenancy } from './tenancy/bootstrapTenancy.js';

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
        autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    }),
);

const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    // Public storefront READS (GET /api/client/*) are server-rendered by the
    // frontend from a handful of shared CDN / serverless egress IPs. A per-IP cap
    // therefore throttles SSR for ALL visitors at once the moment traffic rises
    // (every store page would 404/degrade). These reads are cheap, cacheable and
    // not a meaningful abuse vector, so exempt them here — writes, auth, admin and
    // platform calls stay fully rate-limited.
    skip: (req) => req.method === 'GET' && req.originalUrl.startsWith('/api/client/'),
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

// Readiness: "ready" only when the Mongo connection is live AND answers a ping,
// so an orchestrator / uptime check won't route traffic to an instance that
// can't reach the database. Returns 503 (not 500) so probes treat it as
// "temporarily unavailable" rather than a hard failure.
app.get('/readyz', async (_req, res) => {
    if (mongoose.connection?.readyState !== 1) {
        return res
            .status(503)
            .json({ status: 'not-ready', db: 'disconnected', readyState: mongoose.connection?.readyState ?? null });
    }
    try {
        await mongoose.connection.db.admin().ping();
        return res.json({ status: 'ready', db: 'connected', uptime: process.uptime() });
    } catch {
        return res.status(503).json({ status: 'not-ready', db: 'ping-failed' });
    }
});

app.get('/', (_req, res) =>
    res.json({ success: true, message: 'Ab9dEcommerce API', env: env.NODE_ENV }),
);

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

// ── Platform (super-admin) API — Phase 3/4 ──────────────────────────────────
// Tenant onboarding (public register) + fleet management (super-admin). Mounted
// BEFORE the per-tenant resolver below and wrapped in a SYSTEM context, so these
// routes are intentionally cross-tenant (they create/manage tenants and must see
// all of them) rather than scoped to one store. The super-admin guard inside the
// router protects everything except public store registration.
app.use('/api/platform', (req, _res, next) => runAsSystem(() => next()), platformRouter);

// ── Tenant resolution + async context (Phase 2) ─────────────────────────────
// Resolve the tenant (X-Tenant header / subdomain / custom domain) and bind the
// rest of the request to it via AsyncLocalStorage, BEFORE any route runs — so
// the scoping plugin filters every query (including the admin-auth login lookup,
// which is now per-tenant). Health checks live outside /api and are untouched.
// In the single-tenant interim (no signal) this resolves nothing and the
// plugin's default tenant takes over, so behaviour is unchanged.
app.use('/api', resolveTenant, withTenant);

// ── Mandatory tenant guard (Phase 2+) ───────────────────────────────────────
// When TENANT_ENFORCEMENT=true, /api/client/* and /api/admin/* MUST carry a
// resolved tenant. A request with no X-Tenant header / subdomain signal is
// rejected 400 here rather than silently served under the primary store.
// /api/platform/* is mounted before this and never reaches it.
//
// /api/admin/auth/* is exempt: login is global-by-email (no tenant needed to
// authenticate); the JWT returned carries the tenantId and requireAuth binds
// it via setRequestTenant() on every subsequent request. The Next.js middleware
// also deliberately omits X-Tenant on auth calls for the same reason.
app.use('/api/client', requireTenant);
app.use('/api/admin', (req, _res, next) =>
    req.path.startsWith('/auth/') ? next() : requireTenant(req, _res, next)
);

// Auth (stricter rate limit)
app.use('/api/admin/auth', authLimiter, authRouter);

// API rate limit for everything else
app.use('/api', apiLimiter);

// Audit trail for every state-changing admin request (records on response
// finish; attaches req.audit() so controllers can enrich the entry).
app.use('/api/admin', auditMutations);

// Admin routes (require auth)
app.use('/api/admin/category', requireAuth, categoryRouter);
app.use('/api/admin/product', requireAuth, productRouter);
app.use('/api/admin/header', requireAuth, headerRouter);
app.use('/api/admin/order', requireAuth, orderRouter);
app.use('/api/admin/review', requireAuth, reviewRouter);
app.use('/api/admin/admins', requireAuth, adminMgmtRouter);
app.use('/api/admin/rbac', requireAuth, rbacRouter);
app.use('/api/admin/audit-logs', requireAuth, auditLogRouter);
app.use('/api/admin/analytics', requireAuth, analyticsRouter);
app.use('/api/admin/pos', requireAuth, posRouter);
app.use('/api/admin/stock', requireAuth, stockRouter);
app.use('/api/admin/billing', requireAuth, billingRouter);
app.use('/api/admin/announcements', requireAuth, announcementRouter);
app.use('/api/admin/customer', requireAuth, customerRouter);
app.use('/api/admin/coupon', requireAuth, couponRouter.admin);
app.use('/api/admin/site-settings', requireAuth, siteSettingsRouter.admin);
app.use('/api/admin/footer', requireAuth, footerRouter.admin);
app.use('/api/admin/page', requireAuth, pageRouter.admin);
app.use('/api/admin/nav-menu', requireAuth, navMenuRouter.admin);

// ── Global reAttachTenant for client routes ──────────────────────────────────
// multer (and other streaming body parsers) process the request body via busboy
// event emitters that run in Node's ROOT async context — losing the
// AsyncLocalStorage tenant context that withTenant set at the start of the
// request.  req.tenant (set by resolveTenant) is always preserved on the
// request object, so reAttachTenant can restore the ALS context from it.
//
// Mounting here — BEFORE the client routers — means every route that uses multer
// automatically gets the correct tenant context restored without each router
// having to remember to add reAttachTenant between upload and handler.
//
// For admin routes this is a no-op: requireAuth calls setRequestTenant() which
// re-binds the context from the JWT.  We still apply it to /api/client because
// some client routes (review upload, checkout lead) use multer without auth.
app.use('/api/client', reAttachTenant);

// Public/client routes
app.use('/api/client/auth', clientAuthRouter);
app.use('/api/client/header', clientHeaderRouter);
app.use('/api/client/product', clientProductRouter);
app.use('/api/client/cart', clientCartRouter);
app.use('/api/client/wishlist', clientWishlistRouter);
app.use('/api/client/order', clientOrderRouter);
app.use('/api/client/payment', clientPaymentRouter);
app.use('/api/client/checkout', clientCheckoutRouter);
app.use('/api/client/contact', contactMessageRouter);
app.use('/api/client/review', clientReviewRouter);
app.use('/api/client/category', clientCategoryRouter);
app.use('/api/client/coupon', couponRouter.client);
app.use('/api/client/site-settings', siteSettingsRouter.client);
app.use('/api/client/footer', footerRouter.client);
app.use('/api/client/page', pageRouter.client);
app.use('/api/client/nav-menu', navMenuRouter.client);
app.use('/api/client/chatbot', chatbotRouter);
app.use('/api/client/track', trackingRouter);

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
