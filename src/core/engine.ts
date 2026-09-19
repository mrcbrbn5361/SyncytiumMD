import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import pc from 'picocolors';
import matter from 'gray-matter';
import { CI_WORKFLOW_TEMPLATE } from './templates.js';
import { SyncytiumStorage } from './storage.js';
import { AdapterRegistry } from '../adapters/registry.js';
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
  ImportItem
} from './types.js';

export class SyncytiumEngine {
  readonly storage: SyncytiumStorage;
  readonly registry: AdapterRegistry;

  constructor(rootDir: string = process.cwd()) {
    this.storage = new SyncytiumStorage(rootDir);
    this.registry = new AdapterRegistry();
  }

  async detectStack(): Promise<'typescript' | 'python' | 'go' | 'rust' | 'generic'> {
    const root = this.storage.rootDir;
    try {
      await fs.access(path.join(root, 'package.json'));
      return 'typescript';
    } catch {}

    try {
      await fs.access(path.join(root, 'pyproject.toml'));
      return 'python';
    } catch {}
    try {
      await fs.access(path.join(root, 'requirements.txt'));
      return 'python';
    } catch {}

    try {
      await fs.access(path.join(root, 'go.mod'));
      return 'go';
    } catch {}

    try {
      await fs.access(path.join(root, 'Cargo.toml'));
      return 'rust';
    } catch {}

    return 'generic';
  }

  async init(projectName?: string, stack?: string): Promise<void> {
    if (await this.storage.exists()) {
      throw new Error('.syncytium/ already exists in this directory.');
    }
    const targetStack = stack || await this.detectStack();
    await this.storage.init(projectName, targetStack);
  }

  private filterIgnoredFiles<T extends { relativePath: string }>(files: T[], ignores: string[]): T[] {
    if (ignores.length === 0) return files;
    return files.filter(file => {
      const rel = file.relativePath.replace(/\\/g, '/');
      return !ignores.some(pat => {
        const cleanPat = pat.replace(/\\/g, '/');
        if (cleanPat.startsWith('*')) {
          return rel.endsWith(cleanPat.slice(1));
        }
        return rel === cleanPat || rel.endsWith(`/${cleanPat}`) || rel.includes(cleanPat);
      });
    });
  }

  async sync(adapterFilter?: string[]): Promise<{
    count: number;
    paths: string[];
    elapsedMs: number;
    rulesCount: number;
    decisionsCount: number;
  }> {
    const startTime = performance.now();

    const isInitialized = await this.storage.exists();
    if (!isInitialized) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }

    const config = await this.storage.loadConfig();
    const context = await this.storage.loadCanonicalContext();

    const targets = adapterFilter && adapterFilter.length > 0
      ? adapterFilter
      : config.enabledAdapters;

    const { files } = await this.registry.generateAll(context, targets);
    const ignores = await this.storage.loadIgnorePatterns();
    const filteredFiles = this.filterIgnoredFiles(files, ignores);

    const writtenPaths = await this.registry.writeFiles(this.storage.rootDir, filteredFiles);

    const elapsedMs = Math.round(performance.now() - startTime);

