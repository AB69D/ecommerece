import express from 'express';
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

import categoryRouter from './routes/category.route.js';
import productRouter from './routes/product.route.js';
import headerRouter from './routes/header.route.js';
import clientHeaderRouter from './routes/clientHeader.route.js';
import clientProductRouter from './routes/clientProduct.route.js';
import clientCartRouter from './routes/clientCart.route.js';
import clientWishlistRouter from './routes/clientWishlist.route.js';
import clientOrderRouter from './routes/clientOrder.route.js';
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
import customerRouter from './routes/customer.route.js';
import clientCheckoutRouter from './routes/clientCheckout.route.js';
import posRouter from './routes/pos.route.js';
import couponRouter from './routes/coupon.route.js';
import stockRouter from './routes/stock.route.js';

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
        allowedHeaders: ['Content-Type', 'guest-id', 'Authorization'],
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
        autoLogging: { ignore: (req) => req.url === '/healthz' },
    }),
);

const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/', (_req, res) =>
    res.json({ success: true, message: 'Ab9dEcommerce API', env: env.NODE_ENV }),
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
app.use('/api/admin/customer', requireAuth, customerRouter);
app.use('/api/admin/coupon', requireAuth, couponRouter.admin);
app.use('/api/admin/site-settings', requireAuth, siteSettingsRouter.admin);
app.use('/api/admin/footer', requireAuth, footerRouter.admin);
app.use('/api/admin/page', requireAuth, pageRouter.admin);
app.use('/api/admin/nav-menu', requireAuth, navMenuRouter.admin);

// Public/client routes
app.use('/api/client/header', clientHeaderRouter);
app.use('/api/client/product', clientProductRouter);
app.use('/api/client/cart', clientCartRouter);
app.use('/api/client/wishlist', clientWishlistRouter);
app.use('/api/client/order', clientOrderRouter);
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
        await migrateRoles();
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
