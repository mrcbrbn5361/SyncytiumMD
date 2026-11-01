---
activeAgent: opencode
nextAgent: Any
status: completed
goal: >-
  MCP safety hardening, npm 0.3.0 publish, CI release repair, server.json
  registry metadata
completedWork:
  - >-
    Implemented embedded Knowledge Graph UI server (syncytium graph / syncytium
    ui)
  - Added syncytium_get_graph tool to MCP server
  - >-
    Created automated release pipeline (scripts/release.mjs) with CDN
    propagation polling
  - >-
    Enhanced SyncytiumMD self-hosting (.syncytium/ architecture, ADRs, and
    adapter standards)
  - 'Added unit tests: 20/20 tests passing'
  - Optimized 3D WebGL knowledge graph with Three.js geometry/material pooling
  - Implemented physics alpha decay with auto-sleep (0% idle CPU)
  - Added selective LOD text sprite labels and cursor hover tooltips
  - >-
    Added compact view button in UI and --compact, --no-files, --no-tags flags
    in CLI
  - Enhanced scripts/release.mjs with resilient npm publish retry loop
  - Achieved 21/21 passing unit tests
  - 'Fixed the diff --check gate, orphan pruning and destructive clean'
  - >-
    Eliminated stored XSS in the Obsidian Studio UI and hardened the local
    server
  - >-
    Added zod validation, rule/ADR CRUD, export, validate, lock heartbeat,
    --json
  - 'Added AGENTS.md, GEMINI.md, Copilot path instructions and Roo Code adapters'
  - Replaced substring ignore matching with a real gitignore glob engine
  - Grew the suite from 22 to 114 tests covering every regression above
  - npm run verify passes (119/119 tests)
  - 'Repository paths, adapters and UI security hardening reviewed'
  - annotations
  - rate limits
  - dryRun/confirm
  - trash+restore
  - docs
  - v0.3.0
  - Added src/mcp/safety.ts with annotations and per-tool rate limits
  - >-
    Destructive MCP tools dry-run by default; deletions archived to
    .syncytium/memory/trash and restorable
  - Added syncytium_list_trash and syncytium_restore (20 to 22 tools)
  - Published syncytium-md@0.3.0 to npm and verified the installed CLI
  - >-
    Fixed release workflow idempotency; release run 41336056797 skipped publish
    and passed
  - 'Fixed dependabot (ignore semver-major, group minor/patch); PR 9 green'
  - >-
    Added server.json in official MCP Registry format, schema-validated and
    version-pinned by a test
  - Created and pushed tag v0.3.0 and published GitHub Release
  - 'All gates green: build, typecheck, 124/124 tests, lint 9/9, diff 0 drift'
pendingTasks:
  - Rotate the npm token and LinkedIn/Gemini credentials pasted in chat
  - Re-enable .git/hooks/pre-push only when a post is intended
  - >-
    Optionally publish server.json via mcp-publisher to
    registry.modelcontextprotocol.io
touchedFiles:
  - package.json
  - src/core/types.ts
  - src/core/engine.ts
  - src/mcp/server.ts
  - src/cli/index.ts
  - src/ui/template.ts
  - scripts/release.mjs
  - tests/syncytium.test.ts
  - .syncytium/architecture.md
  - .syncytium/memory/decisions.md
  - .syncytium/rules/adapter-standards.md
  - .syncytium/HANDOFF.md
  - src/core/paths.ts
  - src/core/schemas.ts
  - src/core/diff.ts
  - src/ui/markdown.ts
  - .gitignore
  - README.md
  - README.tr.md
  - .gitattributes
  - src/core/storage.ts
  - server.json
  - src/mcp/safety.ts
  - .github/workflows/release.yml
  - .github/dependabot.yml
contextNotes: >-
  v0.3.0 is live on npm and GitHub. The release workflow is now idempotent: a
  Release for an already-published version skips npm publish. server.json is
  schema-valid against the 2025-12-11 registry schema; description is capped at
  100 chars. The pre-push LinkedIn poster hook is disabled (pre-push.disabled).
