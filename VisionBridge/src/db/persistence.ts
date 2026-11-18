import type { PoolClient } from 'pg';
import { getPool, isDatabaseConfigured } from './pool';

const LAST_SEEN_THROTTLE_MS = 60_000;
const lastSeenTouched = new Map<string, number>();

export interface VerifiedIdentityInput {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
}

export interface SharedVideoDescriptorInput {
    source: 'local' | 'remote';
    sessionId: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    fingerprint?: string | null;
    url?: string | null;
}

function logDbFailure(op: string, err: unknown, meta?: Record<string, unknown>): void {
    const e = err as any;
    console.error('[db] persistence failure', {
        op,
        code: e?.code,
        message: e?.message,
        ...(meta || {}),
    });
}

function safeText(value: unknown, max = 512): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;
    return v.slice(0, max);
}

function safeNullableUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;
    try {
        const u = new URL(v);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        // Do not persist credentials, tokens, or sensitive query params
        if (u.username || u.password) return null;
        const sensitive = ['token', 'access_token', 'auth', 'signature', 'sig', 'key', 'apikey', 'api_key', 'x-amz-signature', 'x-amz-credential', 'x-amz-security-token'];
        for (const k of Array.from(u.searchParams.keys())) {
            if (sensitive.includes(k.toLowerCase())) return null;
        }
        const out = u.toString();
        return out.length <= 2048 ? out : null;
    } catch {
        return null;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function upsertUser(identity: VerifiedIdentityInput): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const uid = safeText(identity.uid, 128);
    if (!uid) return;
    const now = Date.now();
    const last = lastSeenTouched.get(uid) || 0;
    const touch = now - last >= LAST_SEEN_THROTTLE_MS;
    if (touch) lastSeenTouched.set(uid, now);

    const pool = getPool();
    if (!pool) return;

    const email = safeText(identity.email, 320);
    const displayName = safeText(identity.displayName, 255);
    const photoUrl = safeNullableUrl(identity.photoURL);

    try {
        if (touch) {
            await pool.query(
                `INSERT INTO users (firebase_uid, email, display_name, photo_url, last_seen_at)
                 VALUES ($1, $2, $3, $4, now())
                 ON CONFLICT (firebase_uid) DO UPDATE SET
                   email = COALESCE(EXCLUDED.email, users.email),
                   display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                   photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
                   last_seen_at = now()`,
                [uid, email, displayName, photoUrl]
            );
        } else {
            await pool.query(
                `INSERT INTO users (firebase_uid, email, display_name, photo_url)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (firebase_uid) DO UPDATE SET
                   email = COALESCE(EXCLUDED.email, users.email),
                   display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                   photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url)`,
                [uid, email, displayName, photoUrl]
            );
        }
    } catch (err) {
        logDbFailure('upsertUser', err, { uid });
    }
}

async function getActiveRoomId(client: PoolClient, roomCode: string): Promise<number | null> {
    const res = await client.query(
        `SELECT id FROM rooms WHERE room_code = $1 AND status = 'active' LIMIT 1`,
        [roomCode]
    );
    if (!res.rows[0]) return null;
    const id = Number(res.rows[0].id);
    return Number.isFinite(id) ? id : null;
}

export async function createRoomWithHost(
    roomCode: string,
    host: VerifiedIdentityInput,
    socketSessionId: string | null = null
): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    const uid = safeText(host.uid, 128);
    if (!code || !uid) return;
    const pool = getPool();
    if (!pool) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await upsertUserTx(client, host, true);
        const roomRes = await client.query(
            `INSERT INTO rooms (room_code, host_firebase_uid, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (room_code) DO UPDATE SET host_firebase_uid = EXCLUDED.host_firebase_uid
             RETURNING id`,
            [code, uid]
        );
        let roomId: number | null = roomRes.rows[0] ? Number(roomRes.rows[0].id) : null;
        if (!roomId) {
            roomId = await getActiveRoomId(client, code);
        }
        if (roomId) {
            // Close stale active participant rows for this host in this room, then record host participation
            await client.query(
                `UPDATE room_participants SET is_host = false, left_at = now()
                 WHERE room_id = $1 AND is_host = true AND left_at IS NULL`,
                [roomId]
            );
            await client.query(
                `INSERT INTO room_participants (room_id, firebase_uid, socket_session_id, is_host)
                 VALUES ($1, $2, $3, true)`,
                [roomId, uid, safeText(socketSessionId, 128)]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        logDbFailure('createRoomWithHost', err, { roomCode: code, uid });
    } finally {
        client.release();
    }
}

