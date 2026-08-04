# CineSync - Component Map

## Purpose

This document describes the responsibility of every major component in the CineSync application.

AI assistants should always understand existing responsibilities before modifying or creating components.

---

# Architecture Philosophy

The project follows a modular architecture.

Each component should have a single responsibility.

Avoid creating "God Components" that manage UI, networking, WebRTC, and business logic simultaneously.

---

# Frontend Structure

src/

├── App.jsx

├── Room.jsx

├── VideoChat.jsx

├── socket.js

├── components/

│ ├── VideoPlayer.jsx

│ ├── TopNavbar.jsx

│ ├── BottomPanels.jsx

│ ├── ChatPanel.jsx

│ ├── ParticipantGrid.jsx

│ └── video-call/

│ └── VideoCallStage.jsx

---

# App.jsx

## Responsibility

Application entry point.

Responsibilities:

- Routing
- Global providers
- Application initialization

Should NOT contain:

- WebRTC logic
- Socket logic
- Media synchronization

---

# Room.jsx

## Responsibility

Room orchestrator.

Responsibilities:

- Assemble the room interface
- Connect high-level components
- Pass props between modules

Current Audit Result:

Room.jsx is intentionally lightweight.

It should remain an orchestration layer.

Do NOT move WebRTC business logic into this component.

---

# VideoChat.jsx

## Responsibility

Primary WebRTC controller.

Responsibilities:

- Peer connection management
- Camera access
- Microphone access
- Screen sharing
- Offer/Answer exchange
- ICE candidate handling
- Media state
- Peer lifecycle

Current Audit Notes:

Strengths:

- ICE candidate queue
- replaceTrack()
- Connection recovery
- Peer cleanup
- Duplicate stream protection

Future Improvement:

Split into custom hooks as complexity grows.

Suggested hooks:

- useMedia()
- usePeers()
- useScreenShare()
- useSignaling()
- useConnectionState()

---

# VideoPlayer.jsx

## Responsibility

Shared media playback.

Responsibilities:

- Video playback
- Host synchronization
- Blob URL handling
- Playback recovery
- Autoplay handling

Current Audit Result:

This component is production-quality.

Avoid unnecessary rewrites.

---

# VideoCallStage.jsx

## Responsibility

Presentation layer.

Responsibilities:

- Render participant video tiles
- Display MediaStreams
- Handle UI layout

Must NOT:

- Create peer connections
- Exchange SDP
- Exchange ICE candidates
- Manage sockets

Current Audit Result:

Presentation-only component.

Keep it free from networking logic.

---

# socket.js

## Responsibility

Singleton Socket.IO client.

Responsibilities:

- Create one socket instance
- Configure reconnection
- Export shared socket

Rules:

Never create additional socket instances.

Always import the existing singleton.

---

# Backend

server.js

Responsibilities:

- Socket.IO server
- Room management
- Chat
- Playback synchronization
- WebRTC signaling
- Host migration

Current Audit Notes:

Well organized.

Future improvements:

- Firebase token verification
- Payload validation
- Memory limits
- Rate limiting

---

# Component Communication

React Components

↓

Socket.IO Client

↓

Express + Socket.IO Server

↓

Peer Discovery

↓

WebRTC

↓

Media Streams

---

# Dependency Rules

UI Components

↓

Business Logic

↓

Networking

↓

Browser APIs

Never reverse this dependency direction.

---

# Component Responsibilities Summary

| Component | Responsibility |
|------------|----------------|
| App.jsx | Application entry |
| Room.jsx | Room orchestration |
| VideoChat.jsx | WebRTC controller |
| VideoPlayer.jsx | Shared media playback |
| VideoCallStage.jsx | Video UI rendering |
| socket.js | Socket.IO singleton |
| server.js | Backend signaling and room management |

---

# Architecture Guidelines

When creating new components:

- Give each component one clear responsibility.
- Keep UI separate from networking.
- Keep networking separate from WebRTC.
- Prefer composition over large monolithic components.
- Reuse existing modules before creating new ones.
- Avoid duplicating socket or peer connection logic.

---

# AI Development Rules

Before modifying any component:

1. Identify its existing responsibility.
2. Do not move unrelated logic into it.
3. Preserve separation of concerns.
4. Prefer extending existing modules over rewriting them.
5. Maintain consistency with the current architecture.