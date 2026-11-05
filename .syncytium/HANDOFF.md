---
activeAgent: opencode
nextAgent: Human
status: blocked
goal: >-
  v0.3.1 npm publish and MCP Registry listing are blocked on npm OIDC
  trusted-publisher setup
completedWork:
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
  - >-
    3D vault now models real generated files and directory nodes with used/empty
    adapter state; /api/list added and /api/file rejects directories
  - >-
    MCP surface: 23 tools, closed inputs, documented properties, outputSchema +
    structuredContent for stable reads
  - Split validate (read-only) from validate_fix (write)
  - >-
    Added server.json icons, mcpName ownership marker, llms.txt/llms-full.txt
    and a cosign-verified OIDC discovery workflow
  - Removed the local LinkedIn poster hooks and their plaintext credentials
  - >-
    All gates green: build, typecheck, 129/129 tests, lint, validate, diff 0
    drift, doctor healthy
  - >-
    v0.3.1 code, docs, tag and GitHub Release are complete; verification run
    42052911220 is green
  - >-
    MCP Discovery workflow validated the manifest, discovery files and registry
    lookup before waiting on npm
  - >-
    Release workflow failed with npm ENEEDAUTH because the npm package has no
    Trusted Publisher registered for this repository
pendingTasks:
  - >-
    On npmjs.com add a Trusted Publisher for syncytium-md: GitHub Actions, owner
    mrcbrbn5361, repo SyncytiumMD, workflow release.yml
  - >-
    Re-run Release run 42053623967, then run the MCP Discovery workflow (or
    re-run 42053623576)
  - Rotate any credential that was pasted into chat earlier
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
  - scripts/build-discovery.mjs
  - .github/workflows/discoverability.yml
contextNotes: >-
  No npm credential exists locally or in GitHub secrets, so 0.3.1 cannot be
  published until the npm-side trusted publisher exists. After that, both
  workflows are idempotent and need no secrets.
lastUpdated: '2026-11-05T15:24:48.885Z'
---
# 🤝 Syncytium Handoff & Live State

> **Active Agent:** `opencode`
> **Next Recommended Agent:** `Human`
> **Status:** `BLOCKED`
> **Last Updated:** `2026-11-05T15:24:48.885Z`

## 🎯 Current Goal
v0.3.1 npm publish and MCP Registry listing are blocked on npm OIDC trusted-publisher setup

## ✅ Completed in Recent Turns
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
- 3D vault now models real generated files and directory nodes with used/empty adapter state; /api/list added and /api/file rejects directories
- MCP surface: 23 tools, closed inputs, documented properties, outputSchema + structuredContent for stable reads
- Split validate (read-only) from validate_fix (write)
- Added server.json icons, mcpName ownership marker, llms.txt/llms-full.txt and a cosign-verified OIDC discovery workflow
- Removed the local LinkedIn poster hooks and their plaintext credentials
- All gates green: build, typecheck, 129/129 tests, lint, validate, diff 0 drift, doctor healthy
- v0.3.1 code, docs, tag and GitHub Release are complete; verification run 42052911220 is green
- MCP Discovery workflow validated the manifest, discovery files and registry lookup before waiting on npm
- Release workflow failed with npm ENEEDAUTH because the npm package has no Trusted Publisher registered for this repository

## 📋 Pending Tasks (Next Agent Action Items)
- [ ] On npmjs.com add a Trusted Publisher for syncytium-md: GitHub Actions, owner mrcbrbn5361, repo SyncytiumMD, workflow release.yml
- [ ] Re-run Release run 42053623967, then run the MCP Discovery workflow (or re-run 42053623576)
- [ ] Rotate any credential that was pasted into chat earlier

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
- `scripts/build-discovery.mjs`
- `.github/workflows/discoverability.yml`

## 🧠 Context & Handoff Notes for Next Agent
No npm credential exists locally or in GitHub secrets, so 0.3.1 cannot be published until the npm-side trusted publisher exists. After that, both workflows are idempotent and need no secrets.
