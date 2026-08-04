# CineSync UI/UX Rules

## Purpose

This document defines the UI and UX standards for CineSync.

Every interface should be:

- Simple
- Responsive
- Accessible
- Consistent
- Fast
- Predictable

User experience is part of product quality.

---

# Design Philosophy

Prioritize:

1. Clarity
2. Simplicity
3. Consistency
4. Performance
5. Accessibility

Avoid unnecessary visual complexity.

---

# Component Design

Each component should have one clear responsibility.

Good

- VideoPlayer
- ChatPanel
- ParticipantGrid
- TopNavbar

Avoid components that manage:

- UI
- Networking
- Authentication
- WebRTC
- Business logic

simultaneously.

---

# Layout

Prefer layouts that:

- Adapt to different screen sizes
- Use consistent spacing
- Keep controls easy to find

Avoid:

- Crowded interfaces
- Hidden critical actions
- Unexpected layout shifts

---

# Responsive Design

Support:

- Desktop
- Laptop
- Tablet
- Mobile (where applicable)

Use flexible layouts.

Avoid fixed widths unless necessary.

---

# Navigation

Navigation should be:

- Predictable
- Minimal
- Easy to understand

Users should always know:

- Which room they are in
- Whether they are connected
- Who the host is

---

# Loading States

Always provide feedback.

Examples

Good

- Spinner
- Skeleton UI
- Progress indicator

Bad

Blank screen.

---

# Error States

Every user-facing error should explain:

- What happened
- Why (if safe)
- What the user can do next

Good

```
Unable to access your camera.

Please grant camera permission and try again.
```

Bad

```
Error.
```

---

# Empty States

Avoid empty screens.

Examples

Chat

```
No messages yet.

Start the conversation.
```

Participants

```
Waiting for others to join...
```

---

# Feedback

Every important user action should provide feedback.

Examples

- Joined room
- Left room
- Screen sharing started
- Screen sharing stopped
- Video synchronized
- Connection restored

---

# Buttons

Buttons should clearly communicate intent.

Good

- Join Room
- Leave Room
- Start Screen Share
- Stop Screen Share

Avoid

- Go
- Do
- OK

---

# Icons

Icons should:

- Be recognizable
- Include labels or tooltips when needed
- Remain consistent across the application

Icons should not be the only indicator of meaning.

---

# Forms

Every input should have:

- Label
- Placeholder (optional)
- Validation
- Helpful error messages

Validate before submission whenever possible.

---

# Accessibility

Follow WCAG principles where practical.

Ensure:

- Keyboard navigation
- Visible focus indicators
- Sufficient color contrast
- Screen reader-friendly labels
- Meaningful button text

Avoid relying only on color to communicate status.

---

# Color Usage

Use color to reinforce meaning.

Examples

Green

- Connected
- Success

Yellow

- Warning
- Reconnecting

Red

- Error
- Disconnected

Never rely on color alone.

Always include text or icons.

---

# Typography

Use consistent typography.

Hierarchy

- Page title
- Section title
- Body text
- Caption

Avoid excessive font variations.

---

# Animations

Animations should:

- Improve understanding
- Feel responsive
- Be subtle

Avoid:

- Long animations
- Distracting effects
- Animation delays that slow interaction

---

# Real-Time Status

Users should always know:

Connection

- Connected
- Connecting
- Reconnecting
- Disconnected

Media

- Camera On
- Camera Off
- Microphone Muted
- Screen Sharing

Room

- Host
- Participant Count
- Playback Status

---

# Notifications

Use notifications sparingly.

Notify users about:

- Join success
- Leave success
- Connection loss
- Connection restored
- Screen share changes
- Playback synchronization issues

Avoid notification spam.

---

# Video Call UX

Display:

- Participant names
- Camera status
- Microphone status
- Speaking indicator (future)
- Connection quality (future)

Provide graceful fallbacks when video is unavailable.

---

# Chat UX

Support:

- Auto-scroll to new messages
- Timestamp display
- Sender identification

Avoid interrupting users while they scroll older messages.

---

# Performance

Avoid UI lag.

Prefer:

- Efficient rendering
- Lazy loading where appropriate
- Smooth scrolling
- Stable layouts

---

# Consistency

Use the same:

- Button styles
- Modal styles
- Form styles
- Icons
- Colors
- Terminology

Do not introduce inconsistent patterns.

---

# AI Design Rules

When generating UI:

1. Follow existing design patterns.
2. Maintain consistency.
3. Prefer accessibility.
4. Provide loading and error states.
5. Keep layouts responsive.
6. Avoid unnecessary visual complexity.
7. Explain significant UX decisions.

---

# Definition of Good UI

A good interface should:

- Be understandable without explanation.
- Provide immediate feedback.
- Recover gracefully from errors.
- Remain usable under poor network conditions.
- Help users accomplish tasks efficiently.