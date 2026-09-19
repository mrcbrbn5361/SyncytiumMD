---
id: security
title: Security & Safe Coding
description: 'Security rules, secrets handling, and sanitization'
alwaysApply: true
globs: []
tags:
  - security
  - compliance
---
## Security Guidelines
- Never commit secrets, API keys, tokens, or credentials into source control.
- Validate all incoming user input and payloads against strong schemas (e.g. Zod).
- Prevent injection attacks (SQL, command execution, XSS, template injection).
- Use parameterized queries and sanitized HTML output.
