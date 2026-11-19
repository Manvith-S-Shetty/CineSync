import dotenv = require('dotenv');
dotenv.config({ quiet: true } as any);

import express = require('express');
import http = require('http');
import { Server, Socket } from 'socket.io';
import cors = require('cors');
import firebaseAdmin = require('./firebaseAdmin');
import { checkDatabaseHealth, getPool, isDatabaseConfigured } from './db/pool';
import adminRouter = require('./routes/admin');
import adminAnalyticsRouter = require('./routes/adminAnalytics');
import { adminRateLimit } from './middleware/adminRateLimit';
import {
    createRoomWithHost,
    endRoomPersistence,
    recordHostTransfer,
    recordParticipantJoin,
    recordParticipantLeave,
    upsertUser,
    upsertWatchSession,
} from './db/persistence';

const { initFirebaseAdmin, isFirebaseAdminReady, verifyIdToken } = firebaseAdmin;

initFirebaseAdmin();

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const log = (...args: unknown[]): void => {
    if (!isProduction) console.log(...args);
};
const warn = (...args: unknown[]): void => {
    if (!isProduction) console.warn(...args);
};
const error = (...args: unknown[]): void => {
    if (!isProduction) console.error(...args);
};

type CorsOriginOption = string[] | (string | RegExp)[];

interface VerifiedIdentity {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
}

interface UserData {
    id: string;
    username: string;
    displayName: string;
    photoURL: string;
    roomId: string;
    isHost: boolean;
    firebaseUid: string;
}

interface ChatMessage {
    id: string;
    userId: string;
    firebaseUid: string;
    username: string;
    displayName: string;
    photoURL: string;
    text: string;
    timestamp: string;
    isHost: boolean;
}

interface SocketData {
    auth?: VerifiedIdentity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPayload(payload: unknown): Record<string, unknown> {
    return isRecord(payload) ? payload : {};
}

/**
 * CORS for Express + Socket.IO.
 * Production: set CORS_ORIGIN to your frontend origin(s), comma-separated, no trailing slash.
 */
function getCorsAllowedOrigins(): string[] | null {
    const raw = process.env.CORS_ORIGIN;
    if (raw && String(raw).trim()) {
        return String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return null;
}

function getSocketCorsOrigin(): CorsOriginOption {
    const explicit = getCorsAllowedOrigins();
    if (explicit && explicit.length) {
        return explicit;
    }

    if (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production') {
        warn(
            '[signaling] CORS_ORIGIN is not set. Browsers may block Socket.IO. Set CORS_ORIGIN=https://your-app.vercel.app'
        );
    }

    return [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:5173$/,
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5174$/,
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5174$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:5174$/,
    ];
}

const corsOriginOption = getSocketCorsOrigin();
app.use(
    cors({
        origin: corsOriginOption as any,
        credentials: true,
    })
);

app.get('/health', async (_req: express.Request, res: express.Response) => {
    const db = await checkDatabaseHealth();
    res.status(200).json({
        ok: true,
        service: 'signaling-server',
        authConfigured: isFirebaseAdminReady(),
        database: {
            configured: db.configured,
            connected: db.connected,
        },
    });
});

app.get('/', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        ok: true,
        service: 'signaling-server',
        health: '/health',
        authConfigured: isFirebaseAdminReady(),
        database: {
            configured: isDatabaseConfigured(),
        },
    });
});

// Admin HTTP routes are protected by verified Firebase identity + backend allowlist.
app.use('/api/admin', adminRateLimit);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminAnalyticsRouter);

