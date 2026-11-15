# LinkedIn launch post

Tone: personal engineering story, zero hype-emoji, one GIF attachment, first
comment has the links (LinkedIn buries external links in the body).

---

I spent last weekend fixing a problem that had nothing to do with my code.

Four AI coding tools in the same repo. Cursor, Claude Code, Copilot, one CLI
agent. Each reads its own instruction file. Every one of them starts its day
believing it is alone in the codebase.

Two failure modes kept recurring:

1) **Spatial drift.** Same rules, four copies. Someone hand-edits one copy;
   the others silently keep stale instructions. Nobody notices until an agent
   "randomly" ignores a rule we've had for months.

2) **Temporal amnesia.** When one agent finishes a task and hands off, the
   next agent knows nothing about what was just tried, rejected, or left half-
   done. There is no baton.

So I built SyncytiumMD (MIT, open source):

- one canonical `.syncytium/` folder → 10+ tool formats generated and
  banner-tagged (AGENTS.md stays — it's the right standard, we generate it)
- `diff --check` in CI: real unified diffs, fails the PR the moment a
  generated copy drifts
- a handoff baton with a 100-entry audit trail
- a lease-based workspace lock with heartbeat — agents stop editing the same
  ground simultaneously
- a 23-tool MCP server so the agents operate all of this themselves, with
  dry-run-first destructive tools and recoverable deletes
- a 3D knowledge graph because I needed a break from spreadsheets

The design bet: multi-agent coding's real bottleneck isn't instructions, it's
coordination. Most tools in this space compile rules beautifully; almost none
make agents aware of each other.

Try it in two minutes: npx syncytium init && npx syncytium sync

Genuinely curious what engineering leaders think: should agent coordination
live in the repo (files, git-tracked, like this) or in a service? I chose
local-first and git and I'd like to be stress-tested on that choice.

(links in the first comment)
