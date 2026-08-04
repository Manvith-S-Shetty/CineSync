require('dotenv').config({ quiet: true });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const {
    initFirebaseAdmin,
    isFirebaseAdminReady,
    verifyIdToken,
} = require('./firebaseAdmin');

initFirebaseAdmin();

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const log = (...args) => {
    if (!isProduction) console.log(...args);
};
const warn = (...args) => {
    if (!isProduction) console.warn(...args);
};
const error = (...args) => {
    if (!isProduction) console.error(...args);
};
const info = (...args) => console.info(...args);
/**
 * CORS for Express + Socket.IO.
 * Production: set CORS_ORIGIN to your frontend origin(s), comma-separated, no trailing slash.
 */
function getCorsAllowedOrigins() {
    const raw = process.env.CORS_ORIGIN;
    if (raw && String(raw).trim()) {
        return String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return null;
}

function getSocketCorsOrigin() {
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
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:5173$/,
    ];
}

const corsOriginOption = getSocketCorsOrigin();
app.use(
    cors({
        origin: corsOriginOption,
        credentials: true,
    })
);

app.get('/health', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'signaling-server',
        authConfigured: isFirebaseAdminReady(),
    });
});

app.get('/', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'signaling-server',
        health: '/health',
        authConfigured: isFirebaseAdminReady(),
    });
});

