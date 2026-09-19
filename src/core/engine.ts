import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { exec } from 'node:child_process';
import chokidar from 'chokidar';
import pc from 'picocolors';
import matter from 'gray-matter';
import { CI_WORKFLOW_TEMPLATE } from './templates.js';
import { SyncytiumStorage } from './storage.js';
import { AdapterRegistry } from '../adapters/registry.js';
import { renderGraphHtml } from '../ui/template.js';
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
  GraphEdge
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

  async lint(options?: { fix?: boolean }): Promise<LintReport> {
    const issues: LintIssue[] = [];
    let totalChecked = 0;
    let fixedCount = 0;

    const exists = await this.storage.exists();
    if (!exists) {
      issues.push({
        file: '.syncytium',
        type: 'error',
        message: '.syncytium/ directory does not exist. Run `syncytium init` first.'
      });
      return { valid: false, issues, totalChecked: 0, fixedCount: 0 };
    }

    // 1. Lint rules
    try {
      const files = await fs.readdir(this.storage.rulesDir);
      for (const file of files) {
        totalChecked++;
        let currentFileName = file;
        const filePath = `.syncytium/rules/${currentFileName}`;

        if (!currentFileName.endsWith('.md')) {
          issues.push({
            file: filePath,
            type: 'warning',
            message: `Rule file should have .md extension, found: ${currentFileName}`
          });
          continue;
        }

        let baseName = path.basename(currentFileName, '.md');
        if (!/^[a-z0-9-]+$/.test(baseName)) {
          if (options?.fix) {
            const kebab = baseName
              .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
              .toLowerCase()
              .replace(/[^a-z0-9-]+/g, '-');
            const newFileName = `${kebab}.md`;
            const oldPath = path.join(this.storage.rulesDir, currentFileName);
            const newPath = path.join(this.storage.rulesDir, newFileName);
            await fs.rename(oldPath, newPath);
            currentFileName = newFileName;
            baseName = kebab;
            fixedCount++;
          } else {
            issues.push({
              file: filePath,
              type: 'warning',
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
            message: 'Rule file is empty.'
          });
          continue;
        }

        try {
          const parsed = matter(raw);
          if (options?.fix && (!parsed.data.id || !parsed.data.title)) {
            const healedData = {
              id: parsed.data.id || baseName.toLowerCase(),
              title: parsed.data.title || baseName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              alwaysApply: parsed.data.alwaysApply ?? true,
              ...parsed.data
            };
            const healedContent = matter.stringify(parsed.content.trim(), healedData);
            await fs.writeFile(fullPath, healedContent, 'utf-8');
            fixedCount++;
          }

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
      totalChecked,
      fixedCount
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

  async acquireLock(agent: string, goal?: string, leaseMinutes: number = 30): Promise<{ acquired: boolean; lock: SyncytiumLock; message?: string }> {
    const current = await this.storage.loadLock();
    const now = Date.now();

    if (current.locked && current.expiresAt) {
      const expires = new Date(current.expiresAt).getTime();
      if (now < expires && current.agent && current.agent !== agent) {
        return {
          acquired: false,
          lock: current,
          message: `Workspace is currently locked by '${current.agent}' until ${current.expiresAt}. Use --force to override if necessary.`
        };
      }
    }

    const nowDate = new Date(now);
    const expiresDate = new Date(now + leaseMinutes * 60 * 1000);
    const newLock: SyncytiumLock = {
      locked: true,
      agent,
      goal: goal || current.goal || '',
      acquiredAt: nowDate.toISOString(),
      expiresAt: expiresDate.toISOString()
    };

    await this.storage.saveLock(newLock);
    return {
      acquired: true,
      lock: newLock,
      message: `Lock acquired by '${agent}' for ${leaseMinutes} minutes (expires at ${newLock.expiresAt}).`
    };
  }

  async releaseLock(agent?: string, force: boolean = false): Promise<{ released: boolean; lock: SyncytiumLock; message?: string }> {
    const current = await this.storage.loadLock();
    if (!current.locked) {
      return {
        released: true,
        lock: current,
        message: 'Workspace is not locked.'
      };
    }

    const now = Date.now();
    const isExpired = current.expiresAt ? new Date(current.expiresAt).getTime() <= now : false;

    if (!force && !isExpired && agent && current.agent && current.agent !== agent) {
      return {
        released: false,
        lock: current,
        message: `Cannot release lock held by '${current.agent}' without --force.`
      };
    }

    const unlocked: SyncytiumLock = { locked: false };
    await this.storage.saveLock(unlocked);
    return {
      released: true,
      lock: unlocked,
      message: 'Workspace lock released successfully.'
    };
  }

  async getLockStatus(): Promise<SyncytiumLock & { isExpired?: boolean }> {
    const lock = await this.storage.loadLock();
    if (lock.locked && lock.expiresAt) {
      const isExpired = new Date(lock.expiresAt).getTime() <= Date.now();
      return { ...lock, isExpired };
    }
    return { ...lock, isExpired: false };
  }

  async listRules(query?: string): Promise<CanonicalRule[]> {
    const rules = await this.storage.loadRules();
    if (!query || !query.trim()) {
      return rules;
    }

    const q = query.toLowerCase().trim();
    return rules.filter(r => {
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.tags && r.tags.some(t => t.toLowerCase().includes(q))) ||
        r.content.toLowerCase().includes(q)
      );
    });
  }

  async getKnowledgeGraph(): Promise<KnowledgeGraph> {
    const config = await this.storage.loadConfig().catch(() => ({ projectName: path.basename(this.storage.rootDir), enabledAdapters: [] }));
    const rules = await this.storage.loadRules().catch(() => []);
    const decisions = await this.storage.loadDecisions().catch(() => []);
    const handoff: HandoffState = await this.storage.loadHandoff().catch(() => ({
      activeAgent: 'None',
      nextAgent: undefined,
      status: 'in_progress',
      goal: '',
      completedWork: [],
      pendingTasks: [],
      touchedFiles: [],
      contextNotes: '',
      lastUpdated: new Date().toISOString()
    }));
    const architecture = await this.storage.loadArchitecture().catch(() => '');

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 1. Root Node (Project Brain)
    const rootId = 'project-root';
    nodes.push({
      id: rootId,
      label: config.projectName || path.basename(this.storage.rootDir),
      type: 'root',
      group: 'project',
      description: 'Central Project Brain and Memory Core'
    });

    // 2. Rules & Tags
    const tagsSet = new Set<string>();
    for (const rule of rules) {
      const ruleId = `rule:${rule.id}`;
      nodes.push({
        id: ruleId,
        label: rule.title,
        type: 'rule',
        group: 'rules',
        description: rule.description || `Rule ${rule.id}`,
        metadata: {
          alwaysApply: rule.alwaysApply ?? true,
          globs: rule.globs,
          tags: rule.tags,
          content: rule.content
        }
      });

      edges.push({
        source: rootId,
        target: ruleId,
        label: 'governs',
        type: 'contains'
      });

      if (Array.isArray(rule.tags)) {
        for (const tag of rule.tags) {
          const normTag = tag.trim().toLowerCase();
          if (!normTag) continue;
          tagsSet.add(normTag);
          edges.push({
            source: ruleId,
            target: `tag:${normTag}`,
            label: 'tagged',
            type: 'tagged'
          });
        }
      }
    }

    // Add Tag Nodes
    for (const tag of tagsSet) {
      nodes.push({
        id: `tag:${tag}`,
        label: `#${tag}`,
        type: 'tag',
        group: 'tags',
        description: `Tag category: ${tag}`
      });
    }

    // 3. ADR Decisions
    for (const d of decisions) {
      const adrId = `adr:${d.id}`;
      nodes.push({
        id: adrId,
        label: `[${d.id}] ${d.title}`,
        type: 'decision',
        group: 'decisions',
        description: d.context,
        metadata: {
          status: d.status,
          date: d.date,
          decision: d.decision,
          consequences: d.consequences
        }
      });

      edges.push({
        source: rootId,
        target: adrId,
        label: 'decision_record',
        type: 'contains'
      });
    }

    // 4. Architecture Blueprint
    if (architecture.trim()) {
      const archId = 'doc:architecture';
      nodes.push({
        id: archId,
        label: 'Architecture Blueprint',
        type: 'decision',
        group: 'architecture',
        description: 'High-level system design and architectural guidelines',
        metadata: {
          content: architecture
        }
      });
      edges.push({
        source: rootId,
        target: archId,
        label: 'blueprint',
        type: 'contains'
      });
    }

    // 5. Active Agent & Handoff
    if (handoff.activeAgent && handoff.activeAgent !== 'None') {
      const activeAgentId = `agent:${handoff.activeAgent}`;
      nodes.push({
        id: activeAgentId,
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
          lastUpdated: handoff.lastUpdated
        }
      });

      edges.push({
        source: rootId,
        target: activeAgentId,
        label: 'active_session',
        type: 'contains'
      });

      if (handoff.nextAgent && handoff.nextAgent !== 'Any' && handoff.nextAgent !== handoff.activeAgent) {
        const nextAgentId = `agent:${handoff.nextAgent}`;
        nodes.push({
          id: nextAgentId,
          label: `Agent: ${handoff.nextAgent}`,
          type: 'agent',
          group: 'agents',
          description: 'Designated Next Agent for Handoff'
        });

        edges.push({
          source: activeAgentId,
          target: nextAgentId,
          label: 'baton_pass',
          type: 'hands_off_to'
        });
      }
    }

    // 6. Adapters & Bridge Files
    const enabledAdapters = config.enabledAdapters || [];
    const filesSet = new Set<string>();

    for (const adapterId of enabledAdapters) {
      const adapter = this.registry.get(adapterId);
      if (!adapter) continue;

      const adpNodeId = `adapter:${adapter.id}`;
      nodes.push({
        id: adpNodeId,
        label: adapter.name,
        type: 'adapter',
        group: 'adapters',
        description: adapter.description
      });

      edges.push({
        source: rootId,
        target: adpNodeId,
        label: 'bridges_to',
        type: 'contains'
      });

      for (const targetFile of adapter.defaultTargetFiles) {
        const fileNodeId = `file:${targetFile}`;
        if (!filesSet.has(targetFile)) {
          filesSet.add(targetFile);
          nodes.push({
            id: fileNodeId,
            label: targetFile,
            type: 'file',
            group: 'files',
            description: `Generated AI context file: ${targetFile}`
          });
        }

        edges.push({
          source: adpNodeId,
          target: fileNodeId,
          label: 'generates',
          type: 'generates'
        });
      }
    }

    return {
      nodes,
      edges,
      stats: {
        rulesCount: rules.length,
        tagsCount: tagsSet.size,
        decisionsCount: decisions.length,
        activeAgentsCount: handoff.activeAgent && handoff.activeAgent !== 'None' ? 1 : 0,
        bridgeFilesCount: filesSet.size
      }
    };
  }

  async startUiServer(options?: { port?: number; open?: boolean }): Promise<{
    port: number;
    url: string;
    server: http.Server;
    close: () => Promise<void>;
  }> {
    const defaultPort = options?.port || 3737;
    const sseClients = new Set<http.ServerResponse>();

    const unwatch = this.watch(() => {
      for (const res of sseClients) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'reload' })}\n\n`);
        } catch {
          sseClients.delete(res);
        }
      }
    });

    const server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (parsedUrl.pathname === '/api/graph') {
        try {
          const graph = await this.getKnowledgeGraph();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(graph));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      if (parsedUrl.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(': connected\n\n');
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      if (parsedUrl.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
        const config = await this.storage.loadConfig().catch(() => ({ projectName: path.basename(this.storage.rootDir) }));
        const html = renderGraphHtml(config.projectName || 'Syncytium Project');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    const port = await new Promise<number>((resolve, reject) => {
      server.listen(defaultPort, () => resolve(defaultPort));
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          server.listen(0, () => {
            const addr = server.address();
            resolve(typeof addr === 'object' && addr ? addr.port : defaultPort + 1);
          });
        } else {
          reject(err);
        }
      });
    });

    const url = `http://localhost:${port}`;

    if (options?.open !== false) {
      const openCommand = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

      exec(openCommand, () => {});
    }

    return {
      port,
      url,
      server,
      close: async () => {
        await unwatch();
        for (const c of sseClients) {
          try { c.end(); } catch {}
        }
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    };
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


