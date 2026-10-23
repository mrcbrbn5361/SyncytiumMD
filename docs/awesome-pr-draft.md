# Awesome-list PR draft — SyncytiumMD

Copy-paste template for submitting SyncytiumMD to awesome lists
(e.g. awesome-mcp-servers, awesome-claude-code, awesome-ai-coding).
Pick ONE list per PR, adjust the section to that list's format.

---

## Suggested entry (one line, list format)

- [SyncytiumMD](https://github.com/mrcbrbn5361/SyncytiumMD) — One context,
  every AI coding tool: transpile `.syncytium/` rules into Cursor, Claude Code,
  Copilot, Cline/Roo, Windsurf, AGENTS.md, GEMINI.md + MCP server with
  drift-gated CI. (MIT, Node.js 20+, `npx syncytium sync`)

## Suggested PR title

Add SyncytiumMD — universal AI-coding-tool context bridge + MCP server

## Suggested PR body

SyncytiumMD keeps agent instructions **once** in `.syncytium/` and generates
every tool's native format (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`,
`.github/copilot-instructions.md`, …) with a banner + `syncytium diff --check`
drift gate for CI.

Why it fits this list:

- Directly useful to the list's audience (AI coding tool / MCP users).
- Maintained, MIT-licensed, published on npm as `syncytium-md`.
- Docs + 118-test suite + Node 20.x/22.x CI matrix
  (`.github/workflows/syncytium.yml`).
- MCP server: 18 zod-validated tools, stdio transport, token-budgeted output.

Links:

- Repo: https://github.com/mrcbrbn5361/SyncytiumMD
- npm: https://www.npmjs.com/package/syncytium-md
- Quick start: `npx syncytium init && npx syncytium sync && npx syncytium graph`
- CI: https://github.com/mrcbrbn5361/SyncytiumMD/actions/workflows/syncytium.yml

Checklist before opening the PR:

- [ ] Read that list's CONTRIBUTING (entry format, alphabetical order, no dupes).
- [ ] Placed the entry in the correct section, alphabetical position.
- [ ] One-line description matches the list's tone (no marketing superlatives).
- [ ] Link verified: repo + npm + CI badge resolve.
- [ ] Only one list per PR (don't batch multiple awesome lists).