async function upsertUserTx(client: PoolClient, identity: VerifiedIdentityInput, touch: boolean): Promise<void> {
    const uid = safeText(identity.uid, 128);
    if (!uid) return;
    const email = safeText(identity.email, 320);
    const displayName = safeText(identity.displayName, 255);
    const photoUrl = safeNullableUrl(identity.photoURL);
    if (touch) {
        await client.query(
            `INSERT INTO users (firebase_uid, email, display_name, photo_url, last_seen_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (firebase_uid) DO UPDATE SET
               email = COALESCE(EXCLUDED.email, users.email),
               display_name = COALESCE(EXCLUDED.display_name, users.display_name),
               photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
               last_seen_at = now()`,
            [uid, email, displayName, photoUrl]
        );
    } else {
        await client.query(
            `INSERT INTO users (firebase_uid, email, display_name, photo_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (firebase_uid) DO UPDATE SET
               email = COALESCE(EXCLUDED.email, users.email),
               display_name = COALESCE(EXCLUDED.display_name, users.display_name),
               photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url)`,
            [uid, email, displayName, photoUrl]
        );
    }
}

export async function recordParticipantJoin(
    roomCode: string,
    identity: VerifiedIdentityInput,
    isHost: boolean,
    socketSessionId: string | null
): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    const uid = safeText(identity.uid, 128);
    if (!code || !uid) return;
    const pool = getPool();
    if (!pool) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const now = Date.now();
        const touch = now - (lastSeenTouched.get(uid) || 0) >= LAST_SEEN_THROTTLE_MS;
        if (touch) lastSeenTouched.set(uid, now);
        await upsertUserTx(client, identity, touch);

        let roomId = await getActiveRoomId(client, code);
        if (!roomId) {
            // Brief best-effort retries to reduce race with room creation persistence.
            for (let i = 0; i < 5 && !roomId; i++) {
                await delay(40);
                roomId = await getActiveRoomId(client, code);
            }
        }

        if (!roomId) {
            console.warn('[db] recordParticipantJoin skipped: active room not found', { roomCode: code, uid, isHost });
            await client.query('ROLLBACK');
            return;
        }

        if (isHost) {
            await client.query(
                `UPDATE room_participants SET is_host = false, left_at = now()
                 WHERE room_id = $1 AND is_host = true AND left_at IS NULL AND firebase_uid <> $2`,
                [roomId, uid]
            );
            await client.query(
                `UPDATE rooms SET host_firebase_uid = $2 WHERE id = $1 AND status = 'active'`,
                [roomId, uid]
            );
        }
        // Rejoin creates a new history record
        await client.query(
            `INSERT INTO room_participants (room_id, firebase_uid, socket_session_id, is_host)
             VALUES ($1, $2, $3, $4)`,
            [roomId, uid, safeText(socketSessionId, 128), !!isHost]
        );

        await client.query('COMMIT');
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        logDbFailure('recordParticipantJoin', err, { roomCode: code, uid, isHost });
    } finally {
        client.release();
    }
}

export async function recordParticipantLeave(roomCode: string, firebaseUid: string): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    const uid = safeText(firebaseUid, 128);
    if (!code || !uid) return;
    const pool = getPool();
    if (!pool) return;
    try {
        await pool.query(
            `UPDATE room_participants rp
             SET left_at = now(), is_host = false
             FROM rooms r
             WHERE rp.room_id = r.id
               AND r.room_code = $1
               AND rp.firebase_uid = $2
               AND rp.left_at IS NULL`,
            [code, uid]
        );
    } catch (err) {
        logDbFailure('recordParticipantLeave', err, { roomCode: code, uid });
    }
}

