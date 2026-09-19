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
  OpenCodeAdapter
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
