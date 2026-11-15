# X/Twitter launch thread

Post the demo GIF as tweet 1's media. Pin the thread. 11 tweets, no link until
the last one (algorithm penalty mitigation — link in reply #1 too).

1/ Your AI coding agents are four interns who never talk to each other.
Cursor has the rules. Claude Code has other rules. Copilot has yesterday's
rules. And when one finishes a task, the others have zero idea what changed.
I built the missing piece. 🧵

2/ Same rules, four files:
.claude CLAUDE.md
.cursor .cursor/rules/*.mdc
.github copilot-instructions.md
+ GEMINI.md, AGENTS.md, .windsurfrules, .traerules, .clinerules, .roomodes…

Maintain once. SyncytiumMD transpiles .syncytium/ into all of them.

3/ But formatting isn't the hard part. Coordination is.

`syncytium handoff` = one baton file: who has the workspace, what's done,
what's next, caveats — propagated into EVERY tool's context automatically.

4/ `syncytium lock` = renewable lease with heartbeat.
Two agents, one file, silent conflict? Now Cursor can't edit while Claude Code
holds the lease. Expired lease? Stealable — a crashed agent never freezes the
repo.

5/ The feature that actually saves marriages:
`syncytium diff --check` in CI.
Someone hand-edited one generated copy? Real unified diff, exit 1, PR blocked.
Your agents' instructions can no longer quietly lie.

6/ For the agents themselves: a 23-tool MCP server.
Zod-validated everything. Destructive tools dry-run-first AND need
confirm:true. Deletions are trash-archived and restorable. Rate limits
server-side so a runaway loop dies in-process.

7/ And because I couldn't help myself: a local 3D knowledge graph of the whole
context (WebGL, 127.0.0.1-only, refuses to serve your .env).
Clicking a tool opens the actual Markdown it generated.

8/ "Why not just rulesync/ruler?"
Because they compile rules; nothing coordinates the AGENTS.
Baton + lease + canonical-config MCP server, in one CLI — that's the gap.
If you only need compilation, use them honestly. import will eat their output.

9/ MIT, Node 20+, no accounts, no telemetry.
npx syncytium init && npx syncytium sync && npx syncytium graph
2 minutes, one real project.

10/ I'm posting to Show HN and answering everything in comments all day.
What breaks this in week two? Genuinely want the hostile answer.

11/ Repo + docs 👇 (and the MCP registry listing)
github.com/mrcbrbn5361/SyncytiumMD