export async function recordHostTransfer(
    roomCode: string,
    newHost: VerifiedIdentityInput
): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    const uid = safeText(newHost.uid, 128);
    if (!code || !uid) return;
    const pool = getPool();
    if (!pool) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await upsertUserTx(client, newHost, true);
        const roomId = await getActiveRoomId(client, code);
        if (!roomId) {
            console.warn('[db] recordHostTransfer skipped: active room not found', { roomCode: code, uid });
            await client.query('ROLLBACK');
            return;
        }

        // Demote any current active host(s) first to preserve single-active-host invariant.
        await client.query(
            `UPDATE room_participants SET is_host = false
             WHERE room_id = $1 AND is_host = true AND left_at IS NULL`,
            [roomId]
        );

        const promoted = await client.query(
            `UPDATE room_participants SET is_host = true
             WHERE id = (
               SELECT id FROM room_participants
               WHERE room_id = $1 AND firebase_uid = $2 AND left_at IS NULL
               ORDER BY joined_at DESC LIMIT 1
             )
             RETURNING id`,
            [roomId, uid]
        );

        // If no active participant row exists (race/concurrency), ensure room host ref is still consistent.
        if (promoted.rowCount === 0) {
            console.warn('[db] recordHostTransfer: no active participant row to promote', { roomCode: code, uid });
        }

        await client.query(
            `UPDATE rooms SET host_firebase_uid = $2 WHERE id = $1 AND status = 'active'`,
            [roomId, uid]
        );

        await client.query('COMMIT');
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        logDbFailure('recordHostTransfer', err, { roomCode: code, uid });
    } finally {
        client.release();
    }
}

export async function endRoomPersistence(roomCode: string): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    if (!code) return;
    const pool = getPool();
    if (!pool) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const roomId = await getActiveRoomId(client, code);
        if (roomId) {
            await client.query(
                `UPDATE watch_sessions SET is_active = false, ended_at = now()
                 WHERE room_id = $1 AND is_active = true`,
                [roomId]
            );
            await client.query(
                `UPDATE room_participants SET left_at = now(), is_host = false
                 WHERE room_id = $1 AND left_at IS NULL`,
                [roomId]
            );
            await client.query(
                `UPDATE rooms SET status = 'ended', ended_at = now()
                 WHERE id = $1 AND status = 'active'`,
                [roomId]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        logDbFailure('endRoomPersistence', err, { roomCode: code });
    } finally {
        client.release();
    }
}

export async function upsertWatchSession(
    roomCode: string,
    host: VerifiedIdentityInput,
    descriptor: SharedVideoDescriptorInput | null
): Promise<void> {
    if (!isDatabaseConfigured()) return;
    const code = safeText(roomCode, 32);
    const hostUid = safeText(host.uid, 128);
    if (!code || !hostUid) return;
    const pool = getPool();
    if (!pool) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Ensure host user exists for FK consistency before inserting watch session rows.
        await upsertUserTx(client, host, true);
        const roomId = await getActiveRoomId(client, code);
        if (!roomId) {
            console.warn('[db] upsertWatchSession skipped: active room not found', { roomCode: code, hostUid, hasDescriptor: !!descriptor });
            await client.query('ROLLBACK');
            return;
        }

        // Close previous active watch session (replacement/clearing) within the same transaction.
        await client.query(
            `UPDATE watch_sessions SET is_active = false, ended_at = now()
             WHERE room_id = $1 AND is_active = true`,
            [roomId]
        );

        if (descriptor) {
            const sourceType = descriptor.source === 'local' ? 'local' : 'remote';
            const sessionId = safeText(descriptor.sessionId, 128) || `${Date.now()}`;
            const fileName = sourceType === 'local' ? safeText(descriptor.fileName, 260) : null;
            const fileSize = sourceType === 'local' && Number.isFinite(descriptor.fileSize) && (descriptor.fileSize as number) >= 0
                ? Math.floor(descriptor.fileSize as number) : null;
            const duration = Number.isFinite(descriptor.duration) && (descriptor.duration as number) >= 0
                ? descriptor.duration : null;
            const fingerprint = sourceType === 'local' ? safeText(descriptor.fingerprint, 128) : null;
            const remoteUrl = sourceType === 'remote' ? safeNullableUrl(descriptor.url) : null;

            await client.query(
                `INSERT INTO watch_sessions
                   (room_id, host_firebase_uid, source_type, session_id, file_name, file_size, duration_seconds, fingerprint, remote_url, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
                [roomId, hostUid, sourceType, sessionId, fileName, fileSize, duration, fingerprint, remoteUrl]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        logDbFailure('upsertWatchSession', err, { roomCode: code, hostUid, hasDescriptor: !!descriptor, source: descriptor?.source });
    } finally {
        client.release();
    }
}
