import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { exec } from 'node:child_process';
import chokidar from 'chokidar';
import pc from 'picocolors';
import matter from 'gray-matter';
import { CI_WORKFLOW_TEMPLATE, BANNER_MARKER, normalizeStack } from './templates.js';
import { SyncytiumStorage, omitUndefined } from './storage.js';
import { AdapterRegistry } from '../adapters/registry.js';
import { renderGraphHtml } from '../ui/template.js';
import { stripPreservedSection } from '../adapters/base.js';
import { createUnifiedDiff, summarizeDiff } from './diff.js';
import { isIgnored, slugify, toPosix, isInsideRoot } from './paths.js';
import {
  MemoryDecisionSchema,
  RuleFrontmatterSchema,
  HandoffStatusSchema,
  flattenZodError,
  type Stack,
  type FieldIssue
} from './schemas.js';
import type {
  HandoffState,
  HandoffHistoryEntry,
  MemoryDecision,
  DoctorReport,
  DoctorCheckItem,
  DiffReport,
  FileDiffItem,
  LintReport,
  LintIssue,
  ImportReport,
  ImportItem,
  SyncytiumLock,
  CanonicalRule,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  SyncytiumConfig,
  ExportBundle,
  ExportBundleOptions,
  ValidationResult
} from './types.js';
import { VERSION } from '../version.js';

/** Cap on `completedWork` entries so HANDOFF.md never grows without bound. */
const MAX_COMPLETED_WORK = 40;
/** Cap on `touchedFiles` entries in HANDOFF.md. */
const MAX_TOUCHED_FILES = 60;

/** Files that must never be served by the local UI server, even in-root. */
const SENSITIVE_FILE_PATTERN =
  /(^|\/)(\.env(\..+)?|.*\.(pem|key|p12|pfx|keystore|jks|asc|gpg)|id_(rsa|dsa|ecdsa|ed25519)|credentials(\..+)?|\.npmrc|\.netrc|\.pypirc)$/i;

const SENSITIVE_DIR_PATTERN = /(^|\/)\.git(\/|$)/i;

/** Perspectives the UI and the API accept; anything else is treated as `all`. */
const KNOWN_CATEGORIES = new Set(['ide', 'cli', 'extension', 'agent', 'brain', 'generic']);

export interface SyncResult {
  count: number;
  paths: string[];
  pruned: string[];
  elapsedMs: number;
  rulesCount: number;
  decisionsCount: number;
  skippedByLock?: string;
}

export interface KnowledgeGraphOptions {
  compact?: boolean;
  excludeFiles?: boolean;
  excludeTags?: boolean;
  category?: 'all' | 'ide' | 'cli' | 'extension' | 'brain' | 'agent' | string;
}

export interface UiServerOptions {
  port?: number;
  open?: boolean;
  compact?: boolean;
  excludeFiles?: boolean;
  excludeTags?: boolean;
  category?: string;
  /** When true the HTTP API is reachable from other origins. Off by default. */
  allowRemote?: boolean;
}

export class SyncytiumEngine {
  readonly storage: SyncytiumStorage;
  readonly registry: AdapterRegistry;

  constructor(rootDir: string = process.cwd()) {
    this.storage = new SyncytiumStorage(rootDir);
    this.registry = new AdapterRegistry();
  }

