import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getRawSettings } from '../lib/app-settings.js';
import { verifyToken } from '../lib/auth-middleware.js';
import { logSystemWarn } from '../lib/system-log.js';

/**
 * Settings-driven rate limiter that makes requests WAIT instead of failing:
 *
 * 1. Token bucket per user (JWT cookie) or IP — capacity `max`, refill
 *    `max / windowMs` per ms.
 * 2. When no token is available the request is parked in a per-key FIFO
 *    queue and released as tokens refill — up to `ratelimit.queue.maxWaitMs`.
 *    From the client's perspective the request simply takes a little longer.
 * 3. Only when the queue is full or the estimated wait exceeds the cap does
 *    the server respond 429 + `Retry-After` (the client auto-retries).
 */

export type RateLimitScope = 'general' | 'ai' | 'auth';

interface LimiterConfig {
    enabled: boolean;
    capacity: number;
    windowMs: number;
    maxWaitMs: number;
    maxQueueSize: number;
    /** Refund the token when the response is a success (used for login: only failures should count). */
    skipSuccessfulRequests: boolean;
}

interface QueuedRequest {
    res: Response;
    next: NextFunction;
    enqueuedAt: number;
    waitCapAt: number;
}

interface Bucket {
    tokens: number;
    lastRefill: number;
    lastSeen: number;
    queue: QueuedRequest[];
    /** Config snapshot at last arrival — ticks refill against it. */
    cfg: LimiterConfig;
}

interface RateLimitState {
    buckets: Map<string, Bucket>;
    tickTimer: NodeJS.Timeout | null;
}

const globalForLimiter = globalThis as unknown as { __rateLimitState?: RateLimitState };

const state = (): RateLimitState => {
    globalForLimiter.__rateLimitState ??= { buckets: new Map(), tickTimer: null };
    return globalForLimiter.__rateLimitState;
};

const TICK_MS = 250;
const BUCKET_IDLE_MS = 10 * 60 * 1000;

async function loadConfig(scope: RateLimitScope): Promise<LimiterConfig> {
    const raw = await getRawSettings();
    const enabled = raw['ratelimit.enabled'] === 'true';
    const windowMs =
        scope === 'ai'
            ? Number(raw['ratelimit.ai.windowMs'] ?? 60_000)
            : scope === 'auth'
              ? Number(raw['ratelimit.auth.windowMs'] ?? 900_000)
              : Number(raw['ratelimit.windowMs'] ?? 900_000);
    const capacity =
        scope === 'ai'
            ? Number(raw['ratelimit.ai.max'] ?? 10)
            : scope === 'auth'
              ? Number(raw['ratelimit.auth.max'] ?? 10)
              : Number(raw['ratelimit.max'] ?? 600);
    return {
        enabled,
        capacity: Number.isFinite(capacity) && capacity >= 1 ? Math.floor(capacity) : 1,
        windowMs: Number.isFinite(windowMs) && windowMs >= 1_000 ? windowMs : 60_000,
        maxWaitMs: clamp(Number(raw['ratelimit.queue.maxWaitMs'] ?? 10_000), 0, 30_000),
        maxQueueSize: clamp(Number(raw['ratelimit.queue.maxSize'] ?? 100), 0, 5_000),
        skipSuccessfulRequests: scope === 'auth',
    };
}

const clamp = (value: number, min: number, max: number): number =>
    Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), min), max) : min;

function getBucket(key: string, cfg: LimiterConfig, now: number): Bucket {
    let bucket = state().buckets.get(key);
    if (!bucket) {
        bucket = { tokens: cfg.capacity, lastRefill: now, lastSeen: now, queue: [], cfg };
        state().buckets.set(key, bucket);
    } else {
        bucket.cfg = cfg;
    }
    return bucket;
}

function refill(bucket: Bucket, cfg: LimiterConfig, now: number): void {
    const elapsed = now - bucket.lastRefill;
    if (elapsed <= 0) return;
    const refillAmount = (elapsed / cfg.windowMs) * cfg.capacity;
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
}

function rejectWith429(res: Response, retryAfterSeconds: number): void {
    if (res.writableEnded || res.destroyed) return;
    res.status(429).set('Retry-After', String(Math.max(1, retryAfterSeconds))).json({
        error: 'rate_limited',
        message: 'Too many requests. Retrying automatically…',
        retryAfter: Math.max(1, retryAfterSeconds),
    });
}

