# CineSync Architecture Rules

## Purpose

This document defines the architectural constraints of the CineSync repository.

AI assistants must preserve these architectural principles when modifying the project.

Architecture changes require strong justification.

---

# Architecture Philosophy

The project follows a modular architecture.

Goals:

- Separation of concerns
- Low coupling
- High cohesion
- Reusable components
- Predictable data flow

Always extend the current architecture before introducing new patterns.

---

# System Overview

Frontend

React

↓

Socket.IO Client

↓

Express + Socket.IO Server

↓

WebRTC Signaling

↓

Peer-to-Peer Media

Media never passes through the backend.

---

# Layer Responsibilities

## Presentation Layer

Responsible for:

- Rendering UI
- User interaction
- Displaying state

Must NOT:

- Contain WebRTC business logic
- Perform authentication
- Manage networking
- Maintain server state

---

## Business Logic Layer

Responsible for:

- Room logic
- Playback synchronization
- Media management
- User interaction logic

Should remain independent from UI rendering.

---

## Networking Layer

Responsible for:

- Socket.IO communication
- Event dispatch
- Reconnection

Must NOT:

- Render UI
- Store application state unnecessarily

---

## Backend Layer

Responsible for:

- Room management
- Authentication verification
- Signaling
- Chat
- Playback synchronization

Must NOT:

- Handle media streaming
- Render frontend logic

---

# Component Responsibilities

## App.jsx

Responsibilities

- Application bootstrap
- Routing
- Global providers

Never place business logic here.

---

## Room.jsx

Responsibilities

- Room orchestration
- Component composition

Repository audit confirmed:

Room.jsx is intentionally lightweight.

Keep it this way.

Do not move WebRTC logic into Room.jsx.

---

## VideoChat.jsx

Responsibilities

- Peer management
- WebRTC lifecycle
- Media control
- Screen sharing
- Signaling coordination

Future refactoring should split this into custom hooks without changing behavior.

---

## VideoPlayer.jsx

Responsibilities

- Shared media playback
- Playback synchronization
- Video controls

Repository audit confirmed this component is well structured.

Avoid unnecessary rewrites.

---

## VideoCallStage.jsx

Responsibilities

- Render participant video tiles
- Display MediaStreams

Must never:

- Create peer connections
- Exchange SDP
- Handle ICE candidates

Keep this component presentation-only.

---

## socket.js

Responsibilities

Provide the application's single Socket.IO instance.

Never create additional socket instances.

Always import the shared socket.

---

## server.js

Responsibilities

- Room lifecycle
- Socket.IO events
- Signaling
- Host migration
- Chat

Keep server responsibilities independent of frontend concerns.

---

# Dependency Rules

Allowed

UI

↓

Business Logic

↓

Networking

↓

Browser APIs

Never reverse this dependency direction.

---

# State Management Rules

State belongs where it is used.

Avoid unnecessary global state.

Keep state as close as possible to the consuming component.

Avoid duplicate state.

Prefer derived state over duplicated values.

---

# WebRTC Rules

Preserve:

- ICE candidate queueing
- replaceTrack()
- Peer cleanup
- SDP ordering

Do not rewrite negotiation logic without understanding the complete signaling flow.

Future work should implement the Perfect Negotiation pattern.

---

# Socket.IO Rules

Socket.IO is responsible for:

- Signaling
- Playback synchronization
- Chat
- Room events

Socket.IO is NOT responsible for:

- Media transport
- Video streaming
- Audio streaming

---

# Security Architecture

Never trust client input.

Authentication decisions belong to the backend.

Validate:

- Payload structure
- Authorization
- Room membership

Use Firebase ID Token verification for privileged actions.

---

# Error Handling

Every layer should handle its own errors.

Frontend

- Display user-friendly messages.

Backend

- Log errors.
- Return safe responses.
- Never expose internal implementation details.

---

# Logging

Development

Detailed logging is acceptable.

Production

Use structured logging.

Remove unnecessary console statements.

Never log secrets.

---

# Performance Guidelines

Prefer:

- Small components
- Lazy initialization
- Resource cleanup
- Efficient rendering

Avoid:

- Unnecessary re-renders
- Recreating peer connections
- Duplicate listeners

---

# Testing Expectations

Architectural changes require testing.

Minimum:

- Two-user WebRTC
- Three-user WebRTC
- Playback synchronization
- Chat
- Screen sharing
- Reconnection

---

# Refactoring Rules

Refactor only when:

- Complexity has increased.
- Maintainability improves.
- Behavior remains unchanged.
- Tests continue to pass.

Avoid cosmetic rewrites.

---

# AI Decision Checklist

Before modifying the architecture:

1. Understand the current responsibility of the target component.
2. Make the smallest safe change.
3. Preserve separation of concerns.
4. Avoid introducing duplicate logic.
5. Keep networking separate from UI.
6. Keep WebRTC isolated from presentation components.
7. Verify existing functionality still works.

---

# Repository Audit Notes

Confirmed strengths

✓ Thin Room.jsx orchestrator

✓ Singleton Socket.IO client

✓ Clean VideoPlayer implementation

✓ Presentation-only VideoCallStage

✓ Proper listener cleanup

✓ Well-organized backend

Known architectural improvements

- Implement Perfect Negotiation
- Backend Firebase token verification
- Split VideoChat.jsx into focused hooks (future refactor)