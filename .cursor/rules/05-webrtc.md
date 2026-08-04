# CineSync WebRTC Rules

## Purpose

This document defines the engineering rules for the WebRTC implementation in CineSync.

The WebRTC layer is one of the most sensitive parts of the application.

Small changes can easily introduce race conditions or intermittent failures.

Always prefer stability over unnecessary refactoring.

---

# Core Principle

The existing WebRTC implementation is a solid foundation.

Improve it.

Do not rewrite it.

Repository audit confirmed:

✓ Proper SDP ordering

✓ ICE candidate queue

✓ replaceTrack()

✓ Peer cleanup

✓ Connection recovery

These behaviors must be preserved.

---

# Responsibilities

WebRTC is responsible for:

- Video calls
- Audio calls
- Screen sharing
- Peer connections
- Media tracks

WebRTC is NOT responsible for:

- Authentication
- Chat
- Playback synchronization
- Room management

Those belong to other layers.

---

# Signaling

Signaling is performed through Socket.IO.

Socket.IO should ONLY transport:

- Offer
- Answer
- ICE Candidate

Never send media through Socket.IO.

---

# Peer Connection Rules

Each remote participant must have exactly one active RTCPeerConnection.

Never create duplicate peer connections.

Always clean up closed connections.

Always remove references after cleanup.

---

# SDP Rules

Always preserve this order.

Offer

```
createOffer()

↓

setLocalDescription()

↓

Send Offer
```

Answer

```
Receive Offer

↓

setRemoteDescription()

↓

createAnswer()

↓

setLocalDescription()

↓

Send Answer
```

Never change this ordering.

---

# ICE Candidate Rules

Repository audit confirmed:

ICE candidates are queued until the remote description exists.

This behavior must never be removed.

Correct flow

```
Candidate arrives

↓

Remote Description exists?

↓

YES

↓

addIceCandidate()

NO

↓

Queue Candidate

↓

Remote Description set

↓

Flush Queue
```

Never discard early ICE candidates.

---

# Perfect Negotiation

Current repository limitation.

Priority:

🔴 Critical

Future implementation should follow the official Perfect Negotiation pattern.

Required concepts:

- makingOffer
- ignoreOffer
- polite peer
- rollback handling

Purpose

Prevent simultaneous offer collisions ("glare").

Do not invent a custom negotiation algorithm.

Follow the official WebRTC guidance.

---

# Media Streams

Maintain separate concepts for:

Local Stream

- Camera
- Microphone

Remote Streams

- One stream per remote participant

Never mix local and remote media.

---

# Track Management

Preferred

```
replaceTrack()
```

Fallback

```
addTrack()
```

Never recreate the peer connection just to change camera or screen sharing.

---

# Screen Sharing

Use

```
getDisplayMedia()
```

Always

- Replace existing video track.
- Restore camera after sharing.
- Handle browser "Stop Sharing".

Current implementation already supports:

```
track.onended
```

Preserve this behavior.

---

# Camera Handling

Always

- Request permission once when appropriate.
- Handle permission denial gracefully.
- Restore camera after screen sharing.

Never assume camera access is always available.

---

# Microphone Handling

Support

- Enable
- Disable
- Mute
- Unmute

Do not recreate peer connections when toggling microphone state.

---

# Cleanup Rules

Whenever a participant leaves:

Always

- Close RTCPeerConnection
- Stop unused tracks
- Remove MediaStreams
- Remove video elements
- Remove event listeners
- Clear references

Memory leaks are unacceptable.

---

# Connection States

Monitor

- connectionState
- iceConnectionState
- signalingState

React appropriately.

Avoid ignoring failed states.

---

# Reconnection

Support

- Browser refresh
- Temporary network loss
- Socket reconnect

Recovery should reuse existing architecture whenever possible.

---

# Logging

Development

Log:

- Peer creation
- Peer removal
- Offer creation
- Answer creation
- ICE candidates
- Connection state

Production

Avoid excessive logging.

Never log:

- SDP contents
- User media
- Sensitive identifiers

---

# Performance

Avoid

- Duplicate streams
- Duplicate peer connections
- Unnecessary renegotiation
- Recreating MediaStreams

Prefer

- replaceTrack()
- Existing connections
- Efficient cleanup

---

# Testing Requirements

Every WebRTC change must be tested with:

✓ Two participants

✓ Three participants

✓ Four participants

✓ Join

✓ Leave

✓ Rejoin

✓ Refresh

✓ Network disconnect

✓ Network reconnect

✓ Camera toggle

✓ Microphone toggle

✓ Screen sharing

✓ Browser Stop Sharing

---

# Debugging Workflow

When debugging:

1. Check browser permissions.
2. Verify signaling.
3. Verify SDP order.
4. Verify ICE exchange.
5. Verify connection state.
6. Verify media tracks.
7. Verify cleanup.

Never assume the first visible symptom is the root cause.

---

# AI Development Rules

Before changing WebRTC code:

1. Read the entire negotiation flow.
2. Preserve existing SDP ordering.
3. Preserve ICE queueing.
4. Prefer minimal changes.
5. Never rewrite working logic.
6. Test multiple users.
7. Explain any behavior changes.

---

# Repository Audit Summary

Current Assessment

WebRTC Score

**8.8 / 10**

Confirmed Strengths

✓ Correct SDP order

✓ ICE candidate queue

✓ replaceTrack()

✓ Peer cleanup

✓ Screen share lifecycle

Primary Improvement

Implement the **Perfect Negotiation** pattern to eliminate negotiation collisions and improve production reliability.