const io = new Server(server, {
    cors: {
        origin: corsOriginOption as any,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

/** Optional handshake auth ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â does not replace per-event ID token verification. */
io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const token = (socket.handshake as any)?.auth?.token;
    if (!token) {
        next();
        return;
    }
    try {
        (socket.data as SocketData).auth = await verifyIdToken(token);
    } catch {
        // Allow connection; privileged handlers still require a valid idToken.
    }
    next();
});

/**
 * Minimal per-room sequencing for best-effort persistence operations.
 * Ensures dependent DB ops for the same room run in order without blocking realtime behavior.
 * Failures are contained and do not break the chain.
 */
const roomPersistenceChains = new Map<string, Promise<void>>();

function runRoomPersistence(roomId: string, opName: string, fn: () => Promise<void>): void {
    const prev = roomPersistenceChains.get(roomId) ?? Promise.resolve();
    const next = prev
        .catch(() => { /* keep chain alive */ })
        .then(fn)
        .catch((err) => {
            error('[db] sequenced persistence op failed', { roomId, op: opName, message: (err as any)?.message, code: (err as any)?.code });
        })
        .finally(() => {
            if (roomPersistenceChains.get(roomId) === next) {
                roomPersistenceChains.delete(roomId);
            }
        });
    roomPersistenceChains.set(roomId, next);
}

/**
 * Verify Firebase ID token from client payload.
 * Returns server-trusted identity or null (and emits a safe error to the socket).
 */
async function requireVerifiedIdentity(socket: Socket, idToken: unknown): Promise<VerifiedIdentity | null> {
    try {
        const identity = await verifyIdToken(idToken);
        (socket.data as SocketData).auth = identity;
        // Best-effort persistence; never block or fail auth on DB issues.
        void upsertUser(identity);
        return identity;
    } catch (err: unknown) {
        const code = isRecord(err) ? (err as { code?: unknown }).code : undefined;
        if (code === 'AUTH_UNAVAILABLE') {
            socket.emit('error', { message: 'Authentication unavailable' });
            socket.emit('errorMessage', { message: 'Authentication unavailable' });
        } else if (code === 'AUTH_REQUIRED' || code === 'auth/id-token-expired') {
            socket.emit('error', { message: 'Authentication required' });
            socket.emit('errorMessage', { message: 'Authentication required' });
        } else {
            socket.emit('error', { message: 'Authentication failed' });
            socket.emit('errorMessage', { message: 'Authentication failed' });
        }
        return null;
    }
}

/** Ensure the socket already joined this room as the verified Firebase user. */
function requireRoomMember(socket: Socket, roomId: unknown, identity: VerifiedIdentity | null): UserData | null {
    if (typeof roomId !== 'string' || !identity) return null;
    const user = users.get(socket.id);
    if (
        !user ||
        user.roomId !== roomId ||
        user.firebaseUid !== identity.uid ||
        !rooms.has(roomId) ||
        !rooms.get(roomId)?.has(socket.id)
    ) {
        return null;
    }
    return user;
}

function requireRoomHost(socket: Socket, roomId: unknown, identity: VerifiedIdentity | null): UserData | null {
    const user = requireRoomMember(socket, roomId, identity);
    if (!user?.isHost) return null;
    return user;
}

const rooms = new Map<string, Set<string>>(); // Track rooms and their participants
const users = new Map<string, UserData>(); // Track user details
const roomMessages = new Map<string, ChatMessage[]>();
/** roomId -> Firebase uid of current host (first user in room; migrates when host leaves) */
const roomHostFirebaseUid = new Map<string, string>();

const ALLOWED_REACTIONS = new Set(['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDD25', '\uD83D\uDE2E']);

const MAX_ROOM_ID_LENGTH = 32;
const MAX_SDP_LENGTH = 100000;
const MAX_ICE_CANDIDATE_LENGTH = 4096;
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const MAX_CURRENT_TIME_SECONDS = 24 * 60 * 60;

interface RateLimitRule { limit: number; windowMs: number }
interface RateLimitConfig { user?: RateLimitRule; room?: RateLimitRule }
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    auth: { user: { limit: 30, windowMs: 60_000 } },
    roomCreate: { user: { limit: 6, windowMs: 60_000 } },
    roomJoin: { user: { limit: 20, windowMs: 60_000 }, room: { limit: 80, windowMs: 60_000 } },
    signaling: { user: { limit: 240, windowMs: 60_000 }, room: { limit: 1200, windowMs: 60_000 } },
    chat: { user: { limit: 30, windowMs: 30_000 }, room: { limit: 180, windowMs: 30_000 } },
    typing: { user: { limit: 60, windowMs: 30_000 }, room: { limit: 400, windowMs: 30_000 } },
    playback: { user: { limit: 60, windowMs: 30_000 }, room: { limit: 240, windowMs: 30_000 } },
    reaction: { user: { limit: 30, windowMs: 30_000 }, room: { limit: 200, windowMs: 30_000 } },
};
interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();
let lastRateLimitCleanup = Date.now();

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidRoomId(roomId: unknown): roomId is string {
    return typeof roomId === 'string' && /^[A-Za-z0-9]{2,32}$/.test(roomId) && roomId.length <= MAX_ROOM_ID_LENGTH;
}

function isValidSocketId(socketId: unknown): socketId is string {
    return typeof socketId === 'string' && socketId.length > 0 && socketId.length <= 128 && /^[A-Za-z0-9_-]+$/.test(socketId);
}

function isValidSessionDescription(description: unknown, expectedType: string): boolean {
    return (
        isPlainObject(description) &&
        description.type === expectedType &&
        typeof description.sdp === 'string' &&
        description.sdp.length > 0 &&
        description.sdp.length <= MAX_SDP_LENGTH
    );
}

function isValidIceCandidate(candidate: unknown): boolean {
    if (!isPlainObject(candidate)) return false;
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length > MAX_ICE_CANDIDATE_LENGTH) {
        return false;
    }
    if (candidate.sdpMid != null && typeof candidate.sdpMid !== 'string') return false;
    if (candidate.sdpMLineIndex != null && !Number.isInteger(candidate.sdpMLineIndex)) return false;
    return true;
}