    return {
      count: writtenPaths.length,
      paths: writtenPaths,
      elapsedMs,
      rulesCount: context.rules.length,
      decisionsCount: context.decisions.length
    };
  }

  async diff(adapterFilter?: string[]): Promise<DiffReport> {
    const isInitialized = await this.storage.exists();
    if (!isInitialized) {
      throw new Error('Syncytium is not initialized. Run `syncytium init` first.');
    }

    const config = await this.storage.loadConfig();
    const context = await this.storage.loadCanonicalContext();

    const targets = adapterFilter && adapterFilter.length > 0
      ? adapterFilter
      : config.enabledAdapters;

    const { files } = await this.registry.generateAll(context, targets);
    const ignores = await this.storage.loadIgnorePatterns();
    const filteredFiles = this.filterIgnoredFiles(files, ignores);

    const items: FileDiffItem[] = [];

    let identical = 0;
    let modified = 0;
    let missingOnDisk = 0;

    for (const genFile of filteredFiles) {
      const diskPath = path.join(this.storage.rootDir, genFile.relativePath);
      try {
        const diskContent = await fs.readFile(diskPath, 'utf-8');
        // Normalize line breaks for comparison
        const normDisk = diskContent.replace(/\r\n/g, '\n').trim();
        const normGen = genFile.content.replace(/\r\n/g, '\n').trim();

        if (normDisk === normGen) {
          items.push({
            relativePath: genFile.relativePath,
            status: 'identical'
          });
          identical++;
        } else {
          items.push({
            relativePath: genFile.relativePath,
            status: 'modified',
            driftSummary: 'File on disk differs from generated source of truth (.syncytium/)'
          });
          modified++;
        }
      } catch {
        items.push({
          relativePath: genFile.relativePath,
          status: 'missing_on_disk',
          driftSummary: 'Target file does not exist on disk'
        });
        missingOnDisk++;
      }
    }

    const hasDrift = modified > 0 || missingOnDisk > 0;

    return {
      hasDrift,
      items,
      summary: {
        identical,
        modified,
        missingOnDisk
      }
    };
  }

  async doctor(): Promise<DoctorReport> {
    const checks: DoctorCheckItem[] = [];

    // 1. Core Directory Check
    const exists = await this.storage.exists();
    if (!exists) {
      checks.push({
        name: 'Syncytium Root Directory',
        status: 'error',
        message: 'Missing .syncytium/ directory in workspace root.',
        detail: 'Run `syncytium init` to initialize the project.'
      });

      return {
        overallStatus: 'unhealthy',
        checks,
        stats: {
          rulesCount: 0,
          decisionsCount: 0,
          enabledAdaptersCount: 0,
          activeHandoffGoal: 'Not initialized',
          activeAgent: 'None'
        }
      };
    }

    checks.push({
      name: 'Syncytium Root Directory',
      status: 'ok',
      message: 'Found .syncytium/ single source of truth directory.'
    });

    // 2. Config File Check
    let configValid = false;
    let enabledAdaptersCount = 0;
    try {
      const config = await this.storage.loadConfig();
      enabledAdaptersCount = config.enabledAdapters?.length || 0;
      checks.push({
        name: 'Configuration (syncytium.config.json)',
        status: 'ok',
        message: `Valid configuration found with ${enabledAdaptersCount} enabled adapters (${config.enabledAdapters.join(', ')}).`
      });
      configValid = true;
    } catch (e: any) {
      checks.push({
        name: 'Configuration (syncytium.config.json)',
        status: 'error',
        message: `Failed to parse config: ${e.message}`
      });
    }

    // 3. Rules Check
    const rules = await this.storage.loadRules();
    if (rules.length === 0) {
      checks.push({
        name: 'Canonical Rules (.syncytium/rules/)',
        status: 'warn',
        message: 'No rules found in .syncytium/rules/',
        detail: 'Add markdown files in .syncytium/rules/ (e.g. code-style.md) to define project standards.'
      });
    } else {
      checks.push({
        name: 'Canonical Rules (.syncytium/rules/)',
        status: 'ok',
        message: `Found ${rules.length} active canonical rules (${rules.map(r => r.id).join(', ')}).`
      });
    }

    // 4. Decisions Check
    const decisions = await this.storage.loadDecisions();
    checks.push({
      name: 'Architecture Decision Records (ADR)',
      status: 'ok',
      message: `Found ${decisions.length} recorded architectural decisions in memory/decisions.md.`
    });

    // 5. Handoff Check
    const handoff = await this.storage.loadHandoff();
    checks.push({
      name: 'Live Agent Handoff (HANDOFF.md)',
      status: 'ok',
      message: `Active Agent: ${handoff.activeAgent} | Status: ${handoff.status.toUpperCase()} | Next: ${handoff.nextAgent || 'Any'}`,
      detail: `Current Goal: "${handoff.goal}"`
    });

    // 6. Bridge Files Sync Check (Diff)
    let hasDrift = false;
    try {
      const diffResult = await this.diff();
      if (diffResult.hasDrift) {
        hasDrift = true;
        checks.push({
          name: 'Bridge Files Status',
          status: 'warn',
          message: `${diffResult.summary.modified} modified, ${diffResult.summary.missingOnDisk} missing, ${diffResult.summary.identical} in sync.`,
          detail: 'Run `syncytium sync` to synchronize bridge files across all AI tools.'
        });
      } else {
        checks.push({
          name: 'Bridge Files Status',
          status: 'ok',
          message: `All ${diffResult.summary.identical} bridge files are fully synchronized with .syncytium/`
        });
      }
    } catch (e: any) {
      checks.push({
        name: 'Bridge Files Status',
        status: 'warn',
        message: `Could not verify bridge files: ${e.message}`
      });
    }

    let overallStatus: DoctorReport['overallStatus'] = 'healthy';
    if (checks.some(c => c.status === 'error')) {
      overallStatus = 'unhealthy';
    } else if (checks.some(c => c.status === 'warn')) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      checks,
      stats: {
        rulesCount: rules.length,
        decisionsCount: decisions.length,
        enabledAdaptersCount,
        activeHandoffGoal: handoff.goal,
        activeAgent: handoff.activeAgent
      }
    };
  }

  async handoff(params: {
    activeAgent?: string;
    nextAgent?: string;
    status?: HandoffState['status'];
    goal?: string;
    completed?: string[];
    pending?: string[];
    touchedFiles?: string[];
    notes?: string;
    autoSync?: boolean;
  }): Promise<HandoffState> {
    const current = await this.storage.loadHandoff();
    const updated: HandoffState = {
      activeAgent: params.activeAgent || current.activeAgent,
      nextAgent: params.nextAgent !== undefined ? params.nextAgent : current.nextAgent,
      status: params.status || current.status,
      goal: params.goal || current.goal,
      completedWork: params.completed
        ? [...current.completedWork, ...params.completed]
        : current.completedWork,
      pendingTasks: params.pending || current.pendingTasks,
      touchedFiles: params.touchedFiles
        ? Array.from(new Set([...current.touchedFiles, ...params.touchedFiles]))
        : current.touchedFiles,
      contextNotes: params.notes || current.contextNotes,
      lastUpdated: new Date().toISOString()
    };

    await this.storage.writeHandoff(updated);

    const historyEntry: HandoffHistoryEntry = {
      id: `HND-${Date.now().toString(36).toUpperCase()}`,
      timestamp: updated.lastUpdated,
      fromAgent: params.activeAgent || current.activeAgent,
      toAgent: params.nextAgent || updated.nextAgent || 'Any',
      status: updated.status,
      goal: updated.goal,
      tasksDone: params.completed || [],
      nextTasks: updated.pendingTasks,
      activeFiles: updated.touchedFiles,
      notes: params.notes || updated.contextNotes
    };
    await this.storage.recordHandoffHistory(historyEntry);

    if (params.autoSync !== false) {
      await this.sync();
    }

    return updated;
  }

  async getHandoffHistory(limit: number = 10): Promise<HandoffHistoryEntry[]> {
    const list = await this.storage.loadHandoffHistory();
    return list.slice(0, limit);
  }

  async addDecision(decision: MemoryDecision): Promise<void> {
    await this.storage.addDecision(decision);
    await this.sync();
  }

  async clean(adapterFilter?: string[]): Promise<string[]> {
    const config = await this.storage.loadConfig();
    const targets = adapterFilter && adapterFilter.length > 0
      ? adapterFilter
      : config.enabledAdapters;

    return await this.registry.cleanManagedFiles(this.storage.rootDir, targets);
  }

  async getStatus(): Promise<{
    initialized: boolean;
    projectName: string;
    rulesCount: number;
    decisionsCount: number;
    activeAdapters: string[];
    handoff: HandoffState;
  }> {
    const initialized = await this.storage.exists();
    if (!initialized) {
      return {
        initialized: false,
        projectName: '',
        rulesCount: 0,
        decisionsCount: 0,
        activeAdapters: [],
        handoff: await this.storage.loadHandoff()
      };
    }

    const config = await this.storage.loadConfig();
    const rules = await this.storage.loadRules();
    const decisions = await this.storage.loadDecisions();
    const handoff = await this.storage.loadHandoff();

    return {
      initialized: true,
      projectName: config.projectName,
      rulesCount: rules.length,
      decisionsCount: decisions.length,
      activeAdapters: config.enabledAdapters,
      handoff
    };
  }

  async importExisting(options?: { dryRun?: boolean }): Promise<ImportReport> {
    const root = this.storage.rootDir;
    const candidates = [
      { file: 'CLAUDE.md', adapter: 'claude', ruleId: 'imported-claude', title: 'Imported Claude Code Guidelines' },
      { file: '.cursorrules', adapter: 'cursor', ruleId: 'imported-cursorrules', title: 'Imported Cursor Guidelines' },
      { file: '.github/copilot-instructions.md', adapter: 'copilot', ruleId: 'imported-copilot', title: 'Imported GitHub Copilot Guidelines' },
      { file: '.clinerules', adapter: 'cline', ruleId: 'imported-cline', title: 'Imported Cline Guidelines' },
      { file: '.windsurfrules', adapter: 'windsurf', ruleId: 'imported-windsurf', title: 'Imported Windsurf Guidelines' },
      { file: '.traerules', adapter: 'trae', ruleId: 'imported-trae', title: 'Imported Trae Guidelines' },
      { file: 'AGENT.md', adapter: 'opencode', ruleId: 'imported-agent', title: 'Imported Agent Guidelines' },
      { file: 'CONVENTIONS.md', adapter: 'opencode', ruleId: 'imported-conventions', title: 'Imported Conventions' }
    ];

    const items: ImportItem[] = [];

    // Ensure .syncytium/ exists
    if (!await this.storage.exists() && !options?.dryRun) {
      await this.storage.init();
    }

    for (const cand of candidates) {
      const fullPath = path.join(root, cand.file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        // If file was already generated by SyncytiumMD, skip to avoid recursive duplicate
        if (content.includes('AUTO-GENERATED BY SYNCYTIUM') || content.includes('Source of truth: .syncytium') || content.includes('Generated by SyncytiumMD')) {
          continue;
        }

        const targetRuleFile = `${cand.ruleId}.md`;
        items.push({
          sourceFile: cand.file,
          adapterName: cand.adapter,
          targetRuleFile,
          extractedTitle: cand.title
        });

        if (!options?.dryRun) {
          const ruleContent = `---
id: ${cand.ruleId}
title: ${cand.title}
description: Automatically imported from ${cand.file} by SyncytiumMD
alwaysApply: true
tags: [imported, ${cand.adapter}]
---

${content.trim()}
`;
          await this.storage.saveRule(targetRuleFile, ruleContent);
        }
      } catch {
        // file doesn't exist, ignore
      }
    }

    // Also check .cursor/rules/*.mdc
    try {
      const cursorRulesDir = path.join(root, '.cursor', 'rules');
      const mdcFiles = await fs.readdir(cursorRulesDir);
      for (const mdc of mdcFiles) {
        if (!mdc.endsWith('.mdc')) continue;
        if (mdc === 'syncytium-handoff.mdc') continue;
        const fullPath = path.join(cursorRulesDir, mdc);
        const content = await fs.readFile(fullPath, 'utf-8');
        if (content.includes('AUTO-GENERATED BY SYNCYTIUM') || content.includes('Source of truth: .syncytium') || content.includes('Generated by SyncytiumMD')) continue;

        const baseName = path.basename(mdc, '.mdc');
        const targetRuleFile = `imported-cursor-${baseName}.md`;
        items.push({
          sourceFile: `.cursor/rules/${mdc}`,
          adapterName: 'cursor',
          targetRuleFile,
          extractedTitle: `Imported Cursor ${baseName}`
        });

        if (!options?.dryRun) {
          await this.storage.saveRule(targetRuleFile, content);
        }
      }
    } catch {
      // ignore
    }

    if (!options?.dryRun && items.length > 0) {
      await this.sync();
    }

    return {
      importedCount: items.length,
      items
    };
  }

  async lint(): Promise<LintReport> {
    const issues: LintIssue[] = [];
    let totalChecked = 0;

    const exists = await this.storage.exists();
    if (!exists) {
      issues.push({
        file: '.syncytium',
        type: 'error',
        message: '.syncytium/ directory does not exist. Run `syncytium init` first.'
      });
      return { valid: false, issues, totalChecked: 0 };
    }

    // 1. Lint rules
    try {
      const files = await fs.readdir(this.storage.rulesDir);
      for (const file of files) {
        totalChecked++;
        const filePath = `.syncytium/rules/${file}`;
        if (!file.endsWith('.md')) {
          issues.push({
            file: filePath,
            type: 'warning',
            message: `Rule file should have .md extension, found: ${file}`
          });
          continue;
        }

        const baseName = path.basename(file, '.md');
        if (!/^[a-z0-9-]+$/.test(baseName)) {
          issues.push({
            file: filePath,
            type: 'warning',
            message: `Rule filename "${file}" should follow kebab-case (e.g. "code-style.md").`
          });
        }

        const fullPath = path.join(this.storage.rulesDir, file);
        const raw = await fs.readFile(fullPath, 'utf-8');
        if (!raw.trim()) {
          issues.push({
            file: filePath,
            type: 'error',
            message: 'Rule file is empty.'
          });
          continue;
        }

        try {
          const parsed = matter(raw);
          if (parsed.data.globs && !Array.isArray(parsed.data.globs)) {
            issues.push({
              file: filePath,
              type: 'error',
              message: 'Frontmatter "globs" must be an array of strings.'
            });
          }
          if (parsed.data.alwaysApply !== undefined && typeof parsed.data.alwaysApply !== 'boolean') {
            issues.push({
              file: filePath,
              type: 'warning',
              message: 'Frontmatter "alwaysApply" should be a boolean.'
            });
          }
          if (!parsed.content.trim()) {
            issues.push({
              file: filePath,
              type: 'error',
              message: 'Rule markdown body is empty after frontmatter.'
            });
          }
        } catch (err: any) {
          issues.push({
            file: filePath,
            type: 'error',
            message: `Invalid YAML frontmatter: ${err.message}`
          });
        }
      }
    } catch {
      issues.push({
        file: '.syncytium/rules',
        type: 'error',
        message: 'Could not read .syncytium/rules directory.'
      });
    }

    // 2. Lint architecture.md
    totalChecked++;
    try {
      const arch = await this.storage.loadArchitecture();
      if (!arch.trim()) {
        issues.push({
          file: '.syncytium/architecture.md',
          type: 'warning',
          message: 'architecture.md is empty. Add system architecture details for AI agents.'
        });
      }
    } catch {
      issues.push({
        file: '.syncytium/architecture.md',
        type: 'error',
        message: 'Missing architecture.md'
      });
    }

    // 3. Lint HANDOFF.md
    totalChecked++;
    try {
      const handoff = await this.storage.loadHandoff();
      if (!handoff.activeAgent) {
        issues.push({
          file: '.syncytium/HANDOFF.md',
          type: 'warning',
          message: 'Active agent is not specified in HANDOFF.md'
        });
      }
    } catch (err: any) {
      issues.push({
        file: '.syncytium/HANDOFF.md',
        type: 'error',
        message: `Failed to parse HANDOFF.md: ${err.message}`
      });
    }

    const hasErrors = issues.some(i => i.type === 'error');
    return {
      valid: !hasErrors,
      issues,
      totalChecked
    };
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
      ? `\n# --- BEGIN SYNCYTIUM HOOK ---\n# Auto-sync bridge files before commit\nnpx syncytium sync && git add -u\n# --- END SYNCYTIUM HOOK ---\n`
      : `\n# --- BEGIN SYNCYTIUM HOOK ---\n# Check context drift before commit\nnpx syncytium diff\nif [ $? -ne 0 ]; then\n  echo "❌ [Syncytium] Context drift detected! Run 'npx syncytium sync' to synchronize."\n  exit 1\nfi\n# --- END SYNCYTIUM HOOK ---\n`;

    let existingContent = '';
    try {
      existingContent = await fs.readFile(hookPath, 'utf-8');
    } catch {
      existingContent = '#!/bin/sh\n';
    }

    // Remove existing syncytium block if present
    const cleanContent = existingContent.replace(
      /# --- BEGIN SYNCYTIUM HOOK ---[\s\S]*?# --- END SYNCYTIUM HOOK ---\n?/g,
      ''
    ).trimEnd();

    const finalContent = cleanContent + '\n' + hookScript;
    await fs.writeFile(hookPath, finalContent, { mode: 0o755 });

    return { success: true, hookPath };
  }

  async uninstallGitHook(): Promise<{ success: boolean; hookPath: string }> {
    const gitDir = path.join(this.storage.rootDir, '.git');
    const hookPath = path.join(gitDir, 'hooks', 'pre-commit');

    try {
      const content = await fs.readFile(hookPath, 'utf-8');
      const cleanContent = content.replace(
        /# --- BEGIN SYNCYTIUM HOOK ---[\s\S]*?# --- END SYNCYTIUM HOOK ---\n?/g,
        ''
      ).trim();

      if (!cleanContent || cleanContent === '#!/bin/sh') {
        await fs.rm(hookPath, { force: true });
      } else {
        await fs.writeFile(hookPath, cleanContent + '\n', { mode: 0o755 });
      }
      return { success: true, hookPath };
    } catch {
      return { success: false, hookPath };
    }
  }

  async installCiWorkflow(options?: { overwrite?: boolean }): Promise<{ success: boolean; path: string }> {
    const workflowsDir = path.join(this.storage.rootDir, '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
    const targetPath = path.join(workflowsDir, 'syncytium.yml');

    if (!options?.overwrite) {
      try {
        await fs.access(targetPath);
        throw new Error(`CI workflow already exists at .github/workflows/syncytium.yml (use --force to overwrite)`);
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          // File does not exist, proceed
        } else {
          throw e;
        }
      }
    }

    await fs.writeFile(targetPath, CI_WORKFLOW_TEMPLATE, 'utf-8');
    return { success: true, path: targetPath };
  }

  watch(onSync?: (paths: string[]) => void): () => Promise<void> {
    const watcher = chokidar.watch(this.storage.syncytiumDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    let syncTimeout: NodeJS.Timeout | null = null;

    const triggerSync = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        try {
          const res = await this.sync();
          if (onSync) onSync(res.paths);
        } catch (err) {
          console.error(pc.red('Error during auto-sync:'), err);
        }
      }, 150);
    };

    watcher.on('all', () => {
      triggerSync();
    });

    return async () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      await watcher.close();
    };
  }
}
