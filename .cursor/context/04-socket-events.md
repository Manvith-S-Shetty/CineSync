# CineSync - Socket.IO Event Reference

## Purpose

This document defines every Socket.IO event used by CineSync.

It serves as the single source of truth for frontend and backend communication.

When adding new events:

- Keep event names descriptive.
- Validate all incoming payloads.
- Keep payloads minimal.
- Document the event here.

---

# Communication Architecture

Frontend

↓

Socket.IO Client

↓

Socket.IO Server

↓

Room State

↓

Other Connected Clients

Socket.IO is responsible for:

- Room management
- Chat
- Playback synchronization
- WebRTC signaling

Socket.IO is NOT responsible for transporting media.
Media streams are handled directly through WebRTC.

---

# Event Categories

## 1. Room Events

Purpose:

Manage room lifecycle.

Typical events include:

- Create room
- Join room
- Leave room
- Room state updates
- Host reassignment

Expected Payload

```json
{
  "roomId": "string",
  "idToken": "string"
}
```

`createRoom` payload:

```json
{
  "idToken": "string"
}
```

Identity fields (`firebaseUid`, `email`, `displayName`, `photoURL`) must not be trusted from the client. The server derives them from a verified Firebase ID token.

Privileged events that require `idToken`:

- `createRoom`
- `joinRoom`
- `videoChange`
- `watchVideoUrl`
- `endCall`
- `authenticate` (optional session bind)

Responsibilities

Frontend:

- Send join/leave requests with a fresh Firebase ID token
- Update UI

Backend:

- Verify Firebase ID token with Admin SDK
- Validate room
- Track members
- Update host if necessary
- Broadcast room changes

---

# 2. Chat Events

Purpose

Synchronize messages between users.

Typical payload

```json
{
  "roomId": "string",
  "userId": "string",
  "message": "string",
  "timestamp": 0
}
```

Backend responsibilities

- Validate payload
- Broadcast message
- Limit message size
- Store only bounded chat history

Production Recommendation

Never allow unlimited message length.

---

# 3. Playback Synchronization

Purpose

Keep all users watching the same content.

Typical synchronization actions

- Play
- Pause
- Seek
- Video changed
- Playback position

Typical payload

```json
{
  "roomId": "string",
  "currentTime": 0,
  "isPlaying": true
}
```

Rules

Only the current room host controls playback.

Participants receive updates.

Never allow multiple playback authorities.

---

# 4. WebRTC Signaling

Purpose

Exchange signaling information before a peer-to-peer connection exists.

Typical signaling events

- Offer
- Answer
- ICE Candidate

Offer Payload

```json
{
  "targetPeerId": "string",
  "offer": {}
}
```

Answer Payload

```json
{
  "targetPeerId": "string",
  "answer": {}
}
```

ICE Payload

```json
{
  "targetPeerId": "string",
  "candidate": {}
}
```

Important

Socket.IO only exchanges signaling data.

Media never passes through the server.

---

# Event Flow

User joins room

↓

Socket joins room

↓

Existing peers notified

↓

Offer generated

↓

Answer returned

↓

ICE candidates exchanged

↓

Peer connection established

↓

Audio/Video flows directly

---

# Current Implementation Notes

Repository audit confirmed:

✓ Singleton Socket.IO client

✓ Proper event listener cleanup

✓ Automatic reconnection

✓ Clean room lifecycle

✓ Organized backend event handling

No duplicate listener leaks were found.

---

# Event Naming Guidelines

Use verbs for actions.

Examples

Good

```
join-room
leave-room
send-message
play-video
pause-video
offer
answer
ice-candidate
```

Avoid

```
event1
update
send
room
message2
```

---

# Payload Guidelines

Every payload should:

- Include only required fields.
- Validate on the backend.
- Never trust client-supplied identity alone.
- Reject malformed data.

Recommended validation

- Required fields
- Data types
- String length
- Room existence
- User authorization

---

# Error Handling

Every event should handle:

- Invalid room
- User not found
- Unauthorized request
- Malformed payload
- Connection loss

Clients should fail gracefully.

---

# Security Recommendations

Current audit identified:

High Priority

- Verify Firebase ID tokens server-side.
- Validate every incoming Socket.IO payload.
- Add rate limiting.

Medium Priority

- Limit chat history.
- Limit message size.
- Improve structured logging.

---

# Future Socket Events

If new features are added, document them here before implementation.

Possible future events

- typing-start
- typing-stop
- reaction
- raise-hand
- mute-user
- kick-user
- recording-start
- recording-stop

---

# AI Development Rules

Before creating a new Socket.IO event:

1. Check whether an existing event already solves the problem.
2. Keep payloads small.
3. Validate all input.
4. Document the event in this file.
5. Update both frontend and backend together.