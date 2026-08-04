# CineSync Git Workflow Rules

## Purpose

This document defines the Git workflow for the CineSync repository.

Every contribution should be:

- Traceable
- Reviewable
- Reversible
- Well documented

Git history is part of the project's documentation.

---

# Branch Strategy

Never work directly on `main`.

Recommended branches:

```
main
develop
feature/*
bugfix/*
hotfix/*
release/*
```

Examples

```
feature/add-screen-recording

feature/improve-chat-ui

bugfix/fix-webrtc-negotiation

hotfix/socket-reconnect

release/v1.0.0
```

---

# Branch Responsibilities

## main

Contains only stable production code.

Requirements

- Fully tested
- Reviewed
- Deployable

---

## develop

Integration branch.

Contains completed features waiting for release.

---

## feature/*

One feature per branch.

Examples

```
feature/chat-reactions

feature/video-quality-selector

feature/theme-support
```

---

## bugfix/*

One bug per branch.

Examples

```
bugfix/ice-candidate-race

bugfix/video-sync-delay

bugfix/firebase-auth
```

---

## hotfix/*

Used only for urgent production fixes.

Merge back into both:

- main
- develop

---

## release/*

Prepare production releases.

Allowed changes

- Documentation
- Version updates
- Final bug fixes

Avoid introducing new features.

---

# Commit Standards

Each commit should solve one problem.

Avoid mixing unrelated changes.

Good commits

```
Fix ICE candidate queue race condition

Implement Firebase ID token verification

Improve screen share recovery
```

Bad commits

```
Update

Changes

Fix stuff

Final version

Working now
```

---

# Commit Message Format

Recommended

```
<type>: <summary>
```

Types

```
feat:
fix:
refactor:
docs:
test:
style:
perf:
build:
ci:
chore:
```

Examples

```
feat: add participant reconnect handling

fix: prevent duplicate peer connections

docs: update WebRTC architecture

refactor: split media management into hook
```

---

# Pull Requests

Every Pull Request should include:

## Summary

What changed?

## Reason

Why was the change necessary?

## Impact

Which components are affected?

## Testing

What was tested?

## Screenshots

Include UI screenshots when applicable.

---

# Code Review Checklist

Reviewer should verify:

- Correctness
- Readability
- Architecture
- Performance
- Security
- Documentation

Reject Pull Requests that:

- Break architecture
- Duplicate logic
- Introduce unnecessary complexity
- Reduce readability

---

# Merge Strategy

Prefer:

```
Squash and Merge
```

for feature branches.

Use

```
Merge Commit
```

only when preserving history is valuable.

Avoid unnecessary merge commits.

---

# Conflict Resolution

Before resolving conflicts:

1. Understand both changes.
2. Preserve working behavior.
3. Re-run tests.
4. Verify no functionality was lost.

Never resolve conflicts blindly.

---

# Tags

Tag every production release.

Examples

```
v1.0.0

v1.1.0

v2.0.0
```

Tags should correspond to release notes.

---

# Releases

Before creating a release:

- All critical issues resolved
- Documentation updated
- Production checklist completed
- Version updated
- Release notes prepared

---

# Changelog

Maintain a CHANGELOG.

Each release should document:

Added

Changed

Fixed

Removed

Security

Example

```
## v1.0.0

Added

- Multi-user video calls
- Screen sharing

Fixed

- ICE candidate race condition

Security

- Backend Firebase token verification
```

---

# Issue Management

Every issue should include:

- Title
- Description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Priority
- Labels

Close issues only after verification.

---

# Project Boards

Recommended workflow

```
Backlog

↓

Ready

↓

In Progress

↓

Code Review

↓

Testing

↓

Done
```

---

# Documentation Rules

Whenever architecture changes:

Update:

- context/
- roadmap.md
- known-issues.md

Whenever behavior changes:

Update:

- README
- API Reference
- CHANGELOG

Documentation is part of the implementation.

---

# Rollback Strategy

Every major feature should be reversible.

Avoid commits that make rollback difficult.

Prefer small, focused commits.

---

# AI Git Rules

When generating changes:

1. Make the smallest safe modification.
2. Keep commits focused.
3. Suggest an appropriate commit message.
4. Mention affected files.
5. Recommend tests before merging.
6. Recommend updating documentation if behavior changes.

Never suggest force-pushing shared branches unless explicitly requested.

---

# Repository Standards

This repository values:

✓ Clean Git history

✓ Small focused commits

✓ Well-documented Pull Requests

✓ Stable main branch

✓ Traceable changes

✓ Production-ready releases

Git history should tell the story of how the project evolved.