/** Releases queued requests as tokens refill. Runs on a shared interval. */
function flushQueues(): void {
    const now = Date.now();
    const { buckets } = state();

    for (const [key, bucket] of buckets) {
        refill(bucket, bucket.cfg, now);

        while (bucket.queue.length > 0 && bucket.tokens >= 1) {
            const queued = bucket.queue.shift()!;
            if (queued.res.writableEnded || queued.res.destroyed) continue;
            bucket.tokens -= 1;
            try {
                queued.next();
            } catch (error) {
                rejectWith429(queued.res, 1);
                logSystemWarn({
                    source: 'rate-limit',
                    message: 'rate-limit: queued request dispatch failed',
                    meta: { key, error: String(error) },
                });
            }
        }

        // Safety: requests past their wait cap get 429 (client retries transparently).
        for (let i = bucket.queue.length - 1; i >= 0; i--) {
            const queued = bucket.queue[i]!;
            if (queued.res.writableEnded || queued.res.destroyed) {
                bucket.queue.splice(i, 1);
            } else if (now >= queued.waitCapAt) {
                bucket.queue.splice(i, 1);
                const waited = Math.ceil((now - queued.enqueuedAt) / 1000);
                rejectWith429(queued.res, Math.max(1, waited));
            }
        }

        // Sweep idle buckets to bound memory.
        if (bucket.queue.length === 0 && bucket.lastSeen < now - BUCKET_IDLE_MS) {
            buckets.delete(key);
        }
    }
}

function ensureTickTimer(): void {
    const s = state();
    if (s.tickTimer) return;
    s.tickTimer = setInterval(flushQueues, TICK_MS);
    s.tickTimer.unref?.();
}

const keyForRequest = (req: Request): string => {
    const token = extractCookieToken(req);
    if (token) {
        const payload = verifyToken(token);
        if (payload) return `user:${payload.userId}`;
    }
    return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
};

const extractCookieToken = (req: Request): string | null => {
    const header = req.headers.cookie;
    if (!header) return null;
    const match = /(?:^|;\s*)access_token=([^;]+)/.exec(header);
    return match?.[1] ?? null;
};

/**
 * Creates a settings-driven wait-queue rate limiter for the given scope.
 * Per-request settings are read through the cached app-settings accessor.
 */
export function smartRateLimit(scope: RateLimitScope): RequestHandler {
    ensureTickTimer();
    return (req: Request, res: Response, next: NextFunction) => {
        void (async () => {
            const cfg = await loadConfig(scope);
            if (!cfg.enabled) {
                next();
                return;
            }

            const now = Date.now();
            const key = `${scope}:${keyForRequest(req)}`;
            const bucket = getBucket(key, cfg, now);
            bucket.lastSeen = now;
            refill(bucket, cfg, now);

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                if (cfg.skipSuccessfulRequests) {
                    // Refund on success so only failed logins count against the limit.
                    res.on('finish', () => {
                        if (res.statusCode < 400) {
                            bucket.tokens = Math.min(bucket.cfg.capacity, bucket.tokens + 1);
                        }
                    });
                }
                next();
                return;
            }

            const timePerToken = cfg.windowMs / cfg.capacity;
            const estimatedWaitMs = Math.ceil(timePerToken * (bucket.queue.length + 1));

            if (
                bucket.queue.length >= cfg.maxQueueSize ||
                estimatedWaitMs > cfg.maxWaitMs ||
                cfg.maxWaitMs === 0
            ) {
                const retryAfterSeconds = Math.max(1, Math.ceil(estimatedWaitMs / 1000));
                if (bucket.queue.length >= cfg.maxQueueSize || cfg.maxWaitMs === 0) {
                    logSystemWarn({
                        source: 'rate-limit',
                        message: 'rate limit exceeded (queue saturated)',
                        path: req.originalUrl,
                        method: req.method,
                        statusCode: 429,
                        meta: { key, queueLength: bucket.queue.length, retryAfterSeconds },
                    });
                }
                rejectWith429(res, retryAfterSeconds);
                return;
            }

            const queued: QueuedRequest = {
                res,
                next,
                enqueuedAt: now,
                waitCapAt: now + cfg.maxWaitMs,
            };
            bucket.queue.push(queued);        })().catch((error) => {
            // Never let limiter internals break a request.
            next();
            logSystemWarn({
                source: 'rate-limit',
                message: 'rate limiter internal error',
                meta: { error: String(error) },
            });
        });
    };
}

/** Exposed for tests. */
export const __testHooks = { state, flushQueues, refill };
