import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    FRONTEND_URL: z.string().url().or(z.string().regex(/^https?:\/\/localhost/)).optional(),

    // Public base URL of THIS API, used to build absolute gateway callback URLs
    // (SSLCommerz success/fail/cancel/IPN). Optional: when unset we derive it
    // from the proxied request (trust proxy is on), which is fine in most setups.
    PUBLIC_API_URL: z.string().url().optional(),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    ADMIN_EMAILS: z
        .string()
        .default('')
        .transform((s) =>
            s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
        ),

    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),

    API_KEY: z.string().optional(),
    MAIL_FROM_NAME: z.string().default('Ab9dEcommerce'),
    MAIL_FROM_ADDRESS: z.string().email().optional(),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
}

export const env = parsed.data;
