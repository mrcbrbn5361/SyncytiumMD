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
      ADRs without installing heavy frontend runtimes (e.g. Next.js, Electron,
      or Express).
    decision: >-
      Implement an embedded Canvas-based force-directed graph server using
      native node:http and Server-Sent Events (SSE).
    consequences: >-
      Instant startup, zero external runtime weight, works offline, and
      automatically re-renders when files in .syncytium/ change.
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
      Publishing to NPM immediately triggers ETARGET errors if global
      installation is attempted before edge CDNs replicate the new version
      tarball.
    decision: >-
      Implement scripts/release.mjs (npm run release) which verifies tests,
      publishes, polls npm view with exponential backoff until live, and then
      installs globally.
    consequences: >-
      Zero failed releases, automated verification, and frictionless developer
      workflow.
  - id: ADR-005
    title: High-Performance 3D Knowledge Galaxy with Physics Sleep & Geometry Pooling
    status: accepted
    date: '2026-09-19'
    context: >-
      For large codebases with dozens of files, tags, and rules, the 3D WebGL
      knowledge graph experienced sluggish startup, canvas texture contention,
      and unbounded O(N^2) physics loop CPU load.
    decision: >-
      Implement Three.js unit sphere geometry and material caching/pooling,
      simulation alpha decay with auto-sleeping (0% idle CPU load), LOD lazy
      text sprite generation, floating hover tooltips, and compact view mode
      (--compact, --no-files, --no-tags).
    consequences: >-
      Silky 60+ FPS rendering, instant boot on large repositories, zero idle CPU
      consumption, and clean uncluttered visual brain inspection.
  - id: ADR-006
    title: Make the drift gate capable of failing
    status: accepted
    date: '2026-09-26'
    context: >-
      syncytium diff computed hasDrift and printed a tip, but always exited 0.
      The generated GitHub Actions workflow step named 'Verify Zero Context
      Drift', the pre-commit hook's 'if [ \True -ne 0 ]' guard, and the README
      claim were therefore all no-ops: a drifted commit could never be caught.
    decision: >-
      Add diff --check, which exits 1 on any modified, missing or orphaned file.
      The CI template and the generated pre-commit hook both call it. doctor
      additionally inspects the workflow text and warns when it does not use
      --check, because an existing workflow silently keeps the old no-op
      behaviour.
    consequences: >-
      Drift is now a real gate. Projects upgrading with a previously generated
      .github/workflows/syncytium.yml must run syncytium ci --force once; doctor
      tells them so explicitly.
  - id: ADR-007
    title: Never delete a directory that shares its name with a generated target
    status: accepted
    date: '2026-09-26'
    context: >-
      cleanManagedFiles ran fs.rm(dir, { recursive: true }) for directory
      targets such as .cursor/rules/ and .gemini/antigravity/rules/. A
      developer's own .cursor/rules/my-rule.mdc, which carries no Syncytium
      banner, was destroyed. Separately, deleting a rule left its generated
      files on disk forever, and diff declared an 'unmanaged' status it never
      produced.
    decision: >-
      clean now deletes only files carrying the Syncytium banner, file by file,
      and prunes a directory only once it is actually empty. sync additionally
      prunes banner-tagged files that the current rule set no longer generates,
      and diff reports them as 'unmanaged' with the reason.
    consequences: >-
      Hand-written rules in shared directories are safe. Removing a rule is now
      self-cleaning, so users no longer need to hunt down stale .mdc files by
      hand.
  - id: ADR-008
    title: >-
      Escape every value that reaches the browser and stop inlining onclick
      handlers
    status: accepted
    date: '2026-09-26'
    context: >-
      The Obsidian Studio page interpolated projectName raw into the title
      element and the header, and serialised the bootstrap config with a bare
      JSON.stringify, so a value containing a script-closing tag terminated the
      block. Node ids, which come from user-authored rule frontmatter, were
      injected unescaped into data-id attributes and inline onclick handlers in
      seven places. A cloned repository containing a hostile rule id was
      therefore stored XSS.
    decision: >-
      projectName is HTML-escaped; the bootstrap config is serialised with angle
      brackets, ampersand and the U+2028/9 line separators escaped; the category
      value is allow-listed; and every node id is escaped and carried in a
      data-node-id attribute handled by one delegated document listener. No
      inline handlers and no globals on window remain.
    consequences: >-
      The page can no longer execute script from repository content. The
      trade-off is that the 17 inline onclick attributes had to go, which is why
      the two window.* exports were removed.
  - id: ADR-009
    title: Deep-copy everything gray-matter returns
    status: accepted
    date: '2026-09-26'
    context: >-
      gray-matter caches parsed results by content string and hands back the
      same object on a repeated parse. addDecision pushed the new ADR into the
      array returned by loadDecisions, mutating that cached object. Removing the
      ADR again wrote a file whose frontmatter listed one decision, yet
      loadDecisions kept returning two for the rest of the process.
      DEFAULT_CONFIG, INITIAL_RULES and INITIAL_DECISIONS are module-level
      singletons with the same hazard.
    decision: >-
      Every loader in SyncytiumStorage deep-copies its result before returning:
      loadDecisions, loadHandoff, loadHandoffHistory and the config path.
      Module-level templates are cloned before use. A regression test asserts
      that mutating one loaded config does not affect the next read.
    consequences: >-
      Callers may safely mutate what they get back. The cost is a JSON
      round-trip per load, which is irrelevant at this data size and is not on
      the hot path of a sync.
  - id: ADR-010
    title: zod is the single validation boundary
    status: accepted
    date: '2026-09-26'
    context: >-
      SyncytiumConfigSchema was declared and never used: loadConfig did a bare
      JSON.parse and a cast, so a corrupt config silently fell back to defaults
      and doctor's config try/catch could never fire. Rule frontmatter, ADRs,
      handoff status and every MCP tool input were equally unvalidated, and
      several MCP handlers cast args to any.
    decision: >-
      All validation lives in src/core/schemas.ts. loadConfigDetailed reports
      the exact field errors instead of swallowing them; doctor surfaces them as
      an error with a fix hint; validate --fix repairs the file. Every MCP tool
      input is parsed with a zod schema before it reaches the engine, and the
      shared parse helper returns a ready-made tool error rather than throwing.
    consequences: >-
      Invalid input is reported where the user is looking, not swallowed. A
      malformed config can no longer quietly reset enabledAdapters to the
      defaults and stop generating half the bridge files.
  - id: ADR-011
    title: 'One Markdown renderer, injected into the browser'
    status: accepted
    date: '2026-09-26'
    context: >-
      The client-side parser duplicated a server-side renderer and had drifted.
      Its code-fence rule was built with new RegExp from a string literal, where
      an escaped space class degrades to a character class matching only s and
      S, so fenced code never matched. The blockquote rule ran after escaping
      had already turned the angle bracket into an entity, so quotes rendered as
      raw text. List items were emitted with no enclosing list element, and code
      contents were subsequently rewritten by the header and list rules.
    decision: >-
      The renderer lives in src/ui/markdown.ts and is injected into the served
      page verbatim via Function.prototype.toString(), so the browser copy and
      the one used by syncytium export --html are the same code by construction.
      It escapes first, then transforms, and lifts fenced and inline code into
      placeholders so no later rule can touch it.
    consequences: >-
      One implementation, one place to fix, and the unit tests that cover the
      parser now cover the browser's copy too.
  - id: ADR-012
    title: AGENTS.md and GEMINI.md are first-class targets
    status: accepted
    date: '2026-09-26'
    context: >-
      The adapter set covered the 2024-era IDE landscape but not the two
      conventions that have since become the de facto standard for non-IDE
      agents: AGENTS.md and GEMINI.md. Copilot's path-specific instruction files
      were also missing, so glob-scoped rules were flattened into a single
      always-apply document, and Roo Code had no mode definition to load.
    decision: >-
      Add two adapters, AgentsAdapter and GeminiAdapter, bringing the built-in
      set to ten. Copilot now also emits one
      .github/instructions/*.instructions.md per glob-scoped rule, and Cline
      emits a .roomodes architect mode. The Gemini adapter deliberately does not
      write .gemini/settings.json, because that schema is CLI-owned and
      inventing keys risks breaking the user's own configuration.
    consequences: >-
      Context reaches Codex-style and Gemini CLI agents without a manual
      copy-paste, and glob-scoped rules are enforced per path in Copilot instead
      of everywhere. The roomodes file uses hash comments rather than the HTML
      banner so it stays valid YAML; the banner detector keys off the marker
      text, not the comment style.
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
Implement Three.js unit sphere geometry and material caching/pooling, simulation alpha decay with auto-sleeping (0% idle CPU load), LOD lazy text sprite generation, floating hover tooltips, and compact view mode (--compact, --no-files, --no-tags).

**Consequences:**
Silky 60+ FPS rendering, instant boot on large repositories, zero idle CPU consumption, and clean uncluttered visual brain inspection.

---

### [ADR-006] Make the drift gate capable of failing
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
syncytium diff computed hasDrift and printed a tip, but always exited 0. The generated GitHub Actions workflow step named 'Verify Zero Context Drift', the pre-commit hook's 'if [ \True -ne 0 ]' guard, and the README claim were therefore all no-ops: a drifted commit could never be caught.

**Decision:**
Add diff --check, which exits 1 on any modified, missing or orphaned file. The CI template and the generated pre-commit hook both call it. doctor additionally inspects the workflow text and warns when it does not use --check, because an existing workflow silently keeps the old no-op behaviour.

**Consequences:**
Drift is now a real gate. Projects upgrading with a previously generated .github/workflows/syncytium.yml must run syncytium ci --force once; doctor tells them so explicitly.

---

### [ADR-007] Never delete a directory that shares its name with a generated target
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
cleanManagedFiles ran fs.rm(dir, { recursive: true }) for directory targets such as .cursor/rules/ and .gemini/antigravity/rules/. A developer's own .cursor/rules/my-rule.mdc, which carries no Syncytium banner, was destroyed. Separately, deleting a rule left its generated files on disk forever, and diff declared an 'unmanaged' status it never produced.

**Decision:**
clean now deletes only files carrying the Syncytium banner, file by file, and prunes a directory only once it is actually empty. sync additionally prunes banner-tagged files that the current rule set no longer generates, and diff reports them as 'unmanaged' with the reason.

**Consequences:**
Hand-written rules in shared directories are safe. Removing a rule is now self-cleaning, so users no longer need to hunt down stale .mdc files by hand.

---

### [ADR-008] Escape every value that reaches the browser and stop inlining onclick handlers
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
The Obsidian Studio page interpolated projectName raw into the title element and the header, and serialised the bootstrap config with a bare JSON.stringify, so a value containing a script-closing tag terminated the block. Node ids, which come from user-authored rule frontmatter, were injected unescaped into data-id attributes and inline onclick handlers in seven places. A cloned repository containing a hostile rule id was therefore stored XSS.

**Decision:**
projectName is HTML-escaped; the bootstrap config is serialised with angle brackets, ampersand and the U+2028/9 line separators escaped; the category value is allow-listed; and every node id is escaped and carried in a data-node-id attribute handled by one delegated document listener. No inline handlers and no globals on window remain.

**Consequences:**
The page can no longer execute script from repository content. The trade-off is that the 17 inline onclick attributes had to go, which is why the two window.* exports were removed.

---

### [ADR-009] Deep-copy everything gray-matter returns
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
gray-matter caches parsed results by content string and hands back the same object on a repeated parse. addDecision pushed the new ADR into the array returned by loadDecisions, mutating that cached object. Removing the ADR again wrote a file whose frontmatter listed one decision, yet loadDecisions kept returning two for the rest of the process. DEFAULT_CONFIG, INITIAL_RULES and INITIAL_DECISIONS are module-level singletons with the same hazard.

**Decision:**
Every loader in SyncytiumStorage deep-copies its result before returning: loadDecisions, loadHandoff, loadHandoffHistory and the config path. Module-level templates are cloned before use. A regression test asserts that mutating one loaded config does not affect the next read.

**Consequences:**
Callers may safely mutate what they get back. The cost is a JSON round-trip per load, which is irrelevant at this data size and is not on the hot path of a sync.

---

### [ADR-010] zod is the single validation boundary
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
SyncytiumConfigSchema was declared and never used: loadConfig did a bare JSON.parse and a cast, so a corrupt config silently fell back to defaults and doctor's config try/catch could never fire. Rule frontmatter, ADRs, handoff status and every MCP tool input were equally unvalidated, and several MCP handlers cast args to any.

**Decision:**
All validation lives in src/core/schemas.ts. loadConfigDetailed reports the exact field errors instead of swallowing them; doctor surfaces them as an error with a fix hint; validate --fix repairs the file. Every MCP tool input is parsed with a zod schema before it reaches the engine, and the shared parse helper returns a ready-made tool error rather than throwing.

**Consequences:**
Invalid input is reported where the user is looking, not swallowed. A malformed config can no longer quietly reset enabledAdapters to the defaults and stop generating half the bridge files.

---

### [ADR-011] One Markdown renderer, injected into the browser
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
The client-side parser duplicated a server-side renderer and had drifted. Its code-fence rule was built with new RegExp from a string literal, where an escaped space class degrades to a character class matching only s and S, so fenced code never matched. The blockquote rule ran after escaping had already turned the angle bracket into an entity, so quotes rendered as raw text. List items were emitted with no enclosing list element, and code contents were subsequently rewritten by the header and list rules.

**Decision:**
The renderer lives in src/ui/markdown.ts and is injected into the served page verbatim via Function.prototype.toString(), so the browser copy and the one used by syncytium export --html are the same code by construction. It escapes first, then transforms, and lifts fenced and inline code into placeholders so no later rule can touch it.

**Consequences:**
One implementation, one place to fix, and the unit tests that cover the parser now cover the browser's copy too.

---

### [ADR-012] AGENTS.md and GEMINI.md are first-class targets
- **Status:** accepted
- **Date:** 2026-09-26

**Context:**
The adapter set covered the 2024-era IDE landscape but not the two conventions that have since become the de facto standard for non-IDE agents: AGENTS.md and GEMINI.md. Copilot's path-specific instruction files were also missing, so glob-scoped rules were flattened into a single always-apply document, and Roo Code had no mode definition to load.

**Decision:**
Add two adapters, AgentsAdapter and GeminiAdapter, bringing the built-in set to ten. Copilot now also emits one .github/instructions/*.instructions.md per glob-scoped rule, and Cline emits a .roomodes architect mode. The Gemini adapter deliberately does not write .gemini/settings.json, because that schema is CLI-owned and inventing keys risks breaking the user's own configuration.

**Consequences:**
Context reaches Codex-style and Gemini CLI agents without a manual copy-paste, and glob-scoped rules are enforced per path in Copilot instead of everywhere. The roomodes file uses hash comments rather than the HTML banner so it stays valid YAML; the banner detector keys off the marker text, not the comment style.

---