  async detectStack(): Promise<Stack> {
    const root = this.storage.rootDir;
    const has = async (file: string): Promise<boolean> => {
      try {
        await fs.access(path.join(root, file));
        return true;
      } catch {
        return false;
      }
    };

    const candidates: [Stack, string[]][] = [
      ['typescript', ['tsconfig.json']],
      ['rust', ['Cargo.toml']],
      ['go', ['go.mod', 'go.sum']],
      ['kotlin', ['build.gradle.kts', 'settings.gradle.kts']],
      ['java', ['pom.xml', 'build.gradle', 'settings.gradle']],
      ['python', ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Pipfile']],
      ['php', ['composer.json']],
      ['ruby', ['Gemfile', '.ruby-version']],
      ['dotnet', ['global.json']],
      ['swift', ['Package.swift']],
      ['elixir', ['mix.exs']]
    ];

    for (const [stack, files] of candidates) {
      for (const file of files) {
        if (await has(file)) return stack;
      }
    }

    if (await has('package.json')) return 'typescript';
    if (await has('index.js') || (await has('index.mjs'))) return 'javascript';
    return 'generic';
  }

  async init(projectName?: string, stack?: string, force = false): Promise<{ stack: Stack }> {
    const targetStack = normalizeStack(stack || (await this.detectStack()));
    await this.storage.init(projectName, targetStack, force);
    return { stack: targetStack };
  }

  /**
   * Installs any `customAdapters` declared in the config and returns the ids to
   * run. Unknown ids are kept so `doctor`/`validate` can report them.
   */
  private async resolveAdapters(config: SyncytiumConfig): Promise<string[]> {
    this.registry.applyConfig(config);
    return config.enabledAdapters;
  }

  private filterIgnoredFiles<T extends { relativePath: string }>(
    files: T[],
    ignores: string[]
  ): { kept: T[]; skipped: T[] } {
    if (ignores.length === 0) return { kept: files, skipped: [] };
    const kept: T[] = [];
    const skipped: T[] = [];
    for (const file of files) {
      const rel = toPosix(file.relativePath);
      if (isIgnored(rel, ignores).ignored) {
        skipped.push(file);
      } else {
        kept.push(file);
      }
    }
    return { kept, skipped };
  }

  /**
   * Discovers files on disk that carry the Syncytium banner.
   * Used for orphan detection (prune) and for safe `clean`.
   */
  private async findManagedFiles(targets: string[]): Promise<string[]> {
    const found: string[] = [];
    for (const target of targets) {
      const full = path.join(this.storage.rootDir, target);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          // `base` must be the workspace root so the returned paths line up with
          // the relative paths the adapters report (`.cursor/rules/x.mdc`).
          await this.walkManagedFiles(full, this.storage.rootDir, found, 0);
        } else {
          const content = await fs.readFile(full, 'utf-8');
          if (content.includes(BANNER_MARKER)) found.push(toPosix(target));
        }
      } catch {
        // Missing target: nothing to do.
      }
    }
    return dedupe(found);
  }

  private async walkManagedFiles(
    dir: string,
    base: string,
    out: string[],
    depth: number
  ): Promise<void> {
    if (depth > 4) return;
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue;
        await this.walkManagedFiles(full, base, out, depth + 1);
        continue;
      }
      if (!/\.(md|mdc|mdx|txt|rules|yml|yaml|json)$/i.test(entry) && entry !== '.cursorrules' && entry !== '.clinerules' && entry !== '.windsurfrules' && entry !== '.traerules' && entry !== '.roomodes') {
        continue;
      }
      try {
        const content = await fs.readFile(full, 'utf-8');
        if (content.includes(BANNER_MARKER)) out.push(toPosix(path.relative(base, full)));
      } catch {
        // unreadable file: skip
      }
    }
  }

  /** Warns or blocks when a different agent currently holds the workspace lease. */
  private async assertLockAvailable(action: string, enforce: boolean): Promise<string | undefined> {
    const lock = await this.getLockStatus();
    if (!lock.locked || lock.isExpired) return undefined;
    const holder = lock.agent || 'another agent';
    if (enforce) {
      throw new Error(
        `Workspace is locked by '${holder}' until ${lock.expiresAt}. ` +
          `Wait for the lease, pass --force, or run \`syncytium lock release --agent "${holder}"\`. (blocked: ${action})`
      );
    }
    return `Warning: workspace lock is held by '${holder}' (expires ${lock.expiresAt}); ${action} anyway.`;
  }

  async sync(adapterFilter?: string[], options?: { force?: boolean; noPrune?: boolean }): Promise<SyncResult> {
    const startTime = performance.now();

    if (!(await this.storage.exists())) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }

    const config = await this.storage.loadConfig();
    const lockWarning = await this.assertLockAvailable(
      'sync',
      config.options.enforceLock && options?.force !== true
    );
    if (lockWarning) console.error(pc.yellow(lockWarning));

    const context = await this.storage.loadCanonicalContext();
    const targets =
      adapterFilter && adapterFilter.length > 0
        ? adapterFilter
        : await this.resolveAdapters(config);

    const { files } = await this.registry.generateAll(context, targets);
    const ignores = await this.storage.loadIgnorePatterns();
    const { kept } = this.filterIgnoredFiles(files, ignores);

    const writtenPaths = await this.registry.writeFiles(this.storage.rootDir, kept, {
      preserveUserSections: config.options.preserveCustomSections
    });

    let pruned: string[] = [];
    if (config.options.pruneOrphans && options?.noPrune !== true) {
      pruned = await this.pruneOrphans(targets, new Set(writtenPaths));
    }

    return {
      count: writtenPaths.length,
      paths: writtenPaths,
      pruned,
      elapsedMs: Math.round(performance.now() - startTime),
      rulesCount: context.rules.length,
      decisionsCount: context.decisions.length
    };
  }

  /**
   * Deletes generated files whose source rule/adapter output no longer exists.
   * Only files carrying the Syncytium banner are ever removed.
   */
  private async pruneOrphans(targets: string[], keep: Set<string>): Promise<string[]> {
    const adapters = targets
      .map(id => this.registry.get(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
    const managedTargets = dedupe(adapters.flatMap(a => a.defaultTargetFiles));

    const onDisk = await this.findManagedFiles(managedTargets);
    const orphans = onDisk.filter(rel => !keep.has(rel));
    const removed: string[] = [];

    for (const rel of orphans) {
      const full = path.join(this.storage.rootDir, rel);
      try {
        const content = await fs.readFile(full, 'utf-8');
        if (!content.includes(BANNER_MARKER)) continue;
        await fs.unlink(full);
        removed.push(rel);
      } catch {
        // already gone
      }
    }

    // Drop directories that Syncytium created and that are now empty.
    for (const target of managedTargets) {
      if (removed.some(r => r.startsWith(`${toPosix(target)}/`))) {
        await this.removeIfEmpty(path.join(this.storage.rootDir, target));
      }
    }

    return removed;
  }

  private async removeIfEmpty(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);
      if (entries.length === 0) await fs.rmdir(dir);
    } catch {
      // Not empty or gone: keep it.
    }
  }

  async diff(
    adapterFilter?: string[],
    options?: { full?: boolean }
  ): Promise<DiffReport> {
    if (!(await this.storage.exists())) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }

    const config = await this.storage.loadConfig();
    const context = await this.storage.loadCanonicalContext();
    const targets =
      adapterFilter && adapterFilter.length > 0
        ? adapterFilter
        : await this.resolveAdapters(config);

    const { files } = await this.registry.generateAll(context, targets);
    const ignores = await this.storage.loadIgnorePatterns();
    const { kept } = this.filterIgnoredFiles(files, ignores);

    const items: FileDiffItem[] = [];
    let identical = 0;
    let modified = 0;
    let missingOnDisk = 0;
    let unmanaged = 0;

    for (const genFile of kept) {
      const diskPath = path.join(this.storage.rootDir, genFile.relativePath);
      try {
        const diskContent = await fs.readFile(diskPath, 'utf-8');
        // A preserved user section is intentionally absent from the generated
        // content, so it must be excluded from the comparison or it would read
        // as permanent drift. Trailing blank lines are likewise not meaningful.
        const comparableDisk = config.options.preserveCustomSections
          ? stripPreservedSection(diskContent).replace(/\s+$/, '')
          : diskContent;
        const result = createUnifiedDiff(
          genFile.relativePath,
          comparableDisk,
          genFile.content.replace(/\s+$/, ''),
          { maxHunkLines: options?.full ? 400 : 40 }
        );
        if (result.changedLines === 0) {
          items.push({ relativePath: genFile.relativePath, status: 'identical', adapterId: genFile.adapterId });
          identical++;
        } else {
          items.push({
            relativePath: genFile.relativePath,
            status: 'modified',
            adapterId: genFile.adapterId,
            changedLines: result.changedLines,
            driftSummary: summarizeDiff(genFile.relativePath, diskContent, genFile.content),
            patch: result.patch
          });
          modified++;
        }
      } catch {
        items.push({
          relativePath: genFile.relativePath,
          status: 'missing_on_disk',
          adapterId: genFile.adapterId,
          driftSummary: 'Target file does not exist on disk'
        });
        missingOnDisk++;
      }
    }

    // Orphans: banner-tagged files that the current rule set no longer produces.
    const managedTargets = dedupe(
      targets
        .map(id => this.registry.get(id))
        .filter((a): a is NonNullable<typeof a> => a !== undefined)
        .flatMap(a => a.defaultTargetFiles)
    );
    const expected = new Set(kept.map(f => toPosix(f.relativePath)));
    for (const rel of await this.findManagedFiles(managedTargets)) {
      if (expected.has(rel) || isIgnored(rel, ignores).ignored) continue;
      items.push({
        relativePath: rel,
        status: 'unmanaged',
        driftSummary:
          'Orphaned Syncytium file: no canonical rule/adapter generates it any more. `syncytium sync` will remove it.'
      });
      unmanaged++;
    }

    return {
      hasDrift: modified > 0 || missingOnDisk > 0 || unmanaged > 0,
      items,
      summary: { identical, modified, missingOnDisk, unmanaged }
    };
  }

  async doctor(): Promise<DoctorReport> {
    const checks: DoctorCheckItem[] = [];
    const emptyStats = {
      rulesCount: 0,
      decisionsCount: 0,
      enabledAdaptersCount: 0,
      activeHandoffGoal: 'Not initialized',
      activeAgent: 'None'
    };

    if (!(await this.storage.exists())) {
      checks.push({
        id: 'root',
        name: 'Syncytium Root Directory',
        status: 'error',
        message: 'Missing .syncytium/ directory in workspace root.',
        detail: 'Run `syncytium init` to initialize the project.',
        fix: 'syncytium init'
      });
      return { overallStatus: 'unhealthy', checks, stats: emptyStats };
    }

    checks.push({
      id: 'root',
      name: 'Syncytium Root Directory',
      status: 'ok',
      message: 'Found .syncytium/ single source of truth directory.'
    });

    // 1. Config validity (previously a dead try/catch: loadConfig never threw).
    const { config, usedDefaults, issues: configIssues, migratedFrom } =
      await this.storage.loadConfigDetailed();
    if (usedDefaults && configIssues.length > 0) {
      checks.push({
        id: 'config',
        name: 'Configuration (syncytium.config.json)',
        status: 'error',
        message: `Configuration is invalid; defaults were substituted (${configIssues.length} problem(s)).`,
        detail: configIssues.map(i => `${i.path}: ${i.message}`).join('\n              '),
        fix: 'syncytium validate --fix'
      });
    } else if (usedDefaults) {
      checks.push({
        id: 'config',
        name: 'Configuration (syncytium.config.json)',
        status: 'error',
        message: 'syncytium.config.json is missing; default configuration is being used.',
        fix: 'syncytium init --force'
      });
    } else {
      const detail = migratedFrom
        ? `Migrated in-memory from schema v${migratedFrom} to v${config.version}. Run \`syncytium sync\` to persist.`
        : undefined;
      checks.push({
        id: 'config',
        name: 'Configuration (syncytium.config.json)',
        status: detail ? 'warn' : 'ok',
        message: `Valid configuration with ${config.enabledAdapters.length} enabled adapters (${config.enabledAdapters.join(', ')}).`,
        detail
      });
    }

    // 2. Unknown adapters.
    const unknown = config.enabledAdapters.filter(id => !this.registry.get(id));
    if (unknown.length > 0) {
      checks.push({
        id: 'adapters',
        name: 'Adapter Registry',
        status: 'error',
        message: `Unknown adapter id(s) in config: ${unknown.join(', ')}.`,
        detail: `Available: ${this.registry.list().map(a => a.id).join(', ')}`,
        fix: 'syncytium adapters'
      });
    } else {
      checks.push({
        id: 'adapters',
        name: 'Adapter Registry',
        status: 'ok',
        message: `All ${config.enabledAdapters.length} enabled adapters are registered.`
      });
    }

    // 3. Rules.
    const rules = await this.storage.loadRules();
    const unsafeIds = rules.filter(r => r.id !== slugify(r.id, '')).map(r => r.id);
    const duplicateIds = findDuplicates(rules.map(r => r.id));
    if (rules.length === 0) {
      checks.push({
        id: 'rules',
        name: 'Canonical Rules (.syncytium/rules/)',
        status: 'warn',
        message: 'No rules found in .syncytium/rules/',
        detail: 'Add markdown files in .syncytium/rules/ (e.g. code-style.md) to define project standards.',
        fix: 'syncytium rule add --title "Code Style" --body "..."'
      });
    } else {
      const details: string[] = [];
      if (duplicateIds.length > 0) {
        details.push(`Duplicate rule id(s): ${duplicateIds.join(', ')}.`);
      }
      if (unsafeIds.length > 0) {
        details.push(
          `Rule id(s) are not filename-safe and will be slugged in generated output: ${unsafeIds.join(', ')}.`
        );
      }
      checks.push({
        id: 'rules',
        name: 'Canonical Rules (.syncytium/rules/)',
        status: details.length > 0 ? 'warn' : 'ok',
        message: `Found ${rules.length} active canonical rules (${rules.map(r => r.id).join(', ')}).`,
        detail: details.join(' ')
      });
    }

    // 4. Decisions.
    const decisions = await this.storage.loadDecisions();
    checks.push({
      id: 'decisions',
      name: 'Architecture Decision Records (ADR)',
      status: 'ok',
      message: `Found ${decisions.length} recorded architectural decision(s) in memory/decisions.md.`
    });

    // 5. Handoff.
    const handoff = await this.storage.loadHandoff();
    if (!handoff.goal && handoff.activeAgent === 'None') {
      checks.push({
        id: 'handoff',
        name: 'Live Agent Handoff (HANDOFF.md)',
        status: 'warn',
        message: 'No handoff state recorded yet.',
        fix: 'syncytium handoff -i'
      });
    } else {
      checks.push({
        id: 'handoff',
        name: 'Live Agent Handoff (HANDOFF.md)',
        status: 'ok',
        message: `Active Agent: ${handoff.activeAgent} | Status: ${handoff.status.toUpperCase()} | Next: ${handoff.nextAgent || 'Any'}`,
        detail: `Current Goal: "${handoff.goal}"`
      });
    }

    // 6. Bridge file drift.
    try {
      const diffResult = await this.diff();
      const s = diffResult.summary;
      if (diffResult.hasDrift) {
        checks.push({
          id: 'drift',
          name: 'Bridge Files Status',
          status: s.modified + s.missingOnDisk > 0 ? 'warn' : 'warn',
          message: `${s.modified} modified, ${s.missingOnDisk} missing, ${s.unmanaged} orphaned, ${s.identical} in sync.`,
          detail: 'Run `syncytium sync` to synchronize bridge files and prune orphans.',
          fix: 'syncytium sync'
        });
      } else {
        checks.push({
          id: 'drift',
          name: 'Bridge Files Status',
          status: 'ok',
          message: `All ${s.identical} bridge files are fully synchronized with .syncytium/`
        });
      }
    } catch (err) {
      checks.push({
        id: 'drift',
        name: 'Bridge Files Status',
        status: 'warn',
        message: `Could not verify bridge files: ${(err as Error).message}`
      });
    }

    // 7. Multi-agent lock.
    const lock = await this.getLockStatus();
    if (lock.locked && !lock.isExpired) {
      checks.push({
        id: 'lock',
        name: 'Multi-Agent Lock',
        status: 'warn',
        message: `Locked by '${lock.agent || 'unknown'}' until ${lock.expiresAt}${lock.goal ? ` — ${lock.goal}` : ''}.`,
        fix: `syncytium lock release --agent "${lock.agent}"`
      });
    } else {
      checks.push({
        id: 'lock',
        name: 'Multi-Agent Lock',
        status: 'ok',
        message: lock.locked ? 'Previous lock has expired and is free to take.' : 'Unlocked — no agent holds the lease.'
      });
    }

    // 8. Git pre-commit hook.
    const hook = await this.gitHookStatus();
    checks.push(
      hook.installed
        ? {
            id: 'hook',
            name: 'Git Pre-Commit Hook',
            status: 'ok',
            message: `Syncytium pre-commit hook is active (${hook.mode}).`
          }
        : {
            id: 'hook',
            name: 'Git Pre-Commit Hook',
            status: 'warn',
            message: 'No Syncytium pre-commit hook found in .git/hooks.',
            fix: 'syncytium hook install'
          }
    );

    // 9. CI workflow.
    const ci = await this.ciStatus();
    checks.push(
      ci.present
        ? {
            id: 'ci',
            name: 'CI Drift Gate',
            status: /diff\s+--check/.test(ci.content) ? 'ok' : 'warn',
            message: /diff\s+--check/.test(ci.content)
              ? 'CI workflow enforces zero context drift (syncytium diff --check).'
              : 'CI workflow found but it does not use `syncytium diff --check`, so the drift gate cannot fail.',
            fix: /diff\s+--check/.test(ci.content) ? undefined : 'syncytium ci --force'
          }
        : {
            id: 'ci',
            name: 'CI Drift Gate',
            status: 'warn',
            message: 'No Syncytium GitHub Actions workflow found.',
            fix: 'syncytium ci'
          }
    );

    // 10. Lint.
    const lint = await this.lint();
    const errors = lint.issues.filter(i => i.type === 'error').length;
    const warnings = lint.issues.length - errors;
    checks.push(
      errors === 0 && warnings === 0
        ? {
            id: 'lint',
            name: 'Canonical Content Lint',
            status: 'ok',
            message: `All ${lint.totalChecked} checked files are valid.`
          }
        : {
            id: 'lint',
            name: 'Canonical Content Lint',
            status: errors > 0 ? 'error' : 'warn',
            message: `${errors} error(s), ${warnings} warning(s) across ${lint.totalChecked} files.`,
            detail: lint.issues
              .slice(0, 5)
              .map(i => `${i.file}: ${i.message}`)
              .join('\n              '),
            fix: 'syncytium lint --fix'
          }
    );

    const overallStatus: DoctorReport['overallStatus'] = checks.some(c => c.status === 'error')
      ? 'unhealthy'
      : checks.some(c => c.status === 'warn')
        ? 'warning'
        : 'healthy';

    return {
      overallStatus,
      checks,
      stats: {
        rulesCount: rules.length,
        decisionsCount: decisions.length,
        enabledAdaptersCount: config.enabledAdapters.length,
        activeHandoffGoal: handoff.goal,
        activeAgent: handoff.activeAgent
      }
    };
  }

  async handoff(params: {
    activeAgent?: string;
    nextAgent?: string | null;
    status?: HandoffState['status'];
    goal?: string;
    completed?: string[];
    pending?: string[];
    touchedFiles?: string[];
    notes?: string;
    autoSync?: boolean;
    force?: boolean;
  }): Promise<HandoffState> {
    const current = await this.storage.loadHandoff();
    const config = await this.storage.loadConfig();
    if (config.options.enforceLock && params.force !== true) {
      await this.assertLockAvailable('handoff', true);
    }

    const previousAgent = current.activeAgent;
    const status = params.status
      ? HandoffStatusSchema.parse(params.status)
      : current.status;

    const completedWork = params.completed
      ? dedupe([...current.completedWork, ...params.completed]).slice(-MAX_COMPLETED_WORK)
      : current.completedWork;

    const updated: HandoffState = {
      activeAgent: params.activeAgent || current.activeAgent,
      nextAgent:
        params.nextAgent === null
          ? undefined
          : params.nextAgent !== undefined
            ? params.nextAgent
            : current.nextAgent,
      status,
      goal: params.goal ?? current.goal,
      completedWork,
      pendingTasks: params.pending ?? current.pendingTasks,
      touchedFiles: params.touchedFiles
        ? dedupe([...current.touchedFiles, ...params.touchedFiles]).slice(-MAX_TOUCHED_FILES)
        : current.touchedFiles,
      contextNotes: params.notes ?? current.contextNotes,
      lastUpdated: new Date().toISOString()
    };

    await this.storage.writeHandoff(updated);

    await this.storage.recordHandoffHistory({
      id: `HND-${Date.now().toString(36).toUpperCase()}`,
      timestamp: updated.lastUpdated,
      // The baton *leaves* the previously active agent.
      fromAgent: previousAgent,
      toAgent: updated.activeAgent,
      status: updated.status,
      goal: updated.goal,
      tasksDone: params.completed ?? [],
      nextTasks: updated.pendingTasks,
      activeFiles: params.touchedFiles ?? [],
      notes: params.notes
    });

    if (params.autoSync !== false) {
      await this.sync(undefined, { force: params.force });
    }

    return updated;
  }

  async getHandoffHistory(limit: number = 10): Promise<HandoffHistoryEntry[]> {
    const list = await this.storage.loadHandoffHistory();
    return list.slice(0, Math.max(0, limit));
  }

  async addDecision(input: MemoryDecision): Promise<MemoryDecision> {
    const decision = MemoryDecisionSchema.parse(input);
    await this.storage.addDecision(decision);
    await this.sync();
    return decision;
  }

  async removeDecision(id: string): Promise<boolean> {
    const removed = await this.storage.removeDecision(id);
    if (removed) await this.sync();
    return removed;
  }

  async listDecisions(filter?: { status?: string; query?: string }): Promise<MemoryDecision[]> {
    const decisions = await this.storage.loadDecisions();
    let list = decisions;
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(d => d.status === filter.status);
    }
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      list = list.filter(
        d =>
          d.id.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.decision.toLowerCase().includes(q)
      );
    }
    return list;
  }

  // ---------------------------------------------------------------- rules ---

  async addRule(input: {
    id?: string;
    title: string;
    description?: string;
    body: string;
    globs?: string[];
    tags?: string[];
    alwaysApply?: boolean;
    priority?: 'low' | 'medium' | 'high';
    sync?: boolean;
  }): Promise<{ rule: CanonicalRule; path: string }> {
    if (!(await this.storage.exists())) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }
    if (!input.body || !input.body.trim()) {
      throw new Error('Rule body cannot be empty.');
    }

    const baseId = slugify(input.id || input.title, 'rule');
    let id = baseId;
    let suffix = 2;
    while (await fs.access(this.storage.getRulePath(id)).then(() => true, () => false)) {
      id = `${baseId}-${suffix++}`;
    }

    const frontmatter = RuleFrontmatterSchema.parse({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      globs: input.globs ?? [],
      alwaysApply: input.alwaysApply ?? (input.globs ? false : true),
      tags: input.tags ?? [],
      priority: input.priority
    });

    const rule: CanonicalRule = {
      id: frontmatter.id,
      title: frontmatter.title,
      description: frontmatter.description,
      globs: frontmatter.globs,
      alwaysApply: frontmatter.alwaysApply,
      tags: frontmatter.tags,
      priority: frontmatter.priority,
      content: input.body.trim(),
      sourceFile: `.syncytium/rules/${frontmatter.id}.md`
    };

    const fileContent = matter.stringify(rule.content, omitUndefined({ ...frontmatter }));
    const target = await this.storage.saveRule(`${frontmatter.id}.md`, fileContent);

    if (input.sync !== false) await this.sync();
    return { rule, path: target };
  }

  async getRule(id: string): Promise<CanonicalRule | undefined> {
    const rules = await this.storage.loadRules();
    return rules.find(r => r.id === id || slugify(r.id, '') === slugify(id, ''));
  }

  async removeRule(id: string, options?: { sync?: boolean }): Promise<boolean> {
    const rule = await this.getRule(id);
    if (!rule) return false;
    const removed = await this.storage.deleteRuleFile(slugify(rule.id, 'rule'));
    // Some legacy files are named after the file, not the frontmatter id.
    if (!removed && rule.sourceFile) {
      try {
        await fs.unlink(path.join(this.storage.rootDir, rule.sourceFile));
        await this.storage.deleteRuleFile(path.basename(rule.sourceFile, '.md'));
        return true;
      } catch {
        return false;
      }
    }
    if (options?.sync !== false) await this.sync();
    return removed;
  }

  /**
   * Updates an existing rule in place.
   *
   * This deliberately does NOT go through `addRule`, whose id-collision
   * handling would turn an edit into a new `foo-2.md` file.
   */
  async updateRule(
    id: string,
    input: {
      title?: string;
      description?: string;
      body?: string;
      globs?: string[];
      tags?: string[];
      alwaysApply?: boolean;
      priority?: 'low' | 'medium' | 'high';
      sync?: boolean;
    }
  ): Promise<{ rule: CanonicalRule; path: string }> {
    const existing = await this.getRule(id);
    if (!existing) throw new Error(`No rule with id "${id}". Use \`syncytium rule add\` first.`);

    if (input.body !== undefined && !input.body.trim()) {
      throw new Error('Rule body cannot be empty.');
    }

    const globs = input.globs ?? existing.globs ?? [];
    const merged = RuleFrontmatterSchema.parse({
      id: existing.id,
      title: input.title?.trim() ?? existing.title,
      description: input.description?.trim() || existing.description,
      globs,
      alwaysApply: input.alwaysApply ?? (existing.alwaysApply ?? globs.length === 0),
      tags: input.tags ?? existing.tags ?? [],
      priority: input.priority ?? existing.priority
    });

    const filename = path.basename(existing.sourceFile ?? `${existing.id}.md`);
    const target = path.join(this.storage.rulesDir, filename);

    const rule: CanonicalRule = {
      ...merged,
      description: merged.description,
      content: input.body?.trim() ?? existing.content,
      sourceFile: toPosix(path.relative(this.storage.rootDir, target))
    };

    await fs.writeFile(
      target,
      matter.stringify(rule.content, omitUndefined({ ...merged })),
      'utf-8'
    );

    if (input.sync !== false) await this.sync();
    return { rule, path: target };
  }

  async listRules(query?: string): Promise<CanonicalRule[]> {
    const rules = await this.storage.loadRules();
    if (!query || !query.trim()) return rules;
    const q = query.toLowerCase().trim();
    return rules.filter(r =>
      [
        r.id,
        r.title,
        r.description ?? '',
        (r.tags ?? []).join(' '),
        r.content
      ]
        .join('\n')
        .toLowerCase()
        .includes(q)
    );
  }

  // --------------------------------------------------------------- export ---

  async exportBundle(options?: ExportBundleOptions): Promise<ExportBundle> {
    const context = await this.storage.loadCanonicalContext();
    const maxChars = options?.maxRuleChars ?? 0;
    const sections: ExportBundle['sections'] = [];

    for (const rule of context.rules) {
      let body = rule.content;
      let truncated = false;
      if (maxChars > 0 && body.length > maxChars) {
        body = `${body.slice(0, maxChars)}\n… (truncated)`;
        truncated = true;
      }
      const head = rule.description ? `> ${rule.description}\n\n` : '';
      sections.push({
        heading: `📌 ${rule.title}`,
        body: `${head}${body}`,
        truncated
      });
    }

    if (options?.includeArchitecture !== false && context.architecture?.trim()) {
      sections.push({ heading: '🏗️ Architecture', body: context.architecture.trim() });
    }
    if (options?.includeDecisions !== false && context.decisions.length > 0) {
      sections.push({
        heading: '🧠 Architectural Decisions',
        body: context.decisions
          .map(d => `**[${d.id}] ${d.title}** (${d.status})\n${d.decision}`)
          .join('\n\n')
      });
    }
    if (options?.includeHandoff !== false) {
      const h = context.handoff;
      sections.push({
        heading: '🤝 Live Handoff',
        body: [
          `Active Agent: ${h.activeAgent}`,
          `Next Agent: ${h.nextAgent ?? 'Any'}`,
          `Status: ${h.status.toUpperCase()}`,
          `Goal: ${h.goal || 'none'}`,
          h.pendingTasks.length > 0 ? `Pending:\n${h.pendingTasks.map(t => `- [ ] ${t}`).join('\n')}` : ''
        ]
          .filter(Boolean)
          .join('\n')
      });
    }

    const markdown = [
      `# ${context.projectName} — AI Context Bundle`,
      '',
      `> Exported by SyncytiumMD v${VERSION} at ${new Date().toISOString()}`,
      '',
      ...sections.flatMap(s => [`## ${s.heading}`, '', s.body, '', '---', '']),
      ''
    ].join('\n');

    return {
      projectName: context.projectName,
      generatedAt: new Date().toISOString(),
      version: VERSION,
      sections,
      markdown
    };
  }

  // -------------------------------------------------------------- cleanup ---

  async clean(adapterFilter?: string[]): Promise<string[]> {
    const config = await this.storage.loadConfig();
    const targets =
      adapterFilter && adapterFilter.length > 0
        ? adapterFilter
        : await this.resolveAdapters(config);
    return this.registry.cleanManagedFiles(this.storage.rootDir, targets);
  }

  async getStatus(): Promise<{
    initialized: boolean;
    projectName: string;
    version: string;
    rulesCount: number;
    decisionsCount: number;
    activeAdapters: string[];
    handoff: HandoffState;
    lock: SyncytiumLock & { isExpired?: boolean };
  }> {
    const initialized = await this.storage.exists();
    if (!initialized) {
      return {
        initialized: false,
        projectName: '',
        version: VERSION,
        rulesCount: 0,
        decisionsCount: 0,
        activeAdapters: [],
        handoff: await this.storage.loadHandoff(),
        lock: { locked: false, isExpired: false }
      };
    }

    const config = await this.storage.loadConfig();
    const rules = await this.storage.loadRules();
    const decisions = await this.storage.loadDecisions();
    return {
      initialized: true,
      projectName: config.projectName,
      version: VERSION,
      rulesCount: rules.length,
      decisionsCount: decisions.length,
      activeAdapters: config.enabledAdapters,
      handoff: await this.storage.loadHandoff(),
      lock: await this.getLockStatus()
    };
  }

  // ------------------------------------------------------------- validate ---

  async validate(options?: { fix?: boolean }): Promise<ValidationResult> {
    const issues: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];

    const { config, usedDefaults, issues: configIssues } = await this.storage.loadConfigDetailed();
    issues.push(...configIssues);
    if (usedDefaults && configIssues.length === 0) {
      issues.push({ path: 'syncytium.config.json', message: 'File not found; defaults are in use.' });
    }

    for (const id of config.enabledAdapters) {
      if (!this.registry.get(id) && !config.customAdapters.some(c => c.id === id)) {
        issues.push({
          path: `enabledAdapters.${id}`,
          message: 'Unknown adapter id. Run `syncytium adapters` to list valid ids.'
        });
      }
    }

    for (const custom of config.customAdapters) {
      if (!custom.targetFile || custom.targetFile.trim().length === 0) {
        issues.push({
          path: `customAdapters.${custom.id}`,
          message: 'Custom adapter is missing a targetFile.'
        });
      }
    }

    if (options?.fix) {
      if (configIssues.length > 0 || usedDefaults) {
        await this.storage.saveConfig(config);
      }
    } else if (configIssues.length > 0) {
      warnings.push({ path: 'syncytium.config.json', message: 'Run `syncytium validate --fix` to rewrite with defaults.' });
    }

    // Rule frontmatter validation via the shared zod schema.
    const ruleFiles = await this.storage.listRuleFiles();
    for (const file of ruleFiles) {
      const raw = await fs.readFile(path.join(this.storage.rulesDir, file), 'utf-8').catch(() => null);
      if (raw === null) continue;
      try {
        const parsed = matter(raw);
        const result = RuleFrontmatterSchema.safeParse(parsed.data);
        if (!result.success) {
          for (const issue of flattenZodError(result.error)) {
            issues.push({ path: `.syncytium/rules/${file}:${issue.path}`, message: issue.message });
          }
        } else if (result.data.id !== path.basename(file, '.md')) {
          warnings.push({
            path: `.syncytium/rules/${file}`,
            message: `Frontmatter id "${result.data.id}" does not match filename "${path.basename(file, '.md')}".`
          });
        }
      } catch (err) {
        issues.push({
          path: `.syncytium/rules/${file}`,
          message: `Invalid YAML frontmatter: ${(err as Error).message}`
        });
      }
    }

    return { valid: issues.length === 0, issues, warnings };
  }

  // --------------------------------------------------------------- import ---

  async importExisting(options?: { dryRun?: boolean }): Promise<ImportReport> {
    const root = this.storage.rootDir;
    const candidates = [
      { file: 'CLAUDE.md', adapter: 'claude', ruleId: 'imported-claude', title: 'Imported Claude Code Guidelines' },
      { file: 'AGENTS.md', adapter: 'agents', ruleId: 'imported-agents', title: 'Imported AGENTS.md Guidelines' },
      { file: 'GEMINI.md', adapter: 'gemini', ruleId: 'imported-gemini', title: 'Imported Gemini CLI Guidelines' },
      { file: '.cursorrules', adapter: 'cursor', ruleId: 'imported-cursorrules', title: 'Imported Cursor Guidelines' },
      { file: '.github/copilot-instructions.md', adapter: 'copilot', ruleId: 'imported-copilot', title: 'Imported GitHub Copilot Guidelines' },
      { file: '.clinerules', adapter: 'cline', ruleId: 'imported-cline', title: 'Imported Cline Guidelines' },
      { file: '.windsurfrules', adapter: 'windsurf', ruleId: 'imported-windsurf', title: 'Imported Windsurf Guidelines' },
      { file: '.traerules', adapter: 'trae', ruleId: 'imported-trae', title: 'Imported Trae Guidelines' },
      { file: 'AGENT.md', adapter: 'opencode', ruleId: 'imported-agent', title: 'Imported Agent Guidelines' },
      { file: 'CONVENTIONS.md', adapter: 'opencode', ruleId: 'imported-conventions', title: 'Imported Conventions' }
    ];

    const items: ImportItem[] = [];
    let skippedCount = 0;

    if (!(await this.storage.exists()) && !options?.dryRun) {
      await this.storage.init(undefined, 'generic');
    }

    const isManaged = (content: string): boolean =>
      content.includes('AUTO-GENERATED BY SYNCYTIUM') ||
      content.includes('Source of truth: .syncytium') ||
      content.includes('Generated by SyncytiumMD');

    for (const cand of candidates) {
      const fullPath = path.join(root, cand.file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        if (!content.trim()) {
          skippedCount++;
          continue;
        }
        if (isManaged(content)) {
          skippedCount++;
          continue;
        }

        const targetRuleFile = `${slugify(cand.ruleId, 'imported')}.md`;
        items.push({
          sourceFile: cand.file,
          adapterName: cand.adapter,
          targetRuleFile,
          extractedTitle: cand.title
        });

        if (!options?.dryRun) {
          const ruleContent = `---
id: ${targetRuleFile.replace(/\.md$/, '')}
title: ${cand.title}
description: Automatically imported from ${cand.file} by SyncytiumMD
alwaysApply: true
globs: []
tags:
  - imported
  - ${cand.adapter}
---

${content.trim()}
`;
          await this.storage.saveRule(targetRuleFile, ruleContent);
        }
      } catch {
        // File absent: nothing to import.
      }
    }

    for (const cursorDir of ['.cursor/rules', '.github/instructions']) {
      try {
        const dir = path.join(root, cursorDir);
        const files = (await fs.readdir(dir)).sort();
        for (const file of files) {
          if (!/\.(md|mdc|instructions\.md)$/.test(file)) continue;
          if (file === 'syncytium-handoff.mdc' || file === 'syncytium-architecture.mdc') continue;
          const full = path.join(dir, file);
          const content = await fs.readFile(full, 'utf-8');
          if (!content.trim() || isManaged(content)) {
            skippedCount++;
            continue;
          }
          const base = file.replace(/\.(mdc|md)$/, '');
          const targetRuleFile = `imported-${slugify(cursorDir.split('/')[0])}-${slugify(base, 'rule')}.md`;
          items.push({
            sourceFile: `${cursorDir}/${file}`,
            adapterName: cursorDir.startsWith('.cursor') ? 'cursor' : 'copilot',
            targetRuleFile,
            extractedTitle: `Imported ${slugify(base, 'rule')}`
          });
          if (!options?.dryRun) {
            await this.storage.saveRule(targetRuleFile, content);
          }
        }
      } catch {
        // Directory absent.
      }
    }

    if (!options?.dryRun && items.length > 0) {
      await this.sync();
    }

    return { importedCount: items.length, items, skippedCount };
  }

  // ----------------------------------------------------------------- lint ---

  async lint(options?: { fix?: boolean }): Promise<LintReport> {
    const issues: LintIssue[] = [];
    let totalChecked = 0;
    let fixedCount = 0;

    if (!(await this.storage.exists())) {
      issues.push({
        file: '.syncytium',
        type: 'error',
        code: 'not-initialized',
        message: '.syncytium/ directory does not exist. Run `syncytium init` first.'
      });
      return { valid: false, issues, totalChecked: 0, fixedCount: 0 };
    }

    // 1. Rule files. Every directory entry is checked, not just the `.md`
    //    ones, so a stray `notes.txt` is reported instead of ignored.
    const allEntries = await fs.readdir(this.storage.rulesDir).catch(() => [] as string[]);
    allEntries.sort((a, b) => a.localeCompare(b, 'en'));
    for (const file of allEntries) {
      totalChecked++;
      let currentFileName = file;
      const filePath = `.syncytium/rules/${currentFileName}`;

      if (!currentFileName.endsWith('.md')) {
        issues.push({
          file: filePath,
          type: 'warning',
          code: 'rule-extension',
          message: `Rule file should have .md extension, found: ${currentFileName}`
        });
        continue;
      }

      let baseName = path.basename(currentFileName, '.md');
      if (!/^[a-z0-9-]+$/.test(baseName)) {
        if (options?.fix) {
          const kebab = slugify(baseName, 'rule');
          const newFileName = `${kebab}.md`;
          const oldPath = path.join(this.storage.rulesDir, currentFileName);
          const newPath = path.join(this.storage.rulesDir, newFileName);
          if (oldPath === newPath) {
            // Nothing to rename; the name is already canonical.
          } else if (await fs.access(newPath).then(() => true, () => false)) {
            issues.push({
              file: filePath,
              type: 'error',
              code: 'rule-rename-collision',
              message: `Cannot auto-fix to "${newFileName}" because that file already exists. Merge the rules manually.`
            });
            continue;
          } else {
            await fs.rename(oldPath, newPath);
            currentFileName = newFileName;
            baseName = kebab;
            fixedCount++;
          }
        } else {
          issues.push({
            file: filePath,
            type: 'warning',
            code: 'rule-kebab-case',
            message: `Rule filename "${file}" should follow kebab-case (e.g. "code-style.md").`
          });
        }
      }

      const fullPath = path.join(this.storage.rulesDir, currentFileName);
      const raw = await fs.readFile(fullPath, 'utf-8');
      if (!raw.trim()) {
        issues.push({
          file: filePath,
          type: 'error',
          code: 'rule-empty',
          message: 'Rule file is empty.'
        });
        continue;
      }

      try {
        const parsed = matter(raw);
        if (options?.fix && (!parsed.data.id || !parsed.data.title)) {
          // Spread the existing data first so explicit values always win over
          // the defaults we are healing in.
          const healedData = {
            ...parsed.data,
            id: parsed.data.id || slugify(baseName, 'rule'),
            title:
              parsed.data.title ||
              baseName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            alwaysApply: parsed.data.alwaysApply ?? true,
            globs: Array.isArray(parsed.data.globs) ? parsed.data.globs : [],
            tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : []
          };
          await fs.writeFile(
            fullPath,
            matter.stringify(parsed.content.trim(), healedData),
            'utf-8'
          );
          fixedCount++;
        }

        if (parsed.data.globs !== undefined && !Array.isArray(parsed.data.globs)) {
          issues.push({
            file: filePath,
            type: 'error',
            code: 'rule-globs-type',
            message: 'Frontmatter "globs" must be an array of strings.'
          });
        }
        if (parsed.data.tags !== undefined && !Array.isArray(parsed.data.tags)) {
          issues.push({
            file: filePath,
            type: 'warning',
            code: 'rule-tags-type',
            message: 'Frontmatter "tags" must be an array of strings.'
          });
        }
        if (parsed.data.alwaysApply !== undefined && typeof parsed.data.alwaysApply !== 'boolean') {
          issues.push({
            file: filePath,
            type: 'warning',
            code: 'rule-always-apply-type',
            message: 'Frontmatter "alwaysApply" should be a boolean.'
          });
        }
        if (parsed.data.id !== undefined && typeof parsed.data.id !== 'string') {
          issues.push({
            file: filePath,
            type: 'error',
            code: 'rule-id-type',
            message: 'Frontmatter "id" must be a string.'
          });
        }
        if (typeof parsed.data.id === 'string' && parsed.data.id !== slugify(parsed.data.id, '')) {
          issues.push({
            file: filePath,
            type: 'warning',
            code: 'rule-id-unsafe',
            ruleId: parsed.data.id,
            message: `Rule id "${parsed.data.id}" is not filename-safe; generated output will use "${slugify(parsed.data.id, 'rule')}".`
          });
        }
        if (!parsed.content.trim()) {
          issues.push({
            file: filePath,
            type: 'error',
            code: 'rule-body-empty',
            message: 'Rule markdown body is empty after frontmatter.'
          });
        }
      } catch (err) {
        issues.push({
          file: filePath,
          type: 'error',
          code: 'rule-frontmatter',
          message: `Invalid YAML frontmatter: ${(err as Error).message}`
        });
      }
    }

    // 2. Duplicate ids across rule files.
    const rules = await this.storage.loadRules();
    for (const dup of findDuplicates(rules.map(r => r.id))) {
      issues.push({
        file: '.syncytium/rules',
        type: 'error',
        code: 'rule-duplicate-id',
        ruleId: dup,
        message: `Duplicate rule id "${dup}": generated filenames would collide.`
      });
    }

    // 3. architecture.md
    totalChecked++;
    const arch = await this.storage.loadArchitecture();
    if (!arch.trim()) {
      issues.push({
        file: '.syncytium/architecture.md',
        type: 'warning',
        code: 'architecture-empty',
        message: 'architecture.md is empty. Add system architecture details for AI agents.'
      });
    }

    // 4. HANDOFF.md
    totalChecked++;
    const handoff = await this.storage.loadHandoff();
    if (!handoff.activeAgent) {
      issues.push({
        file: '.syncytium/HANDOFF.md',
        type: 'warning',
        code: 'handoff-agent',
        message: 'Active agent is not specified in HANDOFF.md'
      });
    }

    // 5. decisions.md
    totalChecked++;
    try {
      const decisions = await this.storage.loadDecisions();
      const invalid = decisions.filter(d => !MemoryDecisionSchema.safeParse(d).success);
      if (invalid.length > 0) {
        for (const d of invalid) {
          issues.push({
            file: '.syncytium/memory/decisions.md',
            type: 'error',
            code: 'adr-schema',
            message: `ADR "${d?.id ?? 'unknown'}" does not match the required schema (id/title/status/date/context/decision/consequences).`
          });
        }
      }
      for (const dup of findDuplicates(decisions.map(d => d.id))) {
        issues.push({
          file: '.syncytium/memory/decisions.md',
          type: 'error',
          code: 'adr-duplicate-id',
          message: `Duplicate ADR id "${dup}".`
        });
      }
    } catch (err) {
      issues.push({
        file: '.syncytium/memory/decisions.md',
        type: 'error',
        code: 'adr-parse',
        message: `Failed to parse decisions.md: ${(err as Error).message}`
      });
    }

    // 6. config
    totalChecked++;
    const { usedDefaults, issues: configIssues } = await this.storage.loadConfigDetailed();
    for (const issue of configIssues) {
      issues.push({
        file: '.syncytium/syncytium.config.json',
        type: 'error',
        code: 'config-schema',
        message: `${issue.path}: ${issue.message}`
      });
    }
    if (usedDefaults && configIssues.length === 0) {
      issues.push({
        file: '.syncytium/syncytium.config.json',
        type: 'warning',
        code: 'config-missing',
        message: 'Config file missing; defaults are in use.'
      });
    }

    return {
      valid: !issues.some(i => i.type === 'error'),
      issues,
      totalChecked,
      fixedCount
    };
  }

  // ---------------------------------------------------------------- hooks ---

  private async gitHookStatus(): Promise<{ installed: boolean; mode: 'auto-sync' | 'drift-check' | 'unknown' }> {
    try {
      const content = await fs.readFile(
        path.join(this.storage.rootDir, '.git', 'hooks', 'pre-commit'),
        'utf-8'
      );
      if (!content.includes('BEGIN SYNCYTIUM HOOK')) return { installed: false, mode: 'unknown' };
      return {
        installed: true,
        mode: content.includes('syncytium sync') ? 'auto-sync' : 'drift-check'
      };
    } catch {
      return { installed: false, mode: 'unknown' };
    }
  }

  async installGitHook(options?: { autoSync?: boolean }): Promise<{ success: boolean; hookPath: string }> {
    const gitDir = path.join(this.storage.rootDir, '.git');
    try {
      await fs.access(gitDir);
    } catch {
      throw new Error('Not a git repository: .git folder not found in workspace root.');
    }

    const hooksDir = path.join(gitDir, 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, 'pre-commit');

    const hookScript = options?.autoSync
      ? `
# --- BEGIN SYNCYTIUM HOOK ---
# Auto-sync bridge files before commit
npx --no-install syncytium sync >/dev/null 2>&1 || npx --yes syncytium-md@latest sync
git add -u
# --- END SYNCYTIUM HOOK ---
`
      : `
# --- BEGIN SYNCYTIUM HOOK ---
# Block the commit when generated bridge files drifted from .syncytium/
if command -v npx >/dev/null 2>&1; then
  npx --no-install syncytium diff --check || {
    echo "[Syncytium] Context drift detected. Run 'syncytium sync' and stage the result."
    exit 1
  }
fi
# --- END SYNCYTIUM HOOK ---
`;

    let existingContent = '';
    try {
      existingContent = await fs.readFile(hookPath, 'utf-8');
    } catch {
      existingContent = '#!/bin/sh\n';
    }

    const cleanContent = existingContent
      .replace(/# --- BEGIN SYNCYTIUM HOOK ---[\s\S]*?# --- END SYNCYTIUM HOOK ---\r?\n?/g, '')
      .trimEnd();

    await fs.writeFile(hookPath, `${cleanContent}\n${hookScript}`, { mode: 0o755 });
    return { success: true, hookPath };
  }

  async uninstallGitHook(): Promise<{ success: boolean; hookPath: string }> {
    const hookPath = path.join(this.storage.rootDir, '.git', 'hooks', 'pre-commit');
    try {
      const content = await fs.readFile(hookPath, 'utf-8');
      const cleanContent = content
        .replace(/# --- BEGIN SYNCYTIUM HOOK ---[\s\S]*?# --- END SYNCYTIUM HOOK ---\r?\n?/g, '')
        .trim();

      if (!cleanContent || cleanContent === '#!/bin/sh') {
        await fs.rm(hookPath, { force: true });
      } else {
        await fs.writeFile(hookPath, `${cleanContent}\n`, { mode: 0o755 });
      }
      return { success: true, hookPath };
    } catch {
      return { success: false, hookPath };
    }
  }

  // ------------------------------------------------------------------- ci ---

  private get ciPath(): string {
    return path.join(this.storage.rootDir, '.github', 'workflows', 'syncytium.yml');
  }

  private async ciStatus(): Promise<{ present: boolean; content: string }> {
    try {
      return { present: true, content: await fs.readFile(this.ciPath, 'utf-8') };
    } catch {
      return { present: false, content: '' };
    }
  }

  async installCiWorkflow(options?: { overwrite?: boolean }): Promise<{ success: boolean; path: string }> {
    if (!(await this.storage.exists())) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }
    await fs.mkdir(path.dirname(this.ciPath), { recursive: true });

    if (!options?.overwrite) {
      try {
        await fs.access(this.ciPath);
        throw new Error('CI workflow already exists at .github/workflows/syncytium.yml (use --force to overwrite)');
      } catch (err) {
        // Re-throw only our own guard; a missing file is the happy path.
        if ((err as Error).message.includes('already exists')) throw err;
      }
    }

    await fs.writeFile(this.ciPath, CI_WORKFLOW_TEMPLATE, 'utf-8');
    return { success: true, path: this.ciPath };
  }

  async uninstallCiWorkflow(): Promise<{ removed: boolean; path: string }> {
    try {
      await fs.unlink(this.ciPath);
      return { removed: true, path: this.ciPath };
    } catch {
      return { removed: false, path: this.ciPath };
    }
  }

  // ----------------------------------------------------------------- lock ---

  async acquireLock(
    agent: string,
    goal?: string,
    leaseMinutes: number = 30,
    force = false
  ): Promise<{ acquired: boolean; lock: SyncytiumLock; message: string }> {
    if (!agent || !agent.trim()) {
      throw new Error('An agent name is required to acquire the lock (use --agent).');
    }
    if (!Number.isFinite(leaseMinutes) || leaseMinutes <= 0) {
      throw new Error('Lock lease must be a positive number of minutes.');
    }

    const current = await this.storage.loadLock();
    const now = Date.now();

    if (current.locked && current.expiresAt && !force) {
      const expires = new Date(current.expiresAt).getTime();
      if (now < expires && current.agent && current.agent !== agent) {
        return {
          acquired: false,
          lock: current,
          message: `Workspace is currently locked by '${current.agent}' until ${current.expiresAt}. Use --force to override if necessary.`
        };
      }
    }

    const lock: SyncytiumLock = {
      locked: true,
      agent,
      goal: goal || current.goal || '',
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + leaseMinutes * 60 * 1000).toISOString(),
      host: os.hostname(),
      pid: process.pid
    };

    await this.storage.saveLock(lock);
    const forced = force && current.locked ? ' (forced override)' : '';
    return {
      acquired: true,
      lock,
      message: `Lock acquired by '${agent}' for ${leaseMinutes} minutes${forced} (expires at ${lock.expiresAt}).`
    };
  }

  async releaseLock(
    agent?: string,
    force = false
  ): Promise<{ released: boolean; lock: SyncytiumLock; message: string }> {
    const current = await this.storage.loadLock();
    if (!current.locked) {
      return { released: true, lock: current, message: 'Workspace is not locked.' };
    }

    const isExpired = current.expiresAt ? new Date(current.expiresAt).getTime() <= Date.now() : false;
    if (!force && !isExpired && agent && current.agent && current.agent !== agent) {
      return {
        released: false,
        lock: current,
        message: `Cannot release lock held by '${current.agent}' without --force.`
      };
    }

    const unlocked: SyncytiumLock = { locked: false };
    await this.storage.saveLock(unlocked);
    return { released: true, lock: unlocked, message: 'Workspace lock released successfully.' };
  }

  /** Extends the lease of a lock held by `agent`. Used by `watch` to stay alive. */
  async renewLock(agent: string, leaseMinutes = 30): Promise<{ renewed: boolean; message: string }> {
    const current = await this.storage.loadLock();
    if (!current.locked || current.agent !== agent) {
      return { renewed: false, message: 'Lock is not held by this agent; nothing to renew.' };
    }
    const now = Date.now();
    const lock: SyncytiumLock = {
      ...current,
      expiresAt: new Date(now + leaseMinutes * 60 * 1000).toISOString()
    };
    await this.storage.saveLock(lock);
    return { renewed: true, message: `Lock renewed until ${lock.expiresAt}.` };
  }

  async getLockStatus(): Promise<SyncytiumLock & { isExpired: boolean }> {
    const lock = await this.storage.loadLock();
    const isExpired = lock.locked && lock.expiresAt
      ? new Date(lock.expiresAt).getTime() <= Date.now()
      : false;
    return { ...lock, isExpired };
  }

  // --------------------------------------------------------------- graph ---

  async getKnowledgeGraph(options?: KnowledgeGraphOptions): Promise<KnowledgeGraph> {
    const isCompact = options?.compact ?? false;
    const hideFiles = options?.excludeFiles ?? isCompact;
    const hideTags = options?.excludeTags ?? isCompact;
    // An unrecognised category must degrade to "all" rather than silently
    // rendering an empty graph (v0.1.x fell through every filter branch).
    const requested = options?.category?.toLowerCase();
    const filterCategory =
      requested && requested !== 'all' && KNOWN_CATEGORIES.has(requested) ? requested : null;

    const config = await this.storage.loadConfig().catch(() => ({
      projectName: path.basename(this.storage.rootDir),
      enabledAdapters: [] as string[]
    }));
    const rules = await this.storage.loadRules().catch(() => [] as CanonicalRule[]);
    const decisions = await this.storage.loadDecisions().catch(() => [] as MemoryDecision[]);
    const handoff = await this.storage.loadHandoff().catch(
      () =>
        ({
          activeAgent: 'None',
          status: 'in_progress',
          goal: '',
          completedWork: [],
          pendingTasks: [],
          touchedFiles: [],
          contextNotes: '',
          lastUpdated: new Date().toISOString()
        }) as HandoffState
    );
    const architecture = await this.storage.loadArchitecture().catch(() => '');

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const tagsSet = new Set<string>();
    const filesSet = new Set<string>();

    const rootId = 'project-root';
    nodes.push({
      id: rootId,
      label: config.projectName || path.basename(this.storage.rootDir),
      type: 'root',
      group: 'project',
      description: 'Central Project Brain and Memory Core (.syncytium/)',
      metadata: { path: '.syncytium/syncytium.config.json', category: 'brain' }
    });

    // The project brain (rules/ADRs/agents) is only rendered for brain/all views.
    const includeBrain =
      !filterCategory || filterCategory === 'brain' || filterCategory === 'all';

    if (includeBrain) {
      for (const rule of rules) {
        const ruleId = `rule:${rule.id}`;
        nodes.push({
          id: ruleId,
          label: rule.title,
          type: 'rule',
          group: 'rules',
          description: rule.description || `Canonical rule: ${rule.id}`,
          metadata: {
            id: rule.id,
            title: rule.title,
            alwaysApply: rule.alwaysApply ?? true,
            globs: rule.globs ?? [],
            tags: rule.tags ?? [],
            priority: rule.priority,
            content: rule.content,
            path: rule.sourceFile ?? `.syncytium/rules/${rule.id}.md`,
            category: 'rule'
          }
        });
        edges.push({ source: rootId, target: ruleId, label: 'governs', type: 'contains' });

        if (!hideTags) {
          for (const tag of rule.tags ?? []) {
            const normTag = tag.trim().toLowerCase();
            if (!normTag) continue;
            tagsSet.add(normTag);
            edges.push({ source: ruleId, target: `tag:${normTag}`, label: 'tagged', type: 'tagged' });
          }
        }
      }

      if (!hideTags) {
        for (const tag of [...tagsSet].sort()) {
          nodes.push({
            id: `tag:${tag}`,
            label: `#${tag}`,
            type: 'tag',
            group: 'tags',
            description: `Tag category: ${tag}`,
            metadata: { category: 'tag' }
          });
        }
      }

      for (const d of decisions) {
        const adrId = `adr:${d.id}`;
        nodes.push({
          id: adrId,
          label: `[${d.id}] ${d.title}`,
          type: 'decision',
          group: 'decisions',
          description: d.context,
          metadata: {
            id: d.id,
            title: d.title,
            status: d.status,
            date: d.date,
            context: d.context,
            decision: d.decision,
            consequences: d.consequences,
            path: '.syncytium/memory/decisions.md',
            category: 'decision'
          }
        });
        edges.push({ source: rootId, target: adrId, label: 'decision_record', type: 'contains' });
      }

      if (architecture?.trim()) {
        nodes.push({
          id: 'doc:architecture',
          label: 'Architecture Blueprint',
          type: 'doc',
          group: 'architecture',
          description: 'High-level system design and architectural guidelines',
          metadata: {
            content: architecture,
            path: '.syncytium/architecture.md',
            category: 'architecture'
          }
        });
        edges.push({
          source: rootId,
          target: 'doc:architecture',
          label: 'blueprint',
          type: 'contains'
        });
      }

      if (handoff.activeAgent && handoff.activeAgent !== 'None') {
        nodes.push({
          id: `agent:${handoff.activeAgent}`,
          label: `Agent: ${handoff.activeAgent}`,
          type: 'agent',
          group: 'agents',
          description: `Current Active Agent (Status: ${handoff.status.toUpperCase()})`,
          metadata: {
            status: handoff.status,
            goal: handoff.goal,
            pendingTasks: handoff.pendingTasks,
            completedWork: handoff.completedWork,
            touchedFiles: handoff.touchedFiles,
            notes: handoff.contextNotes,
            lastUpdated: handoff.lastUpdated,
            path: '.syncytium/HANDOFF.md',
            category: 'agent'
          }
        });
        edges.push({
          source: rootId,
          target: `agent:${handoff.activeAgent}`,
          label: 'active_session',
          type: 'contains'
        });

        if (handoff.nextAgent && handoff.nextAgent !== 'Any' && handoff.nextAgent !== handoff.activeAgent) {
          nodes.push({
            id: `agent:${handoff.nextAgent}`,
            label: `Agent: ${handoff.nextAgent}`,
            type: 'agent',
            group: 'agents',
            description: 'Designated Next Agent for Handoff',
            metadata: { category: 'agent' }
          });
          edges.push({
            source: `agent:${handoff.activeAgent}`,
            target: `agent:${handoff.nextAgent}`,
            label: 'baton_pass',
            type: 'hands_off_to'
          });
        }
      }

      // Live lease state: agents can see who holds the workspace right now.
      const emptyLock: SyncytiumLock & { isExpired: boolean } = {
        locked: false,
        isExpired: false
      };
      const lock = await this.getLockStatus().catch(() => emptyLock);
      nodes.push({
        id: 'doc:lock',
        label: lock.locked ? `🔒 ${lock.agent || 'locked'}` : '🔓 Unlocked',
        type: 'doc',
        group: 'memory',
        description: lock.locked
          ? `Held by ${lock.agent} until ${lock.expiresAt}${lock.isExpired ? ' (EXPIRED)' : ''}`
          : 'No agent currently holds the multi-agent lease.',
        metadata: {
          category: 'lock',
          locked: lock.locked,
          agent: lock.agent,
          goal: lock.goal,
          acquiredAt: lock.acquiredAt,
          expiresAt: lock.expiresAt,
          isExpired: lock.isExpired,
          content: [
            lock.locked ? `# Workspace Lock: HELD` : `# Workspace Lock: FREE`,
            '',
            `- **Agent:** ${lock.agent ?? 'none'}`,
            `- **Goal:** ${lock.goal ?? '-'}`,
            `- **Acquired:** ${lock.acquiredAt ?? '-'}`,
            `- **Expires:** ${lock.expiresAt ?? '-'}`,
            `- **Expired:** ${lock.isExpired ? 'yes' : 'no'}`,
            lock.host ? `- **Host:** ${lock.host}` : '',
            '',
            'Acquire with `syncytium lock acquire --agent "<name>"`, renew with',
            '`syncytium lock heartbeat --agent "<name>"`, release with',
            '`syncytium lock release --agent "<name>"`.'
          ]
            .filter(Boolean)
            .join('\n'),
          path: '.syncytium/memory/lock.json'
        }
      });
      edges.push({ source: rootId, target: 'doc:lock', label: 'lease', type: 'contains' });
    }

    if (filterCategory !== 'brain') {
      for (const adapterId of config.enabledAdapters ?? []) {
        const adapter = this.registry.get(adapterId);
        if (!adapter) continue;
        if (filterCategory && !matchesCategory(adapter.category, filterCategory)) continue;

        const adpNodeId = `adapter:${adapter.id}`;
        nodes.push({
          id: adpNodeId,
          label: adapter.name,
          type: 'adapter',
          group: 'adapters',
          description: adapter.description,
          metadata: { category: adapter.category, targetFiles: adapter.defaultTargetFiles }
        });
        edges.push({ source: rootId, target: adpNodeId, label: 'bridges_to', type: 'contains' });

        for (const targetFile of adapter.defaultTargetFiles) {
          filesSet.add(targetFile);
          if (hideFiles) continue;
          const fileNodeId = `file:${targetFile}`;
          if (!nodes.some(n => n.id === fileNodeId)) {
            nodes.push({
              id: fileNodeId,
              label: targetFile,
              type: 'file',
              group: 'files',
              description: `Generated ${adapter.category.toUpperCase()} context file: ${targetFile}`,
              metadata: { adapterId: adapter.id, adapterName: adapter.name, category: adapter.category, path: targetFile }
            });
          }
          edges.push({ source: adpNodeId, target: fileNodeId, label: 'generates', type: 'generates' });
        }
      }
    }

    return {
      nodes,
      edges,
      stats: {
        rulesCount: rules.length,
        tagsCount: tagsSet.size,
        decisionsCount: decisions.length,
        activeAgentsCount:
          handoff.activeAgent && handoff.activeAgent !== 'None'
            ? handoff.nextAgent && handoff.nextAgent !== 'Any' && handoff.nextAgent !== handoff.activeAgent
              ? 2
              : 1
            : 0,
        bridgeFilesCount: filesSet.size
      }
    };
  }

  // ------------------------------------------------------------ ui server ---

  async startUiServer(options?: UiServerOptions): Promise<{
    port: number;
    url: string;
    server: http.Server;
    close: () => Promise<void>;
  }> {
    const requestedPort = options?.port ?? 3737;
    const allowRemote = options?.allowRemote === true;
    const sseClients = new Set<http.ServerResponse>();

    const broadcastReload = (): void => {
      if (sseClients.size === 0) return;
      // The watcher already performed a sync; tell clients to re-fetch.
      for (const res of [...sseClients]) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'reload', at: Date.now() })}\n\n`);
        } catch {
          sseClients.delete(res);
        }
      }
    };

    const unwatch = this.watch({ onChange: broadcastReload });

    const hostGuard = (req: http.IncomingMessage): boolean => {
      if (allowRemote) return true;
      const host = (req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
      // Reject DNS-rebinding: only loopback names may talk to this server.
      return host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    };

    const server = http.createServer(async (req, res) => {
      if (!hostGuard(req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Host header not allowed' }));
        return;
      }

      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      // Same-origin only by default; the UI is served from this very server.
      res.setHeader('Access-Control-Allow-Origin', allowRemote ? '*' : 'null');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        if (parsedUrl.pathname === '/api/graph') {
          const compact =
            parsedUrl.searchParams.get('compact') === 'true' || (options?.compact ?? false);
          const excludeFiles =
            parsedUrl.searchParams.get('noFiles') === 'true' || (options?.excludeFiles ?? compact);
          const excludeTags =
            parsedUrl.searchParams.get('noTags') === 'true' || (options?.excludeTags ?? compact);
          const category = parsedUrl.searchParams.get('category') || options?.category || 'all';
          const graph = await this.getKnowledgeGraph({ compact, excludeFiles, excludeTags, category });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(graph));
          return;
        }

        if (parsedUrl.pathname === '/api/file') {
          const targetPath = parsedUrl.searchParams.get('path');
          if (!targetPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing path parameter' }));
            return;
          }

          const normalizedInput = toPosix(targetPath).replace(/^\/+/, '');
          const resolvedRoot = path.resolve(this.storage.rootDir);
          const fullPath = path.resolve(resolvedRoot, normalizedInput);

          if (!isInsideRoot(resolvedRoot, path.resolve(fullPath))) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access denied outside workspace root' }));
            return;
          }

          const relPath = toPosix(path.relative(resolvedRoot, fullPath));
          if (SENSITIVE_FILE_PATTERN.test(relPath) || SENSITIVE_DIR_PATTERN.test(relPath)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Refusing to serve sensitive file: ${relPath}` }));
            return;
          }

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ path: relPath, content }));
          } catch (err) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ error: `File not found: ${relPath}`, detail: (err as Error).message })
            );
          }
          return;
        }

        if (parsedUrl.pathname === '/api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          res.write(': connected\n\n');
          sseClients.add(res);
          const keepAlive = setInterval(() => {
            try {
              res.write(': ping\n\n');
            } catch {
              clearInterval(keepAlive);
              sseClients.delete(res);
            }
          }, 25_000);
          req.on('close', () => {
            clearInterval(keepAlive);
            sseClients.delete(res);
          });
          return;
        }

        if (parsedUrl.pathname === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ status: 'ok', version: VERSION, at: new Date().toISOString() })
          );
          return;
        }

        if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
          const config = await this.storage.loadConfig().catch(() => ({
            projectName: path.basename(this.storage.rootDir)
          }));
          const html = renderGraphHtml(
            config.projectName || 'Syncytium Project',
            {
              compact: options?.compact ?? false,
              excludeFiles: options?.excludeFiles ?? false,
              excludeTags: options?.excludeTags ?? false,
              category: options?.category ?? 'all'
            },
            { version: VERSION }
          );
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy':
              "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; font-src data:"
          });
          res.end(html);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not Found: ${parsedUrl.pathname}` }));
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });

    const port = await new Promise<number>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException): void => {
        if (err.code === 'EADDRINUSE') {
          // Fall back to an ephemeral port so the UI still starts.
          server.listen(0, '127.0.0.1');
          return;
        }
        reject(err);
      };
      server.once('error', onError);
      server.listen(requestedPort, '127.0.0.1', () => {
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : requestedPort);
      });
    });

    const url = `http://localhost:${port}`;

    if (options?.open !== false) {
      const openCommand =
        process.platform === 'win32'
          ? `start "" "${url}"`
          : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;
      exec(openCommand, () => undefined);
    }

    return {
      port,
      url,
      server,
      close: async () => {
        await unwatch();
        for (const client of sseClients) {
          try {
            client.end();
          } catch {
            // client already gone
          }
        }
        sseClients.clear();
        server.removeAllListeners('error');
        await new Promise<void>(resolve => {
          server.close(() => resolve());
          // Keep-alive sockets would otherwise hold the close open.
          server.closeAllConnections?.();
        });
      }
    };
  }

  // --------------------------------------------------------------- watch ---

  /**
   * Watches `.syncytium/` and re-syncs on change.
   *
   * `onChange` fires *after* the sync completes so consumers (e.g. the UI's SSE
   * channel) only refresh once the bridge files are actually on disk.
   */
  watch(options?: {
    onChange?: (result: { paths: string[]; pruned: string[] }) => void;
    onError?: (err: Error) => void;
    /** Hold the workspace lock and renew it on every tick. */
    agent?: string;
    lockLeaseMinutes?: number;
  }): () => Promise<void> {
    const watcher = chokidar.watch(this.storage.syncytiumDir, {
      ignoreInitial: true,
      persistent: true,
      ignored: /(^|[/\\])(\.git|node_modules)([/\\]|$)/,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
    });

    let syncTimeout: NodeJS.Timeout | null = null;
    let inFlight = false;
    let pending = false;

    const runSync = async (): Promise<void> => {
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      try {
        const result = await this.sync();
        options?.onChange?.({ paths: result.paths, pruned: result.pruned });
      } catch (err) {
        options?.onError?.(err as Error);
      } finally {
        inFlight = false;
        if (pending) {
          pending = false;
          schedule();
        }
      }
    };

    const schedule = (): void => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        syncTimeout = null;
        void runSync();
      }, 150);
    };

    watcher.on('all', schedule);
    watcher.on('error', err => options?.onError?.(err as Error));

    let renewTimer: NodeJS.Timeout | null = null;
    if (options?.agent) {
      const lease = options.lockLeaseMinutes ?? 30;
      // Renew at 1/3 of the lease so transient failures do not drop the lock.
      renewTimer = setInterval(() => {
        void this.renewLock(options.agent!, lease).catch(() => undefined);
      }, Math.max(30_000, (lease * 60_000) / 3));
      renewTimer.unref?.();
    }

    return async () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      if (renewTimer) clearInterval(renewTimer);
      await watcher.close();
    };
  }
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dups.add(value);
    seen.add(value);
  }
  return [...dups];
}

function matchesCategory(adapterCategory: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'cli') return adapterCategory === 'cli' || adapterCategory === 'agent';
  if (filter === 'extension') return adapterCategory === 'extension';
  if (filter === 'ide') return adapterCategory === 'ide';
  if (filter === 'agent') return adapterCategory === 'agent' || adapterCategory === 'cli';
  if (filter === 'generic') return adapterCategory === 'generic';
  return adapterCategory === filter;
}
