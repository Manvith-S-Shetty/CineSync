const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
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
        console.warn(
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
    res.status(200).json({ ok: true, service: 'signaling-server' });
});

app.get('/', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'signaling-server',
        health: '/health',
    });
});

const io = socketIO(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "https://cine-sync-beta.vercel.app"
          ],
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

const rooms = new Map(); // Track rooms and their participants
const users = new Map(); // Track user details
const roomMessages = new Map();
/** roomId -> Firebase uid of current host (first user in room; migrates when host leaves) */
const roomHostFirebaseUid = new Map();

const ALLOWED_REACTIONS = new Set(['❤️', '😂', '🔥', '😮']);

const MAX_WATCH_VIDEO_URL_LEN = 2048;
const WATCH_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg'];
/** roomId -> shared direct video URL for watch sync (host-set only) */
const roomWatchVideoUrl = new Map();

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
    console.log('New user connected:', socket.id);

    // Create or join a room
    socket.on('createRoom', ({ username, photoURL, displayName, firebaseUid }) => {
        if (!socket.id || !firebaseUid) {
            socket.emit('error', { message: 'Sign in required to create a room' });
            return;
        }

        const roomId = generateRoomId();
        roomHostFirebaseUid.set(roomId, firebaseUid);
        const name = (displayName || username || 'Guest').trim() || 'Guest';
        joinRoom(socket, {
            roomId,
            username: name,
            displayName: name,
            photoURL: photoURL || '',
            firebaseUid,
            isHost: true,
        });
        socket.emit('roomCreated', {
            roomId,
            user: {
                id: socket.id,
                username: name,
                displayName: name,
                photoURL: photoURL || '',
                isHost: true,
            },
        });
    });

    // Join existing room
    socket.on('joinRoom', ({ roomId, username, photoURL, displayName, firebaseUid }) => {
        const name = (displayName || username || 'Guest').trim() || 'Guest';
        console.log(`Join room attempt - Room: ${roomId}, User: ${name}, SocketId: ${socket.id}`);

        if (!socket.id || !roomId || !firebaseUid) {
            console.error('Missing required data:', { socketId: socket.id, roomId, firebaseUid });
            socket.emit('error', { message: 'Sign in required to join a room' });
            return;
        }

        if (!rooms.has(roomId)) {
            console.error(`Room not found: ${roomId}`);
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        try {
            const isHost = roomHostFirebaseUid.get(roomId) === firebaseUid;
            joinRoom(socket, {
                roomId,
                username: name,
                displayName: name,
                photoURL: photoURL || '',
                firebaseUid,
                isHost,
            });
            console.log(`User ${name} (${socket.id}) joined room ${roomId} successfully (host=${isHost})`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', ({ to, offer, roomId }) => {
        if (!socket.id || !to || !offer || !roomId) {
            console.error('Invalid offer data');
            return;
        }

        const user = users.get(socket.id);
        if (user && rooms.get(roomId)?.has(to)) {
            socket.to(to).emit('offer', {
                from: socket.id,
                offer,
                user: {
                    id: socket.id,
                    username: user.username,
                    isHost: user.isHost
                }
            });
        }
    });

    socket.on('answer', ({ to, answer, roomId }) => {
        if (!socket.id || !to || !answer || !roomId) {
            console.error('Invalid answer data');
            return;
        }

        const user = users.get(socket.id);
        if (user && rooms.get(roomId)?.has(to)) {
            socket.to(to).emit('answer', {
                from: socket.id,
                answer,
                user: {
                    id: socket.id,
                    username: user.username,
                    isHost: user.isHost
                }
            });
        }
    });

    socket.on('candidate', ({ to, candidate, roomId }) => {
        if (!socket.id || !to || !candidate || !roomId) {
            console.error('Invalid candidate data');
            return;
        }

        if (rooms.get(roomId)?.has(to)) {
            socket.to(to).emit('candidate', {
                from: socket.id,
                candidate
            });
        }
    });

    // Watch party video synchronization
    socket.on('videoPlay', ({ roomId, currentTime }) => {
        if (!roomId || typeof currentTime !== 'number') {
            console.error('Invalid videoPlay data');
            return;
        }

        const actor = users.get(socket.id);
        if (!actor?.isHost || actor.roomId !== roomId || !rooms.has(roomId)) return;

        socket.to(roomId).emit('videoPlay', {
            currentTime,
            userId: socket.id
        });
    });

    socket.on('videoPause', ({ roomId, currentTime }) => {
        if (!roomId || typeof currentTime !== 'number') {
            console.error('Invalid videoPause data');
            return;
        }

        const actor = users.get(socket.id);
        if (!actor?.isHost || actor.roomId !== roomId || !rooms.has(roomId)) return;

        socket.to(roomId).emit('videoPause', {
            currentTime,
            userId: socket.id
        });
    });

    socket.on('videoSeek', ({ roomId, currentTime }) => {
        if (!roomId || typeof currentTime !== 'number') {
            console.error('Invalid videoSeek data');
            return;
        }

        const actor = users.get(socket.id);
        if (!actor?.isHost || actor.roomId !== roomId || !rooms.has(roomId)) return;

        socket.to(roomId).emit('videoSeek', {
            currentTime,
            userId: socket.id
        });
    });

    /** Host-only periodic time sync (watch party drift correction) */
    socket.on('videoHostSync', ({ roomId, currentTime }) => {
        if (!roomId || typeof currentTime !== 'number') return;
        const user = users.get(socket.id);
        if (!user?.isHost || user.roomId !== roomId || !rooms.has(roomId)) return;
        socket.to(roomId).emit('videoHostSync', {
            currentTime,
            fromHost: true,
        });
    });

    /** Host shares a direct video URL so guests (and late joiners) stay on the same file */
    socket.on('watchVideoUrl', ({ roomId, videoUrl }) => {
        const user = users.get(socket.id);
        if (!user?.isHost || user.roomId !== roomId || !rooms.has(roomId)) {
            return;
        }

        if (videoUrl == null || videoUrl === '') {
            roomWatchVideoUrl.delete(roomId);
            socket.to(roomId).emit('watchVideoUrl', { videoUrl: null });
            console.log('[watchVideoUrl] cleared for room', roomId);
            return;
        }

        if (!isAllowedWatchVideoUrl(videoUrl)) {
            console.warn('[watchVideoUrl] rejected invalid URL from host', roomId);
            return;
        }

        roomWatchVideoUrl.set(roomId, videoUrl);
        socket.to(roomId).emit('watchVideoUrl', { videoUrl });
        console.log('[watchVideoUrl] broadcast for room', roomId);
    });

    // Handle chat messages
    socket.on('chatTyping', ({ roomId, isTyping }) => {
        const user = users.get(socket.id);
        if (!user || !rooms.has(roomId)) return;
        socket.to(roomId).emit('peerTyping', {
            userId: socket.id,
            username: user.displayName || user.username,
            isTyping: !!isTyping,
        });
    });

    socket.on('watchReaction', ({ roomId, emoji }) => {
        const user = users.get(socket.id);
        if (!user || !rooms.has(roomId)) return;
        if (!emoji || !ALLOWED_REACTIONS.has(emoji)) return;
        io.to(roomId).emit('watchReaction', {
            emoji,
            userId: socket.id,
            username: user.displayName || user.username,
            photoURL: user.photoURL || '',
        });
    });

    socket.on('chatMessage', ({ roomId, message }) => {
        const user = users.get(socket.id);
        if (user && rooms.has(roomId)) {
            const messageData = {
                id: `${Date.now()}-${socket.id.slice(0, 8)}`,
                userId: socket.id,
                firebaseUid: user.firebaseUid || '',
                username: user.username,
                displayName: user.displayName || user.username,
                photoURL: user.photoURL || '',
                text: message,
                timestamp: new Date().toISOString(),
                isHost: user.isHost
            };
            
            // Store message in room messages
            if (!roomMessages.has(roomId)) {
                roomMessages.set(roomId, []);
            }
            roomMessages.get(roomId).push(messageData);
            
            // Broadcast to everyone in the room
            io.to(roomId).emit('chatMessage', messageData);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    // Add these event handlers in your socket.io connection handler
    socket.on('leaveRoom', ({ roomId }) => {
        handleDisconnect(socket);
    });

    socket.on('endCall', ({ roomId }) => {
        const user = users.get(socket.id);
        if (user && user.isHost) {
            io.to(roomId).emit('callEnded');
            // Clean up the room
            if (rooms.has(roomId)) {
                rooms.delete(roomId);
                roomHostFirebaseUid.delete(roomId);
                roomWatchVideoUrl.delete(roomId);
                if (roomMessages.has(roomId)) {
                    roomMessages.delete(roomId);
                }
            }
        }
    });

    // Add this to your existing socket.on('connection') handler
    socket.on('speaking', ({ roomId, speaking }) => {
        socket.to(roomId).emit('userSpeaking', {
            userId: socket.id,
            speaking
        });
    });
});

// Helper functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function joinRoom(socket, { roomId, username, isHost, photoURL, displayName, firebaseUid }) {
    if (!socket.id || !roomId || !username || !firebaseUid) {
        throw new Error('Missing required connection data');
    }

    const disp = displayName || username;
    console.log('Joining room:', { socketId: socket.id, roomId, username: disp, isHost });

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

    console.log('Users in room:', usersInRoom);

    const chatHistory = roomMessages.has(roomId) ? roomMessages.get(roomId) : [];
    const watchVideoUrl = roomWatchVideoUrl.has(roomId)
        ? roomWatchVideoUrl.get(roomId)
        : null;

    socket.emit('roomJoined', {
        roomId,
        users: usersInRoom,
        isHost,
        user: userData,
        chatHistory,
        watchVideoUrl,
    });

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

    socket.to(roomId).emit('userLeft', {
        id: socket.id,
        username: user.username,
        isHost: user.isHost,
    });
}

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT, 10) || 5000;
server.listen(PORT, HOST, () => {
    console.log(
        `[signaling] listening on http://${HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST}:${PORT}`
    );
    if (getCorsAllowedOrigins()) {
        console.log('[signaling] CORS_ORIGIN:', getCorsAllowedOrigins().join(', '));
    }
});
