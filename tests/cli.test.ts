import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist', 'cli', 'index.js');

async function tmpdir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-epipe-'));
}

/**
 * Runs the CLI with a stdout pipe that is destroyed as soon as the first chunk
 * arrives, mimicking `syncytium init | head -1` / `| findstr /B 1:`.
 */
function runWithClosedPipe(args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    child.stdout.once('data', () => {
      // The reader goes away mid-write, exactly like `head -1` does.
      child.stdout.destroy();
    });

    child.on('error', reject);
    child.on('close', code => {
      if (stderr.includes('EPIPE') || stderr.includes('write after end')) {
        reject(new Error(`CLI crashed on EPIPE:\n${stderr}`));
        return;
      }
      resolve(code ?? -1);
    });
  });
}

describe('CLI stdout robustness', () => {
  test('init still creates the workspace when stdout is closed early', async () => {
    const dir = await tmpdir();
    try {
      const code = await runWithClosedPipe(['init', 'Piped'], dir);
      assert.equal(code, 0, 'the process must exit cleanly, not crash');

      // The point of the fix: the side effect happens even though nobody
      // consumed the output. Previously the process died on an unhandled
      // EPIPE after printing its first line, leaving a half-written folder.
      const config = path.join(dir, '.syncytium', 'syncytium.config.json');
      await fs.access(config);
      const parsed = JSON.parse(await fs.readFile(config, 'utf-8'));
      assert.equal(parsed.projectName, 'Piped');

      for (const rel of [
        '.syncytium/rules/code-style.md',
        '.syncytium/architecture.md',
        '.syncytium/HANDOFF.md',
        '.syncytium/memory/decisions.md'
      ]) {
        await fs.access(path.join(dir, rel));
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test('sync still writes every bridge file when stdout is closed early', async () => {
    const dir = await tmpdir();
    try {
      await runWithClosedPipe(['init', 'Piped'], dir);
      const code = await runWithClosedPipe(['sync'], dir);
      assert.equal(code, 0);

      const cursorRules = await fs.readdir(path.join(dir, '.cursor', 'rules'));
      assert.ok(cursorRules.length >= 4, 'expected generated .mdc files');
      await fs.access(path.join(dir, 'CLAUDE.md'));
      await fs.access(path.join(dir, 'AGENTS.md'));
      await fs.access(path.join(dir, 'GEMINI.md'));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test('without a closed pipe nothing changes', async () => {
    const dir = await tmpdir();
    try {
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'init', 'Normal'], { cwd: dir });
        let data = '';
        child.stdout.on('data', c => {
          data += String(c);
        });
        child.on('error', reject);
        child.on('close', () => resolve(data));
      });
      assert.match(output, /Initializing SyncytiumMD/);
      await fs.access(path.join(dir, '.syncytium', 'syncytium.config.json'));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
