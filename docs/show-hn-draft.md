# Show HN draft — SyncytiumMD

Hi HN! I built SyncytiumMD: one context, every AI coding tool, zero copy-paste.

The problem: I use Cursor, Claude Code, Copilot, and CLI agents on CI.
Each wants its own instruction file, so the same rules drift across four
copies and no agent knows what the others did yesterday.

The idea came from a zero-budget side project (a YouTube Music app) where
maintaining per-tool copies became unsustainable. A friend's `memory.md`
suggestion turned into a shared memory layer: keep rules once in
`.syncytium/`, transpile them into every tool's native format.

What it does:

- Single source (`.syncytium/`) → Cursor, Claude Code, Copilot, Cline/Roo,
  Antigravity, Windsurf, Trae, OpenCode, AGENTS.md, GEMINI.md
- Live handoff baton + lease-based workspace lock with audit trail
- `syncytium diff --check` fails CI on drift with real unified diffs
- `syncytium watch` re-syncs on every change, `syncytium clean` removes only
  banner-tagged files
- 3D knowledge graph bound to `127.0.0.1`, MCP server with zod-validated inputs

Try it:

```bash
npx syncytium init
npx syncytium sync
npx syncytium graph
```

Free and MIT-licensed. Feedback welcome!

GitHub: https://github.com/mrcbrbn5361/SyncytiumMD
