# CineSync - API Reference

## Purpose

This document defines all backend APIs and Socket.IO contracts used by CineSync.

It serves as the single source of truth for frontend-backend communication.

Whenever an API changes:

- Update this file.
- Maintain backward compatibility where possible.
- Validate every request on the server.

---

# Backend Overview

Backend Responsibilities

- Room management
- Authentication validation
- Playback synchronization
- Chat synchronization
- WebRTC signaling
- Host reassignment

The backend **does not transport media**.

Audio and video streams always travel directly between peers via WebRTC.

---

# Base URL

Development

```
http://localhost:<PORT>
```

Production

```
Configured using environment variables.
```

---

# Authentication

Firebase Authentication (Google) on the client.

VisionBridge verifies Firebase ID Tokens with the Admin SDK before privileged Socket.IO events:

- `createRoom`, `joinRoom`, `videoChange`, `watchVideoUrl`, `endCall`
- optional `authenticate` and handshake `auth.token`

Never trust client-provided `firebaseUid`, email, or displayName for identity.

Configure Admin credentials via `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.

---

# HTTP Endpoints

## Health Check

Method

```
GET
```

Endpoint

```
/health
```

Purpose

Verify the backend is running.

Example Response

```json
{
  "ok": true,
  "service": "signaling-server",
  "authConfigured": true
}
```

---

# Static Endpoints

If additional REST endpoints are introduced, document them here.

Example

```
POST /api/room

GET /api/room/:id

DELETE /api/room/:id
```

Currently, CineSync primarily communicates through Socket.IO.

---

# Socket.IO API

Socket.IO is the primary communication layer.

Categories

- Room
- Chat
- Playback
- WebRTC Signaling

---

# Room Events

Purpose

Manage room lifecycle.

Example Payload

```json
{
    "roomId": "abc123",
    "userId": "firebase_uid"
}
```

Server Responsibilities

- Validate room
- Join socket room
- Track members
- Update room state
- Broadcast participant changes

---

# Chat Events

Purpose

Synchronize room chat.

Example

```json
{
    "roomId": "abc123",
    "message": "Hello",
    "userId": "firebase_uid",
    "timestamp": 1712345678
}
```

Validation

- Required fields
- Maximum message length
- Room exists
- User belongs to room

Production Recommendation

Keep only a bounded number of messages in memory.

---

# Playback Events

Purpose

Synchronize media playback.

Typical Payload

```json
{
    "roomId": "abc123",
    "currentTime": 120.4,
    "playing": true
}
```

Rules

Only the room host controls playback.

Participants receive synchronization updates.

---

# WebRTC Signaling

Offer

```json
{
    "targetPeerId": "...",
    "offer": {}
}
```

Answer

```json
{
    "targetPeerId": "...",
    "answer": {}
}
```

ICE Candidate

```json
{
    "targetPeerId": "...",
    "candidate": {}
}
```

Important

These payloads contain signaling information only.

Media is exchanged directly between browsers.

---

# Error Responses

Every API should return meaningful errors.

Example

```json
{
    "success": false,
    "message": "Room not found"
}
```

Avoid returning generic errors.

---

# Validation Rules

Every request should validate:

- Required fields
- Correct data types
- String length
- Room existence
- User authorization
- Payload structure

Never trust frontend input.

---

# Environment Variables

Typical Variables

```
PORT

CLIENT_URL

FIREBASE_CONFIG

SOCKET_TIMEOUT

NODE_ENV
```

Do not hardcode production values.

Use environment variables for all configuration.

---

# Rate Limiting

Recommended

Protect:

- Chat
- Join room
- Create room
- Playback events

Prevent spam and abuse.

---

# Security Checklist

Before deploying

✓ Validate every payload

✓ Verify Firebase ID Token

✓ Sanitize user input

✓ Restrict CORS

✓ Avoid exposing secrets

✓ Use HTTPS

---

# Logging

Production logs should include

- Connection established
- Connection closed
- Room created
- Room deleted
- Host changed
- Playback sync
- Authentication failures
- Server errors

Avoid logging sensitive user information.

---

# Versioning

If breaking API changes occur:

- Increment API version.
- Update this document.
- Update frontend and backend together.

Example

```
v1

v2
```

---

# AI Development Rules

Before modifying backend APIs

1. Preserve backward compatibility when possible.
2. Validate every request.
3. Update this document.
4. Keep payloads minimal.
5. Never expose secrets.
6. Never trust client identity without verification.
7. Test frontend and backend together.

---

# Repository Audit Notes

Current backend assessment

Score: **8.9 / 10**

Strengths

- Clean Socket.IO organization
- Good room lifecycle
- Proper host migration
- Well-structured state management

Primary improvements

- Firebase token verification
- Payload validation
- Chat history limits
- Rate limiting
- Structured logging