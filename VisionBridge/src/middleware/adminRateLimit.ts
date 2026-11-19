import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const CLEANUP_INTERVAL_MS = 60_000;

interface WindowState {
    count: number;
    resetAt: number;
}

const windows = new Map<string, WindowState>();
let lastCleanup = Date.now();

function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, state] of windows) {
        if (state.resetAt <= now) windows.delete(key);
    }
}

function getClientKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

export function adminRateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    cleanup(now);

    const key = getClientKey(req);
    let state = windows.get(key);
    if (!state || state.resetAt <= now) {
        state = { count: 0, resetAt: now + WINDOW_MS };
        windows.set(key, state);
    }

    state.count += 1;
    const remaining = Math.max(0, MAX_REQUESTS - state.count);
    const resetSeconds = Math.max(0, Math.ceil((state.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));
    res.setHeader('RateLimit-Policy', `${MAX_REQUESTS};w=${WINDOW_MS / 1000}`);

    if (state.count > MAX_REQUESTS) {
        res.setHeader('Retry-After', String(resetSeconds));
        res.setHeader('Cache-Control', 'no-store');
        res.status(429).json({
            ok: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        });
        return;
    }

    next();
}

export const adminRateLimitConfig = { WINDOW_MS, MAX_REQUESTS };
