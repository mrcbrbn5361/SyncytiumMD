import chokidar from 'chokidar';
import pc from 'picocolors';
import { SyncytiumStorage } from './storage.js';
import { AdapterRegistry } from '../adapters/registry.js';
import type { HandoffState, MemoryDecision } from './types.js';

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

  async sync(adapterFilter?: string[]): Promise<{ count: number; paths: string[] }> {
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

    return { count: writtenPaths.length, paths: writtenPaths };
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

    watcher.on('all', (event, filePath) => {
      triggerSync();
    });

    return async () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      await watcher.close();
    };
  }
}
