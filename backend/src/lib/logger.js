import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
    level: env.LOG_LEVEL,
    transport: isDev
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.token',
            '*.secret',
            'MONGODB_URI',
            'JWT_SECRET',
            'CLOUDINARY_API_SECRET',
        ],
        remove: true,
    },
});
