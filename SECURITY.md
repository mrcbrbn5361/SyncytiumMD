# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| < 0.2.0 | No — please upgrade |

## Reporting a vulnerability

**Do not open a public issue.** Report privately via the repository's
[private vulnerability reporting](../../security/advisories/new) (preferred),
or email the maintainer listed in `package.json`.

Include: affected version, reproduction steps, and impact. We aim to
acknowledge within 72 hours and will coordinate a fix + release before any
public disclosure.

## Scope and boundaries

- The Obsidian Studio UI server (`syncytium ui` / `syncytium graph`) binds to
  `127.0.0.1` and rejects non-loopback `Host` headers (DNS-rebinding guard).
  Only use `--allow-remote` on a network you trust.
- `/api/file` never serves in-root secrets (`.env*`, `*.pem`, `*.key`,
  `id_rsa`, `.npmrc`, `.netrc`, …) or anything under `.git/`, and enforces a
  root-containment check on every path.
- `syncytium clean` deletes only files carrying the Syncytium banner; your
  hand-written files are never touched.
- MCP tool inputs are validated with zod. Never paste secrets into rules,
  ADRs, or handoff notes: stdout is the MCP JSON-RPC transport, so secrets
  must never be logged.

## Permissions and local access

- Syncytium reads the project workspace, `.syncytium/`, and git metadata; it writes
  only generated bridge files plus `.syncytium/` state.
- The tool itself requires no token. Any credential used by an MCP client must be
  supplied by the user through that client's `env` block and should be
  least-privilege and short-lived.
- The Obsidian Studio server binds to `127.0.0.1` unless `--allow-remote` is
  passed explicitly.
- `syncytium clean` removes only banner-tagged generated files.

## Network and data reach

- Runtime network access is limited to the optional Three.js load in Obsidian
  Studio, pinned to cdnjs 0.149.0 with an SRI hash.
- There is no telemetry, analytics, or automatic update check in the CLI or MCP
  server.
- npm installs and upgrades are user-controlled; pin `syncytium-md@<version>`
  instead of `@latest`.

## Version pinning

- Pin the exact package version in `.mcp.json`, CI, and lockfiles.
- Avoid `@latest` or unpinned `npx` invocations for production workflows.

## Hardening contributions are welcome

PRs that tighten path containment, UI escaping, secret redaction, or
dependency hygiene are prioritized. Please add a regression test that fails
without the fix and name the issue in the test description.
