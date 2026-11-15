# Good First Issues — ready to publish

Ten concrete, code-grounded issues. Publish each one verbatim with
`scripts/apply-github-settings.ps1` (or manually) once the owner is ready.
Every "file" reference below exists in the repo today.

Labels to create first: `good first issue`, `help wanted`, `area: cli`,
`area: mcp`, `area: adapters`, `area: ui`, `area: docs`, `area: ci`.

---

## 1. Add a `syncytium_lock_renew` MCP tool

**Area:** `area: mcp` · **Size:** small

The CLI has `syncytium lock heartbeat` and the engine exposes `renewLock()`
(`src/core/engine.ts`), but the MCP surface only advertises
`syncytium_lock_acquire`, `syncytium_lock_release` and `syncytium_lock_status`
(`src/mcp/server.ts`). A long-running agent that renews its lease from the CLI
has to shell out — inconsistent with the rest of the surface.

**Expected behaviour**
- New tool `syncytium_lock_renew` (`agent`, optional `minutes`) delegating to
  `engine.renewLock()`.
- Registered in `src/mcp/safety.ts` with honest annotations (idempotent,
  non-destructive) and a rate-limit bucket like the other lock tools.
- Tool count in `README.md`, `README.tr.md` and `.syncytium/architecture.md`
  bumped to 24.

**Acceptance criteria**
- `node --test` passes; new tests cover renew-by-non-holder (`renewed: false`)
  and renew-by-holder extending the expiry.
- `syncytium diff --check` green (docs regenerated via `npm run sync:repo`).

---

## 2. `diff --format=github` — GitHub Actions annotations

**Area:** `area: cli`, `area: ci` · **Size:** small

`syncytium diff --check` already exits 1 in CI. Make the failure *clickable*:
with `--format=github` each drifted file is emitted as a workflow command, e.g.
`::error file=.cursor/rules/code-style.mdc,title=Context drift::2 line(s) differ from .syncytium/`.

**Expected behaviour**
- New `--format <text|json|github>` option on `diff` (default `text`, `json`
  behaviour stays behind the global `--json`).
- `--check` semantics unchanged (exit 1 on drift).

**Acceptance criteria**
- Spawned CLI test in `tests/syncytium.test.ts` asserts annotation lines and
  exit code 1.
- The generated drift workflow (`.github/workflows/syncytium.yml` installed via
  `syncytium ci`) documented in README's Guards section.

---

## 3. Built-in adapter for Amazon Kiro (`.kiro/steering/*.md`)

**Area:** `area: adapters` · **Size:** medium

Kiro reads steering files from `.kiro/steering/`. The adapter contract is fully
documented in `.syncytium/rules/adapter-standards.md`, and `.mdc`-style
multi-file adapters already exist (Cursor in `src/adapters/builtin/cursor.ts`,
Antigravity in `src/adapters/builtin/antigravity.ts`) — copy the structure.

**Expected behaviour**
- `KiroAdapter` emitting one file per rule plus the handoff file, with the
  SyncytiumMD banner.
- Registered in `src/adapters/registry.ts`; selectable in `enabledAdapters`.

**Acceptance criteria**
- Unit test asserting the generated paths and banner, matching the Cursor
  adapter test style; `syncytium sync` output in README's file diagram updated.

---

## 4. `rule add --body-file -` reads the body from stdin

**Area:** `area: cli` · **Size:** tiny

`--body-file` (src/cli/index.ts, rule add) only accepts a path. Agents and
pipes want `syncytium rule add --title X --body-file -`.

**Acceptance criteria**
- `-` reads all of stdin as the body; empty stdin still errors with the
  existing message; spawned CLI test with `input:` option.

---

## 5. CI matrix: run the test suite on Windows and macOS

**Area:** `area: ci` · **Size:** small

`.github/workflows/syncytium.yml` tests only `ubuntu-latest`. The CLI is used
on Windows/macOS and `record-demo.mjs` is cross-platform; we should know if the
path-safety or diff code regresses per-OS.

**Expected behaviour**
- Matrix `os: [ubuntu-latest, windows-latest, macos-latest] × node [22.x, 24.x]`
  for the test job (release job stays single-OS).

**Acceptance criteria**
- Green run on all three OSes; if a real platform bug surfaces, file it
  separately rather than masking it.

---

## 6. `handoff --dry-run` prints the resulting state without writing

**Area:** `area: cli` · **Size:** small

`remove_rule`/`remove_decision` are dry-run-first, but `handoff` (the most
frequent write) always mutates `.syncytium/HANDOFF.md`. A `--dry-run` that
prints the merged state (same output as the real run) lets CI preview the
baton, and `--dry-run` composes with `--json`.

**Acceptance criteria**
- Engine `handoff()` accepts `dryRun` and skips `writeHandoff` +
  `recordHandoffHistory` when set; spawned CLI test asserts files unchanged.

---

## 7. README translation: Japanese (or Spanish)

**Area:** `area: docs` · **Size:** small

`README.md` (English) and `README.tr.md` (Turkish) exist. A native-quality
translation into Japanese or Spanish, linked from the language row, grows the
reachable audience. Translation PRs from native speakers are especially welcome
— please don't open machine-translation PRs.

**Acceptance criteria**
- `README.ja.md` / `README.es.md` with every section of the English README,
  links added to both existing READMEs, code samples kept verbatim.

---

## 8. Graph UI: search box for the vault file tree

**Area:** `area: ui` · **Size:** medium

The Obsidian-Studio panel (`src/ui/template.ts`) lists generated files in a
tree; on large projects users must scroll. A filter input that hides
non-matching branches (client-side, no new endpoints) makes the vault usable.

**Acceptance criteria**
- Debounced filter on the existing DOM tree; state survives node clicks;
  works with the existing keyboard navigation; XSS-safe as before (reuse the
  existing escaping helpers — `escapeHtmlAttribute`, event delegation, no
  inline handlers).

---

## 9. Document + test `NO_COLOR`/`FORCE_COLOR` behaviour

**Area:** `area: cli`, `area: docs` · **Size:** tiny

Colors come from picocolors, which honours `NO_COLOR`/`FORCE_COLOR`, but this
is undocumented. Add a "Colors" line to README's development section and one
spawned test forcing colors off.

---

## 10. `doctor` check: bridge files older than the canonical source

**Area:** `area: cli` · **Size:** small

`doctor` runs 11 health checks. Add a 12th: detect bridge files whose mtime is
older than `.syncytium/`'s newest file and suggest `syncytium sync` (the check
must be advisory — content drift remains the job of `diff`, mtime is only the
hint; state that in the output).

**Acceptance criteria**
- Check emits `fix: syncytium sync`; no false failure on fresh checkouts where
  mtimes are equal; engine unit test with crafted mtimes.
