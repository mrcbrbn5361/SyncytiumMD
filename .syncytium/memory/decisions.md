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
  - id: ADR-002
    title: Zero-Heavy-Dependencies Knowledge Graph UI
    status: accepted
    date: '2026-09-19'
    context: >-
      Users need an Obsidian-style visual brain graph of their rules, tags, and
      ADRs without installing heavy frontend runtimes (e.g. Next.js, Electron, or Express).
    decision: >-
      Implement an embedded Canvas-based force-directed graph server using native
      node:http and Server-Sent Events (SSE).
    consequences: >-
      Instant startup, zero external runtime weight, works offline, and automatically
      re-renders when files in .syncytium/ change.
  - id: ADR-003
    title: Lease-Based Multi-Agent Collision Prevention Lock
    status: accepted
    date: '2026-09-19'
    context: >-
      When running multiple autonomous agents or human-AI handoffs, agents risk
      overwriting each other's active work simultaneously.
    decision: >-
      Introduce syncytium lock with time-expiring leases (e.g. 30-45 minutes)
      stored in .syncytium/memory/lock.json.
    consequences: >-
      Agents verify workspace availability before starting long autonomous runs;
      expired locks clear automatically without blocking forever.
  - id: ADR-004
    title: Automated Release Pipeline with NPM CDN Replication Polling
    status: accepted
    date: '2026-09-19'
    context: >-
      Publishing to NPM immediately triggers ETARGET errors if global installation
      is attempted before edge CDNs replicate the new version tarball.
    decision: >-
      Implement scripts/release.mjs (npm run release) which verifies tests,
      publishes, polls npm view with exponential backoff until live, and then installs globally.
    consequences: >-
      Zero failed releases, automated verification, and frictionless developer workflow.
  - id: ADR-005
    title: High-Performance 3D Knowledge Galaxy with Physics Sleep & Geometry Pooling
    status: accepted
    date: '2026-09-19'
    context: >-
      For large codebases with dozens of files, tags, and rules, the 3D WebGL knowledge
      graph experienced sluggish startup, canvas texture contention, and unbounded O(N^2)
      physics loop CPU load.
    decision: >-
      Implement Three.js unit sphere geometry and material caching/pooling, simulation
      alpha decay with auto-sleeping (0% idle CPU load), LOD lazy text sprite generation,
      floating hover tooltips, and compact view mode (--compact, --no-files, --no-tags).
    consequences: >-
      Silky 60+ FPS rendering, instant boot on large repositories, zero idle CPU consumption,
      and clean uncluttered visual brain inspection.
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

### [ADR-002] Zero-Heavy-Dependencies Knowledge Graph UI
- **Status:** accepted
- **Date:** 2026-09-19

**Context:**
Users need an Obsidian-style visual brain graph of their rules, tags, and ADRs without installing heavy frontend runtimes (e.g. Next.js, Electron, or Express).

**Decision:**
Implement an embedded Canvas-based force-directed graph server using native node:http and Server-Sent Events (SSE).

**Consequences:**
Instant startup, zero external runtime weight, works offline, and automatically re-renders when files in .syncytium/ change.

---

### [ADR-003] Lease-Based Multi-Agent Collision Prevention Lock
- **Status:** accepted
- **Date:** 2026-09-19

**Context:**
When running multiple autonomous agents or human-AI handoffs, agents risk overwriting each other's active work simultaneously.

**Decision:**
Introduce syncytium lock with time-expiring leases (e.g. 30-45 minutes) stored in .syncytium/memory/lock.json.

**Consequences:**
Agents verify workspace availability before starting long autonomous runs; expired locks clear automatically without blocking forever.

---

### [ADR-004] Automated Release Pipeline with NPM CDN Replication Polling
- **Status:** accepted
- **Date:** 2026-09-19

**Context:**
Publishing to NPM immediately triggers ETARGET errors if global installation is attempted before edge CDNs replicate the new version tarball.

**Decision:**
Implement scripts/release.mjs (npm run release) which verifies tests, publishes, polls npm view with exponential backoff until live, and then installs globally.

**Consequences:**
Zero failed releases, automated verification, and frictionless developer workflow.

---

### [ADR-005] High-Performance 3D Knowledge Galaxy with Physics Sleep & Geometry Pooling
- **Status:** accepted
- **Date:** 2026-09-19

**Context:**
For large codebases with dozens of files, tags, and rules, the 3D WebGL knowledge graph experienced sluggish startup, canvas texture contention, and unbounded O(N^2) physics loop CPU load.

**Decision:**
Implement Three.js unit sphere geometry and material caching/pooling, simulation alpha decay with auto-sleeping (0% idle CPU load), LOD lazy text sprite generation, floating hover tooltips, and compact view mode (`--compact`, `--no-files`, `--no-tags`).

**Consequences:**
Silky 60+ FPS rendering, instant boot on large repositories, zero idle CPU consumption, and clean uncluttered visual brain inspection.

---
