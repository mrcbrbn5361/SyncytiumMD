# Show HN draft — SyncytiumMD (v2, launch-ready)

**Title:** Show HN: SyncytiumMD – Shared workflows and handoffs for AI coding agents

**URL:** https://github.com/mrcbrbn5361/SyncytiumMD

**Post body:**

Hi HN — I'm Miraç, I built SyncytiumMD (MIT, single npm dep tree, no account,
no telemetry). Disclosure: I'm the author, so please roast it accordingly.

The problem is one most of you have by now: I run Cursor, Claude Code, Copilot
and a couple of CLI agents on the same repo. Every tool reads its own
instruction file, so the same rules live in four copies — and they drift. But
the sharper problem is temporal, not spatial: when Claude Code ends its turn,
Cursor genuinely does not know what just happened. There is no baton.

What I kept after building this: AGENTS.md is the right standard for shared
instructions — so I don't replace it, I generate it (plus 9 other native
formats: .cursor/rules/*.mdc, CLAUDE.md, GEMINI.md, .github/instructions/*,
.cline rules, Windsurf, Trae, OpenCode, Roo...). Around that standard I added
the missing workflow pieces:

- Handoff baton: one command writes "who's on it, what's done, what's next,
  caveats" into HANDOFF.md and propagates it into every tool's file. A
  100-entry audit trail logs every pass of the baton.
- Lease-based lock: agents take a renewable lease with a heartbeat before
  editing. Expired leases are stealable on purpose — a crashed agent must
  never freeze a workspace.
- CI drift gate: `syncytium diff --check` regenerates every bridge file in
  memory, compares, and exits 1 with real unified diffs if a human hand-edited
  one copy. (This flag alone has caught two "why did Cursor suddenly ignore
  our rules?" mysteries for me.)
- MCP server with 23 tools, so agents can run all of the above themselves —
  every input zod-validated, destructive tools dry-run-first, deletions
  trash-archived and restorable, rate-limits enforced server-side.
- A local 3D knowledge graph of the whole context (127.0.0.1, rejects non-
  loopback Host headers, won't serve .env/.git).

The bet, since people will ask "why not rulesync/ruler?": those are excellent
rules compilers (rulesync tracks ~66 tool targets, ruler ~32). The hard part
of multi-agent work isn't formatting instructions — it's coordinating the
agents that read them. Nobody I found ships baton + renewable lease + a
canonical-config MCP server in one tool. If rules compilation is all you need,
honestly: use them, `syncytium import` will happily re-absorb what they made.

Honest limitations: 10 adapters (not 60), the audit trail is a local JSON
file, the lease is advisory (it coordinates agents, it doesn't sandbox them),
and I'm one person — response time to issues is good but not corporate.

Try in ~2 minutes:

    npx syncytium init && npx syncytium sync && npx syncytium graph

Demo GIF + comparison table are in the README. I'll be in the comments all
day — what would make you delete this from your toolchain in week two?

---

## Posting notes (delete before posting)

- When: Tue–Thu, 14:00–15:00 UTC — current HN traffic peak; it improves odds,
  guarantees nothing.
- Account age matters: if the account is brand new, spend days commenting on
  other posts first; day-one Show HN from a fresh account rarely surfaces.
- First two hours: answer every technical comment, admit every limitation you
  get caught on. Do not reply with marketing. No vote-begging, no co-voting —
  instant death and account ban.
- Be ready to paste: the demo GIF URL (raw.githubusercontent), the MCP config
  snippet, and this repo's `diff --check` output when something drifts.
- If the post stalls below ~10 points after 6h, leave it; reposting is worse.
