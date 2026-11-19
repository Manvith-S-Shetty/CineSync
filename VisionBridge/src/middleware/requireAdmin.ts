import type { NextFunction, Request, Response } from 'express';
import firebaseAdmin = require('../firebaseAdmin');

export interface AdminIdentity {
    uid: string;
}

export interface AdminRequest extends Request {
    admin?: AdminIdentity;
}

/** Extract only `Authorization: Bearer <token>`; never query/body/header role data. */
function getBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    const token = match?.[1]?.trim();
    return token ? token : null;
}

let cachedAdminUidsRaw: string | null = null;
let cachedAdminUids = new Set<string>();

/**
 * Backend-only admin allowlist from ADMIN_UIDS.
 * Comma-separated, trimmed, empty entries ignored. Never returned to clients.
 */
function getAdminUids(): Set<string> {
    const raw = String(process.env.ADMIN_UIDS || '');
    if (raw !== cachedAdminUidsRaw) {
        cachedAdminUidsRaw = raw;
        cachedAdminUids = new Set(
            raw
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
        );
    }
    return cachedAdminUids;
}

function errorBody(code: string, message: string): { ok: false; error: { code: string; message: string } } {
    return { ok: false, error: { code, message } };
}

/**
 * Protect admin HTTP routes:
 * - missing/malformed/invalid/expired/revoked token -> 401
 * - valid non-admin -> 403
 * - allowlisted admin -> next()
 *
 * A future custom-claims path can replace/extend the allowlist with
 * `decoded.admin === true` from the verified Firebase token.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = getBearerToken(req);
    if (!token) {
        res.status(401).json(errorBody('AUTH_REQUIRED', 'Authentication required'));
        return;
    }

    let identity;
    try {
        identity = await firebaseAdmin.verifyIdToken(token, true);
    } catch (err: unknown) {
        const code = (err as { code?: unknown } | null)?.code;
        if (code === 'AUTH_UNAVAILABLE') {
            res.status(503).json(errorBody('AUTH_UNAVAILABLE', 'Authentication unavailable'));
            return;
        }
        res.status(401).json(errorBody('AUTH_INVALID', 'Invalid or expired authentication token'));
        return;
    }

    if (!getAdminUids().has(identity.uid)) {
        res.status(403).json(errorBody('FORBIDDEN', 'Admin access required'));
        return;
    }

    (req as AdminRequest).admin = { uid: identity.uid };
    next();
}
