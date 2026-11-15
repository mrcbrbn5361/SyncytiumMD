# Reddit posts — one per community, story-first

General rules: no link-first posts, no "check out my tool" openers, disclose
authorship in the first line or comments, read each sub's self-promo rules the
day of posting, answer every comment. Reddit punishes polish; write like an
engineer describing a fix, not a launch.

---

## r/ClaudeCode (and/or r/ClaudeAI) — angle: Claude Code forgets the other agents

**Title:** Claude Code kept overwriting rules Cursor agents were mid-task on, so I built a shared workspace layer

> Author here, and yes that's me shooting myself in the foot for honesty:
> the story is my repos are shared between Claude Code, Cursor and Copilot,
> and each session starts like it's the first day. Claude reads CLAUDE.md,
> Cursor reads .cursor/rules, nobody reads what the other finished yesterday.
> I made `.syncytium/` the single source of truth (it generates both files +
> AGENTS.md/GEMINI.md/etc), added a handoff baton ("done: X, next: Y,
> caveat: Z"), a lease lock so two agents don't edit the same area at once,
> and `diff --check` in CI that fails when a generated file drifts.
> Claude Code integration via hooks: SessionStart can print the live handoff,
> Stop can remind the model to update it. MCP server has all 23 tools,
> destructive ones dry-run-first and trash-recoverable. It's MIT, npx works.
> Ask me anything, including "why isn't this just a Claude Code memory file".

## r/cursor — angle: one rule source for Cursor + CLI agents

**Title:** I generate my .cursor/rules AND CLAUDE.md/GEMINI.md from one folder — drift fails CI

> (same story, tightened) Focus for this sub: the `.cursor/rules/*.mdc`
> generation keeps frontmatter/`alwaysApply` semantics, user sections are
> preserved, `clean` only removes banner files, 10 adapters out of the box.
> What Cursor-only setup did you regret going multi-tool?

## r/ChatGPTCoding — angle: cross-session amnesia

**Title:** "No agent knows what the others did yesterday" — built a shared baton + audit trail

> Focus: HANDOFF.md as the baton, 100-entry audit history, works with any
> combination of tools, zero accounts/telemetry, local-first.

## r/ExperiencedDevs — angle: honest architecture discussion (NO direct promo)

**Title:** Lease locks and handoff protocols for AI coding agents — what's the failure mode you're most worried about?

> Write it as a design discussion (advisory leases vs CRDTs, file-based vs
> event-bus coordination, why human takeover must exist), disclose the tool
> once, in a single comment, only if asked in-thread. Value-first posts age
> best here.

## r/programming, lobste.rs — only after HN day

Same content as Show HN; lobste.rs requires invites and hard self-promo
etiquette — the HN thread link can be submitted by a non-author later.

## Launch-order

1. r/ClaudeCode, r/cursor — same day, HN -24h (warm-up + feedback).
2. r/ExperiencedDevs — HN day +3, discussion form.
3. r/ChatGPTCoding — HN +2 days.
