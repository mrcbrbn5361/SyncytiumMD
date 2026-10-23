<!-- Keep it small: one concern per PR. Never hand-edit generated bridge files. -->

## What

## Why

## Verification

- [ ] `npm run typecheck`
- [ ] Changed module's tests (QA owns the broad suite)
- [ ] `node dist/cli/index.js lint`
- [ ] `node dist/cli/index.js diff` — zero drift (regenerated files committed together)
- [ ] `node dist/cli/index.js doctor` — no `error` checks

## Docs

- [ ] `README.md` **and** `README.tr.md` updated (public behaviour change)
- [ ] ADR added via `syncytium adr add` (architectural decision)
- [ ] Handoff updated before turn end (`syncytium handoff …`)
