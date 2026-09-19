import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import pc from 'picocolors';
import { SyncytiumStorage } from './storage.js';
import { AdapterRegistry } from '../adapters/registry.js';
import type {
  HandoffState,
  MemoryDecision,
  DoctorReport,
  DoctorCheckItem,
  DiffReport,
  FileDiffItem
} from './types.js';

export class SyncytiumEngine {
  readonly storage: SyncytiumStorage;
  readonly registry: AdapterRegistry;

  constructor(rootDir: string = process.cwd()) {
    this.storage = new SyncytiumStorage(rootDir);
    this.registry = new AdapterRegistry();
  }

  async init(projectName?: string): Promise<void> {
    if (await this.storage.exists()) {
      throw new Error('.syncytium/ already exists in this directory.');
    }
    await this.storage.init(projectName);
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
    const writtenPaths = await this.registry.writeFiles(this.storage.rootDir, files);

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
    const items: FileDiffItem[] = [];

    let identical = 0;
    let modified = 0;
    let missingOnDisk = 0;

    for (const genFile of files) {
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

    if (params.autoSync !== false) {
      await this.sync();
    }

    return updated;
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
