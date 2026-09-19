import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../core/types.js';
import { CursorAdapter } from './builtin/cursor.js';
import { ClaudeCodeAdapter } from './builtin/claude.js';
import { GitHubCopilotAdapter } from './builtin/copilot.js';
import { ClineAdapter } from './builtin/cline.js';
import { AntigravityAdapter } from './builtin/antigravity.js';
import { WindsurfAdapter } from './builtin/windsurf.js';
import { TraeAdapter } from './builtin/trae.js';
import { OpenCodeAdapter } from './builtin/opencode.js';
import { GenericAdapter, type GenericAdapterConfig } from './builtin/generic.js';

export class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>();

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
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
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

    const targetAdapters = enabledIds
      ? enabledIds
          .map(id => this.get(id))
          .filter((a): a is AgentAdapter => a !== undefined)
      : this.list();

    for (const adapter of targetAdapters) {
      try {
        const files = await adapter.generate(context);
        byAdapter[adapter.id] = files;
        allFiles.push(...files);
      } catch (err) {
        console.error(`Error generating files for adapter ${adapter.id}:`, err);
      }
    }

    return { files: allFiles, byAdapter };
  }

  async writeFiles(rootDir: string, files: GeneratedFile[]): Promise<string[]> {
    const writtenPaths: string[] = [];
    for (const file of files) {
      const fullPath = path.join(rootDir, file.relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf-8');
      writtenPaths.push(file.relativePath);
    }
    return writtenPaths;
  }

  async cleanManagedFiles(rootDir: string, enabledIds?: string[]): Promise<string[]> {
    const cleaned: string[] = [];
    const targetAdapters = enabledIds
      ? enabledIds
          .map(id => this.get(id))
          .filter((a): a is AgentAdapter => a !== undefined)
      : this.list();

    for (const adapter of targetAdapters) {
      for (const target of adapter.defaultTargetFiles) {
        const fullPath = path.join(rootDir, target);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
            cleaned.push(`${target} (directory)`);
          } else {
            // Check if file contains Syncytium banner before deleting
            const content = await fs.readFile(fullPath, 'utf-8');
            if (content.includes('SYNCYTIUM-MD')) {
              await fs.unlink(fullPath);
              cleaned.push(target);
            }
          }
        } catch {
          // File does not exist, ignore
        }
      }
    }
    return cleaned;
  }
}
