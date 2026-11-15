# Competitive intelligence — verified 2026-11-15

All numbers pulled live from the GitHub REST API + raw READMEs on the stated
date. Feature columns reflect README claims only, not audited behavior.
Re-verify before publishing anywhere.

| Repo | ★ | Last push | Core story | handoff | lease lock | CI drift gate | MCP server | reverse import | audit | graph UI |
|---|---|---|---|---|---|---|---|---|---|---|
| intellectronica/ruler | 2,974 | 2026-11-14 | rules → ~32 agents | ✗ | ✗ | ✗ | ✗ (propagates configs) | ✗ | ✗ | ✗ |
| dyoshikawa/rulesync | 1,610 | 2026-11-15 | 66 tool targets, skills/hooks/permissions, docs site, ≥100 releases | ✗ | ✗ | unclear | ✗ | ✓ import+convert | ✗ | ✗ |
| maxgfr/conforme | 5 | 2026-11-12 | Rust, `check` CI gate, migrate matrix, 14 tools | ✗ | ✗ | ✓ | ✗ | ✓ any-tool source | ✗ | ✗ |
| moneytool/agentmeld | 4 | 2026-11-05 | symlink-first, `sync --adopt` runtime adoption, `sync --check`, bundled action | ✗ | ✗ | ✓ | ✗ | ✓ strongest | ✗ | ✗ |
| yiftahb/agsync | 10 | 2026-09-27 | lockfile/registry semantics for skills (pinned, --frozen) | ✗ | ✗ | partial | ✗ | ✗ | ✗ | ✗ |
| alessandrobologna/agent-bus-mcp | 7 | 2026-08-16 | SQLite MCP message bus + replay web UI | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | partial |
| kristianrolando/cross-agent-handoff | 2 | 2026-11-09 | skill: HANDOFF.md checkpoints, advisory lock + takeover log | ✓✓ | ✓ advisory | ✗ | ✗ | ✗ | partial | ✗ |
| dan-calin/shared-agent-memory | 28 | 2026-08-03 | shared MCP memory graph + file claims board + block hook | ✓ | ✓ claims | ✗ | ✓ | ✗ | ✓ | headless |

(Names in `ruler` line corrected during verification: the prompt's
`electronlectronica/ruler` 404s; the real repo is **intellectronica/ruler**.)

## Strategic read

- Nobody spans **rules compilation + agent coordination**. The two camps
  don't even reference each other. That union is SyncytiumMD's only honest
  moat — say "first credible", not "first", forever.
- Rulesync/ruler win the coverage arms race; do NOT fight there. Our README
  must state our 10 adapters proudly-small, not apologetically.
- Coordination competitors (cross-agent-handoff, shared-agent-memory,
  agent-bus) validate demand and show the vocabulary buyers already use
  (checkpoint, takeover, claims, replay) — borrow the words.
- conforme + agentmeld: their CI-gate-as-headline marketing is proven and
  cheap — our `diff --check` is equivalent or better and currently buried.

## Three patterns to steal (not code)

1. **Evidence theater** (agentmeld, cross-agent-handoff): publish a
   `verified/unverified` adapter matrix, a "live trial" doc with explicit
   "not yet observed" rows, and a generous "Why not Rulesync?" table. Trust is
   the scarce good in this niche.
2. **Distribution machine** (rulesync): docs site later, but now: checkmark
   coverage table as README centerpiece, awesome-list badges once merged,
   per-week release notes even for tiny releases.
3. **CI gate as the demo** (conforme/agentmeld): the hero GIF's climax must be
   the red `diff --check` failure — none of the coordination tools can show
   that moment at all.

## Known metric baselines for comparison (2026-11-15)

- rulesync hit ~1,610★ in ~17 months with a docs site + daily releases.
- shared-agent-memory: 28★ in 4.5 months with zero marketing.
- 6★/10 weeks is NOT product judgment — it is absence of distribution (no HN
  record exists for "syncytium", zero awesome-list mentions, verified).
