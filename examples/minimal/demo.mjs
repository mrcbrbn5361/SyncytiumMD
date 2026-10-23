// Minimal init → sync → graph → handoff demo (library path).
// Runs in a fresh temp dir by default so it never touches the repo.
// Usage: node demo.mjs [target-dir]   (requires `npm run build` first)
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SyncytiumEngine } from '../../dist/index.js';

const target = process.argv[2] ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-minimal-')));
await fs.mkdir(target, { recursive: true });

const engine = new SyncytiumEngine(target);
await engine.init('minimal-demo', 'generic', true);
const syncResult = await engine.sync();
const graph = await engine.getKnowledgeGraph();
await engine.handoff({
  activeAgent: 'demo',
  nextAgent: 'demo-next',
  status: 'ready_for_review',
  goal: 'Demo goal',
  completed: ['init+sync done'],
  pending: ['next step']
});

console.log(
  `demo ok: dir=${target} files=${syncResult.count} ` +
    `nodes=${graph.nodes.length} edges=${graph.edges.length}`
);
