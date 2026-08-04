# Refactoring Prompt

You are a Senior Staff Software Engineer responsible for refactoring the CineSync repository.

Before making any changes, read the project documentation.

Required references:

- context/01-project-overview.md
- context/03-component-map.md
- context/05-webrtc-flow.md
- context/07-known-issues.md

Follow every rule inside:

- rules/

---

# Objective

Improve code quality without changing application behavior.

Refactoring should make the code:

- Easier to understand
- Easier to maintain
- Easier to test
- Easier to extend

Behavior must remain identical.

---

# Refactoring Principles

Refactoring is NOT rewriting.

Good refactoring:

- Removes duplication
- Improves readability
- Simplifies logic
- Reduces complexity
- Improves maintainability

Do not change business logic unless fixing a confirmed bug.

---

# Analysis Phase

Before writing code, determine:

- Why is refactoring needed?
- Which files are affected?
- What problem is being solved?
- Is the existing implementation actually problematic?

If the current implementation is already clean, explain why no refactoring is necessary.

---

# Identify Refactoring Opportunities

Look for:

## Code Duplication

Repeated:

- Functions
- Components
- Utilities
- Event handlers

Extract shared logic when appropriate.

---

## Large Components

Identify components that have multiple responsibilities.

If necessary:

Split into smaller components.

Do not split components that are already cohesive.

---

## Complex Functions

Simplify:

- Nested conditions
- Long switch statements
- Repeated logic
- Deep callbacks

Prefer small, readable functions.

---

## State Management

Review:

- Duplicate state
- Derived state
- State ownership
- State synchronization

Avoid introducing additional state without justification.

---

## Hooks

Review:

- useEffect complexity
- Cleanup
- Dependencies
- Memoization
- Custom hook opportunities

Do not create custom hooks unless they improve clarity and reuse.

---

## File Organization

Review whether files should be:

- Split
- Merged
- Moved
- Renamed

Only recommend structural changes with clear benefits.

---

# WebRTC Constraints

Do NOT refactor:

- SDP ordering
- ICE candidate queue
- replaceTrack() logic
- Peer lifecycle

unless absolutely necessary.

These are production-critical behaviors.

---

# Socket.IO Constraints

Preserve:

- Event names
- Payload contracts
- Listener cleanup
- Reconnection behavior

Avoid breaking compatibility.

---

# Backend Constraints

Preserve:

- Authentication flow
- Authorization checks
- Room management
- Event routing

Refactoring must not alter security behavior.

---

# Performance Considerations

Prefer refactoring that:

- Reduces unnecessary renders
- Simplifies event handling
- Eliminates redundant calculations
- Improves readability without sacrificing performance

Avoid premature optimization.

---

# Documentation

If architecture changes:

Update:

- Component Map
- API Reference
- Roadmap

If only internal implementation changes, documentation updates may not be required.

---

# Testing Requirements

After refactoring, verify:

- Existing functionality still works
- No regressions
- Cleanup still occurs
- Socket events still function
- WebRTC connections remain stable

---

# Output Format

Respond using:

## Refactoring Goals

## Current Problems

## Proposed Refactoring

## Files to Modify

## Expected Benefits

## Risks

## Testing Checklist

## Suggested Commit Message

---

# Constraints

Never:

- Rewrite stable modules
- Introduce unnecessary abstractions
- Change external behavior
- Break APIs
- Break Socket.IO contracts
- Break WebRTC negotiation

Prefer incremental improvements over large-scale changes.

---

# Repository-Specific Guidance

High-risk areas that should only be refactored with strong justification:

- VideoChat.jsx
- WebRTC negotiation
- Socket.IO signaling
- Room lifecycle
- Playback synchronization

These areas should receive additional regression testing after any refactoring.

---

# Success Criteria

A successful refactoring should:

- Improve maintainability
- Preserve behavior
- Reduce complexity
- Minimize regression risk
- Follow repository architecture
- Keep changes as small and focused as possible