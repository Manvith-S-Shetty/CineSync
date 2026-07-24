# CineSync - Known Issues & Technical Debt

## Purpose

This document tracks known issues, technical debt, and future improvements.

---

# Priority Levels

- Critical
- High
- Medium
- Low

---

# Current Issues

## ISSUE-001 — Perfect Negotiation Pattern

**Priority:** Critical  
**Status:** Open  
**Area:** WebRTC  

Offer collisions may occur during simultaneous join / renegotiation / screen share.

**Recommended:** Implement WebRTC Perfect Negotiation (makingOffer / ignoreOffer / polite peer).

---

## ISSUE-005 — Production Logging Noise

**Priority:** Medium  
**Status:** Open  

Verbose `console.log` remains on hot paths.

---

## ISSUE-006 — Camera Restoration After Screen Share

**Priority:** Medium  
**Status:** Open  

Stopping screen share assumes a live camera track still exists; may need `getUserMedia` reacquire.

---

# Technical Debt

## TD-001 — Large VideoChat Component (High, Open)

Split into hooks after stability work: `useMedia`, `usePeers`, `useScreenShare`, `useSignaling`.

## TD-002 — Centralize Configuration (Medium, Open)

## TD-003 — Payload Validation (High, Partially addressed)

Chat length + ICE room membership added. Remaining: broader schema validation on all events.

---

# Resolved Issues

## ISSUE-002 — Backend Trusts Client Identity

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Firebase Admin `verifyIdToken` on privileged Socket.IO events; frontend sends `idToken` only.

## ISSUE-003 — Chat History Grows Indefinitely

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Cap room chat history at 200 messages; reject empty / >2000 char messages.

## ISSUE-004 — Room ID Collision Risk

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** `generateRoomId()` retries until unique; longer fallback id if needed.

## ISSUE-007 — Socket.IO CORS Hardcoded

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Socket.IO CORS uses the same `corsOriginOption` as Express (`CORS_ORIGIN` / dev defaults).

## ISSUE-008 — Missing videoStateChange Handler

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Added `videoStateChange` → `videoStateChanged` on VisionBridge server.

## ISSUE-009 — Guest Load UX / Error Overlay Spam

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Host-only load controls (no instructional banner text); disconnect poll no longer opens ErrorCard every 5s; ErrorCard Continue clears error.

## ISSUE-010 — Missing NavPanel Build Config

**Status:** Verified Fixed (2026-07-25)  
**Resolution:** Restored deleted `package.json`, Vite/Tailwind configs from git HEAD.

---

# Audit Summary

**Production readiness (this pass):** 8.2 / 10

Remaining blockers for true production:

1. Perfect Negotiation  
2. TURN for restrictive NATs  
3. Broader payload validation + structured logging  
