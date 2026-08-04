# CineSync - Project Overview

## Project Summary

CineSync is a full-stack real-time watch party platform that allows multiple users to watch videos together while communicating through live video, audio, and chat.

The application synchronizes media playback across all participants in a room using Socket.IO while enabling peer-to-peer audio and video communication using WebRTC.

The architecture separates UI rendering, signaling, media synchronization, and backend room management into independent modules.

---

# Core Features

## Authentication

- Firebase Authentication
- Google Sign-In
- User session persistence

---

## Watch Party

- Create room
- Join room
- Host-controlled playback
- Shared video synchronization
- Video URL loading
- Local file playback
- Host migration when host disconnects

---

## Real-Time Communication

- Peer-to-peer video calls
- Peer-to-peer audio calls
- Screen sharing
- Camera toggle
- Microphone toggle

---

## Chat

- Real-time messaging
- Room-based communication
- Instant synchronization

---

## Synchronization

The host controls playback.

Participants automatically synchronize:

- Play
- Pause
- Seek
- Video change
- Playback position

Synchronization occurs through Socket.IO events while media is streamed independently.

---

# Technology Stack

## Frontend

- React
- React Router
- Socket.IO Client
- WebRTC
- Firebase Authentication

---

## Backend

- Node.js
- Express
- Socket.IO

---

## Browser APIs

- MediaDevices
- RTCPeerConnection
- MediaStream
- getUserMedia()
- getDisplayMedia()

---

# High-Level Architecture

User
    │
    ▼
React Frontend
    │
    ├───────────────┐
    │               │
Socket.IO        WebRTC
(Signaling)   (Media Streams)
    │               │
    ▼               ▼
Node Server     Peer-to-Peer
    │
Room State
Playback Sync
Chat
Host Management

---

# Current Architecture Assessment

Repository audit confirms:

- Clean component separation
- Thin orchestration layer
- Well-structured backend
- Singleton Socket.IO client
- Advanced WebRTC implementation
- Proper ICE candidate queueing
- Correct use of replaceTrack()

Overall architecture is suitable for production after targeted stability improvements.

---

# Current Production Priorities

Critical:

1. Implement WebRTC Perfect Negotiation pattern.
2. Verify Firebase ID tokens on backend.
3. Improve reconnect testing.
4. Improve screen-share recovery.

Medium Priority:

- Limit in-memory chat history.
- Replace random room ID generation.
- Reduce production logging.

---

# Repository Goal

Maintain a production-quality real-time collaboration platform that is:

- Modular
- Secure
- Testable
- Scalable
- Easy to maintain
- Easy for AI assistants to understand