# Minimal end-to-end demo: init → sync → graph → handoff

Runs entirely in a fresh temp dir, so it never touches your repo.

## CLI version (4 commands)

```bash
export DEMO_DIR="$(mktemp -d)"
cd "$DEMO_DIR"

npx syncytium-md init "minimal-demo" --template generic
npx syncytium-md sync
npx syncytium-md graph --no-open --json   # prints node/edge counts, no browser
npx syncytium-md handoff --from "demo" --to "demo-next" \
  -s ready_for_review -g "Demo goal" -d "init+sync done" -t "next step"
```

Expected: `sync` reports bridge files generated, `graph --json` reports at
least the rule/decision nodes, `handoff` prints the new baton state.

## Programmatic version (library)

```bash
node demo.mjs                 # fresh temp dir
node demo.mjs /tmp/my-demo    # explicit dir (created if missing)
```

`demo.mjs` calls the same engine methods the CLI wraps:
`init()` → `sync()` → `getKnowledgeGraph()` → `handoff()`, then prints a
one-line summary with counts. Requires the package built (`npm run build`
from the repo root) because it imports `../../dist/index.js`.
