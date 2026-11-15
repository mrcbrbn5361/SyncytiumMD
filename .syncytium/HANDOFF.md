---
activeAgent: opencode
nextAgent: Human
status: ready_for_review
goal: >-
  Execute launch plan per writing-block.md: Phase 0 showcase done locally;
  external submissions need owner approval
completedWork:
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
  - >-
    Added npm trusted publisher mrcbrbn5361/SyncytiumMD release.yml with
    publish+stage permissions via npm trust
  - >-
    Re-ran Release run 42053623967: syncytium-md@0.3.1 published with
    provenance, version live on registry
  - >-
    Re-ran MCP Discovery run 42053623576:
    io.github.mrcbrbn5361/syncytiummd@0.3.1 successfully published to
    registry.modelcontextprotocol.io
  - >-
    3 real CLI bugs fixed (handoff --no-sync default, diff --full char
    rendering, graph --no-files/tags/open) + 3 regression tests (132 green)
  - >-
    demo.gif/graph.gif/graph.png/terminal.png recorded from the real CLI via
    scripts/record-demo.mjs
  - 'README EN+TR showcase: hero GIF, AGENTS.md & rulesync comparison tables'
  - >-
    docs/launch campaign (show-hn, awesome lists verified,
    reddit/x/linkedin/TR/newsletter/dev.to) + good-first-issues + github-setup +
    release notes + competitive-analysis + metrics baseline
pendingTasks:
  - >-
    gh auth login, then run docs/github-setup.md (homepage, discussions, labels,
    good-first-issues, release notes)
  - >-
    Ship a v0.3.2 patch with the 3 bugfixes so npm users get the fixed handoff
    (needs npm publish approval)
  - >-
    Submit the 5 verified awesome lists + MCP directories; then Show HN on
    Tue-Thu 14:00-15:00 UTC
  - Rotate any credential pasted into chat earlier
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
  Root cause of E403 'OIDC permission denied for this action': trusted publisher
  configs created after 2026-09-03 default to stage-publish only; recreate with
  npm trust github --allow-publish. No repo files changed this turn.
lastUpdated: '2026-11-15T16:37:10.240Z'
---
# 🤝 Syncytium Handoff & Live State

> **Active Agent:** `opencode`
> **Next Recommended Agent:** `Human`
> **Status:** `READY_FOR_REVIEW`
> **Last Updated:** `2026-11-15T16:37:10.240Z`

## 🎯 Current Goal
Execute launch plan per writing-block.md: Phase 0 showcase done locally; external submissions need owner approval

## ✅ Completed in Recent Turns
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
- Added npm trusted publisher mrcbrbn5361/SyncytiumMD release.yml with publish+stage permissions via npm trust
- Re-ran Release run 42053623967: syncytium-md@0.3.1 published with provenance, version live on registry
- Re-ran MCP Discovery run 42053623576: io.github.mrcbrbn5361/syncytiummd@0.3.1 successfully published to registry.modelcontextprotocol.io
- 3 real CLI bugs fixed (handoff --no-sync default, diff --full char rendering, graph --no-files/tags/open) + 3 regression tests (132 green)
- demo.gif/graph.gif/graph.png/terminal.png recorded from the real CLI via scripts/record-demo.mjs
- README EN+TR showcase: hero GIF, AGENTS.md & rulesync comparison tables
- docs/launch campaign (show-hn, awesome lists verified, reddit/x/linkedin/TR/newsletter/dev.to) + good-first-issues + github-setup + release notes + competitive-analysis + metrics baseline

## 📋 Pending Tasks (Next Agent Action Items)
- [ ] gh auth login, then run docs/github-setup.md (homepage, discussions, labels, good-first-issues, release notes)
- [ ] Ship a v0.3.2 patch with the 3 bugfixes so npm users get the fixed handoff (needs npm publish approval)
- [ ] Submit the 5 verified awesome lists + MCP directories; then Show HN on Tue-Thu 14:00-15:00 UTC
- [ ] Rotate any credential pasted into chat earlier

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
Root cause of E403 'OIDC permission denied for this action': trusted publisher configs created after 2026-09-03 default to stage-publish only; recreate with npm trust github --allow-publish. No repo files changed this turn.