lastUpdated: '2026-11-01T18:21:48.839Z'
---
# 🤝 Syncytium Handoff & Live State

> **Active Agent:** `opencode`
> **Next Recommended Agent:** `Any`
> **Status:** `COMPLETED`
> **Last Updated:** `2026-11-01T18:21:48.839Z`

## 🎯 Current Goal
MCP safety hardening, npm 0.3.0 publish, CI release repair, server.json registry metadata

## ✅ Completed in Recent Turns
- Implemented embedded Knowledge Graph UI server (syncytium graph / syncytium ui)
- Added syncytium_get_graph tool to MCP server
- Created automated release pipeline (scripts/release.mjs) with CDN propagation polling
- Enhanced SyncytiumMD self-hosting (.syncytium/ architecture, ADRs, and adapter standards)
- Added unit tests: 20/20 tests passing
- Optimized 3D WebGL knowledge graph with Three.js geometry/material pooling
- Implemented physics alpha decay with auto-sleep (0% idle CPU)
- Added selective LOD text sprite labels and cursor hover tooltips
- Added compact view button in UI and --compact, --no-files, --no-tags flags in CLI
- Enhanced scripts/release.mjs with resilient npm publish retry loop
- Achieved 21/21 passing unit tests
- Fixed the diff --check gate, orphan pruning and destructive clean
- Eliminated stored XSS in the Obsidian Studio UI and hardened the local server
- Added zod validation, rule/ADR CRUD, export, validate, lock heartbeat, --json
- Added AGENTS.md, GEMINI.md, Copilot path instructions and Roo Code adapters
- Replaced substring ignore matching with a real gitignore glob engine
- Grew the suite from 22 to 114 tests covering every regression above
- npm run verify passes (119/119 tests)
- Repository paths, adapters and UI security hardening reviewed
- annotations
- rate limits
- dryRun/confirm
- trash+restore
- docs
- v0.3.0
- Added src/mcp/safety.ts with annotations and per-tool rate limits
- Destructive MCP tools dry-run by default; deletions archived to .syncytium/memory/trash and restorable
- Added syncytium_list_trash and syncytium_restore (20 to 22 tools)
- Published syncytium-md@0.3.0 to npm and verified the installed CLI
- Fixed release workflow idempotency; release run 41336056797 skipped publish and passed
- Fixed dependabot (ignore semver-major, group minor/patch); PR 9 green
- Added server.json in official MCP Registry format, schema-validated and version-pinned by a test
- Created and pushed tag v0.3.0 and published GitHub Release
- All gates green: build, typecheck, 124/124 tests, lint 9/9, diff 0 drift

## 📋 Pending Tasks (Next Agent Action Items)
- [ ] Rotate the npm token and LinkedIn/Gemini credentials pasted in chat
- [ ] Re-enable .git/hooks/pre-push only when a post is intended
- [ ] Optionally publish server.json via mcp-publisher to registry.modelcontextprotocol.io

## 📂 Recently Touched Files
- `package.json`
- `src/core/types.ts`
- `src/core/engine.ts`
- `src/mcp/server.ts`
- `src/cli/index.ts`
- `src/ui/template.ts`
- `scripts/release.mjs`
- `tests/syncytium.test.ts`
- `.syncytium/architecture.md`
- `.syncytium/memory/decisions.md`
- `.syncytium/rules/adapter-standards.md`
- `.syncytium/HANDOFF.md`
- `src/core/paths.ts`
- `src/core/schemas.ts`
- `src/core/diff.ts`
- `src/ui/markdown.ts`
- `.gitignore`
- `README.md`
- `README.tr.md`
- `.gitattributes`
- `src/core/storage.ts`
- `server.json`
- `src/mcp/safety.ts`
- `.github/workflows/release.yml`
- `.github/dependabot.yml`

## 🧠 Context & Handoff Notes for Next Agent
v0.3.0 is live on npm and GitHub. The release workflow is now idempotent: a Release for an already-published version skips npm publish. server.json is schema-valid against the 2025-12-11 registry schema; description is capped at 100 chars. The pre-push LinkedIn poster hook is disabled (pre-push.disabled).
