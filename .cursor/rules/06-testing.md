# CineSync Testing Rules

## Purpose

This document defines the testing standards for CineSync.

Every code change should maintain or improve application stability.

No feature is considered complete until it has been tested.

---

# Testing Philosophy

Testing is part of development.

Do not assume code works because it compiles.

Always verify behavior.

Priority:

1. Correctness
2. Stability
3. Regression Prevention
4. Performance

---

# Before Writing Code

AI should first determine:

- What functionality is changing?
- Which components are affected?
- Which existing features could break?
- What should be tested after the change?

Never modify code without identifying affected areas.

---

# Required Testing Workflow

Every change should follow this process.

```

Understand Problem

↓

Identify Impact

↓

Implement Solution

↓

Manual Testing

↓

Regression Testing

↓

Performance Check

↓

Documentation Update

```

---

# Regression Testing

Every modification must verify that existing functionality still works.

Never assume unrelated features remain unaffected.

For every bug fix:

- Verify the bug is fixed.
- Verify no new bugs were introduced.

---

# Frontend Testing

After modifying React components, verify:

- UI renders correctly.
- No console errors.
- State updates correctly.
- Event handlers work.
- Cleanup functions execute.

---

# Backend Testing

After modifying the backend, verify:

- Server starts.
- Socket.IO initializes.
- Room management works.
- APIs return expected responses.
- Error handling behaves correctly.

---

# Socket.IO Testing

Test:

✓ Client connects.

✓ Client disconnects.

✓ Reconnect works.

✓ Join room.

✓ Leave room.

✓ Multiple users.

✓ Invalid payload.

✓ Unauthorized request.

✓ Server restart.

Never assume Socket.IO behavior remains unchanged.

---

# WebRTC Testing

Every WebRTC change must be tested with:

## Connection

- Two users
- Three users
- Four users

---

## Media

- Camera
- Microphone
- Screen sharing

---

## Lifecycle

- Join
- Leave
- Rejoin
- Refresh
- Close tab
- Reconnect

---

## Network

- Disable internet
- Restore internet
- Socket reconnect
- Peer reconnect

---

## Browser

Test on:

- Chrome
- Edge
- Firefox

where supported.

---

# Playback Synchronization

Verify:

- Play
- Pause
- Seek
- Video change
- Host reassignment

All participants should remain synchronized.

---

# Chat Testing

Verify:

- Send message
- Receive message
- Multiple users
- Invalid message
- Empty message
- Long message

---

# Authentication Testing

Verify:

- Login
- Logout
- Session restore
- Invalid session
- Unauthorized user

---

# Error Handling

Test failures.

Examples:

- Camera denied
- Microphone denied
- Invalid room
- Invalid video URL
- Lost internet
- Backend unavailable

Application should fail gracefully.

---

# Performance Testing

Verify:

- No memory leaks
- Stable CPU usage
- Stable reconnect behavior
- No duplicate media streams
- No duplicate peer connections

---

# Security Testing

Verify:

- Invalid payloads rejected
- Unauthorized requests rejected
- Authentication enforced
- Secrets not exposed
- CORS configured correctly

---

# Documentation

If behavior changes:

Update:

- context/
- roadmap.md
- known-issues.md
- production-checklist.md

Documentation is part of the feature.

---

# AI Testing Checklist

Before considering work complete:

✓ Code builds.

✓ No syntax errors.

✓ No unused imports.

✓ No duplicate logic.

✓ Cleanup verified.

✓ Manual testing completed.

✓ Regression testing completed.

✓ Documentation updated.

---

# Definition of Done

A task is complete only if:

- Code works.
- Existing functionality still works.
- No critical regressions exist.
- Documentation is updated.
- Production checklist remains valid.

---

# Repository Audit Guidance

High-risk areas requiring extra testing:

🔴 WebRTC negotiation

🔴 Socket.IO signaling

🔴 Playback synchronization

🟠 Authentication

🟠 Host reassignment

🟠 Screen sharing

These areas should receive additional attention after every modification.

---

# AI Development Rules

When generating code:

1. Explain what should be tested.
2. Identify regression risks.
3. Suggest edge cases.
4. Never claim code is fully tested.
5. Distinguish between code review and actual runtime verification.
6. Prefer small, testable changes over large rewrites.