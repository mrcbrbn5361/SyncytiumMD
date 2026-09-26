# Contributing to SyncytiumMD

Thanks for helping. This repository **eats its own dog food**: the canonical
rules in `.syncytium/rules/` are generated into every AI tool's instruction
file, so a change to a rule is a change to what every agent reads here.

## Setup

```bash
git clone https://github.com/mrcbrbn5361/SyncytiumMD.git
cd SyncytiumMD
npm install
npm run verify
```

Requires **Node.js 22.6+** (the test script uses
`node --experimental-strip-types`).

## The definition of done

```bash
npm run verify                # typecheck -> build -> test
node dist/cli/index.js lint   # canonical rules + frontmatter are valid
node dist/cli/index.js diff   # zero drift; commit the regenerated files
node dist/cli/index.js doctor # no error checks
```

`diff --check` exits non-zero on any drift, so the pre-commit hook and the CI
workflow can both fail. Never hand-edit a generated file: change
`.syncytium/` and run `syncytium sync`.

## Working agreement

1. Read `.syncytium/HANDOFF.md` first — it holds the live goal and pending work.
2. Take the lease so two agents do not edit the same files:
   `syncytium lock acquire --agent "<your name>"`.
3. Record architectural decisions as you make them:
   `syncytium adr add --title "..." --context "..." --decision "..." --consequences "..."`.
4. Release it and pass the baton before you finish:
   `syncytium handoff --from "<name>" -g "<goal>" -d "<done>" -t "<todo>"`.

## Code conventions

The full list lives in `.syncytium/rules/` and is enforced socially, not by a
linter plugin. The short version:

- `tsc` runs with `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
  `noImplicitReturns` and `verbatimModuleSyntax`. Do not silence these; fix the
  code.
- Comments explain **why**, never what. A comment restating the next line is
  noise; one explaining a non-obvious constraint or a bug workaround is required.
- New behaviour needs a test that fails without the change, with the regression
  named in the test description.
- If you touch a public command, flag or MCP tool, update `README.md` **and**
  `README.tr.md`.

## Adding an adapter

See `.syncytium/rules/adapter-standards.md`. In short: implement `AgentAdapter`,
stamp every `GeneratedFile` with your `adapterId`, emit a Syncytium banner, and
add a test that exercises `generate()` against a real `CanonicalContext`.

## Releasing

```bash
npm run release                 # verify -> publish -> CDN poll -> global install
node scripts/release.mjs --dry-run
node scripts/release.mjs --bump patch
```

`--bump` updates `package.json` and `src/version.ts` together; a unit test
asserts they stay in sync, so never edit either one by hand.
