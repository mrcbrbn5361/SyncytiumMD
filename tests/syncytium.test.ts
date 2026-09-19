import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  SyncytiumEngine,
  CursorAdapter,
  ClaudeCodeAdapter,
  GitHubCopilotAdapter,
  ClineAdapter,
  AntigravityAdapter,
  WindsurfAdapter,
  TraeAdapter,
  OpenCodeAdapter,
  createSyncytiumMcpServer
} from '../dist/index.js';

describe('SyncytiumMD Test Suite', () => {
  let tempDir: string;
  let engine: SyncytiumEngine;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-test-'));
    engine = new SyncytiumEngine(tempDir);
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('engine.init creates .syncytium and starter files', async () => {
    await engine.init('TestProject');
    const exists = await engine.storage.exists();
    assert.equal(exists, true);

    const rules = await engine.storage.loadRules();
    assert.ok(rules.length >= 3);

    const handoff = await engine.storage.loadHandoff();
    assert.equal(handoff.activeAgent, 'Human');
  });

  test('engine.sync generates bridge files for all enabled adapters', async () => {
    const result = await engine.sync();
    assert.ok(result.count >= 14);

    // Verify Cursor MDC files
    const cursorFile = await fs.readFile(path.join(tempDir, '.cursor/rules/code-style.mdc'), 'utf-8');
    assert.ok(cursorFile.includes('description:'));
    assert.ok(cursorFile.includes('Code Style Guidelines'));

    // Verify Claude.md
    const claudeFile = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeFile.includes('# CLAUDE.md - TestProject'));

    // Verify Copilot instructions
    const copilotFile = await fs.readFile(path.join(tempDir, '.github/copilot-instructions.md'), 'utf-8');
    assert.ok(copilotFile.includes('GitHub Copilot Instructions'));

    // Verify Cline rules
    const clineFile = await fs.readFile(path.join(tempDir, '.clinerules'), 'utf-8');
    assert.ok(clineFile.includes('Cline & Roo Code System Instructions'));

    // Verify Antigravity rules
    const antigravityFile = await fs.readFile(path.join(tempDir, '.gemini/antigravity/rules/code-style.md'), 'utf-8');
    assert.ok(antigravityFile.includes('Code Style'));

    // Verify Windsurf & Trae
    assert.ok(await fs.readFile(path.join(tempDir, '.windsurfrules'), 'utf-8'));
    assert.ok(await fs.readFile(path.join(tempDir, '.traerules'), 'utf-8'));

    // Verify AGENT.md
    assert.ok(await fs.readFile(path.join(tempDir, 'AGENT.md'), 'utf-8'));
  });

  test('engine.handoff updates state and propagates to bridge files', async () => {
    const updated = await engine.handoff({
      activeAgent: 'Antigravity',
      nextAgent: 'Cursor',
      status: 'in_progress',
      goal: 'Write REST endpoints',
      pending: ['Create /api/users route'],
      notes: 'Make sure to handle 404 cleanly'
    });

    assert.equal(updated.activeAgent, 'Antigravity');
    assert.equal(updated.nextAgent, 'Cursor');

    // Check that Cursor's handoff rule is updated
    const cursorHandoff = await fs.readFile(path.join(tempDir, '.cursor/rules/syncytium-handoff.mdc'), 'utf-8');
    assert.ok(cursorHandoff.includes('Next: `Cursor`'));
    assert.ok(cursorHandoff.includes('Create /api/users route'));
  });

  test('engine.addDecision records an ADR and syncs', async () => {
    await engine.addDecision({
      id: 'ADR-002',
      title: 'Use Fastify over Express',
      status: 'accepted',
      date: '2026-09-19',
      context: 'Need high throughput for microservices.',
      decision: 'Selected Fastify framework.',
      consequences: 'Requires Fastify plugin ecosystem.'
    });

    const decisions = await engine.storage.loadDecisions();
    assert.ok(decisions.some(d => d.id === 'ADR-002'));

    // Check that CLAUDE.md mentions the decision
    const claudeFile = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeFile.includes('[ADR-002] Use Fastify over Express'));
  });

  test('engine.diff detects modified files, missing files, and synchronized state', async () => {
    // Simulate drift: modify CLAUDE.md and delete a file
    const claudePath = path.join(tempDir, 'CLAUDE.md');
    await fs.writeFile(claudePath, '# Modified outdated content');

    const diffBefore = await engine.diff();
    assert.equal(diffBefore.hasDrift, true);
    assert.ok(diffBefore.summary.modified >= 1);

    // After sync: all files should be identical
    await engine.sync();
    const diffAfter = await engine.diff();
    assert.equal(diffAfter.hasDrift, false);
    assert.ok(diffAfter.summary.identical > 0);
    assert.equal(diffAfter.summary.missingOnDisk, 0);
    assert.equal(diffAfter.summary.modified, 0);
  });

  test('engine.doctor performs comprehensive health check', async () => {
    const report = await engine.doctor();
    assert.ok(['healthy', 'warning'].includes(report.overallStatus));
    assert.ok(report.checks.length >= 5);
    assert.equal(report.stats.rulesCount >= 3, true);
    assert.equal(report.stats.enabledAdaptersCount >= 8, true);
    assert.ok(report.checks.some(c => c.name.includes('Root Directory') && c.status === 'ok'));
    assert.ok(report.checks.some(c => c.name.includes('Live Agent Handoff') && c.status === 'ok'));
  });

  test('engine.getHandoffHistory records and returns audit trail', async () => {
    const history = await engine.getHandoffHistory(5);
    assert.ok(history.length >= 1);
    assert.ok(history[0].id.startsWith('HND-'));
    assert.equal(history[0].toAgent, 'Cursor');
    assert.equal(history[0].status, 'in_progress');
  });

  test('engine.lint validates project rules and context', async () => {
    const report = await engine.lint();
    assert.equal(report.valid, true);
    assert.ok(report.totalChecked >= 4);
    assert.equal(report.issues.filter(i => i.type === 'error').length, 0);
  });

  test('engine.installGitHook and uninstallGitHook manage pre-commit hook', async () => {
    const gitDir = path.join(tempDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });

    const installRes = await engine.installGitHook({ autoSync: true });
    assert.equal(installRes.success, true);
    const hookContent = await fs.readFile(installRes.hookPath, 'utf-8');
    assert.ok(hookContent.includes('BEGIN SYNCYTIUM HOOK'));
    assert.ok(hookContent.includes('syncytium sync'));

    const uninstallRes = await engine.uninstallGitHook();
    assert.equal(uninstallRes.success, true);
    const hookExists = await fs.access(uninstallRes.hookPath).then(() => true).catch(() => false);
    assert.equal(hookExists, false);
  });

  test('engine.importExisting reverse-migrates legacy rule files', async () => {
    const importDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-import-test-'));
    try {
      const importEngine = new SyncytiumEngine(importDir);

      // Create legacy rule files
      await fs.writeFile(
        path.join(importDir, 'CLAUDE.md'),
        '# Legacy Claude Rules\nAlways write tests first and adhere to TypeScript strict mode.'
      );
      await fs.writeFile(
        path.join(importDir, '.clinerules'),
        '# Legacy Cline Rules\nDo not execute rm -rf on project root.'
      );

      const report = await importEngine.importExisting();
      assert.equal(report.importedCount, 2);
      assert.ok(report.items.some(i => i.sourceFile === 'CLAUDE.md'));
      assert.ok(report.items.some(i => i.sourceFile === '.clinerules'));

      // Verify canonical rules created
      const importedClaude = await fs.readFile(
        path.join(importDir, '.syncytium', 'rules', 'imported-claude.md'),
        'utf-8'
      );
      assert.ok(importedClaude.includes('Always write tests first'));

      const importedCline = await fs.readFile(
        path.join(importDir, '.syncytium', 'rules', 'imported-cline.md'),
        'utf-8'
      );
      assert.ok(importedCline.includes('Do not execute rm -rf'));
    } finally {
      await fs.rm(importDir, { recursive: true, force: true });
    }
  });

  test('engine.detectStack and stack templates work accurately', async () => {
    // Without manifest in tempDir, defaults to generic
    assert.equal(await engine.detectStack(), 'generic');

    // In workspace root with package.json, accurately detects typescript
    const rootEngine = new SyncytiumEngine(process.cwd());
    assert.equal(await rootEngine.detectStack(), 'typescript');

    // Test Python stack initialization in separate directory
    const pyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-py-'));
    try {
      const pyEngine = new SyncytiumEngine(pyDir);
      await pyEngine.init('PythonApp', 'python');
      const rules = await pyEngine.storage.loadRules();
      assert.ok(rules.some(r => r.id === 'code-style' && r.tags?.includes('pep8')));
    } finally {
      await fs.rm(pyDir, { recursive: true, force: true });
    }
  });

  test('.syncytiumignore excludes specified files from generation and diff', async () => {
    // Create .syncytiumignore targeting .traerules and .windsurfrules
    const ignoreFile = path.join(tempDir, '.syncytiumignore');
    await fs.writeFile(ignoreFile, '.traerules\n.windsurfrules\n# comment\n');

    const syncRes = await engine.sync();
    assert.ok(!syncRes.paths.some(p => p.endsWith('.traerules')));
    assert.ok(!syncRes.paths.some(p => p.endsWith('.windsurfrules')));

    const diffRes = await engine.diff();
    assert.ok(!diffRes.items.some(i => i.relativePath === '.traerules'));
    assert.ok(!diffRes.items.some(i => i.relativePath === '.windsurfrules'));

    // Cleanup ignore file
    await fs.rm(ignoreFile, { force: true });
  });

  test('engine.installCiWorkflow generates GitHub Actions workflow', async () => {
    const ciRes = await engine.installCiWorkflow();
    assert.equal(ciRes.success, true);
    const content = await fs.readFile(ciRes.path, 'utf-8');
    assert.ok(content.includes('syncytium lint'));
    assert.ok(content.includes('syncytium diff'));
  });

  test('MCP server registers all tools including get_history, lint, and diff', async () => {
    const { server } = createSyncytiumMcpServer(tempDir);
    assert.ok(server);
  });

  test('multi-agent lock prevents concurrent collisions with lease expiration', async () => {
    // Initial status: unlocked
    const initial = await engine.getLockStatus();
    assert.equal(initial.locked, false);

    // Acquire lock by Cursor
    const acq1 = await engine.acquireLock('Cursor', 'Refactoring auth module', 60);
    assert.equal(acq1.acquired, true);
    assert.equal(acq1.lock.agent, 'Cursor');

    // Status check
    const status1 = await engine.getLockStatus();
    assert.equal(status1.locked, true);
    assert.equal(status1.agent, 'Cursor');
    assert.equal(status1.isExpired, false);

    // Another agent (Claude) attempts to acquire without force -> rejected
    const acq2 = await engine.acquireLock('Claude', 'Fixing CSS', 30);
    assert.equal(acq2.acquired, false);
    assert.ok(acq2.message?.includes('currently locked by \'Cursor\''));

    // Claude attempts to release Cursor's lock without force -> rejected
    const rel1 = await engine.releaseLock('Claude', false);
    assert.equal(rel1.released, false);

    // Cursor releases its own lock -> success
    const rel2 = await engine.releaseLock('Cursor', false);
    assert.equal(rel2.released, true);

    const status2 = await engine.getLockStatus();
    assert.equal(status2.locked, false);

    // Acquire and force release
    await engine.acquireLock('AgentX', 'Experiment', 10);
    const relForce = await engine.releaseLock('AgentY', true);
    assert.equal(relForce.released, true);
    const status3 = await engine.getLockStatus();
    assert.equal(status3.locked, false);
  });

  test('engine.lint({ fix: true }) auto-renames files to kebab-case and heals frontmatter', async () => {
    const brokenRulePath = path.join(tempDir, '.syncytium', 'rules', 'BadFileName.md');
    await fs.writeFile(brokenRulePath, '# Non-compliant body without frontmatter\nSome content.');

    // Lint without fix detects issues
    const lintBefore = await engine.lint({ fix: false });
    assert.ok(lintBefore.issues.some(i => i.message.includes('kebab-case')));

    // Lint with fix repairs it
    const lintAfter = await engine.lint({ fix: true });
    assert.ok(lintAfter.fixedCount && lintAfter.fixedCount > 0);

    // Verify file was renamed to kebab-case
    await assert.rejects(fs.access(brokenRulePath));
    const fixedRulePath = path.join(tempDir, '.syncytium', 'rules', 'bad-file-name.md');
    const fixedContent = await fs.readFile(fixedRulePath, 'utf-8');
    assert.ok(fixedContent.includes('id: bad-file-name'));
    assert.ok(fixedContent.includes('title: Bad File Name'));

    // Cleanup
    await fs.rm(fixedRulePath, { force: true });
  });

  test('engine.listRules searches canonical rules catalog', async () => {
    const allRules = await engine.listRules();
    assert.ok(allRules.length >= 3);

    const filtered = await engine.listRules('style');
    assert.ok(filtered.length >= 1);
    assert.ok(filtered.some(r => r.id === 'code-style'));

    const nonExistent = await engine.listRules('nonexistentquery12345');
    assert.equal(nonExistent.length, 0);
  });

  test('engine.getKnowledgeGraph returns structured nodes, edges and stats', async () => {
    const graph = await engine.getKnowledgeGraph();
    assert.ok(graph.nodes.length >= 5);
    assert.ok(graph.edges.length >= 4);

    // Verify root node
    const root = graph.nodes.find(n => n.type === 'root');
    assert.ok(root);

    // Verify rule nodes
    const ruleNodes = graph.nodes.filter(n => n.type === 'rule');
    assert.ok(ruleNodes.length >= 3);

    // Verify stats
    assert.ok(graph.stats.rulesCount >= 3);
    assert.ok(graph.stats.bridgeFilesCount >= 1);
  });

  test('engine.getKnowledgeGraph supports compact, excludeFiles, and excludeTags options', async () => {
    // Normal graph has files and tags
    const fullGraph = await engine.getKnowledgeGraph();
    const hasFiles = fullGraph.nodes.some(n => n.type === 'file');
    const hasTags = fullGraph.nodes.some(n => n.type === 'tag');

    // Compact mode: omits both files and tags
    const compactGraph = await engine.getKnowledgeGraph({ compact: true });
    assert.equal(compactGraph.nodes.some(n => n.type === 'file'), false);
    assert.equal(compactGraph.nodes.some(n => n.type === 'tag'), false);
    assert.ok(compactGraph.nodes.length < fullGraph.nodes.length);
    assert.ok(compactGraph.nodes.some(n => n.type === 'root'));
    assert.ok(compactGraph.nodes.some(n => n.type === 'rule'));

    // excludeFiles only
    const noFilesGraph = await engine.getKnowledgeGraph({ excludeFiles: true });
    assert.equal(noFilesGraph.nodes.some(n => n.type === 'file'), false);
    if (hasTags) {
      assert.equal(noFilesGraph.nodes.some(n => n.type === 'tag'), true);
    }

    // excludeTags only
    const noTagsGraph = await engine.getKnowledgeGraph({ excludeTags: true });
    assert.equal(noTagsGraph.nodes.some(n => n.type === 'tag'), false);
    if (hasFiles) {
      assert.equal(noTagsGraph.nodes.some(n => n.type === 'file'), true);
    }
  });

  test('engine.startUiServer starts local server and exposes /api/graph and UI', async () => {
    const ui = await engine.startUiServer({ port: 3899, open: false });
    assert.equal(ui.port, 3899);
    assert.ok(ui.url.includes('3899'));

    try {
      const res = await fetch(`http://localhost:3899/api/graph`);
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.nodes.length >= 5);

      const htmlRes = await fetch(`http://localhost:3899/`);
      assert.equal(htmlRes.status, 200);
      const html = await htmlRes.text();
      assert.ok(html.includes('SyncytiumMD Knowledge Graph'));
    } finally {
      await ui.close();
    }
  });

  test('engine.clean safely removes bridge files', async () => {
    const cleaned = await engine.clean();
    assert.ok(cleaned.length > 0);

    // .syncytium must remain intact
    const exists = await engine.storage.exists();
    assert.equal(exists, true);

    // Generated files must be removed
    await assert.rejects(fs.access(path.join(tempDir, 'CLAUDE.md')));
    await assert.rejects(fs.access(path.join(tempDir, '.clinerules')));
  });
});
