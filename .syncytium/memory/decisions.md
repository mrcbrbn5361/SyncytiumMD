---
decisions:
  - id: ADR-001
    title: Adopt SyncytiumMD as Universal Context Bridge
    status: accepted
    date: '2026-09-19'
    context: >-
      Multiple AI agents and IDEs (Cursor, Claude Code, Copilot, Cline,
      Antigravity, etc.) are used concurrently, leading to fragmented context
      and duplicated rules.
    decision: >-
      Use SyncytiumMD as the single source of truth (.syncytium/) to transpile
      and synchronize rules, memories, and handoff state across all AI coding
      tools.
    consequences: >-
      All tools stay in sync with zero manual copy-pasting. Changes in rules
      propagate automatically to all connected IDEs and CLIs.
---
# Architectural Decision Records (ADR)

### [ADR-001] Adopt SyncytiumMD as Universal Context Bridge
- **Status:** accepted
- **Date:** 2026-09-19

**Context:**
Multiple AI agents and IDEs (Cursor, Claude Code, Copilot, Cline, Antigravity, etc.) are used concurrently, leading to fragmented context and duplicated rules.

**Decision:**
Use SyncytiumMD as the single source of truth (.syncytium/) to transpile and synchronize rules, memories, and handoff state across all AI coding tools.

**Consequences:**
All tools stay in sync with zero manual copy-pasting. Changes in rules propagate automatically to all connected IDEs and CLIs.

---

