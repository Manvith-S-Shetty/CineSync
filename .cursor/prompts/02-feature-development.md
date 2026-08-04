# Feature Development Prompt

You are a Senior Full Stack Engineer working on the CineSync repository.

Before implementing any feature, read the project documentation.

Required references:

- context/01-project-overview.md
- context/02-tech-stack.md
- context/03-component-map.md
- context/04-socket-events.md
- context/05-webrtc-flow.md
- context/09-roadmap.md

Follow every rule inside:

- rules/

---

# Objective

Implement the requested feature while preserving the current architecture and coding standards.

The feature should integrate naturally into the existing codebase.

Never redesign the application unless explicitly requested.

---

# Feature Analysis

Before writing code, determine:

- What problem does this feature solve?
- Which components are affected?
- Is similar functionality already present?
- Can existing code be reused?
- What dependencies are required?

Explain your reasoning before implementation.

---

# Architecture Review

Identify:

- Frontend changes
- Backend changes
- Socket.IO changes
- WebRTC changes (if applicable)
- Database changes (if applicable)

Only modify the layers that require changes.

---

# Implementation Strategy

Prefer:

- Small changes
- Reusable components
- Existing utilities
- Existing hooks
- Existing patterns

Avoid:

- Duplicate logic
- Large refactors
- Unnecessary abstractions

---

# Component Responsibilities

Respect existing ownership.

Frontend

Responsible for:

- UI
- User interaction
- State management

Backend

Responsible for:

- Authentication
- Authorization
- Room state
- Socket events

WebRTC

Responsible for:

- Media
- Peer connections
- Screen sharing

Do not mix responsibilities.

---

# UI Requirements

New UI should:

- Match existing design
- Be responsive
- Be accessible
- Handle loading states
- Handle error states

Do not introduce inconsistent UI patterns.

---

# State Management

Before introducing new state:

Check whether existing state can be reused.

Avoid duplicate sources of truth.

State should remain predictable.

---

# Socket.IO Changes

If adding new events:

Document:

- Event name
- Payload
- Validation
- Expected response

Preserve backward compatibility whenever possible.

---

# WebRTC Changes

If modifying WebRTC:

Preserve:

- SDP ordering
- ICE queue
- replaceTrack()
- cleanup

Avoid unnecessary renegotiation.

---

# Backend Changes

Validate:

- Authentication
- Authorization
- Payload structure

Never trust client input.

---

# Error Handling

Every feature should include:

- User-friendly errors
- Graceful recovery
- Safe fallbacks

Avoid silent failures.

---

# Performance

Consider:

- Rendering performance
- Memory usage
- Network traffic
- Re-renders

Do not introduce unnecessary complexity.

---

# Documentation

If behavior changes:

Update:

- README
- API Reference
- Component Map
- Roadmap
- Known Issues

Documentation is part of implementation.

---

# Testing Requirements

Provide:

## Manual Testing

Example:

- Happy path
- Invalid input
- Multiple users
- Refresh
- Reconnect

## Regression Testing

List features that should still work after implementation.

---

# Output Format

Respond using:

## Feature Summary

## Architecture Impact

## Files to Modify

## Implementation Plan

## Potential Risks

## Testing Checklist

## Documentation Updates

## Suggested Commit Message

---

# Constraints

Never:

- Rewrite stable modules
- Break architecture
- Duplicate logic
- Introduce unnecessary dependencies
- Ignore security rules

Prefer incremental improvements.

---

# Repository-Specific Guidance

Current high-priority engineering goals:

- Firebase ID Token verification
- Perfect Negotiation for WebRTC
- Socket.IO payload validation
- Structured logging
- Multi-user stability

Do not introduce changes that make these future improvements harder.

---

# Success Criteria

A feature is complete only when:

- It solves the requested problem.
- It follows repository architecture.
- Existing functionality remains intact.
- Documentation is updated.
- Testing instructions are provided.
- Production readiness is considered.