function isValidPlaybackTime(currentTime: unknown): currentTime is number {
    return typeof currentTime === 'number' && Number.isFinite(currentTime) && currentTime >= 0 && currentTime <= MAX_CURRENT_TIME_SECONDS;
}

function emitRateLimit(socket: Socket): void {
    socket.emit('errorMessage', { message: 'Too many requests. Please slow down.' });
}

function consumeBucket(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const existing = rateBuckets.get(key);
    if (!existing || existing.resetAt <= now) {
        rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
}

function cleanupRateBuckets(): void {
    const now = Date.now();
    if (now - lastRateLimitCleanup < 60_000) return;
    lastRateLimitCleanup = now;
    for (const [key, bucket] of rateBuckets.entries()) {
        if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
}

function getRateUserKey(socket: Socket, identity?: VerifiedIdentity | null): string {
    return identity?.uid || (socket.data as SocketData)?.auth?.uid || users.get(socket.id)?.firebaseUid || socket.id;
}

function checkRateLimit(socket: Socket, category: string, opts: { roomId?: unknown; identity?: VerifiedIdentity | null } = {}): boolean {
    cleanupRateBuckets();
    const config = RATE_LIMITS[category];
    if (!config) return true;
    const userKey = getRateUserKey(socket, opts.identity);
    if (config.user && !consumeBucket(`${category}:user:${userKey}`, config.user.limit, config.user.windowMs)) {
        emitRateLimit(socket);
        return false;
    }
    const roomId = opts.roomId;
    if (config.room && typeof roomId === 'string' && !consumeBucket(`${category}:room:${roomId}`, config.room.limit, config.room.windowMs)) {
        emitRateLimit(socket);
        return false;
    }
    return true;
}

function getRoomMember(socket: Socket, roomId: unknown): UserData | null {
    if (!isValidRoomId(roomId)) return null;
    const room = rooms.get(roomId);
    const user = users.get(socket.id);
    if (!room || !user || user.roomId !== roomId || !room.has(socket.id)) return null;
    return user;
}

function getRoomMemberBySocketId(roomId: unknown, socketId: unknown): UserData | null {
    if (!isValidRoomId(roomId) || !isValidSocketId(socketId)) return null;
    const room = rooms.get(roomId);
    const user = users.get(socketId);
    if (!room || !room.has(socketId) || !user || user.roomId !== roomId) return null;
    return user;
}

function getSignalingParticipants(socket: Socket, roomId: unknown, to: unknown): { sender: UserData; recipient: UserData } | null {
    if (!isValidSocketId(to) || to === socket.id) return null;
    const sender = getRoomMember(socket, roomId);
    const recipient = getRoomMemberBySocketId(roomId, to);
    if (!sender || !recipient) return null;
    return { sender, recipient };
}

function shouldAllowRoomEvent(socket: Socket, category: string, roomId: unknown): boolean {
    if (!getRoomMember(socket, roomId)) return false;
    return checkRateLimit(socket, category, { roomId });
}
const MAX_WATCH_VIDEO_URL_LEN = 2048;
const MAX_SHARED_FILENAME_LEN = 260;
const MAX_SESSION_ID_LEN = 128;
const MAX_FINGERPRINT_LEN = 128;
const WATCH_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg'];

interface SharedVideoDescriptor {
    source: 'local' | 'remote';
    sessionId: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    fingerprint?: string | null;
    url?: string | null;
}
/** roomId -> shared video descriptor for watch sync (host-set only) */
const roomSharedVideo = new Map<string, SharedVideoDescriptor>();
/** roomId -> shared direct video URL for watch sync (host-set only, remote compat) */
const roomWatchVideoUrl = new Map<string, string>();
/** roomId -> current room video URL (alias used by videoChange event, remote compat) */
const roomVideo = new Map<string, string>();

function generateVideoSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toSharedDescriptor(value: unknown): SharedVideoDescriptor | null {
    if (!isPlainObject(value)) return null;
    const source = value.source;
    const sessionId = typeof value.sessionId === 'string' && value.sessionId.length > 0 && value.sessionId.length <= MAX_SESSION_ID_LEN
        ? value.sessionId
        : generateVideoSessionId();
    if (source === 'local') {
        const fileName = typeof value.fileName === 'string' ? value.fileName.slice(0, MAX_SHARED_FILENAME_LEN) : '';
        const fileSize = typeof value.fileSize === 'number' && Number.isFinite(value.fileSize) && value.fileSize >= 0 ? Math.floor(value.fileSize) : NaN;
        const duration = typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration >= 0 ? value.duration : NaN;
        if (!fileName || !Number.isFinite(fileSize) || !Number.isFinite(duration)) return null;
        const fingerprint = typeof value.fingerprint === 'string' && value.fingerprint.length <= MAX_FINGERPRINT_LEN ? value.fingerprint : null;
        return { source: 'local', sessionId, fileName, fileSize, duration, fingerprint };
    }
    if (source === 'remote') {
        const url = typeof value.url === 'string' ? value.url : null;
        if (url == null || url === '') return { source: 'remote', sessionId, url: null };
        if (!isAllowedWatchVideoUrl(url)) return null;
        return { source: 'remote', sessionId, url };
    }
    return null;
}

function isYouTubeHostname(hostname: string): boolean {
    const h = String(hostname || '').toLowerCase();
    return (
        h === 'youtube.com' ||
        h === 'www.youtube.com' ||
        h === 'm.youtube.com' ||
        h === 'youtu.be' ||
        h === 'www.youtu.be' ||
        h.endsWith('.youtube.com')
    );
}

function isAllowedWatchVideoUrl(url: unknown): url is string {
    if (typeof url !== 'string' || url.length === 0 || url.length > MAX_WATCH_VIDEO_URL_LEN) {
        return false;
    }
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }
    if (isYouTubeHostname(parsed.hostname)) {
        return false;
    }
    const path = parsed.pathname.toLowerCase();
    return WATCH_VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

io.on('connection', (socket: Socket) => {
    log('New user connected:', socket.id);
    log('[SOCKET CONNECTED]', socket.id);

    // Temporary baseline measurement: Socket.IO round-trip latency
    socket.on('metrics:ping', (payload: unknown = {}) => {
        const p = getPayload(payload);
        socket.emit('metrics:pong', {
            clientTimestamp: p.clientTimestamp,
            serverTimestamp: Date.now(),
        });
    });

    // Optional handshake / refresh: bind verified identity to the socket session
    socket.on('authenticate', async (payload: unknown = {}) => {
        const { idToken } = getPayload(payload);
        if (!checkRateLimit(socket, 'auth')) return;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        socket.emit('authenticated', { uid: identity.uid });
    });

    // Create room - identity from verified ID token only
    socket.on('createRoom', async (payload: unknown = {}) => {
        const { idToken } = getPayload(payload);
        if (!checkRateLimit(socket, 'roomCreate')) return;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity || !socket.id) return;
        if (!checkRateLimit(socket, 'roomCreate', { identity })) return;

        const roomId = generateRoomId();
        roomHostFirebaseUid.set(roomId, identity.uid);
        // Best-effort persistence (room + host participant). Sequenced per room; does not affect in-memory/Socket.IO flow.
        runRoomPersistence(roomId, 'createRoomWithHost', () => createRoomWithHost(roomId, identity, socket.id));
        joinRoom(socket, {
            roomId,
            username: identity.displayName,
            displayName: identity.displayName,
            photoURL: identity.photoURL,
            firebaseUid: identity.uid,
            isHost: true,
        }, { skipPersistence: true });
        socket.emit('roomCreated', {
            roomId,
            user: {
                id: socket.id,
                username: identity.displayName,
                displayName: identity.displayName,
                photoURL: identity.photoURL,
                isHost: true,
            },
        });
    });

    // Join existing room - identity from verified ID token only
    socket.on('joinRoom', async (payload: unknown = {}) => {
        const { roomId, idToken } = getPayload(payload);
        if (!checkRateLimit(socket, 'roomJoin')) return;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity || !socket.id || !isValidRoomId(roomId)) {
            if (!isValidRoomId(roomId)) {
                socket.emit('errorMessage', { message: 'Room not found' });
                socket.emit('error', { message: 'Room not found' });
            }
            return;
        }
        if (!checkRateLimit(socket, 'roomJoin', { roomId, identity })) return;

        log(`Join room attempt - Room: ${roomId}, uid: ${identity.uid}, SocketId: ${socket.id}`);

        if (!rooms.has(roomId)) {
            error(`Room not found: ${roomId}`);
            socket.emit('errorMessage', { message: 'Room not found' });
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        try {
            const isHost = roomHostFirebaseUid.get(roomId) === identity.uid;
            const rid = String(roomId);
            joinRoom(socket, {
                roomId: rid,
                username: identity.displayName,
                displayName: identity.displayName,
                photoURL: identity.photoURL,
                firebaseUid: identity.uid,
                isHost,
            });
            // Best-effort persistence (join history / rejoin record). Sequenced per room to avoid room-missing races.
            runRoomPersistence(rid, 'recordParticipantJoin', () => recordParticipantJoin(rid, identity, isHost, socket.id));
            log(
                `User ${identity.displayName} (${socket.id}) joined room ${rid} successfully (host=${isHost})`
            );
        } catch (joinError) {
            error('Error joining room:', joinError);
            socket.emit('errorMessage', { message: 'Failed to join room' });
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', (payload: unknown = {}) => {
        const { to, offer, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidSessionDescription(offer, 'offer')) return;

        const { sender } = participants;
        socket.to(String(to)).emit('offer', {
            from: socket.id,
            offer,
            user: {
                id: socket.id,
                username: sender.username,
                isHost: sender.isHost,
            },
        });
    });

    socket.on('answer', (payload: unknown = {}) => {
        const { to, answer, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidSessionDescription(answer, 'answer')) return;

        const { sender } = participants;
        socket.to(String(to)).emit('answer', {
            from: socket.id,
            answer,
            user: {
                id: socket.id,
                username: sender.username,
                isHost: sender.isHost,
            },
        });
    });

    socket.on('candidate', (payload: unknown = {}) => {
        const { to, candidate, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidIceCandidate(candidate)) return;

        socket.to(String(to)).emit('candidate', {
            from: socket.id,
            candidate,
        });
    });

    // Watch party video synchronization
    const relayPlayback = (event: 'videoPlay' | 'videoPause' | 'videoSeek' | 'videoHostSync', payload: unknown) => {
        const p = getPayload(payload);
        const { roomId, currentTime } = p;
        const actor = getRoomMember(socket, roomId);
        if (!actor?.isHost || !isValidPlaybackTime(currentTime)) return;
        if (!checkRateLimit(socket, 'playback', { roomId })) return;
        const isPlaying = typeof p.isPlaying === 'boolean' ? p.isPlaying : undefined;
        const hostSentAt = typeof p.hostSentAt === 'number' ? p.hostSentAt : undefined;
        const out: Record<string, unknown> = {
            currentTime,
            userId: socket.id,
            serverTimestamp: Date.now(),
            fromHost: true,
        };
        if (isPlaying !== undefined) out.isPlaying = isPlaying;
        if (hostSentAt !== undefined) out.hostSentAt = hostSentAt;
        socket.to(String(roomId)).emit(event, out);
    };

    socket.on('videoPlay', (payload: unknown = {}) => relayPlayback('videoPlay', payload));
    socket.on('videoPause', (payload: unknown = {}) => relayPlayback('videoPause', payload));
    socket.on('videoSeek', (payload: unknown = {}) => relayPlayback('videoSeek', payload));
    socket.on('videoHostSync', (payload: unknown = {}) => relayPlayback('videoHostSync', payload));

    /** Host shares video (remote URL or local-file metadata). No blob URLs. */
    socket.on('watchVideoUrl', async (payload: unknown = {}) => {
        const p = getPayload(payload);
        const { roomId, idToken } = p;
        const descriptorInput = p.descriptor ?? p.video;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user) return;
        if (!checkRateLimit(socket, 'playback', { roomId, identity })) return;

        const rid = String(roomId);
        if (descriptorInput != null) {
            const desc = toSharedDescriptor(descriptorInput);
            if (!desc || (desc.source === 'remote' && (desc.url == null || desc.url === ''))) {
                roomSharedVideo.delete(rid);
                roomWatchVideoUrl.delete(rid);
                roomVideo.delete(rid);
                socket.to(rid).emit('videoChange', { videoUrl: null, descriptor: null });
                socket.to(rid).emit('watchVideoUrl', { videoUrl: null, descriptor: null });
                // Best-effort persistence: close active watch session on clear/invalid.
                runRoomPersistence(rid, 'upsertWatchSession:clear', () => upsertWatchSession(rid, identity, null));
                log('[watchVideoUrl] cleared descriptor for room', rid);
                return;
            }
            if (desc.source === 'remote' && typeof desc.url === 'string') {
                roomWatchVideoUrl.set(rid, desc.url);
                roomVideo.set(rid, desc.url);
            } else {
                roomWatchVideoUrl.delete(rid);
                roomVideo.delete(rid);
            }
            roomSharedVideo.set(rid, desc);
            const videoUrl = desc.source === 'remote' ? (desc.url ?? null) : null;
            socket.to(rid).emit('videoChange', { videoUrl, descriptor: desc });
            socket.to(rid).emit('watchVideoUrl', { videoUrl, descriptor: desc });
            // Best-effort persistence: replace/activate watch session metadata (no blob/content/playback ticks).
            runRoomPersistence(rid, 'upsertWatchSession:set', () => upsertWatchSession(rid, identity, desc));
            log('[watchVideoUrl] broadcast descriptor for room', rid, desc.source);
            return;
        }

        const videoUrl = p.videoUrl;
        if (videoUrl == null || videoUrl === '') {
            roomSharedVideo.delete(rid);
            roomWatchVideoUrl.delete(rid);
            roomVideo.delete(rid);
            socket.to(rid).emit('videoChange', { videoUrl: null, descriptor: null });
            socket.to(rid).emit('watchVideoUrl', { videoUrl: null, descriptor: null });
            // Best-effort persistence: close active watch session.
            runRoomPersistence(rid, 'upsertWatchSession:clear', () => upsertWatchSession(rid, identity, null));
            log('[watchVideoUrl] cleared for room', rid);
            return;
        }

        if (!isAllowedWatchVideoUrl(videoUrl)) {
            warn('[watchVideoUrl] rejected invalid URL from host', rid);
            return;
        }

        const desc: SharedVideoDescriptor = { source: 'remote', sessionId: generateVideoSessionId(), url: String(videoUrl) };
        roomSharedVideo.set(rid, desc);
        roomWatchVideoUrl.set(rid, String(videoUrl));
        roomVideo.set(rid, String(videoUrl));
        socket.to(rid).emit('videoChange', { videoUrl: String(videoUrl), descriptor: desc });
        socket.to(rid).emit('watchVideoUrl', { videoUrl: String(videoUrl), descriptor: desc });
        // Best-effort persistence: store sanitized remote watch session metadata.
        runRoomPersistence(rid, 'upsertWatchSession:set', () => upsertWatchSession(rid, identity, desc));
        log('[watchVideoUrl] broadcast for room', rid);
    });

    /** Backward-compatible event name used by some clients */
    socket.on('videoChange', async (payload: unknown = {}) => {
        const p = getPayload(payload);
        const { roomId, idToken } = p;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user || !checkRateLimit(socket, 'playback', { roomId, identity })) return;

        const rid = String(roomId);
        const descriptorInput = p.descriptor ?? p.video;
        if (descriptorInput != null) {
            const desc = toSharedDescriptor(descriptorInput);
            if (!desc || (desc.source === 'remote' && (desc.url == null || desc.url === ''))) {
                roomSharedVideo.delete(rid);
                roomWatchVideoUrl.delete(rid);
                roomVideo.delete(rid);
                socket.to(rid).emit('videoChange', { videoUrl: null, descriptor: null });
                socket.to(rid).emit('watchVideoUrl', { videoUrl: null, descriptor: null });
                // Best-effort persistence: close active watch session.
                runRoomPersistence(rid, 'upsertWatchSession:clear', () => upsertWatchSession(rid, identity, null));
                return;
            }
            if (desc.source === 'remote' && typeof desc.url === 'string') {
                roomWatchVideoUrl.set(rid, desc.url);
                roomVideo.set(rid, desc.url);
            } else {
                roomWatchVideoUrl.delete(rid);
                roomVideo.delete(rid);
            }
            roomSharedVideo.set(rid, desc);
            const videoUrl = desc.source === 'remote' ? (desc.url ?? null) : null;
            socket.to(rid).emit('videoChange', { videoUrl, descriptor: desc });
            socket.to(rid).emit('watchVideoUrl', { videoUrl, descriptor: desc });
            // Best-effort persistence: replace/activate watch session metadata.
            runRoomPersistence(rid, 'upsertWatchSession:set', () => upsertWatchSession(rid, identity, desc));
            return;
        }

        const videoUrl = p.videoUrl;
        if (videoUrl == null || videoUrl === '') {
            roomSharedVideo.delete(rid);
            roomVideo.delete(rid);
            roomWatchVideoUrl.delete(rid);
            socket.to(rid).emit('videoChange', { videoUrl: null, descriptor: null });
            socket.to(rid).emit('watchVideoUrl', { videoUrl: null, descriptor: null });
            // Best-effort persistence: close active watch session.
            runRoomPersistence(rid, 'upsertWatchSession:clear', () => upsertWatchSession(rid, identity, null));
            return;
        }

        if (!isAllowedWatchVideoUrl(videoUrl)) return;
        const desc: SharedVideoDescriptor = { source: 'remote', sessionId: generateVideoSessionId(), url: String(videoUrl) };
        roomSharedVideo.set(rid, desc);
        roomVideo.set(rid, String(videoUrl));
        roomWatchVideoUrl.set(rid, String(videoUrl));
        socket.to(rid).emit('videoChange', { videoUrl: String(videoUrl), descriptor: desc });
        socket.to(rid).emit('watchVideoUrl', { videoUrl: String(videoUrl), descriptor: desc });
        // Best-effort persistence: store sanitized remote watch session metadata.
        runRoomPersistence(rid, 'upsertWatchSession:set', () => upsertWatchSession(rid, identity, desc));
    });

    // Handle chat messages
    socket.on('chatTyping', (payload: unknown = {}) => {
        const { roomId, isTyping } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user || typeof isTyping !== 'boolean') return;
        if (!checkRateLimit(socket, 'typing', { roomId })) return;
        socket.to(String(roomId)).emit('peerTyping', {
            userId: socket.id,
            username: user.displayName || user.username,
            isTyping,
        });
    });

    socket.on('watchReaction', (payload: unknown = {}) => {
        const { roomId, emoji } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user || !ALLOWED_REACTIONS.has(String(emoji))) return;
        if (!checkRateLimit(socket, 'reaction', { roomId })) return;
        io.to(String(roomId)).emit('watchReaction', {
            emoji,
            userId: socket.id,
            username: user.displayName || user.username,
            photoURL: user.photoURL || '',
        });
    });

    socket.on('chatMessage', (payload: unknown = {}) => {
        const { roomId, message } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user) return;
        if (!checkRateLimit(socket, 'chat', { roomId })) return;

        const text = typeof message === 'string' ? message.trim() : '';
        if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return;

        const rid = String(roomId);
        const messageData: ChatMessage = {
            id: `${Date.now()}-${socket.id.slice(0, 8)}`,
            userId: socket.id,
            firebaseUid: user.firebaseUid || '',
            username: user.username,
            displayName: user.displayName || user.username,
            photoURL: user.photoURL || '',
            text,
            timestamp: new Date().toISOString(),
            isHost: user.isHost,
        };

        // Store message in room messages (bounded history)
        if (!roomMessages.has(rid)) {
            roomMessages.set(rid, []);
        }
        const history = roomMessages.get(rid)!;
        history.push(messageData);
        const MAX_CHAT_HISTORY = 200;
        if (history.length > MAX_CHAT_HISTORY) {
            history.splice(0, history.length - MAX_CHAT_HISTORY);
        }

        // Broadcast to everyone in the room
        io.to(rid).emit('chatMessage', messageData);
    });

    socket.on('videoStateChange', (payload: unknown = {}) => {
        const { roomId, isVideoOff } = getPayload(payload);
        if (!shouldAllowRoomEvent(socket, 'signaling', roomId) || typeof isVideoOff !== 'boolean') return;
        socket.to(String(roomId)).emit('videoStateChanged', {
            userId: socket.id,
            isVideoOff,
        });
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    // Add these event handlers in your existing socket.io connection handler
    socket.on('leaveRoom', (payload: unknown = {}) => {
        const { roomId } = getPayload(payload);
        if (!getRoomMember(socket, roomId)) return;
        handleDisconnect(socket);
    });

    socket.on('endCall', async (payload: unknown = {}) => {
        const { roomId, idToken } = getPayload(payload);
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user) {
            socket.emit('error', { message: 'Not authorized' });
            return;
        }
        if (!checkRateLimit(socket, 'playback', { roomId, identity })) return;

        const rid = String(roomId);
        io.to(rid).emit('callEnded');
        // Best-effort persistence: end room, close active participants/watch sessions.
        runRoomPersistence(rid, 'endRoomPersistence', () => endRoomPersistence(rid));
        clearRoom(rid);
    });

    // Add this to your existing socket.on('connection') handler
    socket.on('speaking', (payload: unknown = {}) => {
        const { roomId, speaking } = getPayload(payload);
        if (!shouldAllowRoomEvent(socket, 'typing', roomId) || typeof speaking !== 'boolean') return;
        socket.to(String(roomId)).emit('userSpeaking', {
            userId: socket.id,
            speaking,
        });
    });
});