const io = socketIO(server, {
    cors: {
        origin: corsOriginOption,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

/** Optional handshake auth — does not replace per-event ID token verification. */
io.use(async (socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) {
        next();
        return;
    }
    try {
        socket.data.auth = await verifyIdToken(token);
    } catch {
        // Allow connection; privileged handlers still require a valid idToken.
    }
    next();
});

/**
 * Verify Firebase ID token from client payload.
 * Returns server-trusted identity or null (and emits a safe error to the socket).
 */
async function requireVerifiedIdentity(socket, idToken) {
    try {
        const identity = await verifyIdToken(idToken);
        socket.data.auth = identity;
        return identity;
    } catch (err) {
        const code = err?.code;
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
function requireRoomMember(socket, roomId, identity) {
    const user = users.get(socket.id);
    if (
        !user ||
        !identity ||
        user.roomId !== roomId ||
        user.firebaseUid !== identity.uid ||
        !rooms.has(roomId) ||
        !rooms.get(roomId)?.has(socket.id)
    ) {
        return null;
    }
    return user;
}

function requireRoomHost(socket, roomId, identity) {
    const user = requireRoomMember(socket, roomId, identity);
    if (!user?.isHost) return null;
    return user;
}

const rooms = new Map(); // Track rooms and their participants
const users = new Map(); // Track user details
const roomMessages = new Map();
/** roomId -> Firebase uid of current host (first user in room; migrates when host leaves) */
const roomHostFirebaseUid = new Map();

const ALLOWED_REACTIONS = new Set(['❤️', '😂', '🔥', '😮']);

const MAX_ROOM_ID_LENGTH = 32;
const MAX_SDP_LENGTH = 100000;
const MAX_ICE_CANDIDATE_LENGTH = 4096;
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const MAX_CURRENT_TIME_SECONDS = 24 * 60 * 60;

const RATE_LIMITS = {
    auth: { user: { limit: 30, windowMs: 60_000 } },
    roomCreate: { user: { limit: 6, windowMs: 60_000 } },
    roomJoin: { user: { limit: 20, windowMs: 60_000 }, room: { limit: 80, windowMs: 60_000 } },
    signaling: { user: { limit: 240, windowMs: 60_000 }, room: { limit: 1200, windowMs: 60_000 } },
    chat: { user: { limit: 30, windowMs: 30_000 }, room: { limit: 180, windowMs: 30_000 } },
    typing: { user: { limit: 60, windowMs: 30_000 }, room: { limit: 400, windowMs: 30_000 } },
    playback: { user: { limit: 60, windowMs: 30_000 }, room: { limit: 240, windowMs: 30_000 } },
    reaction: { user: { limit: 30, windowMs: 30_000 }, room: { limit: 200, windowMs: 30_000 } },
};
const rateBuckets = new Map();
let lastRateLimitCleanup = Date.now();

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPayload(payload) {
    return isPlainObject(payload) ? payload : {};
}

function isValidRoomId(roomId) {
    return typeof roomId === 'string' && /^[A-Za-z0-9]{2,32}$/.test(roomId) && roomId.length <= MAX_ROOM_ID_LENGTH;
}

function isValidSocketId(socketId) {
    return typeof socketId === 'string' && socketId.length > 0 && socketId.length <= 128 && /^[A-Za-z0-9_-]+$/.test(socketId);
}

function isValidSessionDescription(description, expectedType) {
    return (
        isPlainObject(description) &&
        description.type === expectedType &&
        typeof description.sdp === 'string' &&
        description.sdp.length > 0 &&
        description.sdp.length <= MAX_SDP_LENGTH
    );
}

function isValidIceCandidate(candidate) {
    if (!isPlainObject(candidate)) return false;
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length > MAX_ICE_CANDIDATE_LENGTH) {
        return false;
    }
    if (candidate.sdpMid != null && typeof candidate.sdpMid !== 'string') return false;
    if (candidate.sdpMLineIndex != null && !Number.isInteger(candidate.sdpMLineIndex)) return false;
    return true;
}

function isValidPlaybackTime(currentTime) {
    return Number.isFinite(currentTime) && currentTime >= 0 && currentTime <= MAX_CURRENT_TIME_SECONDS;
}

function emitRateLimit(socket) {
    socket.emit('errorMessage', { message: 'Too many requests. Please slow down.' });
}

function consumeBucket(key, limit, windowMs) {
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

function cleanupRateBuckets() {
    const now = Date.now();
    if (now - lastRateLimitCleanup < 60_000) return;
    lastRateLimitCleanup = now;
    for (const [key, bucket] of rateBuckets.entries()) {
        if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
}

function getRateUserKey(socket, identity) {
    return identity?.uid || socket.data?.auth?.uid || users.get(socket.id)?.firebaseUid || socket.id;
}

function checkRateLimit(socket, category, { roomId, identity } = {}) {
    cleanupRateBuckets();
    const config = RATE_LIMITS[category];
    if (!config) return true;
    const userKey = getRateUserKey(socket, identity);
    if (config.user && !consumeBucket(`${category}:user:${userKey}`, config.user.limit, config.user.windowMs)) {
        emitRateLimit(socket);
        return false;
    }
    if (config.room && roomId && !consumeBucket(`${category}:room:${roomId}`, config.room.limit, config.room.windowMs)) {
        emitRateLimit(socket);
        return false;
    }
    return true;
}

function getRoomMember(socket, roomId) {
    if (!isValidRoomId(roomId)) return null;
    const room = rooms.get(roomId);
    const user = users.get(socket.id);
    if (!room || !user || user.roomId !== roomId || !room.has(socket.id)) return null;
    return user;
}

function getRoomMemberBySocketId(roomId, socketId) {
    if (!isValidRoomId(roomId) || !isValidSocketId(socketId)) return null;
    const room = rooms.get(roomId);
    const user = users.get(socketId);
    if (!room || !room.has(socketId) || !user || user.roomId !== roomId) return null;
    return user;
}

function getSignalingParticipants(socket, roomId, to) {
    if (!isValidSocketId(to) || to === socket.id) return null;
    const sender = getRoomMember(socket, roomId);
    const recipient = getRoomMemberBySocketId(roomId, to);
    if (!sender || !recipient) return null;
    return { sender, recipient };
}

function shouldAllowRoomEvent(socket, category, roomId) {
    if (!getRoomMember(socket, roomId)) return false;
    return checkRateLimit(socket, category, { roomId });
}
const MAX_WATCH_VIDEO_URL_LEN = 2048;
const WATCH_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg'];
/** roomId -> shared direct video URL for watch sync (host-set only) */
const roomWatchVideoUrl = new Map();
/** roomId -> current room video URL (alias used by videoChange event) */
const roomVideo = new Map();

function isYouTubeHostname(hostname) {
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

function isAllowedWatchVideoUrl(url) {
    if (typeof url !== 'string' || url.length === 0 || url.length > MAX_WATCH_VIDEO_URL_LEN) {
        return false;
    }
    let parsed;
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

io.on('connection', (socket) => {
    log('New user connected:', socket.id);
    log('[SOCKET CONNECTED]', socket.id);

    // Optional handshake / refresh: bind verified identity to the socket session
    socket.on('authenticate', async (payload = {}) => {
        const { idToken } = getPayload(payload);
        if (!checkRateLimit(socket, 'auth')) return;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        socket.emit('authenticated', { uid: identity.uid });
    });

    // Create room - identity from verified ID token only
    socket.on('createRoom', async (payload = {}) => {
        const { idToken } = getPayload(payload);
        if (!checkRateLimit(socket, 'roomCreate')) return;
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity || !socket.id) return;
        if (!checkRateLimit(socket, 'roomCreate', { identity })) return;

        const roomId = generateRoomId();
        roomHostFirebaseUid.set(roomId, identity.uid);
        joinRoom(socket, {
            roomId,
            username: identity.displayName,
            displayName: identity.displayName,
            photoURL: identity.photoURL,
            firebaseUid: identity.uid,
            isHost: true,
        });
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
    socket.on('joinRoom', async (payload = {}) => {
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
            joinRoom(socket, {
                roomId,
                username: identity.displayName,
                displayName: identity.displayName,
                photoURL: identity.photoURL,
                firebaseUid: identity.uid,
                isHost,
            });
            log(
                `User ${identity.displayName} (${socket.id}) joined room ${roomId} successfully (host=${isHost})`
            );
        } catch (joinError) {
            error('Error joining room:', joinError);
            socket.emit('errorMessage', { message: 'Failed to join room' });
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', (payload = {}) => {
        const { to, offer, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidSessionDescription(offer, 'offer')) return;

        const { sender } = participants;
        socket.to(to).emit('offer', {
            from: socket.id,
            offer,
            user: {
                id: socket.id,
                username: sender.username,
                isHost: sender.isHost,
            },
        });
    });

    socket.on('answer', (payload = {}) => {
        const { to, answer, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidSessionDescription(answer, 'answer')) return;

        const { sender } = participants;
        socket.to(to).emit('answer', {
            from: socket.id,
            answer,
            user: {
                id: socket.id,
                username: sender.username,
                isHost: sender.isHost,
            },
        });
    });

    socket.on('candidate', (payload = {}) => {
        const { to, candidate, roomId } = getPayload(payload);
        const participants = getSignalingParticipants(socket, roomId, to);
        if (!participants) return;
        if (!checkRateLimit(socket, 'signaling', { roomId })) return;
        if (!isValidIceCandidate(candidate)) return;

        socket.to(to).emit('candidate', {
            from: socket.id,
            candidate,
        });
    });

    // Watch party video synchronization
    socket.on('videoPlay', (payload = {}) => {
        const { roomId, currentTime } = getPayload(payload);
        const actor = getRoomMember(socket, roomId);
        if (!actor?.isHost || !isValidPlaybackTime(currentTime)) return;
        if (!checkRateLimit(socket, 'playback', { roomId })) return;

        socket.to(roomId).emit('videoPlay', {
            currentTime,
            userId: socket.id,
        });
    });

    socket.on('videoPause', (payload = {}) => {
        const { roomId, currentTime } = getPayload(payload);
        const actor = getRoomMember(socket, roomId);
        if (!actor?.isHost || !isValidPlaybackTime(currentTime)) return;
        if (!checkRateLimit(socket, 'playback', { roomId })) return;

        socket.to(roomId).emit('videoPause', {
            currentTime,
            userId: socket.id,
        });
    });

    socket.on('videoSeek', (payload = {}) => {
        const { roomId, currentTime } = getPayload(payload);
        const actor = getRoomMember(socket, roomId);
        if (!actor?.isHost || !isValidPlaybackTime(currentTime)) return;
        if (!checkRateLimit(socket, 'playback', { roomId })) return;

        socket.to(roomId).emit('videoSeek', {
            currentTime,
            userId: socket.id,
        });
    });

    /** Host-only periodic time sync (watch party drift correction) */
    socket.on('videoHostSync', (payload = {}) => {
        const { roomId, currentTime } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user?.isHost || !isValidPlaybackTime(currentTime)) return;
        if (!checkRateLimit(socket, 'playback', { roomId })) return;
        socket.to(roomId).emit('videoHostSync', {
            currentTime,
            fromHost: true,
        });
    });

    /** Host shares a direct video URL so guests (and late joiners) stay on the same file */
    socket.on('watchVideoUrl', async (payload = {}) => {
        const { roomId, videoUrl, idToken } = getPayload(payload);
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user || !checkRateLimit(socket, 'playback', { roomId, identity })) return;

        if (videoUrl == null || videoUrl === '') {
            roomWatchVideoUrl.delete(roomId);
            roomVideo.delete(roomId);
            socket.to(roomId).emit('videoChange', { videoUrl: null });
            socket.to(roomId).emit('watchVideoUrl', { videoUrl: null });
            log('[watchVideoUrl] cleared for room', roomId);
            return;
        }

        if (!isAllowedWatchVideoUrl(videoUrl)) {
            warn('[watchVideoUrl] rejected invalid URL from host', roomId);
            return;
        }

        roomWatchVideoUrl.set(roomId, videoUrl);
        roomVideo.set(roomId, videoUrl);
        socket.to(roomId).emit('videoChange', { videoUrl });
        socket.to(roomId).emit('watchVideoUrl', { videoUrl });
        log('[watchVideoUrl] broadcast for room', roomId);
    });

    /** Backward-compatible event name used by some clients */
    socket.on('videoChange', async (payload = {}) => {
        const { roomId, videoUrl, idToken } = getPayload(payload);
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user || !checkRateLimit(socket, 'playback', { roomId, identity })) return;

        if (videoUrl == null || videoUrl === '') {
            roomVideo.delete(roomId);
            roomWatchVideoUrl.delete(roomId);
            socket.to(roomId).emit('videoChange', { videoUrl: null });
            socket.to(roomId).emit('watchVideoUrl', { videoUrl: null });
            return;
        }

        if (!isAllowedWatchVideoUrl(videoUrl)) return;
        roomVideo.set(roomId, videoUrl);
        roomWatchVideoUrl.set(roomId, videoUrl);
        socket.to(roomId).emit('videoChange', { videoUrl });
        socket.to(roomId).emit('watchVideoUrl', { videoUrl });
    });

    // Handle chat messages
    socket.on('chatTyping', (payload = {}) => {
        const { roomId, isTyping } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user || typeof isTyping !== 'boolean') return;
        if (!checkRateLimit(socket, 'typing', { roomId })) return;
        socket.to(roomId).emit('peerTyping', {
            userId: socket.id,
            username: user.displayName || user.username,
            isTyping,
        });
    });

    socket.on('watchReaction', (payload = {}) => {
        const { roomId, emoji } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user || !ALLOWED_REACTIONS.has(emoji)) return;
        if (!checkRateLimit(socket, 'reaction', { roomId })) return;
        io.to(roomId).emit('watchReaction', {
            emoji,
            userId: socket.id,
            username: user.displayName || user.username,
            photoURL: user.photoURL || '',
        });
    });

    socket.on('chatMessage', (payload = {}) => {
        const { roomId, message } = getPayload(payload);
        const user = getRoomMember(socket, roomId);
        if (!user) return;
        if (!checkRateLimit(socket, 'chat', { roomId })) return;

        const text = typeof message === 'string' ? message.trim() : '';
        if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return;

        const messageData = {
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
        if (!roomMessages.has(roomId)) {
            roomMessages.set(roomId, []);
        }
        const history = roomMessages.get(roomId);
        history.push(messageData);
        const MAX_CHAT_HISTORY = 200;
        if (history.length > MAX_CHAT_HISTORY) {
            history.splice(0, history.length - MAX_CHAT_HISTORY);
        }

        // Broadcast to everyone in the room
        io.to(roomId).emit('chatMessage', messageData);
    });

    socket.on('videoStateChange', (payload = {}) => {
        const { roomId, isVideoOff } = getPayload(payload);
        if (!shouldAllowRoomEvent(socket, 'signaling', roomId) || typeof isVideoOff !== 'boolean') return;
        socket.to(roomId).emit('videoStateChanged', {
            userId: socket.id,
            isVideoOff,
        });
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    // Add these event handlers in your socket.io connection handler
    socket.on('leaveRoom', (payload = {}) => {
        const { roomId } = getPayload(payload);
        if (!getRoomMember(socket, roomId)) return;
        handleDisconnect(socket);
    });

    socket.on('endCall', async (payload = {}) => {
        const { roomId, idToken } = getPayload(payload);
        const identity = await requireVerifiedIdentity(socket, idToken);
        if (!identity) return;
        const user = requireRoomHost(socket, roomId, identity);
        if (!user) {
            socket.emit('error', { message: 'Not authorized' });
            return;
        }
        if (!checkRateLimit(socket, 'playback', { roomId, identity })) return;

        io.to(roomId).emit('callEnded');
        clearRoom(roomId);
    });

    // Add this to your existing socket.on('connection') handler
    socket.on('speaking', (payload = {}) => {
        const { roomId, speaking } = getPayload(payload);
        if (!shouldAllowRoomEvent(socket, 'typing', roomId) || typeof speaking !== 'boolean') return;
        socket.to(roomId).emit('userSpeaking', {
            userId: socket.id,
            speaking,
        });
    });
});

// Helper functions
function clearRoom(roomId) {
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
    roomWatchVideoUrl.delete(roomId);
    roomVideo.delete(roomId);
    roomMessages.delete(roomId);
}
function generateRoomId() {
    let id;
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

function joinRoom(socket, { roomId, username, isHost, photoURL, displayName, firebaseUid }) {
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

    rooms.get(roomId).add(socket.id);
    socket.join(roomId);

    const userData = {
        id: socket.id,
        username: disp,
        displayName: disp,
        photoURL: photoURL || '',
        roomId,
        isHost,
        firebaseUid,
    };
    users.set(socket.id, userData);

    const usersInRoom = Array.from(rooms.get(roomId))
        .map((id) => users.get(id))
        .filter((user) => user && user.id !== socket.id);

    log('Users in room:', usersInRoom);

    const chatHistory = roomMessages.has(roomId) ? roomMessages.get(roomId) : [];
    const watchVideoUrl = roomVideo.has(roomId)
        ? roomVideo.get(roomId)
        : null;

    socket.emit('roomJoined', {
        roomId,
        users: usersInRoom,
        isHost,
        user: userData,
        chatHistory,
        watchVideoUrl,
        videoUrl: watchVideoUrl,
    });

    if (watchVideoUrl) {
        socket.emit('videoChange', { videoUrl: watchVideoUrl });
    }

    socket.to(roomId).emit('userJoined', {
        user: userData,
    });
}

function handleDisconnect(socket) {
    const user = users.get(socket.id);
    if (!user) return;

    const { roomId, firebaseUid } = user;

    if (rooms.has(roomId)) {
        const memberSet = rooms.get(roomId);
        const hostUid = roomHostFirebaseUid.get(roomId);
        const wasRoomHost = hostUid && firebaseUid && hostUid === firebaseUid;

        memberSet.delete(socket.id);

        if (memberSet.size === 0) {
            rooms.delete(roomId);
            roomHostFirebaseUid.delete(roomId);
            roomWatchVideoUrl.delete(roomId);
            roomVideo.delete(roomId);
            if (roomMessages.has(roomId)) {
                roomMessages.delete(roomId);
            }
        } else if (wasRoomHost) {
            const nextSocketId = memberSet.values().next().value;
            const nextUser = users.get(nextSocketId);
            if (nextUser?.firebaseUid) {
                roomHostFirebaseUid.set(roomId, nextUser.firebaseUid);
                for (const id of memberSet) {
                    const u = users.get(id);
                    if (u) u.isHost = u.firebaseUid === nextUser.firebaseUid;
                }
                io.to(roomId).emit('hostChanged', {
                    hostFirebaseUid: nextUser.firebaseUid,
                    hostDisplayName: nextUser.displayName || nextUser.username,
                });
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
const PORT = Number.parseInt(process.env.PORT, 10) || 5000;
server.listen(PORT, HOST, () => {
    log(
        `[signaling] listening on http://${HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST}:${PORT}`
    );
    log(`[signaling] Firebase Admin auth: ${isFirebaseAdminReady() ? 'ready' : 'NOT CONFIGURED'}`);
    if (getCorsAllowedOrigins()) {
        log('[signaling] CORS_ORIGIN:', getCorsAllowedOrigins().join(', '));
    }
});
