import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { request as httpRequest } from 'node:http';
import {
  SyncytiumEngine,
  CursorAdapter,
  GitHubCopilotAdapter,
  ClineAdapter,
  AgentsAdapter,
  GeminiAdapter,
  GenericAdapter,
  createSyncytiumMcpServer,
  VERSION,
  slugify,
  isIgnored,
  compileGlob,
  isInsideRoot,
  createUnifiedDiff,
  renderMarkdownToHtml,
  escapeHtml,
  getRulesForStack,
  getArchitectureForStack,
  normalizeStack,
  listSupportedStacks,
  renderGraphHtml,
  escapeHtmlAttribute,
  serializeForScript,
  SyncytiumConfigSchema
} from '../dist/index.js';

async function tmpdir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('SyncytiumMD v0.2.0 — full test suite', () => {
  let tempDir: string;
  let engine: SyncytiumEngine;

  before(async () => {
    tempDir = await tmpdir('syncytium-test-');
    engine = new SyncytiumEngine(tempDir);
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ======================================================================
  describe('paths: slugify / glob / containment', () => {
    test('slugify neutralises path traversal and illegal filename chars', () => {
      assert.equal(slugify('../../etc/passwd'), 'etc-passwd');
      assert.equal(slugify('a/b\\c'), 'a-b-c');
      assert.equal(slugify('My Cool Rule!'), 'my-cool-rule');
      // camelCase must be split, otherwise a kebab-case "fix" on a
      // case-insensitive filesystem is a silent no-op.
      assert.equal(slugify('BadFileName'), 'bad-file-name');
      assert.equal(slugify('ADR-001'), 'adr-001');
      assert.equal(slugify('tsconfig.json'), 'tsconfig.json');
      assert.equal(slugify(''), 'rule');
      assert.equal(slugify('   '), 'rule');
      assert.equal(slugify('CON'), 'con-file', 'windows reserved device name');
      assert.equal(slugify('..'), 'rule');
      assert.equal(slugify('.hidden'), 'hidden');
    });

    test('slugify output can never contain a path separator or traversal', () => {
      const hostile = [
        '../../x',
        '..\\..\\windows\\system32',
        'a/../../b',
        './x',
        'foo/../bar',
        '....//....//etc'
      ];
      for (const input of hostile) {
        const out = slugify(input, 'rule');
        assert.ok(!out.includes('/'), `${input} -> ${out}`);
        assert.ok(!out.includes('\\'), `${input} -> ${out}`);
        assert.ok(!out.includes('..'), `${input} -> ${out}`);
      }
    });

    test('glob matching follows gitignore semantics, not substring matching', () => {
      // The v0.1.x implementation used rel.includes(pat), so a pattern named
      // "rules" also matched .clinerules / .cursorrules / .windsurfrules.
      assert.equal(isIgnored('.clinerules', ['rules']).ignored, false);
      assert.equal(isIgnored('.cursorrules', ['rules']).ignored, false);
      assert.equal(isIgnored('.windsurfrules', ['rules']).ignored, false);
      assert.equal(isIgnored('.traerules', ['rules']).ignored, false);
      assert.equal(isIgnored('.clinerules', ['*rules']).ignored, true, 'wildcards still work');
      // Real gitignore semantics: a bare `rules` DOES match the directory and
      // everything under it, at any depth.
      assert.equal(isIgnored('.cursor/rules/a.mdc', ['rules']).ignored, true);
      assert.equal(isIgnored('.cursor/rules/a.mdc', ['.cursor/rules/']).ignored, true);
      assert.equal(isIgnored('.cursor/rules/a.mdc', ['.cursor/rules']).ignored, true);
    });

    test('glob matching supports ** , ? , dir-only and negation', () => {
      assert.equal(isIgnored('a/b/c.md', ['**/*.md']).ignored, true);
      assert.equal(isIgnored('a/b/c.ts', ['**/*.md']).ignored, false);
      assert.equal(isIgnored('src/file1.ts', ['src/file?.ts']).ignored, true);
      assert.equal(isIgnored('src/file12.ts', ['src/file?.ts']).ignored, false);
      assert.equal(isIgnored('build/x/y.js', ['build/']).ignored, true);
      assert.equal(isIgnored('build', ['build/']).ignored, true);
      // Last match wins, like git.
      assert.equal(isIgnored('keep.md', ['*.md', '!keep.md']).ignored, false);
      assert.equal(isIgnored('drop.md', ['*.md', '!keep.md']).ignored, true);
      assert.equal(isIgnored('x.md', ['# comment', '']).ignored, false);
    });

    test('isIgnored matches nested basenames at any depth', () => {
      assert.equal(isIgnored('node_modules/x/y.js', ['node_modules']).ignored, true);
      assert.equal(isIgnored('a/b/node_modules/c.js', ['node_modules']).ignored, true);
    });

    test('compileGlob caches and produces stable matchers', () => {
      const a = compileGlob('**/*.md');
      const b = compileGlob('**/*.md');
      assert.equal(a, b, 'matcher should be cached');
    });

    test('isInsideRoot blocks sibling-prefix escapes', () => {
      assert.equal(isInsideRoot('/a/b', '/a/b/c'), true);
      assert.equal(isInsideRoot('/a/b', '/a/b'), true);
      assert.equal(isInsideRoot('/a/b', '/a/bc'), false);
      assert.equal(isInsideRoot('/a/b', '/a/../etc/passwd'), false);
    });
  });

  // ======================================================================
  describe('diff: unified patch generation', () => {
    test('reports zero changes for identical text', () => {
      const r = createUnifiedDiff('a.md', 'one\ntwo\n', 'one\ntwo\n');
      assert.equal(r.changedLines, 0);
      assert.equal(r.patch, '');
    });

    test('produces a hunk with -/+ lines and a stable header', () => {
      const r = createUnifiedDiff('a.md', 'one\ntwo\nthree\n', 'one\nTWO\nthree\n');
      assert.equal(r.changedLines, 2);
      assert.match(r.patch, /^--- a\/a\.md\n\+\+\+ b\/a\.md \(syncytium generated\)/);
      assert.match(r.patch, /-two/);
      assert.match(r.patch, /\+TWO/);
    });

    test('detects pure additions and pure deletions', () => {
      assert.equal(createUnifiedDiff('a', '', 'x\ny\n').changedLines, 2);
      assert.equal(createUnifiedDiff('a', 'x\ny\n', '').changedLines, 2);
    });

    test('truncates very large diffs and says so', () => {
      const oldText = Array.from({ length: 400 }, (_, i) => `line ${i}`).join('\n');
      const newText = Array.from({ length: 400 }, (_, i) => `LINE ${i}`).join('\n');
      const r = createUnifiedDiff('big.md', oldText, newText, { maxHunkLines: 20 });
      assert.equal(r.truncated, true);
      assert.ok(r.patch.includes('diff truncated'));
    });

    test('normalises CRLF so Windows checkouts do not show phantom drift', () => {
      assert.equal(createUnifiedDiff('a', 'x\r\ny', 'x\ny').changedLines, 0);
    });
  });

  // ======================================================================
  describe('markdown: canonical renderer (XSS + parser regressions)', () => {
    test('escapes raw HTML so rule content can never inject markup', () => {
      const html = renderMarkdownToHtml('<img src=x onerror=alert(1)>');
      assert.ok(!html.includes('<img'));
      assert.ok(html.includes('&lt;img'));
    });

    test('escapes script tags and javascript: URLs', () => {
      const html = renderMarkdownToHtml('<script>alert(1)</script>');
      assert.ok(!html.toLowerCase().includes('<script'));
    });

    test('fenced code blocks are preserved verbatim', () => {
      // v0.1.x built this regex with new RegExp('...([\\s\\S]*?)...') from a
      // string literal, so `\\s` degraded to [sS] and the rule never matched.
      const html = renderMarkdownToHtml('```ts\nconst a = 1;\n# not a header\n- not a list\n```');
      assert.ok(html.includes('<pre><code>'), 'fence should render as <pre>');
      assert.ok(html.includes('const a = 1;'));
      assert.ok(!html.includes('<h1>'), 'headers must not be parsed inside code');
      assert.ok(!html.includes('<li>'), 'lists must not be parsed inside code');
      assert.ok(html.includes('md-lang'), 'language hint should be captured');
    });

    test('blockquotes render as blockquote, not as raw entity text', () => {
      // v0.1.x ran the blockquote rule *after* escaping, so ">" was already
      // "&gt;" and the rule could never match.
      const html = renderMarkdownToHtml('> this is a quote');
      assert.ok(html.includes('<blockquote>'), html);
      assert.ok(html.includes('this is a quote'));
      assert.ok(!html.includes('&gt; this is a quote'));
    });

    test('unordered lists are wrapped in a real <ul>', () => {
      const html = renderMarkdownToHtml('- first\n- second\n- third');
      assert.equal((html.match(/<ul>/g) ?? []).length, 1);
      assert.equal((html.match(/<li>/g) ?? []).length, 3);
    });

    test('inline code protects emphasis markers', () => {
      const html = renderMarkdownToHtml('use `**not bold**` here');
      assert.ok(html.includes('<code>**not bold**</code>'));
      assert.ok(!html.includes('<strong>'));
    });

    test('horizontal rules are not converted into list items', () => {
      const html = renderMarkdownToHtml('before\n\n---\n\nafter');
      assert.ok(html.includes('<hr />'));
      assert.ok(!html.includes('<li>'));
    });

    test('headings and emphasis still work', () => {
      const html = renderMarkdownToHtml('# H1\n## H2\n### H3\n**bold** and *italic*');
      assert.ok(html.includes('<h1>H1</h1>'));
      assert.ok(html.includes('<h2>H2</h2>'));
      assert.ok(html.includes('<h3>H3</h3>'));
      assert.ok(html.includes('<strong>bold</strong>'));
      assert.ok(html.includes('<em>italic</em>'));
    });

    test('escapeHtml keeps falsy-but-real values visible', () => {
      assert.equal(escapeHtml(0), '0');
      assert.equal(escapeHtml(false), 'false');
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
      assert.equal(escapeHtml("a'b\"c&d<e>f"), 'a&#39;b&quot;c&amp;d&lt;e&gt;f');
    });

    test('empty input returns an empty string', () => {
      assert.equal(renderMarkdownToHtml(''), '');
      assert.equal(renderMarkdownToHtml(null as unknown as string), '');
    });
  });

  // ======================================================================
  describe('UI HTML: injection hardening', () => {
    test('projectName cannot break out of <title>', () => {
      const html = renderGraphHtml('</title><img src=x onerror=alert(1)>');
      assert.ok(!html.includes('</title><img'));
      assert.ok(html.includes('&lt;/title&gt;'));
    });

    test('projectName in the header badge is escaped', () => {
      const html = renderGraphHtml('<script>bad()</script>');
      const badge = html.match(/<span class="version-tag">([^<]*)</);
      assert.ok(badge, 'version-tag should exist');
      assert.ok(!badge[1].includes('<'));
    });

    test('inline initialConfig cannot terminate the <script> block', () => {
      // serializeForScript must escape anything that could close the block.
      const hostile = serializeForScript({ category: '</script><img src=x onerror=alert(1)>' });
      assert.ok(!hostile.includes('</script>'), hostile);
      assert.ok(hostile.includes('\\u003c'), 'angle brackets must be unicode-escaped');
      assert.ok(!hostile.includes('<'));

      // A U+2028 line separator is a literal newline in JS source.
      const lineSep = serializeForScript({ note: 'a\u2028b' });
      assert.ok(!lineSep.includes('\u2028'));
      assert.ok(lineSep.includes('\\u2028'));

      // And the whole payload must be allow-listed anyway.
      const html = renderGraphHtml('p', { category: '</script><img src=x onerror=alert(1)>' });
      const m = html.match(/const initialConfig = (.*);/);
      assert.ok(m, 'initialConfig should be assigned');
      assert.ok(!m![1].includes('</script>'), m![1]);
      assert.ok(m![1].includes('"category":"all"'));
    });

    test('an unknown --category value falls back to "all"', () => {
      const html = renderGraphHtml('p', { category: '../../etc/passwd' });
      assert.ok(html.includes('"category":"all"'), 'category must be allow-listed');
    });

    test('the injected markdown renderer is the canonical one', () => {
      const html = renderGraphHtml('p');
      assert.ok(html.includes('function renderMarkdownToHtml'), 'renderer must be inlined');
      assert.ok(html.includes('function escapeHtml'), 'escapeHtml must be inlined');
      assert.ok(!html.includes('onclick="selectNodeById'), 'inline onclick must be gone');
      assert.ok(!html.includes('window.selectNodeById'), 'no leaked global');
      assert.ok(!html.includes('window.toggleFolder'), 'no leaked global');
    });

    test('escapeHtmlAttribute neutralises attribute and tag breakouts', () => {
      assert.equal(escapeHtmlAttribute('a"b'), 'a&quot;b');
      assert.equal(escapeHtmlAttribute("a'b"), 'a&#39;b');
      assert.equal(escapeHtmlAttribute('<b>'), '&lt;b&gt;');
      assert.equal(escapeHtmlAttribute('a&b'), 'a&amp;b');
    });

    test('the version is passed in rather than hardcoded in the template', () => {
      const html = renderGraphHtml('p', {}, { version: '9.9.9' });
      assert.ok(html.includes('9.9.9'));
      assert.ok(!html.includes('0.1.9'));
    });
  });

  // ======================================================================
  describe('templates: stack coverage', () => {
    test('every stack advertised by --template has real rules', () => {
      // v0.1.x documented `--template rust` but shipped no RUST_RULES, so rust
      // silently fell through to the generic TypeScript-ish default.
      for (const stack of listSupportedStacks()) {
        const rules = getRulesForStack(stack);
        assert.ok(rules.length >= 3, `${stack} should seed >= 3 rules, got ${rules.length}`);
        assert.ok(
          rules.some(r => r.tags?.some(t => t === stack || t === 'rust' || t === 'go' || t === 'python')) ||
            stack === 'generic' || stack === 'javascript',
          `${stack} rules should be stack-specific`
        );
        for (const r of rules) {
          assert.ok(r.id && r.title && r.content, `${stack}/${r.id} incomplete`);
        }
      }
    });

    test('normalizeStack resolves aliases and rejects unknown values', () => {
      assert.equal(normalizeStack('TS'), 'typescript');
      assert.equal(normalizeStack('golang'), 'go');
      assert.equal(normalizeStack('rs'), 'rust');
      assert.equal(normalizeStack('c#'), 'generic');
      assert.equal(normalizeStack(undefined), 'generic');
    });

    test('architecture seed is stack-aware', () => {
      const rust = getArchitectureForStack('rust', 'MyProj');
      assert.ok(rust.includes('Rust'));
      assert.ok(rust.includes('MyProj'));
      const py = getArchitectureForStack('python', 'P');
      assert.ok(py.includes('Python'));
    });
  });

  // ======================================================================
  describe('config: zod validation and safe fallbacks', () => {
    test('SyncytiumConfigSchema fills every default', () => {
      const cfg = SyncytiumConfigSchema.parse({ projectName: 'X' });
      assert.equal(cfg.version, '2.0.0');
      assert.ok(cfg.enabledAdapters.length > 0);
      assert.deepEqual(cfg.customAdapters, []);
      assert.equal(cfg.options.pruneOrphans, true);
      assert.equal(cfg.options.enforceLock, false);
    });

    test('a broken config surfaces issues instead of silently defaulting', async () => {
      const dir = await tmpdir('syncytium-badcfg-');
      try {
        await fs.mkdir(path.join(dir, '.syncytium'), { recursive: true });
        await fs.writeFile(
          path.join(dir, '.syncytium', 'syncytium.config.json'),
          '{ this is not json'
        );
        const e = new SyncytiumEngine(dir);
        const { usedDefaults, issues, config } = await e.storage.loadConfigDetailed();
        assert.equal(usedDefaults, true);
        assert.ok(issues.length > 0, 'issues must be reported');
        assert.ok(config.projectName.length > 0, 'must still return a usable config');
        // doctor used to have a dead try/catch because loadConfig never threw.
        const report = await e.doctor();
        const cfgCheck = report.checks.find(c => c.id === 'config');
        assert.equal(cfgCheck?.status, 'error');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('loadConfig never hands back the shared DEFAULT_CONFIG object', async () => {
      const dir = await tmpdir('syncytium-alias-');
      try {
        const e = new SyncytiumEngine(dir);
        const a = await e.storage.loadConfig();
        const b = await e.storage.loadConfig();
        a.enabledAdapters.push('MUTATED');
        assert.ok(!b.enabledAdapters.includes('MUTATED'), 'configs must not alias');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('a bad adapter id in config is reported by validate and doctor', async () => {
      const dir = await tmpdir('syncytium-badadapter-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const cfg = await e.storage.loadConfig();
        cfg.enabledAdapters.push('does-not-exist');
        await e.storage.saveConfig(cfg);
        const v = await e.validate();
        assert.equal(v.valid, false);
        const report = await e.doctor();
        assert.equal(report.checks.find(c => c.id === 'adapters')?.status, 'error');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('customAdapters declared in config become real adapters', async () => {
      const dir = await tmpdir('syncytium-custom-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const cfg = await e.storage.loadConfig();
        // Only the three required fields; the schema fills the rest.
        cfg.customAdapters = [
          { id: 'mytool', name: 'My Tool', targetFile: 'MYTOOL.md' }
        ] as typeof cfg.customAdapters;
        cfg.enabledAdapters.push('mytool');
        await e.storage.saveConfig(cfg);

        const res = await e.sync();
        assert.ok(res.paths.includes('MYTOOL.md'), JSON.stringify(res.paths));
        const content = await fs.readFile(path.join(dir, 'MYTOOL.md'), 'utf-8');
        assert.ok(content.includes('AUTO-GENERATED BY SYNCYTIUM'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: init / sync', () => {
    before(async () => {
      await engine.init('TestProject', 'generic');
    });

    test('engine.init creates .syncytium and starter files', async () => {
      const dir = await tmpdir('syncytium-init-');
      try {
        const e = new SyncytiumEngine(dir);
        const { stack } = await e.init('TestProject', 'typescript');
        assert.equal(stack, 'typescript');
        assert.equal(await e.storage.exists(), true);
        const rules = await e.storage.loadRules();
        assert.ok(rules.length >= 4);
        assert.ok(rules.some(r => r.id === 'typescript-strictness'));
        const handoff = await e.storage.loadHandoff();
        assert.equal(handoff.activeAgent, 'Human');
        // architecture must be seeded for the requested stack
        const arch = await e.storage.loadArchitecture();
        assert.ok(arch.includes('TypeScript'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('init refuses to clobber unless --force is passed', async () => {
      const dir = await tmpdir('syncytium-init2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        await assert.rejects(() => e.init('B', 'generic'), /already exists/);
        await e.init('B', 'generic', true);
        assert.equal((await e.storage.loadConfig()).projectName, 'B');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('init honours stack auto-detection', async () => {
      const dir = await tmpdir('syncytium-detect-');
      try {
        await fs.writeFile(path.join(dir, 'Cargo.toml'), '[package]\nname="x"\n');
        const e = new SyncytiumEngine(dir);
        assert.equal(await e.detectStack(), 'rust');
        const { stack } = await e.init('R', undefined);
        assert.equal(stack, 'rust');
        assert.ok((await e.storage.loadRules()).some(r => r.tags?.includes('rust')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('sync generates bridge files for all enabled adapters', async () => {
      const res = await engine.sync();
      assert.ok(res.count >= 20, `expected >= 20 files, got ${res.count}`);

      for (const rel of [
        'CLAUDE.md',
        'AGENT.md',
        'CONVENTIONS.md',
        'AGENTS.md',
        'GEMINI.md',
        '.clinerules',
        '.roomodes',
        '.cursorrules',
        '.windsurfrules',
        '.traerules',
        '.github/copilot-instructions.md',
        '.cursor/rules/code-style.mdc',
        '.cursor/rules/syncytium-handoff.mdc',
        '.gemini/antigravity/rules/handoff.md'
      ]) {
        const content = await fs.readFile(path.join(tempDir, rel), 'utf-8');
        assert.ok(content.includes('AUTO-GENERATED BY SYNCYTIUM'), `${rel} missing banner`);
      }

      const copilotInstr = await fs.readFile(
        path.join(tempDir, '.github/instructions/testing-standards.instructions.md'),
        'utf-8'
      );
      assert.ok(copilotInstr.includes('applyTo:'));
      assert.ok(copilotInstr.includes('**/*.test.*'));

      // The Gemini adapter must not invent keys in the CLI-owned settings.json.
      const geminiSettingsExists = await fs
        .access(path.join(tempDir, '.gemini/settings.json'))
        .then(() => true, () => false);
      assert.equal(geminiSettingsExists, false);
    });

    test('generated paths never escape the workspace even with a hostile rule id', async () => {
      const dir = await tmpdir('syncytium-evil-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('Evil', 'generic');
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'evil.md'),
          '---\nid: "../../../../escaped"\ntitle: Evil\nalwaysApply: true\nglobs: []\ntags: []\n---\n\nbody\n'
        );
        const res = await e.sync();
        for (const p of res.paths) {
          assert.ok(!p.includes('..'), `path escaped: ${p}`);
          assert.ok(!path.isAbsolute(p), `absolute path: ${p}`);
        }
        await assert.rejects(fs.access(path.join(dir, '..', 'escaped.mdc')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('sync prunes orphans left behind by a deleted rule', async () => {
      const dir = await tmpdir('syncytium-prune-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addRule({ id: 'temp-rule', title: 'Temp', body: 'temp body' });
        const generated = path.join(dir, '.cursor', 'rules', 'temp-rule.mdc');
        await fs.access(generated);

        // Before pruning, diff must surface the file as an orphan.
        const beforeDiff = await e.diff();
        assert.ok(
          beforeDiff.items.some(i => i.relativePath === '.cursor/rules/temp-rule.mdc'),
          'rule file should exist before removal'
        );

        await e.removeRule('temp-rule');
        await assert.rejects(fs.access(generated), 'orphaned .mdc must be pruned');
        const afterDiff = await e.diff();
        assert.equal(afterDiff.summary.unmanaged, 0, 'no orphans should remain');
        assert.equal(afterDiff.hasDrift, false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('sync --no-prune keeps orphans and diff reports them as unmanaged', async () => {
      const dir = await tmpdir('syncytium-noprune-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addRule({ id: 'keep-me', title: 'Keep', body: 'b' });
        await fs.unlink(path.join(dir, '.syncytium', 'rules', 'keep-me.md'));
        // File still on disk with a banner, but no rule produces it any more.
        await e.sync(undefined, { noPrune: true });
        const orphan = path.join(dir, '.cursor', 'rules', 'keep-me.mdc');
        await fs.access(orphan);
        const report = await e.diff();
        // Both `.cursor/rules/keep-me.mdc` and its antigravity twin are orphans.
        assert.equal(report.summary.unmanaged, 2);
        assert.equal(report.hasDrift, true);
        const entry = report.items.find(i => i.status === 'unmanaged');
        assert.ok(entry?.driftSummary?.includes('Orphaned'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: diff', () => {
    test('diff detects modification, deletion and clean state', async () => {
      const dir = await tmpdir('syncytium-diff-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('D', 'generic');
        await e.sync();

        const clean = await e.diff();
        assert.equal(clean.hasDrift, false);
        assert.ok(clean.summary.identical > 0);

        await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# tampered');
        await fs.unlink(path.join(dir, '.clinerules'));

        const dirty = await e.diff();
        assert.equal(dirty.hasDrift, true);
        assert.equal(dirty.summary.modified, 1);
        assert.equal(dirty.summary.missingOnDisk, 1);

        const modified = dirty.items.find(i => i.relativePath === 'CLAUDE.md');
        assert.ok(modified?.patch, 'a patch must be produced');
        assert.ok((modified?.changedLines ?? 0) > 0);
        assert.match(modified!.patch!, /^-# tampered/m);

        await e.sync();
        assert.equal((await e.diff()).hasDrift, false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('diff summary always includes the unmanaged bucket', async () => {
      const dir = await tmpdir('syncytium-diffsumm-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('D', 'generic');
        await e.sync();
        const report = await e.diff();
        assert.equal(typeof report.summary.unmanaged, 'number');
        assert.equal(report.summary.unmanaged, 0);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: rules CRUD', () => {
    test('addRule derives a safe id and avoids collisions', async () => {
      const dir = await tmpdir('syncytium-rule-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');

        const first = await e.addRule({ title: 'My Great Rule', body: 'a' });
        assert.equal(first.rule.id, 'my-great-rule');

        const second = await e.addRule({ title: 'My Great Rule', body: 'b' });
        assert.equal(second.rule.id, 'my-great-rule-2');

        const explicit = await e.addRule({ id: 'Weird Name!', title: 'X', body: 'c' });
        assert.equal(explicit.rule.id, 'weird-name');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('addRule rejects an empty body', async () => {
      const dir = await tmpdir('syncytium-rule2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await assert.rejects(() => e.addRule({ title: 'X', body: '   ' }), /body cannot be empty/);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('addRule defaults alwaysApply from the presence of globs', async () => {
      const dir = await tmpdir('syncytium-rule3-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const globbed = await e.addRule({ title: 'G', body: 'b', globs: ['**/*.ts'] });
        assert.equal(globbed.rule.alwaysApply, false);
        const plain = await e.addRule({ title: 'N', body: 'b' });
        assert.equal(plain.rule.alwaysApply, true);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('getRule and removeRule work by id, and removeRule prunes output', async () => {
      const dir = await tmpdir('syncytium-rule4-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addRule({ id: 'temp', title: 'Temp', body: 'b' });
        assert.ok(await e.getRule('temp'));
        assert.ok(await e.getRule('TEMP'), 'lookup should be case-insensitive-ish');
        assert.equal(await e.removeRule('temp'), true);
        assert.equal(await e.getRule('temp'), undefined);
        assert.equal(await e.removeRule('temp'), false);
        await assert.rejects(fs.access(path.join(dir, '.cursor', 'rules', 'temp.mdc')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('listRules searches id, title, tag and body', async () => {
      const dir = await tmpdir('syncytium-rule5-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addRule({ id: 'a', title: 'Alpha', body: 'x', tags: ['zeta'] });
        await e.addRule({ id: 'b', title: 'Beta', body: 'contains needle here' });

        assert.equal((await e.listRules('alpha')).length, 1);
        assert.equal((await e.listRules('zeta')).length, 1);
        assert.equal((await e.listRules('needle')).length, 1);
        assert.equal((await e.listRules('nope-12345')).length, 0);
        assert.ok((await e.listRules()).length >= 5);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('rules are returned in a stable, platform-independent order', async () => {
      const dir = await tmpdir('syncytium-order-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addRule({ id: 'zeta', title: 'Z', body: 'b' });
        await e.addRule({ id: 'alpha', title: 'A', body: 'b' });
        const a = (await e.storage.loadRules()).map(r => r.id);
        const b = (await e.storage.loadRules()).map(r => r.id);
        assert.deepEqual(a, b, 'loadRules must be deterministic');
        assert.deepEqual([...a].sort(), a, 'rules must be sorted');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: ADRs', () => {
    test('nextDecisionId fills gaps instead of colliding', async () => {
      const dir = await tmpdir('syncytium-adr-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        // Remove ADR-002 so the "length + 1" heuristic would wrongly return 002.
        await e.storage.writeDecisions([
          { id: 'ADR-001', title: 'One', status: 'accepted', date: '2026-01-01', context: 'c', decision: 'd', consequences: 'q' },
          { id: 'ADR-003', title: 'Three', status: 'accepted', date: '2026-01-01', context: 'c', decision: 'd', consequences: 'q' }
        ]);
        assert.equal(await e.storage.nextDecisionId(), 'ADR-002');

        await e.addDecision({ id: 'ADR-002', title: 'Two', status: 'accepted', date: '2026-01-02', context: 'c', decision: 'd', consequences: 'q' });
        assert.equal(await e.storage.nextDecisionId(), 'ADR-004');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('decisions round-trip and are not re-injected when deleted', async () => {
      const dir = await tmpdir('syncytium-adr2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        assert.equal((await e.storage.loadDecisions()).length, 1);

        await e.addDecision({ id: 'ADR-002', title: 'Fastify', status: 'accepted', date: '2026-09-19', context: 'throughput', decision: 'use Fastify', consequences: 'plugin ecosystem' });
        assert.ok((await e.storage.loadDecisions()).some(d => d.id === 'ADR-002'));
        assert.ok((await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8')).includes('[ADR-002] Fastify'));

        assert.equal(await e.removeDecision('ADR-002'), true);
        assert.equal(await e.removeDecision('ADR-002'), false);
        assert.equal((await e.storage.loadDecisions()).some(d => d.id === 'ADR-002'), false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('a project with no decisions.md reports zero, not the template ADR', async () => {
      const dir = await tmpdir('syncytium-adr3-');
      try {
        const e = new SyncytiumEngine(dir);
        await fs.mkdir(path.join(dir, '.syncytium'), { recursive: true });
        // v0.1.x returned INITIAL_DECISIONS here, inventing ADR-001.
        assert.deepEqual(await e.storage.loadDecisions(), []);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('a missing HANDOFF.md reports a neutral state, not the template', async () => {
      const dir = await tmpdir('syncytium-ho-');
      try {
        const e = new SyncytiumEngine(dir);
        await fs.mkdir(path.join(dir, '.syncytium'), { recursive: true });
        const h = await e.storage.loadHandoff();
        assert.equal(h.activeAgent, 'None');
        assert.equal(h.goal, '');
        assert.deepEqual(h.pendingTasks, []);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('ADRs written only to the markdown body are recovered', async () => {
      const dir = await tmpdir('syncytium-adrlegacy-');
      try {
        const e = new SyncytiumEngine(dir);
        await fs.mkdir(path.join(dir, '.syncytium', 'memory'), { recursive: true });
        await fs.writeFile(
          path.join(dir, '.syncytium', 'memory', 'decisions.md'),
          '# Architectural Decision Records (ADR)\n\n' +
            '### [ADR-007] Legacy format\n- **Status:** accepted\n- **Date:** 2026-01-05\n\n' +
            '**Context:**\nOld ctx\n\n**Decision:**\nOld decision\n\n**Consequences:**\nOld cons\n\n---\n\n'
        );
        const decisions = await e.storage.loadDecisions();
        assert.equal(decisions.length, 1);
        assert.equal(decisions[0].id, 'ADR-007');
        assert.equal(decisions[0].title, 'Legacy format');
        assert.equal(decisions[0].decision, 'Old decision');
        assert.equal(decisions[0].consequences, 'Old cons');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('listDecisions filters by status and query', async () => {
      const dir = await tmpdir('syncytium-adrfilter-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.addDecision({ id: 'ADR-002', title: 'Keep', status: 'accepted', date: 'd', context: 'c', decision: 'd', consequences: 'q' });
        await e.addDecision({ id: 'ADR-003', title: 'Drop', status: 'deprecated', date: 'd', context: 'c', decision: 'd', consequences: 'q' });
        assert.equal((await e.listDecisions({ status: 'deprecated' })).length, 1);
        assert.equal((await e.listDecisions({ status: 'all' })).length, 3);
        assert.equal((await e.listDecisions({ query: 'drop' })).length, 1);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: clean must never delete user files', () => {
    test('clean removes only banner-tagged files, not whole directories', async () => {
      const dir = await tmpdir('syncytium-clean-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();

        // A hand-written rule living alongside the generated ones.
        const userRule = path.join(dir, '.cursor', 'rules', 'my-own-rule.mdc');
        await fs.writeFile(
          userRule,
          '---\ndescription: mine\nglobs: \n---\n\n# My own rule, written by a human.\n'
        );
        // And a hand-written file in the same directory target set.
        const userGemini = path.join(dir, '.gemini', 'antigravity', 'rules', 'mine.md');
        await fs.writeFile(userGemini, '# my notes\n');

        const cleaned = await e.clean();

        assert.ok(cleaned.includes('.cursor/rules/code-style.mdc'), 'generated file should go');
        assert.equal(await fs.access(userRule).then(() => true, () => false), true, 'user rule must survive');
        assert.equal(await fs.access(userGemini).then(() => true, () => false), true, 'user file must survive');
        assert.ok(await fs.stat(path.join(dir, '.cursor', 'rules')), 'directory must survive');

        // v0.1.x did `fs.rm(dir, { recursive: true })` and destroyed both.
        assert.equal(await e.storage.exists(), true);
        await assert.rejects(fs.access(path.join(dir, 'CLAUDE.md')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('clean removes a managed directory once it is empty', async () => {
      const dir = await tmpdir('syncytium-clean2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();
        await e.clean();
        const rulesDir = path.join(dir, '.cursor', 'rules');
        const exists = await fs.stat(rulesDir).then(() => true, () => false);
        assert.equal(exists, false, 'fully-managed dir should be removed');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: .syncytiumignore', () => {
    test('excluded files are neither written nor reported by diff', async () => {
      const dir = await tmpdir('syncytium-ignore-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.writeFile(path.join(dir, '.syncytiumignore'), '.traerules\n.windsurfrules\n# comment\n');

        const res = await e.sync();
        assert.ok(!res.paths.includes('.traerules'));
        assert.ok(!res.paths.includes('.windsurfrules'));
        const report = await e.diff();
        assert.ok(!report.items.some(i => i.relativePath === '.traerules'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('an ignored file already on disk is not reported as an orphan', async () => {
      const dir = await tmpdir('syncytium-ignore2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();
        await fs.writeFile(path.join(dir, '.syncytiumignore'), '.traerules\n');
        const report = await e.diff();
        assert.equal(
          report.items.filter(i => i.status === 'unmanaged').some(i => i.relativePath === '.traerules'),
          false
        );
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: handoff and lock', () => {
    test('handoff records the previous agent as the baton source', async () => {
      const dir = await tmpdir('syncytium-handoff-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.handoff({ activeAgent: 'Antigravity', nextAgent: 'Cursor', goal: 'g1' });
        await e.handoff({ activeAgent: 'Cursor', nextAgent: 'Claude', goal: 'g2' });

        const history = await e.getHandoffHistory(5);
        // Newest first: the second handoff moved the baton Antigravity -> Cursor.
        assert.equal(history[0].fromAgent, 'Antigravity');
        assert.equal(history[0].toAgent, 'Cursor');
        // The first one moved it out of the seeded 'Human' state.
        assert.equal(history[1].fromAgent, 'Human');
        assert.equal(history[1].toAgent, 'Antigravity');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('completedWork is de-duplicated and capped', async () => {
      const dir = await tmpdir('syncytium-cap-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        for (let i = 0; i < 60; i++) {
          await e.handoff({ activeAgent: 'A', completed: [`task ${i}`], autoSync: false });
        }
        await e.handoff({ activeAgent: 'A', completed: ['task 0', 'task 0'], autoSync: false });
        const h = await e.storage.loadHandoff();
        assert.ok(h.completedWork.length <= 40, `cap breached: ${h.completedWork.length}`);
        assert.equal(new Set(h.completedWork).size, h.completedWork.length, 'must be deduped');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('handoff propagates the state to every bridge file', async () => {
      const dir = await tmpdir('syncytium-ho2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.handoff({
          activeAgent: 'Antigravity',
          nextAgent: 'Cursor',
          status: 'in_progress',
          goal: 'Write REST endpoints',
          pending: ['Create /api/users route'],
          notes: 'Handle 404 cleanly'
        });
        const mdc = await fs.readFile(path.join(dir, '.cursor', 'rules', 'syncytium-handoff.mdc'), 'utf-8');
        assert.ok(mdc.includes('Next: `Cursor`'));
        assert.ok(mdc.includes('Create /api/users route'));
        const agents = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf-8');
        assert.ok(agents.includes('Create /api/users route'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lock acquire --force is actually honoured (regression)', async () => {
      const dir = await tmpdir('syncytium-lockforce-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.acquireLock('Cursor', 'first', 30, false);
        const blocked = await e.acquireLock('Claude', 'second', 30, false);
        assert.equal(blocked.acquired, false, 'without force it must be refused');
        assert.ok(blocked.message?.includes("locked by 'Cursor'"));

        const forced = await e.acquireLock('Claude', 'second', 30, true);
        assert.equal(forced.acquired, true, '--force must override');
        assert.equal(forced.lock.agent, 'Claude');
        assert.ok(forced.message?.includes('forced override'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lock records host/pid and validates its arguments', async () => {
      const dir = await tmpdir('syncytium-lockmeta-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const res = await e.acquireLock('Cursor', 'g', 15);
        assert.ok(res.lock.host);
        assert.equal(typeof res.lock.pid, 'number');
        await assert.rejects(() => e.acquireLock('', 'g', 15), /agent name is required/);
        await assert.rejects(() => e.acquireLock('A', 'g', 0), /positive number/);
        await assert.rejects(() => e.acquireLock('A', 'g', -5), /positive number/);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('renewLock extends only the holder own lease', async () => {
      const dir = await tmpdir('syncytium-lockrenew-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.acquireLock('Cursor', 'g', 5);
        assert.equal((await e.renewLock('Claude', 30)).renewed, false);
        const res = await e.renewLock('Cursor', 30);
        assert.equal(res.renewed, true);
        assert.ok(new Date((await e.getLockStatus()).expiresAt!).getTime() > Date.now() + 20 * 60_000);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('releaseLock refuses a foreign agent without force', async () => {
      const dir = await tmpdir('syncytium-lockrel-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.acquireLock('Cursor', 'g', 30);
        assert.equal((await e.releaseLock('Claude', false)).released, false);
        assert.equal((await e.releaseLock('Cursor', false)).released, true);
        assert.equal((await e.getLockStatus()).locked, false);
        assert.equal((await e.releaseLock(undefined, false)).released, true, 'not locked is a no-op');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('enforceLock blocks sync until the lock is released or forced', async () => {
      const dir = await tmpdir('syncytium-lockenforce-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const cfg = await e.storage.loadConfig();
        cfg.options.enforceLock = true;
        await e.storage.saveConfig(cfg);

        await e.acquireLock('Cursor', 'holding', 30);
        await assert.rejects(() => e.sync(), /locked by 'Cursor'/);
        await e.sync(undefined, { force: true });
        await e.releaseLock('Cursor');
        await e.sync();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: lint', () => {
    test('clean workspace lints without errors', async () => {
      const dir = await tmpdir('syncytium-lint-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();
        const report = await e.lint();
        assert.equal(report.valid, true, JSON.stringify(report.issues));
        assert.ok(report.totalChecked >= 4);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint --fix renames to kebab-case and heals frontmatter', async () => {
      const dir = await tmpdir('syncytium-lintfix-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const bad = path.join(dir, '.syncytium', 'rules', 'BadFileName.md');
        await fs.writeFile(bad, '# no frontmatter\nsome content.\n');

        const before = await e.lint();
        assert.ok(before.issues.some(i => i.code === 'rule-kebab-case'));

        const after = await e.lint({ fix: true });
        assert.ok((after.fixedCount ?? 0) > 0);
        await assert.rejects(fs.access(bad));
        const fixed = await fs.readFile(path.join(dir, '.syncytium', 'rules', 'bad-file-name.md'), 'utf-8');
        assert.ok(fixed.includes('id: bad-file-name'));
        assert.ok(fixed.includes('title: Bad File Name'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint --fix refuses to clobber an existing file on rename', async () => {
      const dir = await tmpdir('syncytium-lintcoll-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'bad-file-name.md'),
          '---\nid: bad-file-name\ntitle: A\n---\n\nkeep me\n'
        );
        // `BadFileName` slugifies to `bad-file-name`, which is genuinely
        // occupied above — a real collision on every filesystem. (An earlier
        // revision used `Bad_File_Name`, whose slug is `bad_file_name`, so the
        // test asserted a collision that never existed; it only passed on
        // Windows because the case-insensitive `fs.access` matched the file
        // against itself.)
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'BadFileName.md'),
          '---\nid: x\ntitle: B\n---\n\ncollide\n'
        );
        const report = await e.lint({ fix: true });
        const collision = report.issues.find(i => i.code === 'rule-rename-collision');
        assert.ok(collision, 'collision must be reported, not silently overwrite');
        assert.equal(collision.type, 'error');
        const kept = await fs.readFile(path.join(dir, '.syncytium', 'rules', 'bad-file-name.md'), 'utf-8');
        assert.ok(kept.includes('keep me'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint --fix applies a rename whose target resolves to the source itself', async () => {
      // On a case-insensitive filesystem a pure case-change rename
      // (`My-Rule.md` -> `my-rule.md`) makes `fs.access` on the target succeed
      // because the target IS the source. That must not be misreported as a
      // collision. A symlink reproduces the same-target situation on
      // case-sensitive filesystems too; when symlinks are unavailable the
      // plain file still exercises the path on Windows via case-insensitivity.
      const dir = await tmpdir('syncytium-lintself-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const rulesDir = path.join(dir, '.syncytium', 'rules');
        await fs.writeFile(
          path.join(rulesDir, 'My-Rule.md'),
          '---\nid: my-rule\ntitle: Case\n---\n\nbody\n'
        );
        try {
          await fs.symlink(
            path.join(rulesDir, 'My-Rule.md'),
            path.join(rulesDir, 'my-rule.md')
          );
        } catch {
          // No symlinks here (e.g. Windows without Developer Mode); the test
          // below still validates the behaviour, just without the alias.
        }
        const report = await e.lint({ fix: true });
        const collision = report.issues.find(i => i.code === 'rule-rename-collision');
        assert.equal(collision, undefined, 'a rename onto the file itself is not a collision');
        const kept = await fs.readFile(path.join(rulesDir, 'my-rule.md'), 'utf-8');
        assert.ok(kept.includes('body'), 'content must survive the rename');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint --fix preserves explicitly-set frontmatter values', async () => {
      const dir = await tmpdir('syncytium-lintheal-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'heal-me.md'),
          '---\nid: my-custom-id\ntags:\n  - alpha\n---\n\nbody\n'
        );
        await e.lint({ fix: true });
        const fixed = await fs.readFile(path.join(dir, '.syncytium', 'rules', 'heal-me.md'), 'utf-8');
        assert.ok(fixed.includes('id: my-custom-id'), 'explicit id must not be replaced');
        assert.ok(fixed.includes('alpha'), 'explicit tags must not be replaced');
        assert.ok(/title: Heal Me/.test(fixed), 'missing title should be derived');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint detects duplicate rule ids and unsafe ids', async () => {
      const dir = await tmpdir('syncytium-lintdup-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'one.md'),
          '---\nid: dup\ntitle: One\n---\n\na\n'
        );
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'two.md'),
          '---\nid: dup\ntitle: Two\n---\n\nb\n'
        );
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'three.md'),
          '---\nid: Has Spaces\ntitle: Three\n---\n\nc\n'
        );
        const report = await e.lint();
        assert.ok(report.issues.some(i => i.code === 'rule-duplicate-id' && i.ruleId === 'dup'));
        assert.ok(report.issues.some(i => i.code === 'rule-id-unsafe'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint validates the ADR schema', async () => {
      const dir = await tmpdir('syncytium-lintadr-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.storage.writeDecisions([
          { id: 'ADR-001', title: 'Bad', status: 'not-a-status' as never, date: 'd', context: 'c', decision: 'd', consequences: 'q' }
        ]);
        const report = await e.lint();
        assert.equal(report.valid, false);
        assert.ok(report.issues.some(i => i.code === 'adr-schema'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('lint reports a missing .syncytium directory', async () => {
      const dir = await tmpdir('syncytium-lintnone-');
      try {
        const e = new SyncytiumEngine(dir);
        const report = await e.lint();
        assert.equal(report.valid, false);
        assert.ok(report.issues.some(i => i.code === 'not-initialized'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: doctor, validate, hooks, ci', () => {
    test('doctor reports every subsystem and stays healthy on a synced project', async () => {
      const dir = await tmpdir('syncytium-doctor-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();
        const report = await e.doctor();
        const ids = report.checks.map(c => c.id);
        for (const expected of ['root', 'config', 'adapters', 'rules', 'decisions', 'handoff', 'drift', 'lock', 'hook', 'ci', 'lint']) {
          assert.ok(ids.includes(expected), `doctor missing check: ${expected}`);
        }
        assert.ok(['healthy', 'warning'].includes(report.overallStatus));
        // hook + ci are absent in a bare temp dir, so a warning is correct here.
        assert.equal(report.checks.find(c => c.id === 'drift')?.status, 'ok');
        assert.equal(report.checks.find(c => c.id === 'config')?.status, 'ok');
        assert.equal(report.stats.rulesCount >= 3, true);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('doctor flags a CI workflow whose drift gate cannot fail', async () => {
      const dir = await tmpdir('syncytium-doctorci-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();
        const wf = path.join(dir, '.github', 'workflows', 'syncytium.yml');
        await fs.mkdir(path.dirname(wf), { recursive: true });
        await fs.writeFile(wf, 'name: x\njobs:\n  v:\n    steps:\n      - run: syncytium diff\n');
        const check = (await e.doctor()).checks.find(c => c.id === 'ci');
        assert.equal(check?.status, 'warn');
        assert.ok(check?.message?.includes('cannot fail'));
        assert.equal(check?.fix, 'syncytium ci --force');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('installCiWorkflow uses a drift gate that can actually fail', async () => {
      const dir = await tmpdir('syncytium-ci-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const res = await e.installCiWorkflow();
        const content = await fs.readFile(res.path, 'utf-8');
        assert.ok(content.includes('syncytium lint'));
        assert.ok(content.includes('syncytium validate'));
        // v0.1.x ran plain `syncytium diff`, which always exited 0.
        assert.ok(content.includes('syncytium diff --check'));
        assert.ok(!/run: syncytium diff\s*$/m.test(content));
        assert.equal((await e.doctor()).checks.find(c => c.id === 'ci')?.status, 'ok');
        await assert.rejects(() => e.installCiWorkflow(), /already exists/);
        assert.equal((await e.uninstallCiWorkflow()).removed, true);
        assert.equal((await e.uninstallCiWorkflow()).removed, false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('validate passes on a good project and detects bad rule frontmatter', async () => {
      const dir = await tmpdir('syncytium-validate-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const good = await e.validate();
        assert.equal(good.valid, true, JSON.stringify(good.issues));

        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'bad.md'),
          '---\nid: 12345\nglobs: "not-an-array"\n---\n\nbody\n'
        );
        const bad = await e.validate();
        assert.equal(bad.valid, false);
        assert.ok(bad.issues.some(i => i.path.includes('bad.md')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('validate warns when frontmatter id and filename disagree', async () => {
      const dir = await tmpdir('syncytium-validate2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.writeFile(
          path.join(dir, '.syncytium', 'rules', 'mismatch.md'),
          '---\nid: different-id\ntitle: M\n---\n\nbody\n'
        );
        const result = await e.validate();
        assert.ok(result.warnings.some(w => w.message.includes('does not match filename')));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('git hook install/uninstall is idempotent and uses diff --check', async () => {
      const dir = await tmpdir('syncytium-hook-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await fs.mkdir(path.join(dir, '.git', 'hooks'), { recursive: true });

        const drift = await e.installGitHook();
        let content = await fs.readFile(drift.hookPath, 'utf-8');
        assert.ok(content.includes('BEGIN SYNCYTIUM HOOK'));
        // The hook gated on `$? -ne 0`, but v0.1.x `diff` never set that code.
        assert.ok(content.includes('syncytium diff --check'));

        await e.installGitHook({ autoSync: true });
        content = await fs.readFile(drift.hookPath, 'utf-8');
        assert.equal((content.match(/BEGIN SYNCYTIUM HOOK/g) ?? []).length, 1, 'no duplicated blocks');
        assert.ok(content.includes('syncytium sync'));

        assert.equal((await e.uninstallGitHook()).success, true);
        assert.equal(await fs.access(drift.hookPath).then(() => true, () => false), false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('installGitHook preserves a pre-existing hook body', async () => {
      const dir = await tmpdir('syncytium-hook2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        const hooks = path.join(dir, '.git', 'hooks');
        await fs.mkdir(hooks, { recursive: true });
        const hookPath = path.join(hooks, 'pre-commit');
        await fs.writeFile(hookPath, '#!/bin/sh\necho "my own checks"\n');

        const res = await e.installGitHook();
        const content = await fs.readFile(res.hookPath, 'utf-8');
        assert.ok(content.includes('my own checks'), 'user hook must survive');

        await e.uninstallGitHook();
        const after = await fs.readFile(hookPath, 'utf-8');
        assert.ok(after.includes('my own checks'));
        assert.ok(!after.includes('SYNCYTIUM HOOK'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('installGitHook fails clearly outside a git repo', async () => {
      const dir = await tmpdir('syncytium-hook3-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await assert.rejects(() => e.installGitHook(), /Not a git repository/);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: export', () => {
    test('exportBundle assembles every section', async () => {
      const dir = await tmpdir('syncytium-export-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('Exportable', 'typescript');
        const bundle = await e.exportBundle();
        assert.equal(bundle.projectName, 'Exportable');
        assert.equal(bundle.version, VERSION);
        assert.ok(bundle.sections.length >= 4);
        assert.ok(bundle.markdown.includes('Code Style Guidelines'));
        assert.ok(bundle.markdown.includes('ADR-001'));
        assert.ok(bundle.markdown.includes('Live Handoff'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('exportBundle honours section toggles and truncation', async () => {
      const dir = await tmpdir('syncytium-export2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('E', 'generic');
        const minimal = await e.exportBundle({
          includeHandoff: false,
          includeDecisions: false,
          includeArchitecture: false
        });
        assert.equal(minimal.sections.length, (await e.storage.loadRules()).length);

        const truncated = await e.exportBundle({ maxRuleChars: 20 });
        assert.ok(truncated.sections.some(s => s.truncated));
        assert.ok(truncated.markdown.includes('(truncated)'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: import', () => {
    test('importExisting reverse-migrates legacy files and skips managed ones', async () => {
      const dir = await tmpdir('syncytium-import-');
      try {
        const e = new SyncytiumEngine(dir);
        await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# Legacy\nAlways write tests first.\n');
        await fs.writeFile(path.join(dir, '.clinerules'), '# Legacy Cline\nNo rm -rf on the root.\n');
        await fs.mkdir(path.join(dir, '.cursor', 'rules'), { recursive: true });
        await fs.writeFile(path.join(dir, '.cursor', 'rules', 'custom.mdc'), '# my own cursor rule\n');
        await fs.writeFile(path.join(dir, 'AGENT.md'), '<!--\n  AUTO-GENERATED BY SYNCYTIUM-MD\n-->\nmanaged\n');

        const report = await e.importExisting();
        const sources = report.items.map(i => i.sourceFile);
        assert.ok(sources.includes('CLAUDE.md'));
        assert.ok(sources.includes('.clinerules'));
        assert.ok(sources.includes('.cursor/rules/custom.mdc'));
        assert.ok(!sources.includes('AGENT.md'), 'already-managed files must be skipped');
        assert.ok((report.skippedCount ?? 0) >= 1);

        const imported = await fs.readFile(path.join(dir, '.syncytium', 'rules', 'imported-claude.md'), 'utf-8');
        assert.ok(imported.includes('Always write tests first'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('importExisting --dry-run writes nothing', async () => {
      const dir = await tmpdir('syncytium-import2-');
      try {
        await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# Legacy\ncontent\n');
        const e = new SyncytiumEngine(dir);
        const report = await e.importExisting({ dryRun: true });
        assert.equal(report.importedCount, 1);
        assert.equal(await e.storage.exists(), false, 'dry run must not initialize');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('import round-trips without duplicating on a second run', async () => {
      const dir = await tmpdir('syncytium-import3-');
      try {
        const e = new SyncytiumEngine(dir);
        await fs.writeFile(path.join(dir, '.clinerules'), '# hand written\nbe careful\n');
        assert.equal((await e.importExisting()).importedCount, 1);
        // Second pass finds only the (now managed) generated files.
        const second = await e.importExisting();
        assert.equal(second.importedCount, 0);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: knowledge graph', () => {
    test('returns structured nodes, edges and stats', async () => {
      const dir = await tmpdir('syncytium-graph-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('G', 'generic');
        const graph = await e.getKnowledgeGraph();
        assert.ok(graph.nodes.some(n => n.type === 'root'));
        assert.ok(graph.nodes.filter(n => n.type === 'rule').length >= 3);
        assert.ok(graph.edges.length > 0);
        assert.ok(graph.stats.rulesCount >= 3);
        assert.ok(graph.nodes.some(n => n.id === 'doc:lock'), 'lock node should be present');

        // Every edge endpoint must resolve to a real node.
        const ids = new Set(graph.nodes.map(n => n.id));
        for (const edge of graph.edges) {
          assert.ok(ids.has(edge.source), `dangling edge source: ${edge.source}`);
          assert.ok(ids.has(edge.target), `dangling edge target: ${edge.target}`);
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('compact / excludeFiles / excludeTags remove the right node types', async () => {
      const dir = await tmpdir('syncytium-graph2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('G', 'generic');

        const full = await e.getKnowledgeGraph();
        assert.ok(full.nodes.some(n => n.type === 'file'));
        assert.ok(full.nodes.some(n => n.type === 'tag'));

        const compact = await e.getKnowledgeGraph({ compact: true });
        assert.equal(compact.nodes.some(n => n.type === 'file'), false);
        assert.equal(compact.nodes.some(n => n.type === 'tag'), false);
        assert.ok(compact.nodes.length < full.nodes.length);

        const noFiles = await e.getKnowledgeGraph({ excludeFiles: true });
        assert.equal(noFiles.nodes.some(n => n.type === 'file'), false);
        assert.ok(noFiles.nodes.some(n => n.type === 'tag'));

        const noTags = await e.getKnowledgeGraph({ excludeTags: true });
        assert.equal(noTags.nodes.some(n => n.type === 'tag'), false);
        assert.ok(noTags.nodes.some(n => n.type === 'file'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('category filter isolates perspectives and honours includeBrain (regression)', async () => {
      const dir = await tmpdir('syncytium-graph3-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('G', 'generic');

        const ide = await e.getKnowledgeGraph({ category: 'ide' });
        assert.ok(ide.nodes.some(n => n.type === 'adapter' && n.metadata?.category === 'ide'));
        assert.equal(ide.nodes.some(n => n.type === 'adapter' && n.metadata?.category === 'cli'), false);
        // v0.1.x computed `includeRules` and then ignored it, so every
        // perspective kept rendering the whole rule set.
        assert.equal(ide.nodes.some(n => n.type === 'rule'), false, 'ide view must not include rules');
        assert.equal(ide.nodes.some(n => n.type === 'decision'), false);

        const brain = await e.getKnowledgeGraph({ category: 'brain' });
        assert.ok(brain.nodes.some(n => n.type === 'rule'));
        assert.equal(brain.nodes.some(n => n.type === 'adapter'), false);
        assert.equal(brain.nodes.some(n => n.type === 'file'), false);

        const cli = await e.getKnowledgeGraph({ category: 'cli' });
        assert.ok(cli.nodes.some(n => n.type === 'adapter' && n.metadata?.category === 'cli'));
        assert.equal(cli.nodes.some(n => n.type === 'adapter' && n.metadata?.category === 'ide'), false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('an unknown category is treated as "all"', async () => {
      const dir = await tmpdir('syncytium-graph4-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('G', 'generic');
        const bogus = await e.getKnowledgeGraph({ category: '../../etc/passwd' });
        assert.ok(bogus.nodes.some(n => n.type === 'rule'));
        assert.ok(bogus.nodes.some(n => n.type === 'adapter'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('graph metadata arrays are always arrays, never undefined', async () => {
      const dir = await tmpdir('syncytium-graph5-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('G', 'generic');
        const graph = await e.getKnowledgeGraph();
        for (const node of graph.nodes.filter(n => n.type === 'rule')) {
          assert.ok(Array.isArray(node.metadata?.globs), `${node.id} globs`);
          assert.ok(Array.isArray(node.metadata?.tags), `${node.id} tags`);
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('engine: UI server security', () => {
    test('serves graph, file and health endpoints, and blocks traversal', async () => {
      const dir = await tmpdir('syncytium-ui-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        await e.sync();
        const ui = await e.startUiServer({ port: 0, open: false });
        const base = `http://localhost:${ui.port}`;
        try {
          const graph = await fetch(`${base}/api/graph?category=ide`);
          assert.equal(graph.status, 200);
          assert.ok(Array.isArray((await graph.json() as any).nodes));

          const file = await fetch(`${base}/api/file?path=${encodeURIComponent('.syncytium/architecture.md')}`);
          assert.equal(file.status, 200);
          const fileData = await file.json() as any;
          assert.equal(fileData.path, '.syncytium/architecture.md');
          assert.ok(fileData.content.includes('System Architecture'));

          const traversal = await fetch(`${base}/api/file?path=../../etc/passwd`);
          assert.equal(traversal.status, 403);

          const health = await fetch(`${base}/api/health`);
          assert.equal(health.status, 200);
          assert.equal((await health.json() as any).version, VERSION);

          const notFound = await fetch(`${base}/api/nope`);
          assert.equal(notFound.status, 404);
          assert.equal((await notFound.json() as any).error !== undefined, true);

          const html = await fetch(`${base}/`);
          assert.equal(html.status, 200);
          const page = await html.text();
          assert.ok(page.includes('SyncytiumMD'));
          assert.ok(page.includes('vault-sidebar'));
          assert.ok(page.includes('doc-sidebar'));
          assert.ok(page.includes('Content-Security-Policy') === false, 'CSP comes from the header');
          assert.equal(page.includes('UI ' + VERSION), true, 'version should be rendered');
        } finally {
          await ui.close();
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('/api/file refuses in-root secrets and .git internals', async () => {
      const dir = await tmpdir('syncytium-ui2-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        await e.sync();
        await fs.writeFile(path.join(dir, '.env'), 'SECRET=hunter2\n');
        await fs.mkdir(path.join(dir, '.git'), { recursive: true });
        await fs.writeFile(path.join(dir, '.git', 'config'), '[core]\n');
        await fs.writeFile(path.join(dir, 'server.pem'), '-----BEGIN PRIVATE KEY-----\n');

        const ui = await e.startUiServer({ port: 0, open: false });
        const base = `http://localhost:${ui.port}`;
        try {
          for (const target of ['.env', '.git/config', 'server.pem', 'id_rsa', '.npmrc']) {
            const res = await fetch(`${base}/api/file?path=${encodeURIComponent(target)}`);
            assert.equal(res.status, 403, `${target} must be refused`);
          }
          // A legitimate file still works.
          const ok = await fetch(`${base}/api/file?path=${encodeURIComponent('CLAUDE.md')}`);
          assert.equal(ok.status, 200);
        } finally {
          await ui.close();
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('rejects a non-loopback Host header (DNS-rebinding guard)', async () => {
      const dir = await tmpdir('syncytium-ui3-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        const ui = await e.startUiServer({ port: 0, open: false });
        try {
          // `fetch` forbids overriding Host, so this needs a raw request.
          const status = await new Promise<number>((resolve, reject) => {
            const req = httpRequest(
              {
                host: '127.0.0.1',
                port: ui.port,
                path: '/api/health',
                method: 'GET',
                headers: { host: 'evil.example.com' }
              },
              res => {
                res.resume();
                resolve(res.statusCode ?? 0);
              }
            );
            req.on('error', reject);
            req.end();
          });
          assert.equal(status, 403, 'a foreign Host must be rejected');

          // The same path with a loopback Host still works.
          const ok = await fetch(`http://localhost:${ui.port}/api/health`);
          assert.equal(ok.status, 200);
        } finally {
          await ui.close();
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('--allow-remote lifts the Host guard', async () => {
      const dir = await tmpdir('syncytium-ui6-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        const ui = await e.startUiServer({ port: 0, open: false, allowRemote: true });
        try {
          const status = await new Promise<number>((resolve, reject) => {
            const req = httpRequest(
              {
                host: '127.0.0.1',
                port: ui.port,
                path: '/api/health',
                method: 'GET',
                headers: { host: 'evil.example.com' }
              },
              res => {
                res.resume();
                resolve(res.statusCode ?? 0);
              }
            );
            req.on('error', reject);
            req.end();
          });
          assert.equal(status, 200);
        } finally {
          await ui.close();
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('rejects non-GET methods and closes cleanly', async () => {
      const dir = await tmpdir('syncytium-ui4-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        const ui = await e.startUiServer({ port: 0, open: false });
        try {
          const res = await fetch(`http://localhost:${ui.port}/api/graph`, { method: 'POST' });
          assert.equal(res.status, 405);
        } finally {
          await ui.close();
          // close() must resolve even with the SSE keep-alive timer in play.
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('UI server falls back to an ephemeral port when the requested one is taken', async () => {
      const dir = await tmpdir('syncytium-ui5-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('UI', 'generic');
        const first = await e.startUiServer({ port: 0, open: false });
        const port = first.port;
        try {
          const second = await e.startUiServer({ port, open: false });
          try {
            assert.notEqual(second.port, port, 'should have picked another port');
            assert.ok(second.port > 0);
          } finally {
            await second.close();
          }
        } finally {
          await first.close();
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('adapters', () => {
    test('every registered adapter emits a Syncytium banner', async () => {
      const dir = await tmpdir('syncytium-adapters-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'typescript');
        const context = await e.storage.loadCanonicalContext();
        for (const adapter of e.registry.list()) {
          const files = await adapter.generate(context);
          assert.ok(files.length > 0, `${adapter.id} produced nothing`);
          for (const file of files) {
            assert.ok(
              file.content.includes('AUTO-GENERATED BY SYNCYTIUM'),
              `${adapter.id} -> ${file.relativePath} missing banner`
            );
            assert.ok(file.adapterId === adapter.id, 'files must be stamped with their adapter');
            assert.ok(!file.relativePath.includes('..'), `${adapter.id} escaped the workspace`);
          }
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('all ten built-in adapters are registered with sane metadata', async () => {
      const dir = await tmpdir('syncytium-reg-');
      try {
        const e = new SyncytiumEngine(dir);
        const ids = e.registry.list().map(a => a.id).sort();
        assert.deepEqual(ids, [
          'agents', 'antigravity', 'claude', 'cline', 'copilot',
          'cursor', 'gemini', 'opencode', 'trae', 'windsurf'
        ]);
        for (const a of e.registry.list()) {
          assert.ok(a.name.length > 0);
          assert.ok(a.description.length > 0);
          assert.ok(a.defaultTargetFiles.length > 0);
        }
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('the new AGENTS.md and GEMINI.md adapters include the handoff and ADR sections', async () => {
      const dir = await tmpdir('syncytium-newadapters-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        const context = await e.storage.loadCanonicalContext();
        context.handoff.goal = 'ship v0.2.0';

        const agents = await new AgentsAdapter().generate(context);
        const agentsMd = agents.find(f => f.relativePath === 'AGENTS.md')!;
        assert.ok(agentsMd.content.includes('ship v0.2.0'));
        assert.ok(agentsMd.content.includes('Working Agreement'));
        assert.ok(agentsMd.content.includes('lock acquire'));

        const gemini = await new GeminiAdapter().generate(context);
        const geminiMd = gemini.find(f => f.relativePath === 'GEMINI.md')!;
        assert.ok(geminiMd.content.includes('ship v0.2.0'));
        assert.ok(geminiMd.content.includes('Working Agreement'));
        assert.equal(gemini.some(f => f.relativePath.endsWith('.json')), false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('the Cline adapter emits a valid .roomodes YAML document', async () => {
      const dir = await tmpdir('syncytium-roomodes-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        const context = await e.storage.loadCanonicalContext();
        const files = await new ClineAdapter().generate(context);
        const roomodes = files.find(f => f.relativePath === '.roomodes')!;
        assert.ok(roomodes.content.includes('customModes:'));
        assert.ok(roomodes.content.includes('name: syncytium-architect'));
        // No tabs, and every list item is indented consistently.
        assert.ok(!roomodes.content.includes('\t'), 'YAML must not contain tabs');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('the Copilot adapter emits applyTo only for glob-scoped rules', async () => {
      const dir = await tmpdir('syncytium-copilot-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'typescript');
        const context = await e.storage.loadCanonicalContext();
        const files = await new GitHubCopilotAdapter().generate(context);
        const instructions = files.filter(f => f.relativePath.endsWith('.instructions.md'));
        // testing-standards and typescript-strictness are the two glob-scoped
        // rules in the TypeScript template; the rest are always-apply.
        assert.equal(instructions.length, 2, instructions.map(f => f.relativePath).join(', '));
        const testing = instructions.find(f => f.relativePath.includes('testing-standards'))!;
        assert.ok(testing.content.includes('applyTo: "**/*.test.*'));
        const strictness = instructions.find(f => f.relativePath.includes('typescript-strictness'))!;
        assert.ok(strictness.content.includes('applyTo: "**/*.ts'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('GenericAdapter honours includeArchitecture / includeHandoff', async () => {
      const dir = await tmpdir('syncytium-generic-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        const context = await e.storage.loadCanonicalContext();
        const adapter = new GenericAdapter({
          id: 'x', name: 'X', targetFile: 'X.md',
          includeArchitecture: true, includeHandoff: false
        });
        const [file] = await adapter.generate(context);
        assert.equal(file.relativePath, 'X.md');
        assert.ok(file.content.includes('Architecture'));
        assert.ok(!file.content.includes('Live Handoff Status'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('Cursor emits .mdc globs as a comma-separated string', async () => {
      const dir = await tmpdir('syncytium-cursor-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        const context = await e.storage.loadCanonicalContext();
        const files = await new CursorAdapter().generate(context);
        const mdc = files.find(f => f.relativePath.endsWith('testing-standards.mdc'))!;
        assert.ok(/^globs: .*,.*$/m.test(mdc.content), 'globs should be comma separated, got:\n' + mdc.content);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('emitRuleIndex adds an index when the option is on', async () => {
      const dir = await tmpdir('syncytium-index-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('A', 'generic');
        const cfg = await e.storage.loadConfig();
        cfg.options.emitRuleIndex = true;
        await e.storage.saveConfig(cfg);
        await e.sync();
        const claude = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8');
        assert.ok(claude.includes('Rule Index'));
        assert.ok(claude.includes('`code-style`'));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('preserved user sections', () => {
    test('sync keeps content the user appended below the generated area', async () => {
      const dir = await tmpdir('syncytium-preserve-');
      try {
        const e = new SyncytiumEngine(dir);
        await e.init('P', 'generic');
        await e.sync();

        const target = path.join(dir, 'CLAUDE.md');
        const original = await fs.readFile(target, 'utf-8');
        await fs.writeFile(
          target,
          original + '\n<!-- ===== Syncytium preserved user section ===== -->\n\n## My Own Notes\nDo not clobber me.\n'
        );

        await e.sync();
        const after = await fs.readFile(target, 'utf-8');
        assert.ok(after.includes('## My Own Notes'), 'user section must survive');
        assert.ok(after.includes('Do not clobber me'));
        assert.equal((await e.diff()).hasDrift, false, 'a preserved section must not read as drift');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // ======================================================================
  describe('MCP server', () => {
    test('exposes a wired-up server instance', async () => {
      const dir = await tmpdir('syncytium-mcp-');
      try {
        const { server, engine: mcpEngine } = createSyncytiumMcpServer(dir);
        assert.ok(server);
        assert.ok(mcpEngine instanceof SyncytiumEngine);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('every advertised tool name is unique and prefixed', async () => {
      const source = await fs.readFile(
        new URL('../src/mcp/server.ts', import.meta.url),
        'utf-8'
      );
      const names = [...source.matchAll(/name: '(syncytium_[a-z_]+)'/g)].map(m => m[1]);
      assert.ok(names.length >= 15, `expected >= 15 tools, found ${names.length}`);
      assert.equal(new Set(names).size, names.length, 'tool names must be unique');
      for (const name of names) assert.ok(name.startsWith('syncytium_'));
    });
  });

  // ======================================================================
  describe('release metadata', () => {
    test('VERSION matches package.json', async () => {
      const pkg = JSON.parse(
        await fs.readFile(new URL('../package.json', import.meta.url), 'utf-8')
      );
      assert.equal(VERSION, pkg.version, 'src/version.ts must match package.json');
    });

    test('the CLI and MCP report the same version', async () => {
      const cli = await fs.readFile(new URL('../dist/cli/index.js', import.meta.url), 'utf-8');
      assert.ok(!cli.includes("version('0.1.9')"), 'CLI must not hardcode a stale version');
    });
  });
});
