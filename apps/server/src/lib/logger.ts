import pino from 'pino';

const REDACT_PATHS = [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    '*.password',
    '*.token',
    '*.access_token',
    '*.csrf_token',
    'password',
    'token',
    'access_token',
    'csrf_token',
    'newPassword',
    'oldPassword',
];

export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
    },
    base: undefined,
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
