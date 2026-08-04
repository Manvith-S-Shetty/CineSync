# CineSync Security Rules

## Purpose

This document defines the security requirements for CineSync.

Every new feature, API, Socket.IO event, and WebRTC change must comply with these rules.

Security always takes precedence over convenience.

---

# Security Principles

Follow these principles:

- Never trust client input.
- Validate everything.
- Authenticate before authorizing.
- Grant the minimum required permissions.
- Fail securely.
- Never expose secrets.

---

# Authentication

Current Authentication

- Firebase Authentication
- Google Sign-In

Production Requirement

The backend must verify Firebase ID Tokens using the Firebase Admin SDK.

Status: Implemented on VisionBridge for privileged Socket.IO events (`createRoom`, `joinRoom`, `videoChange`, `watchVideoUrl`, `endCall`, plus optional `authenticate` / handshake `auth.token`).

Never trust:

- uid
- email
- displayName

when they are sent directly from the frontend.

Authentication must always be verified on the server.

---

# Authorization

Authentication proves identity.

Authorization determines permissions.

Examples

Room Host

Allowed:

- Play video
- Pause video
- Seek video
- Change video

Participants

Allowed:

- Join room
- Chat
- Video call
- Screen share

Participants must NOT control host-only actions.

---

# Input Validation

Validate every request.

Required checks:

- Required fields
- Data types
- Maximum length
- Allowed values
- Room existence
- User membership
- Authentication status

Reject invalid requests immediately.

---

# Socket.IO Security

Every Socket.IO event must:

- Validate payload structure
- Validate room membership
- Validate user identity
- Handle malformed data safely

Never trust event payloads.

---

# Rate Limiting

Protect against spam.

Recommended limits:

- Room creation
- Join requests
- Chat messages
- Playback updates
- Signaling events

Use server-side rate limiting.

---

# WebRTC Security

Socket.IO transports:

- Offer
- Answer
- ICE candidates

Media never passes through the backend.

Never:

- Log SDP contents
- Log ICE candidates in production
- Modify SDP unless necessary

---

# Firebase

Never expose:

- Service Account JSON
- Private Keys
- API Secrets

Store secrets only in environment variables.

Never commit secrets to Git.

---

# Environment Variables

Use environment variables for:

- Firebase configuration
- API URLs
- Port numbers
- Client URLs
- Production configuration

Never hardcode production values.

---

# Secrets

Never store:

- Tokens
- Passwords
- Service accounts
- Private keys

inside:

- source code
- documentation
- Git history

Use:

.env

for development.

Use platform secret management for production.

---

# CORS

Restrict CORS.

Development

Allow localhost.

Production

Allow only approved frontend domains.

Never use:

```
origin: "*"
```

in production.

---

# Error Handling

Good

```
Authentication failed.
```

Bad

```
Firebase token verification failed because ...
```

Never expose:

- Stack traces
- Database structure
- Internal server details

---

# Logging

Development

Detailed logs allowed.

Production

Never log:

- Tokens
- Passwords
- Emails (unless necessary)
- Private user data
- Firebase credentials

Prefer structured logging.

---

# Chat Security

Validate:

- Maximum message length
- Empty messages
- Room membership

Escape or sanitize user-generated content before rendering.

---

# File Handling

Validate:

- File type
- File size
- MIME type

Reject unsupported files.

Never trust client-reported file types.

---

# Web Security

Protect against:

- XSS
- CSRF (where applicable)
- Injection attacks
- Malformed payloads

Never inject untrusted HTML into the DOM.

Avoid using:

```
dangerouslySetInnerHTML
```

unless absolutely necessary.

---

# Dependencies

Before adding a dependency:

Ask:

- Is it maintained?
- Is it necessary?
- Does it increase the attack surface?

Prefer built-in APIs when practical.

---

# Production Checklist

Before deployment verify:

✓ Firebase ID Token verification enabled

✓ Payload validation enabled

✓ CORS restricted

✓ HTTPS enabled

✓ Secrets secured

✓ Rate limiting configured

✓ Error messages sanitized

✓ Logging reviewed

---

# Security Audit Findings

Repository audit identified these high-priority improvements:

✅ Firebase ID Token verification (ISSUE-002 resolved).

🔴 Validate all Socket.IO payloads.

🟠 Add rate limiting.

✅ Limit chat history.

🟠 Improve structured logging.

---

# AI Development Rules

Before generating code:

1. Never trust frontend data.
2. Validate every payload.
3. Authenticate before authorizing.
4. Never expose secrets.
5. Prefer secure defaults.
6. Explain any security trade-offs.
7. Reject insecure implementations even if they appear simpler.

---

# Definition of Secure Code

Secure code should:

- Protect user identity.
- Prevent unauthorized actions.
- Handle invalid input safely.
- Avoid leaking sensitive information.
- Remain secure under malformed or malicious requests.