// Helper functions
function clearRoom(roomId: string): void {
    const memberSet = rooms.get(roomId);
    if (memberSet) {
        for (const socketId of memberSet) {
            users.delete(socketId);
            const roomSocket = io.sockets.sockets.get(socketId);
            if (roomSocket) {
                roomSocket.leave(roomId);
            }
        }
    }
    rooms.delete(roomId);
    roomHostFirebaseUid.delete(roomId);
    roomSharedVideo.delete(roomId);
    roomWatchVideoUrl.delete(roomId);
    roomVideo.delete(roomId);
    roomMessages.delete(roomId);
}
function generateRoomId(): string {
    let id = '';
    let attempts = 0;
    do {
        id = Math.random().toString(36).substring(2, 8).toUpperCase();
        attempts += 1;
    } while (rooms.has(id) && attempts < 50);
    if (rooms.has(id)) {
        id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase().slice(0, 10);
    }
    return id;
}

function joinRoom(
    socket: Socket,
    params: { roomId: string; username: string; isHost: boolean; photoURL?: string; displayName?: string; firebaseUid: string },
    _opts?: { skipPersistence?: boolean }
): void {
    const { roomId, username, isHost, photoURL, displayName, firebaseUid } = params;
    if (!isValidSocketId(socket.id) || !isValidRoomId(roomId) || !username || !firebaseUid) {
        throw new Error('Missing required connection data');
    }

    const existingUser = users.get(socket.id);
    if (existingUser && existingUser.roomId !== roomId) {
        handleDisconnect(socket);
    }

    const disp = displayName || username;
    log('Joining room:', { socketId: socket.id, roomId, username: disp, isHost });

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }

    rooms.get(roomId)!.add(socket.id);
    socket.join(roomId);

    const userData: UserData = {
        id: socket.id,
        username: disp,
        displayName: disp,
        photoURL: photoURL || '',
        roomId,
        isHost,
        firebaseUid,
    };
    users.set(socket.id, userData);

    const usersInRoom = Array.from(rooms.get(roomId)!)
        .map((id) => users.get(id))
        .filter((user): user is UserData => !!user && user.id !== socket.id);

    log('Users in room:', usersInRoom);

    const chatHistory = roomMessages.has(roomId) ? roomMessages.get(roomId)! : [];
    const sharedVideo = roomSharedVideo.has(roomId) ? roomSharedVideo.get(roomId)! : null;
    const watchVideoUrl = sharedVideo?.source === 'remote' ? (sharedVideo.url ?? null) : (roomVideo.has(roomId) ? roomVideo.get(roomId)! : null);

    socket.emit('roomJoined', {
        roomId,
        users: usersInRoom,
        isHost,
        user: userData,
        chatHistory,
        watchVideoUrl,
        videoUrl: watchVideoUrl,
        sharedVideo,
    });

    if (sharedVideo) {
        socket.emit('videoChange', { videoUrl: watchVideoUrl, descriptor: sharedVideo });
        socket.emit('watchVideoUrl', { videoUrl: watchVideoUrl, descriptor: sharedVideo });
    } else if (watchVideoUrl) {
        socket.emit('videoChange', { videoUrl: watchVideoUrl });
    }

    socket.to(roomId).emit('userJoined', {
        user: userData,
    });
}

