# Metrics dashboard — baseline & weekly log

Baselines below were verified live on **2026-11-15** (API calls in-session).
Update weekly, same weekday, using `scripts/weekly-metrics.ps1` outputs +
manual notes. Never interpolate between real data points.

## Verified baseline — 2026-11-15 (pre-launch)

| Signal | Value | Source |
|---|---|---|
| GitHub stars | 6 | api.github.com |
| Forks / subscribers | 1 / 0 | api.github.com |
| Open issues | 1 (all 9 incl. PRs are Dependabot) | api.github.com |
| npm monthly downloads | 913 (window 10-16 → 11-14) | api.npmjs.org |
| npm version / provenance | 0.3.1, OIDC provenance | registry check |
| MCP Registry listing | `io.github.mrcbrbn5361/syncytiummd` @0.3.1, **active** | registry.modelcontextprotocol.io |
| Hacker News mentions | 0 | hn.algolia.com search |
| Awesome-list mentions | 0 | GitHub search |
| Community (non-Dependabot) issues | 0 | api.github.com |
| Repo settings | homepage unset, Discussions off, wiki on | api.github.com |
| Tests | 129→132 (3 new CLI regression tests this session) | npm test |
| Owner followers | 3 | api.github.com |

Honest read: distribution ≈ 0; npm trickle exists without any launch. The
913 downloads cannot be attributed to real users (CI/npx/bots inflate npm by
design) — treat "unique users" as **unknown**, not 913.

## Weekly log (append rows)

| Week | ★ | Δ★ | forks | downloads | MCP installs | new issues/comments (community) | PRs merged (ext) | channel events | notes |
|---|---|---|---|---|---|---|---|---|---|
| W0 2026-11-15 | 6 | — | 1 | 913/mo | unknown | 0 | 0 | baseline set | demo assets + 3 bugfixes shipped |

## Channel ledger (fill on submission days)

| date | channel | url | 24h result | 7d result |
|---|---|---|---|---|

## Rules

- Stars ≠ users; downloads ≠ users. Report ranges or "unknown", never invented
  "active users".
- If growth stalls after a launch, investigate conversion (README bounce,
  install errors, Windows issues) before assuming "more promotion".
