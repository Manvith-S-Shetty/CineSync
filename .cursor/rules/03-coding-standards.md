# CineSync Coding Standards

## Purpose

This document defines the coding conventions for the CineSync project.

Every new file, function, component, and API should follow these standards.

Consistency is more important than personal preference.

---

# General Principles

Write code that is:

- Correct
- Readable
- Maintainable
- Testable
- Predictable
- Production-ready

Always prioritize clarity over cleverness.

---

# File Organization

One file should have one primary responsibility.

Example:

Good

```
VideoPlayer.jsx
```

Responsible only for video playback.

Bad

```
VideoPlayer.jsx
```

Handles:

- Authentication
- Socket events
- Chat
- Playback
- WebRTC

---

# Naming Conventions

## Variables

Use descriptive camelCase names.

Good

```javascript
currentRoomId
remoteParticipant
playbackPosition
isScreenSharing
```

Bad

```javascript
a
tmp
obj
data1
x
```

---

## Functions

Function names should describe actions.

Good

```javascript
createPeerConnection()
joinRoom()
sendOffer()
restoreCamera()
```

Bad

```javascript
doThing()
run()
start()
temp()
```

---

## Components

Use PascalCase.

Good

```
VideoPlayer
ChatPanel
ParticipantGrid
TopNavbar
```

---

## Hooks

Always begin with:

```
use
```

Example

```
useMedia()
usePeers()
useScreenShare()
```

---

# React Standards

Prefer:

- Functional components
- Hooks
- Composition

Avoid:

- Class components
- Massive components
- Deep prop drilling

---

# Component Size

Recommended

- Under 250 lines

Acceptable

- 250–400 lines

Needs Refactoring

- Over 400 lines

Exception

Large orchestrator components may exist temporarily during refactoring.

---

# Function Size

Ideal

10–30 lines

Maximum

~50 lines

If longer:

Split into helper functions.

---

# State Management

Rules

- Keep state close to where it is used.
- Avoid duplicate state.
- Prefer derived state.
- Avoid unnecessary global state.

---

# Props

Pass only required props.

Avoid:

```jsx
<Component {...everything} />
```

Prefer

```jsx
<Component
    roomId={roomId}
    user={user}
/>
```

---

# Async Code

Always use:

```javascript
try {
    ...
} catch (error) {
    ...
}
```

Handle failures gracefully.

Never ignore Promise rejections.

---

# Error Messages

Provide meaningful messages.

Good

```
Unable to join room.

Camera permission denied.
```

Bad

```
Something went wrong.
```

---

# Comments

Comment **why**, not **what**.

Good

```javascript
// Queue ICE candidates until the remote description is available.
```

Bad

```javascript
// Increment i.
i++;
```

Avoid obvious comments.

---

# Constants

Never hardcode repeated values.

Bad

```javascript
setTimeout(..., 3000)
```

Good

```javascript
const RECONNECT_DELAY = 3000;
```

Store shared values in configuration files.

---

# Imports

Order imports consistently.

1. React
2. Third-party libraries
3. Internal modules
4. Styles
5. Assets

Example

```javascript
import React from "react";

import { io } from "socket.io-client";

import socket from "./socket";

import "./Room.css";
```

---

# Socket.IO

Always:

- Use the singleton socket.
- Remove listeners in cleanup.
- Validate payloads.

Never:

- Create multiple socket instances.

---

# WebRTC

Preserve:

- ICE queue
- replaceTrack()
- Peer cleanup

Never recreate peer connections unless necessary.

---

# Security

Never:

- Trust client input.
- Expose secrets.
- Hardcode API keys.

Always:

- Validate payloads.
- Sanitize user input.
- Verify authentication on the backend.

---

# Logging

Development

Detailed logs are acceptable.

Production

Use structured logging.

Remove unnecessary console statements.

Never log:

- Tokens
- Passwords
- Secrets
- Private user information

---

# Code Duplication

Before writing new code:

Check whether similar logic already exists.

Prefer reuse over duplication.

---

# Performance

Prefer:

- Efficient rendering
- Memoization only when needed
- Proper cleanup
- Lazy initialization

Avoid premature optimization.

---

# Git Standards

Each commit should:

- Solve one problem.
- Be independently understandable.
- Keep the project working.

Good commit messages

```
Fix WebRTC ICE candidate race condition

Improve playback synchronization

Add Firebase token verification
```

Bad

```
Update

Changes

Fix stuff
```

---

# Pull Request Checklist

Before submitting:

- Code builds successfully.
- No unused imports.
- No dead code.
- No debug logs.
- Documentation updated if needed.

---

# AI Development Checklist

Before generating code:

1. Read the surrounding files.
2. Match existing coding style.
3. Reuse existing utilities.
4. Make the smallest safe change.
5. Explain non-obvious decisions.
6. Avoid introducing technical debt.

---

# Repository Standards

This repository values:

✓ Readability

✓ Simplicity

✓ Modularity

✓ Stability

✓ Production-ready code

Every generated change should improve at least one of these qualities without degrading the others.