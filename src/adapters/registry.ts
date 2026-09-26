import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentAdapter, CanonicalContext, GeneratedFile, SyncytiumConfig } from '../core/types.js';
import { BANNER_MARKER } from '../core/templates.js';
import { toPosix } from '../core/paths.js';
import { mergeUserSection } from './base.js';
import { CursorAdapter } from './builtin/cursor.js';
import { ClaudeCodeAdapter } from './builtin/claude.js';
import { GitHubCopilotAdapter } from './builtin/copilot.js';
import { ClineAdapter } from './builtin/cline.js';
import { AntigravityAdapter } from './builtin/antigravity.js';
import { WindsurfAdapter } from './builtin/windsurf.js';
import { TraeAdapter } from './builtin/trae.js';
import { OpenCodeAdapter } from './builtin/opencode.js';
import { AgentsAdapter } from './builtin/agents.js';
import { GeminiAdapter } from './builtin/gemini.js';
import { GenericAdapter, type GenericAdapterConfig } from './builtin/generic.js';

export interface WriteOptions {
  /** Keep content the user appended below the generated section. */
  preserveUserSections?: boolean;
}

export class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>();
  private customIds = new Set<string>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new CursorAdapter());
    this.register(new ClaudeCodeAdapter());
    this.register(new GitHubCopilotAdapter());
    this.register(new ClineAdapter());
    this.register(new AntigravityAdapter());
    this.register(new WindsurfAdapter());
    this.register(new TraeAdapter());
    this.register(new OpenCodeAdapter());
    this.register(new AgentsAdapter());
    this.register(new GeminiAdapter());
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  /** Registers (or replaces) a user-declared adapter from the config file. */
  registerCustom(config: GenericAdapterConfig): AgentAdapter {
    const id = config.id.toLowerCase();
    const adapter = new GenericAdapter(config);
    this.adapters.set(id, adapter);
    this.customIds.add(id);
    return adapter;
  }

  isCustom(id: string): boolean {
    return this.customIds.has(id.toLowerCase());
  }

  /** Installs every `customAdapters` entry declared in a validated config. */
  applyConfig(config: SyncytiumConfig): void {
    for (const custom of config.customAdapters ?? []) {
      this.registerCustom({
        id: custom.id,
        name: custom.name,
        targetFile: custom.targetFile,
        category: custom.category,
        header: custom.header,
        includeArchitecture: custom.includeArchitecture,
        includeHandoff: custom.includeHandoff
      });
    }
  }

  registerGeneric(config: GenericAdapterConfig): void {
    this.register(new GenericAdapter(config));
  }

  get(id: string): AgentAdapter | undefined {
    return this.adapters.get(id.toLowerCase());
  }

  list(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  async generateAll(
    context: CanonicalContext,
    enabledIds?: string[]
  ): Promise<{ files: GeneratedFile[]; byAdapter: Record<string, GeneratedFile[]> }> {
    const allFiles: GeneratedFile[] = [];
    const byAdapter: Record<string, GeneratedFile[]> = {};

    const requested = enabledIds && enabledIds.length > 0 ? enabledIds : [...this.adapters.keys()];
    const targetAdapters = requested
      .map(id => this.get(id))
      .filter((a): a is AgentAdapter => a !== undefined);

    for (const adapter of targetAdapters) {
      try {
        const files = await adapter.generate(context);
        const stamped = files.map(file => ({ ...file, adapterId: adapter.id }));
        byAdapter[adapter.id] = stamped;
        allFiles.push(...stamped);
      } catch (err) {
        console.error(`Error generating files for adapter ${adapter.id}:`, err);
      }
    }

    return { files: allFiles, byAdapter };
  }

  /**
   * Writes generated files.
   *
   * Paths are resolved against `rootDir` and verified to stay inside it, so a
   * hostile rule id can never escape the workspace.
   */
  async writeFiles(
    rootDir: string,
    files: GeneratedFile[],
    options?: WriteOptions
  ): Promise<string[]> {
    const writtenPaths: string[] = [];
    const resolvedRoot = path.resolve(rootDir);

    for (const file of files) {
      const fullPath = path.resolve(resolvedRoot, file.relativePath);
      if (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error(`Refusing to write outside the workspace: ${file.relativePath}`);
      }

      let content = file.content;
      if (options?.preserveUserSections) {
        const previous = await fs.readFile(fullPath, 'utf-8').catch(() => null);
        if (previous) content = mergeUserSection(file.content, previous);
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      writtenPaths.push(toPosix(file.relativePath));
    }
    return writtenPaths;
  }

  /**
   * Removes generated files while leaving hand-written content alone.
   *
   * Directories are only emptied file-by-file: a user's own
   * `.cursor/rules/my-rule.mdc` must survive `syncytium clean`.
   */
  async cleanManagedFiles(rootDir: string, enabledIds?: string[]): Promise<string[]> {
    const cleaned: string[] = [];
    const requested = enabledIds && enabledIds.length > 0 ? enabledIds : [...this.adapters.keys()];
    const targets = requested
      .map(id => this.get(id))
      .filter((a): a is AgentAdapter => a !== undefined)
      .flatMap(a => a.defaultTargetFiles);

    for (const target of [...new Set(targets)]) {
      const fullPath = path.join(rootDir, target);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (!stat.isDirectory()) {
        const content = await fs.readFile(fullPath, 'utf-8').catch(() => null);
        if (content?.includes(BANNER_MARKER)) {
          await fs.unlink(fullPath);
          cleaned.push(toPosix(target));
        }
        continue;
      }

      // Directory target: delete only banner-tagged files, then prune empties.
      const managed = await this.collectManagedFiles(fullPath, rootDir);
      for (const rel of managed) {
        const file = path.join(rootDir, rel);
        const content = await fs.readFile(file, 'utf-8').catch(() => null);
        if (content?.includes(BANNER_MARKER)) {
          await fs.unlink(file);
          cleaned.push(rel);
        }
      }
      await this.removeEmptyDirs(fullPath, rootDir);
    }

    return cleaned;
  }

  private async collectManagedFiles(dir: string, base: string, depth = 0): Promise<string[]> {
    if (depth > 4) return [];
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const found: string[] = [];
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
        found.push(...(await this.collectManagedFiles(full, base, depth + 1)));
        continue;
      }
      const content = await fs.readFile(full, 'utf-8').catch(() => null);
      if (content?.includes(BANNER_MARKER)) {
        found.push(toPosix(path.relative(base, full)));
      }
    }
    return found;
  }

  /** Removes now-empty directories bottom-up, stopping at `root`. */
  private async removeEmptyDirs(dir: string, root: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      try {
        if ((await fs.stat(full)).isDirectory()) await this.removeEmptyDirs(full, root);
      } catch {
        // skip
      }
    }
    try {
      if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
    } catch {
      // Not empty: keep it, the user owns those files.
    }
  }
}
