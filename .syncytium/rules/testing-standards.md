---
id: testing-standards
title: Testing Standards & Verification
description: Quality assurance and test verification guidelines
alwaysApply: false
globs:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - tests/**/*
tags:
  - test
  - quality
---
## Testing Guidelines
- Write unit tests for all business logic and edge cases.
- Mock external network requests, timers, and heavy I/O in unit test suites.
- Verify tests pass before completing any implementation task.
- Follow the Arrange-Act-Assert pattern for test clarity.
