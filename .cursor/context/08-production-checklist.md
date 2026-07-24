# CineSync - Production Checklist

## Purpose

This document defines the minimum requirements before deploying CineSync.

Every production release must pass this checklist.

Rules:

- Do not skip tests because "it worked before."
- Verify every completed item.
- Update this document as new features are added.

---

# Release Information

Version:

Release Date:

Release Engineer:

Environment:

- Development
- Staging
- Production

---

# Build Verification

## Frontend

- [ ] Project builds successfully.
- [ ] No build warnings.
- [ ] No TypeScript/ESLint errors (if applicable).
- [ ] Environment variables configured.
- [ ] Assets load correctly.

---

## Backend

- [ ] Server starts successfully.
- [ ] Socket.IO initializes correctly.
- [ ] Environment variables loaded.
- [ ] Health endpoint responds.
- [ ] No startup errors.

---

# Authentication

## Login

- [ ] Google Sign-In works.
- [ ] Existing session restores correctly.
- [ ] Logout works.
- [ ] Invalid session handled correctly.

---

## Security

- [x] Firebase ID token verified on backend.
- [ ] Unauthorized users rejected.
- [ ] Invalid payloads rejected.
- [ ] CORS configured correctly.
- [ ] Secrets not exposed.
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` (or split Admin env vars) set on VisionBridge host.

---

# Room Management

- [ ] Create room.
- [ ] Join room.
- [ ] Leave room.
- [ ] Rejoin room.
- [ ] Invalid room handled correctly.
- [ ] Host reassignment works.
- [ ] Room cleanup after all users leave.

---

# Chat

- [ ] Send messages.
- [ ] Receive messages.
- [ ] Multiple users tested.
- [ ] Long messages rejected.
- [ ] Chat history limit enforced.

---

# Video Playback

- [ ] Load video URL.
- [ ] Load local file.
- [ ] Play synchronization.
- [ ] Pause synchronization.
- [ ] Seek synchronization.
- [ ] Playback remains synchronized after reconnect.

---

# Camera

- [ ] Enable camera.
- [ ] Disable camera.
- [ ] Camera reconnects after refresh.
- [ ] Camera permission denied handled gracefully.

---

# Microphone

- [ ] Enable microphone.
- [ ] Disable microphone.
- [ ] Permission denied handled.
- [ ] Audio reconnect tested.

---

# Screen Sharing

- [ ] Start sharing.
- [ ] Stop sharing.
- [ ] Browser "Stop Sharing" button tested.
- [ ] Camera restored correctly.
- [ ] Multiple participants receive screen share.

---

# WebRTC

## Two Users

- [ ] Connect successfully.
- [ ] Video visible.
- [ ] Audio works.

---

## Three Users

- [ ] All users connected.
- [ ] No duplicate streams.
- [ ] Stable after 5 minutes.

---

## Four Users

- [ ] Stable connections.
- [ ] No missing participants.
- [ ] No unexpected disconnects.

---

## Network Recovery

- [ ] Disable Wi-Fi.
- [ ] Restore Wi-Fi.
- [ ] Peer reconnects.
- [ ] Socket reconnects.
- [ ] Playback resynchronizes.

---

# Browser Testing

## Chrome

- [ ] Windows
- [ ] macOS (if supported)

---

## Edge

- [ ] Windows

---

## Firefox

- [ ] Basic functionality verified.

---

# Performance

- [ ] No memory leaks observed.
- [ ] CPU usage acceptable.
- [ ] Network usage reasonable.
- [ ] Multiple users remain stable.

---

# Backend Monitoring

- [ ] Socket connections logged.
- [ ] Disconnects logged.
- [ ] Errors logged.
- [ ] Authentication failures logged.
- [ ] Host migration logged.

Avoid logging sensitive user information.

---

# Error Handling

Verify graceful handling of:

- [ ] Invalid room
- [ ] Invalid video URL
- [ ] Permission denied
- [ ] Camera unavailable
- [ ] Microphone unavailable
- [ ] Screen share cancelled
- [ ] Lost internet connection
- [ ] Backend restart

---

# Deployment

## Frontend

- [ ] Production build completed.
- [ ] Environment variables correct.
- [ ] HTTPS enabled.

---

## Backend

- [ ] Production environment configured.
- [ ] HTTPS enabled.
- [ ] CORS restricted.
- [ ] Logs monitored.

---

# Repository Health

- [ ] README updated.
- [ ] CHANGELOG updated.
- [ ] Documentation updated.
- [ ] Known issues reviewed.
- [ ] No debug code left behind.

---

# Git Checklist

- [ ] Feature branch merged.
- [ ] Pull Request approved.
- [ ] CI/CD pipeline passed (if available).
- [ ] Version tag created.

---

# Final Go/No-Go Decision

Critical Issues Remaining?

- [ ] Yes
- [ ] No

Deployment Approved?

- [ ] Yes
- [ ] No

Approved By:

Date:

---

# AI Development Rules

Before deploying:

1. Complete every applicable checklist item.
2. Never deploy with known critical issues.
3. Update documentation if behavior changes.
4. Record any new production issues in `07-known-issues.md`.
5. If deployment fails, document the root cause before retrying.

---

# Repository Audit Summary

Current Production Readiness

**8.9 / 10**

Primary blockers before a production release:

1. Implement WebRTC Perfect Negotiation.
2. Verify Firebase ID tokens on the backend.
3. Validate all Socket.IO payloads.
4. Complete multi-user and network recovery testing.