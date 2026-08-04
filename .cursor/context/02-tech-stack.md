# CineSync - Technology Stack

## Overview

This document describes every major technology used in CineSync and explains why it exists in the project.

---

# Frontend

## React

Purpose:

- Build the user interface
- Manage application state
- Render reusable components
- Handle routing and page updates

Responsibilities:

- Room UI
- Video Player UI
- Video Call UI
- Chat UI
- Authentication UI

---

## React Router

Purpose:

- Client-side navigation

Used For:

- Home page
- Room page
- Authentication flow

---

## Socket.IO Client

Purpose:

Real-time communication between the browser and the backend.

Responsibilities:

- Join rooms
- Leave rooms
- Playback synchronization
- Chat messaging
- WebRTC signaling
- Room updates

Important Notes:

- Singleton socket instance
- Automatic reconnection enabled
- Event listeners are properly cleaned up

---

## Firebase Authentication

Purpose:

Authenticate users using Google Sign-In.

Responsibilities:

- User login
- Session persistence
- User identity

Current Improvement:

Backend should verify Firebase ID Tokens instead of trusting client-provided user identifiers.

---

# WebRTC

Purpose:

Provide peer-to-peer communication.

Responsibilities:

- Video calls
- Audio calls
- Screen sharing

Key APIs:

- RTCPeerConnection
- MediaStream
- MediaStreamTrack
- RTCIceCandidate
- RTCSessionDescription

Current Implementation Strengths:

- ICE candidate queue
- replaceTrack()
- Peer cleanup
- Connection recovery
- Duplicate stream protection

Future Improvement:

Implement the Perfect Negotiation pattern to prevent simultaneous offer collisions.

---

# Browser APIs

## getUserMedia()

Used For:

- Camera access
- Microphone access

---

## getDisplayMedia()

Used For:

- Screen sharing

---

## MediaStream

Represents:

- Camera stream
- Microphone stream
- Screen share stream

---

# Backend

## Node.js

Purpose:

Run the backend server.

Responsibilities:

- Room management
- Authentication integration
- Socket.IO server
- Business logic

---

## Express.js

Purpose:

HTTP server framework.

Responsibilities:

- API endpoints
- Middleware
- Health checks
- Server configuration

---

## Socket.IO Server

Purpose:

Real-time event communication.

Responsibilities:

- Room management
- Playback synchronization
- Chat
- WebRTC signaling
- Host reassignment

Current Strengths:

- Clean room lifecycle
- Good state management
- Proper disconnect handling

---

# Development Tools

## Git

Version control.

---

## GitHub

Repository hosting.

Recommended Usage:

- Feature branches
- Pull Requests
- Issue tracking
- Project boards

---

## Cursor

Primary AI-assisted IDE.

Uses:

- Code generation
- Refactoring
- Bug fixing
- Documentation
- Repository understanding

The `.cursor/` directory provides project-specific context to improve AI-generated code.

---

# Current Stack Diagram

User
│
▼
React
│
├── Firebase Authentication
├── Socket.IO Client
├── WebRTC
└── Browser APIs
│
▼
Express Server
│
├── Socket.IO Server
├── Room State
└── Signaling
│
▼
Peer-to-Peer Media Streams

---

# Production Notes

Current architecture is suitable for production.

Recommended improvements:

- Backend Firebase token verification
- Perfect Negotiation for WebRTC
- Rate limiting
- Structured logging
- Payload validation
- Memory limits for in-memory chat history

---

# Guiding Principles

When introducing new technologies:

- Prefer simplicity over complexity.
- Reuse existing architecture before adding dependencies.
- Keep business logic separate from UI.
- Minimize unnecessary libraries.
- Maintain a modular and testable codebase.