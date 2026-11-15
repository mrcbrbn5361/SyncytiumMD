# Context Engineering Is Broken: One Shared Workspace for AI Coding Agents

*Draft for dev.to — English. The article must teach something useful even if
the reader never installs anything.*

---

You run three AI coding agents. Cursor for the IDE, Claude Code in the
terminal, Copilot on the PRs. Each of them is genuinely good at its job.
Together, they are three interns who never talk, never read yesterday's log,
and occasionally overwrite each other's work.

This is not a model-quality problem. It's a **context plumbing** problem. And
the industry is still pretending the fix is "one instruction file to rule them
all". It isn't — because there are two distinct failure modes, and a file
only addresses one of them.

## Failure mode 1: spatial drift

Same rules, four files:

```
CLAUDE.md
.cursor/rules/style.mdc
.github/copilot-instructions.md
AGENTS.md
```

They start identical. Then someone edits `CLAUDE.md` at 23:41 on a Thursday.
Now Cursor enforces "no default exports", Claude Code doesn't know the rule
exists, and Copilot enforces an older variant. No error, no warning — agents
just behave inconsistently, and you spend an afternoon debugging your model's
"mood".

The convention-level fix (AGENTS.md) helps: it gives every tool one file to
read. I'd call it a genuine win — but it's one file in a room with many
readers, and *anything* can still edit it, while each vendor still prefers its
own native format for frontmatter, globs and always-apply semantics.

## Failure mode 2: temporal amnesia

Claude Code just spent 40 minutes implementing JWT refresh. It fails one test
and its session budget dies. You switch to Cursor.

Cursor's context is: instructions + files. It does **not** contain:

- what was tried and *rejected* (and why)
- the half-done state ("service layer done, route tests pending")
- the caveat ("don't touch session-store.ts, it's mid-refactor")

Every agent starts like it's day one at the job. Instructions tell agents how
to work. They say nothing about what happened *since your last session*.

## What coordination actually requires — a small taxonomy

Look at what serious multi-agent systems keep converging on (I'm deliberately
describing patterns, not tools — you can implement all of these with a folder
and discipline):

1. **A canonical source + generation, with drift as a build error.** Generate
   every vendor file from one source, mark generated files, and fail CI when a
   generated file is hand-edited. The trick that makes this usable is the
   human-preservation escape hatch: let generated files keep user sections, so
   "drift" actually means drift.
2. **A baton.** One small, structured, cheap-to-read state doc: current owner,
   status, done/next lists, caveats, timestamp. Written at end of turn, read at
   start of turn. That's the whole protocol. It must live *in the repo* so
   every tool sees it in its own context window.
3. **A lease, not a mutex.** Agents crash. A classic lock turns a crash into a
   frozen workspace; a lease with an expiry and a heartbeat turns a crash into
   a 30-minute inconvenience and a stealable lease. Make takeover auditable —
   "who stole whose lease, why" is exactly what humans need to trust the system.
4. **An audit trail that is data, not prose.** A JSON history of handoff passes
   is grep-able, diff-able and MCP-able. A `SESSION_NOTES.md` narrative is none
   of these.
5. **Self-service access for the agents themselves.** If only humans can
   operate the coordination layer, it rots at 2am. Expose it as tools —
   validated inputs, dry-run-first destructive ops, recoverable deletes.

Notice none of these require a server. They require *structure in the repo*.

## Try it in 10 minutes without installing anything

You can prototype today with plain files:

```markdown
<!-- HANDOFF.md — the baton, keep it under 40 lines -->
active: claude-code  next: cursor  status: blocked
goal: JWT refresh
done: service layer, refresh rotation test
next: route tests; wire /refresh handler
caveat: session-store.ts mid-refactor, DO NOT EDIT
updated: 2026-11-15T10:12Z
```

A lease is `lock.json` with `agent`, `expires`, `heartbeat` fields; your agent
hook can refuse to start edits while it's fresh. A drift check is literally:

```bash
node scripts/generate-agent-files.js && git diff --exit-code
```

Wire those three into your hooks/CI and watch how much coordination noise
vanishes. Most of the pain is protocol, not platform.

## What a tool adds (and what it can't)

The reason I packaged all of this as [SyncytiumMD](https://github.com/mrcbrbn5361/SyncytiumMD)
isn't that folders are impossible — it's that discipline decays. The tool
makes the protocol the path of least resistance: one canonical `.syncytium/`,
10+ generated formats, `handoff`/`lock`/`diff --check` as commands, an MCP
server so agents operate the protocol themselves, plus extras (trash-backed
restores, 3D graph) that make the system explorable.

And what it can't fix: the lease is **advisory**. It coordinates agents that
agree to coordinate; it doesn't sandbox the one that doesn't. Agent-awareness
is a protocol problem until operating-system-level agent isolation is real —
anyone telling you otherwise is selling something.

## The design question worth arguing about

Should coordination live **in the repo** (files, git history, reviewable,
zero infrastructure, works offline — everything above) or in a **service**
(observability, cross-repo state, real-time messaging)? My honest answer in
2026: start in the repo. Git is already an audit-trail database, your CI is
already an enforcement point, and your agents already read files. Move to a
service when cross-machine coordination forces your hand — not before.

What's your failure mode: drift, amnesia, collisions — or all three? I'd love
to hear which of these five patterns you already use.
