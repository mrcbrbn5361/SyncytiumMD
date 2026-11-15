---
activeAgent: opencode
nextAgent: Human
status: ready_for_review
goal: >-
  Phase 1: wait for awesome-list merges (punkpeye #14698 fully unblocked:
  has-glama/has-emoji/valid-name), complete remaining manual submissions
  (mcpservers.org/Smithery/mcp.so/cursor.directory), then launch (Show HN
  Tue-Thu 14:00-15:00 UTC)
completedWork:
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
  - >-
    gh device-flow auth completed; pushed Phase 0 commit 0bddb02; repo settings
    done via gh (description, homepage, topics agents-md+coding-agents,
    Discussions enabled, 8 labels, 10 good-first-issues #10-19, 3 release notes
    rewritten)
  - >-
    Phase 1 awesome-lists: punkpeye PR #14698 revived (rebased clean, badge
    removed, fast-track marker, MERGEABLE/CLEAN); bradAGI PR #660 and yzfly PR
    #1069 opened (both OPEN/MERGEABLE); hesreallyhim frozen to outsiders -
    dropped; wong2 wants web form not PR
  - >-
    gh device-flow auth + repo settings: description, homepage, topics,
    Discussions ON, 8 labels, good-first-issues #10-19, 3 release notes
    rewritten
  - >-
    punkpeye PR #14698 revived to OPEN/MERGEABLE/CLEAN with fast-track marker;
    bradAGI #660 and yzfly #1069 opened; hesreallyhim dropped (frozen);
    docs/launch/awesome-lists.md updated to live status
  - >-
    v0.3.2 shipped end-to-end: tag + GitHub Release + CI OIDC publish (+
    syncytium-md@0.3.2, provenance sigstore 3907611038), MCP Discovery
    republished registry manifest, global install verified 0.3.2, lockfile gate
    re-green on 1bb7a24
  - >-
    npm trusted-publisher now has --allow-publish (granted via website);
    fix-trusted-publisher.yml removed as dead surface
  - >-
    v0.3.2 shipped end-to-end via CI OIDC publish (npm latest=0.3.2, provenance,
    MCP Discovery green, global install verified, lockfile gate re-green)
  - >-
    Glama evaluation now live (rated B); punkpeye #14698 label flipped
    missing-glama to has-glama, score badge + TS emoji added, all listing
    requirements satisfied
pendingTasks:
  - >-
    If #14698 not merged within 3-4 days post-unblock, one polite ping to
    @punkpeye; same cadence for bradAGI #660 and yzfly #1069 (opened 2026-11-15)
  - >-
    Manual web submissions pending: mcpservers.org (wong2), Smithery, mcp.so,
    cursor.directory
  - 'Launch window after merges: docs/show-hn-draft.md Tue-Thu 14:00-15:00 UTC'
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
  - docs/launch/awesome-lists.md
  - docs/release-notes/v0.3.2.md
contextNotes: >-
  Glama submit was already done by human in September; evaluation simply took
  time to complete.
lastUpdated: '2026-11-15T18:47:52.999Z'
---
# 🤝 Syncytium Handoff & Live State

> **Active Agent:** `opencode`
> **Next Recommended Agent:** `Human`
> **Status:** `READY_FOR_REVIEW`
> **Last Updated:** `2026-11-15T18:47:52.999Z`

## 🎯 Current Goal
Phase 1: wait for awesome-list merges (punkpeye #14698 fully unblocked: has-glama/has-emoji/valid-name), complete remaining manual submissions (mcpservers.org/Smithery/mcp.so/cursor.directory), then launch (Show HN Tue-Thu 14:00-15:00 UTC)

## ✅ Completed in Recent Turns
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
- gh device-flow auth completed; pushed Phase 0 commit 0bddb02; repo settings done via gh (description, homepage, topics agents-md+coding-agents, Discussions enabled, 8 labels, 10 good-first-issues #10-19, 3 release notes rewritten)
- Phase 1 awesome-lists: punkpeye PR #14698 revived (rebased clean, badge removed, fast-track marker, MERGEABLE/CLEAN); bradAGI PR #660 and yzfly PR #1069 opened (both OPEN/MERGEABLE); hesreallyhim frozen to outsiders - dropped; wong2 wants web form not PR
- gh device-flow auth + repo settings: description, homepage, topics, Discussions ON, 8 labels, good-first-issues #10-19, 3 release notes rewritten
- punkpeye PR #14698 revived to OPEN/MERGEABLE/CLEAN with fast-track marker; bradAGI #660 and yzfly #1069 opened; hesreallyhim dropped (frozen); docs/launch/awesome-lists.md updated to live status
- v0.3.2 shipped end-to-end: tag + GitHub Release + CI OIDC publish (+ syncytium-md@0.3.2, provenance sigstore 3907611038), MCP Discovery republished registry manifest, global install verified 0.3.2, lockfile gate re-green on 1bb7a24
- npm trusted-publisher now has --allow-publish (granted via website); fix-trusted-publisher.yml removed as dead surface
- v0.3.2 shipped end-to-end via CI OIDC publish (npm latest=0.3.2, provenance, MCP Discovery green, global install verified, lockfile gate re-green)
- Glama evaluation now live (rated B); punkpeye #14698 label flipped missing-glama to has-glama, score badge + TS emoji added, all listing requirements satisfied

## 📋 Pending Tasks (Next Agent Action Items)
- [ ] If #14698 not merged within 3-4 days post-unblock, one polite ping to @punkpeye; same cadence for bradAGI #660 and yzfly #1069 (opened 2026-11-15)
- [ ] Manual web submissions pending: mcpservers.org (wong2), Smithery, mcp.so, cursor.directory
- [ ] Launch window after merges: docs/show-hn-draft.md Tue-Thu 14:00-15:00 UTC
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
- `docs/launch/awesome-lists.md`
- `docs/release-notes/v0.3.2.md`

## 🧠 Context & Handoff Notes for Next Agent
Glama submit was already done by human in September; evaluation simply took time to complete.
