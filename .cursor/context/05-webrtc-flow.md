# CineSync - WebRTC Flow

## Purpose

This document explains how WebRTC is implemented in CineSync.

It describes the connection lifecycle, signaling flow, media management, screen sharing, and current production recommendations.

AI assistants must follow this document when modifying any WebRTC-related code.

---

# Overview

WebRTC is responsible for direct peer-to-peer communication between participants.

Media is **never routed through the backend**.

The backend is only responsible for signaling.

---

# Responsibilities

WebRTC handles:

- Video calls
- Audio calls
- Screen sharing
- Media stream exchange

Socket.IO handles:

- Room discovery
- Offer exchange
- Answer exchange
- ICE candidate exchange

---

# Connection Flow

```
User Joins Room
        │
        ▼
Acquire Camera & Microphone
        │
        ▼
Create RTCPeerConnection
        │
        ▼
Exchange Offer
        │
        ▼
Exchange Answer
        │
        ▼
Exchange ICE Candidates
        │
        ▼
Peer Connection Established
        │
        ▼
Media Streams Begin
```

---

# Connection Lifecycle

## Step 1

User joins a room.

The backend informs existing participants that a new peer has joined.

---

## Step 2

The browser requests media access.

Uses:

```
navigator.mediaDevices.getUserMedia()
```

Obtains:

- Camera
- Microphone

---

## Step 3

Create Peer Connection

A new `RTCPeerConnection` is created for each remote participant.

Each peer connection is responsible for one remote user.

---

## Step 4

Attach Local Tracks

The local camera and microphone tracks are added to the peer connection.

The current implementation prefers:

```
replaceTrack()
```

whenever possible.

---

## Step 5

Offer / Answer Exchange

Offer

```
createOffer()

↓

setLocalDescription()

↓

Socket.IO

↓

Remote Peer
```

Answer

```
setRemoteDescription()

↓

createAnswer()

↓

setLocalDescription()

↓

Socket.IO
```

This order is correct and should not be changed.

---

# ICE Candidate Exchange

After local description is set:

```
ICE Candidate

↓

Socket.IO

↓

Remote Peer

↓

addIceCandidate()
```

Repository audit confirms:

✓ ICE candidates are queued until the remote description exists.

This prevents one of the most common WebRTC failures.

---

# ICE Queue

Current implementation:

```
Candidate Arrives

↓

Remote Description Exists?

↓

YES ----------------→ addIceCandidate()

NO

↓

Store Candidate

↓

Remote Description Set

↓

Flush Queue

↓

addIceCandidate()
```

This implementation is production quality.

---

# Media Streams

Each participant maintains:

Local Stream

- Camera
- Microphone

Remote Streams

- One MediaStream per connected participant

Duplicate streams are prevented.

---

# Screen Sharing

Screen sharing uses:

```
getDisplayMedia()
```

Flow

```
Start Screen Share

↓

Capture Display

↓

replaceTrack()

↓

Remote Users Receive New Video
```

When sharing ends:

```
Screen Track Ends

↓

stopScreenShare()

↓

Restore Camera

↓

replaceTrack()
```

Repository audit confirms:

✓ Browser stop-sharing button is correctly handled using `track.onended`.

---

# Playback Synchronization

Video playback is NOT part of WebRTC.

Playback synchronization uses Socket.IO.

WebRTC only transports:

- Camera
- Microphone
- Screen Share

---

# Peer Cleanup

When a participant leaves:

- Close peer connection
- Remove MediaStream
- Remove video element
- Clean listeners
- Release resources

Repository audit confirms proper cleanup exists.

---

# Current Strengths

Repository audit identified:

✓ ICE Candidate Queue

✓ replaceTrack()

✓ Duplicate Stream Protection

✓ Peer Cleanup

✓ Connection Recovery

✓ Organized Peer Management

These are strengths and should be preserved.

---

# Current Limitations

Highest Priority

Missing Perfect Negotiation pattern.

Current implementation does not explicitly handle simultaneous offers ("glare").

Potential symptoms:

- One-way connections
- Random connection failures
- Refresh fixes issue
- Failed renegotiation

Recommended implementation:

- makingOffer
- ignoreOffer
- polite peer
- rollback support

---

# Production Recommendations

High Priority

- Implement Perfect Negotiation.
- Improve reconnect testing.
- Improve simultaneous join testing.

Medium Priority

- Add structured WebRTC logging.
- Handle camera restoration if original track no longer exists.
- Improve device change handling.

---

# Debugging Checklist

When debugging WebRTC:

Check:

- Camera permission
- Microphone permission
- Offer creation
- Answer creation
- ICE exchange
- Connection state
- Signaling state
- ICE connection state
- Media tracks
- Peer cleanup

Never assume signaling is the problem before checking browser permissions.

---

# Testing Checklist

Test:

✓ 2 participants

✓ 3 participants

✓ 4 participants

✓ Join while others are connected

✓ Leave room

✓ Rejoin room

✓ Refresh browser

✓ Disable internet

✓ Reconnect

✓ Toggle camera

✓ Toggle microphone

✓ Start screen share

✓ Stop screen share

✓ Browser "Stop Sharing"

---

# AI Development Rules

Before modifying WebRTC:

1. Preserve existing signaling flow.
2. Never remove ICE candidate queueing.
3. Prefer `replaceTrack()` over recreating peer connections.
4. Keep Socket.IO limited to signaling only.
5. Test multi-user scenarios after every change.
6. Do not rewrite working connection logic unless a reproducible issue exists.
7. If adding renegotiation logic, follow the Perfect Negotiation pattern.

---

# Repository Audit Summary

Current WebRTC Assessment

Overall Score: **8.8 / 10**

Strengths

- Clean architecture
- Good peer lifecycle
- Production-quality ICE handling
- Correct SDP order
- Screen sharing implemented correctly
- Good resource cleanup

Primary Improvement

Implement the **Perfect Negotiation** pattern to improve reliability during simultaneous joins and renegotiation.

The existing implementation is a strong foundation and should be enhanced rather than rewritten.