function handleDisconnect(socket: Socket): void {
    const user = users.get(socket.id);
    if (!user) return;

    const { roomId, firebaseUid } = user;

    if (rooms.has(roomId)) {
        const memberSet = rooms.get(roomId)!;
        const hostUid = roomHostFirebaseUid.get(roomId);
        const wasRoomHost = hostUid && firebaseUid && hostUid === firebaseUid;

        memberSet.delete(socket.id);

        if (memberSet.size === 0) {
            // Best-effort persistence: end room (closes active watch session/participants and marks room ended).
            runRoomPersistence(roomId, 'endRoomPersistence', () => endRoomPersistence(roomId));
            rooms.delete(roomId);
            roomHostFirebaseUid.delete(roomId);
            roomSharedVideo.delete(roomId);
            roomWatchVideoUrl.delete(roomId);
            roomVideo.delete(roomId);
            if (roomMessages.has(roomId)) {
                roomMessages.delete(roomId);
            }
        } else {
            // Best-effort persistence: mark leaving participant history record closed.
            if (firebaseUid) {
                runRoomPersistence(roomId, 'recordParticipantLeave', () => recordParticipantLeave(roomId, firebaseUid));
            }
            if (wasRoomHost) {
                const nextSocketId = memberSet.values().next().value as string | undefined;
                const nextUser = nextSocketId ? users.get(nextSocketId) : undefined;
                if (nextUser?.firebaseUid) {
                    roomHostFirebaseUid.set(roomId, nextUser.firebaseUid);
                    for (const id of memberSet) {
                        const u = users.get(id);
                        if (u) u.isHost = u.firebaseUid === nextUser.firebaseUid;
                    }
                    // Best-effort persistence: transfer active host role/participant host flags.
                    runRoomPersistence(roomId, 'recordHostTransfer', () => recordHostTransfer(roomId, {
                        uid: nextUser.firebaseUid,
                        displayName: nextUser.displayName || nextUser.username,
                        photoURL: nextUser.photoURL || null,
                    }));
                    io.to(roomId).emit('hostChanged', {
                        hostFirebaseUid: nextUser.firebaseUid,
                        hostDisplayName: nextUser.displayName || nextUser.username,
                    });
                }
            }
        }
    }

    users.delete(socket.id);
    socket.leave(roomId);

    socket.to(roomId).emit('userLeft', {
        id: socket.id,
        username: user.username,
        isHost: user.isHost,
    });
}

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT || '', 10) || 5000;
server.listen(PORT, HOST, () => {
    log(
        `[signaling] listening on http://${HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST}:${PORT}`
    );
    log(`[signaling] Firebase Admin auth: ${isFirebaseAdminReady() ? 'ready' : 'NOT CONFIGURED'}`);
    log(`[signaling] Database persistence: ${isDatabaseConfigured() ? 'configured' : 'not configured'}`);
    const origins = getCorsAllowedOrigins();
    if (origins) {
        log('[signaling] CORS_ORIGIN:', origins.join(', '));
    }
});
