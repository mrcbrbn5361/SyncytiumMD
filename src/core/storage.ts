import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type {
  CanonicalContext,
  CanonicalRule,
  MemoryDecision,
  HandoffState,
  SyncytiumConfig,
  HandoffHistoryEntry,
  SyncytiumLock
} from './types.js';
import { SyncytiumConfigSchema, SyncytiumLockSchema, CONFIG_SCHEMA_VERSION, type Stack } from './schemas.js';
import { toPosix } from './paths.js';
import {
  DEFAULT_CONFIG,
  INITIAL_DECISIONS,
  INITIAL_HANDOFF,
  getRulesForStack,
  getArchitectureForStack
} from './templates.js';

/** Maximum number of handoff history entries retained on disk. */
const MAX_HISTORY_ENTRIES = 100;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Structural deep copy.
 *
 * gray-matter keeps an internal cache keyed by the content string and hands
 * back the *same* object on a repeated parse. Without copying, a caller that
 * mutates a loaded array (e.g. `addDecision` pushing a new ADR) corrupts that
 * cache, and a later `loadDecisions()` for the identical file content returns
 * the mutated value - a genuinely baffling bug to chase down.
 */
function clone<T>(value: T): T {
  return value === undefined || value === null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Drops keys whose value is `undefined`.
 *
 * gray-matter delegates to js-yaml's `dump`, which throws
 * "unacceptable kind of an object to dump" for an explicitly-undefined value -
 * and optional rule frontmatter fields are routinely undefined.
 */
export function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value;
  }
  return output as T;
}

export interface ConfigLoadResult {
  config: SyncytiumConfig;
  /** True when the file was missing or unusable and defaults were substituted. */
  usedDefaults: boolean;
  /** Field-level problems that did not prevent defaults from being applied. */
  issues: { path: string; message: string }[];
  /** True when an older config version was upgraded in memory. */
  migratedFrom?: string;
}

export class SyncytiumStorage {
  readonly rootDir: string;
  readonly syncytiumDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    this.syncytiumDir = path.join(this.rootDir, '.syncytium');
  }

  get configPath(): string {
    return path.join(this.syncytiumDir, 'syncytium.config.json');
  }

  get rulesDir(): string {
    return path.join(this.syncytiumDir, 'rules');
  }

  get memoryDir(): string {
    return path.join(this.syncytiumDir, 'memory');
  }

  get architecturePath(): string {
    return path.join(this.syncytiumDir, 'architecture.md');
  }

  get decisionsPath(): string {
    return path.join(this.memoryDir, 'decisions.md');
  }

  get handoffPath(): string {
    return path.join(this.syncytiumDir, 'HANDOFF.md');
  }

  get handoffHistoryPath(): string {
    return path.join(this.memoryDir, 'handoff-history.json');
  }

  get ignorePath(): string {
    return path.join(this.rootDir, '.syncytiumignore');
  }

  get lockPath(): string {
    return path.join(this.memoryDir, 'lock.json');
  }

  async loadIgnorePatterns(): Promise<string[]> {
    try {
      const content = await fs.readFile(this.ignorePath, 'utf-8');
      return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.syncytiumDir);
      return true;
    } catch {
      return false;
    }
  }

  async init(projectName?: string, stack: string = 'generic', force = false): Promise<void> {
    if (!force && (await this.exists())) {
      throw new Error('.syncytium/ already exists in this directory. Use `syncytium init --force` to re-initialize.');
    }

    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.mkdir(this.rulesDir, { recursive: true });
    await fs.mkdir(this.memoryDir, { recursive: true });

    const config: SyncytiumConfig = SyncytiumConfigSchema.parse({
      ...deepClone(DEFAULT_CONFIG),
      version: CONFIG_SCHEMA_VERSION,
      projectName: projectName || path.basename(this.rootDir)
    });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    const initialRules = getRulesForStack(stack);
    for (const rule of initialRules) {
      const filePath = path.join(this.rulesDir, `${rule.id}.md`);
      const fileContent = matter.stringify(
        rule.content,
        omitUndefined({
          id: rule.id,
          title: rule.title,
          description: rule.description,
          alwaysApply: rule.alwaysApply ?? true,
          globs: rule.globs ?? [],
          tags: rule.tags ?? []
        })
      );
      await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    await fs.writeFile(
      this.architecturePath,
      getArchitectureForStack(stack, projectName || path.basename(this.rootDir)),
      'utf-8'
    );

    await this.writeDecisions(INITIAL_DECISIONS);
    await this.writeHandoff(INITIAL_HANDOFF);
  }

  /**
   * Reads and validates the config file.
   *
   * Unlike a bare `JSON.parse` + cast this never hands back a shared mutable
   * reference to `DEFAULT_CONFIG`, and it never silently discards a broken
   * file: the caller receives the fallback *and* the reasons for it so `doctor`
   * and `validate` can surface the problem.
   */
  async loadConfigDetailed(): Promise<ConfigLoadResult> {
    const fallback: SyncytiumConfig = {
      ...(deepClone(DEFAULT_CONFIG) as SyncytiumConfig),
      projectName: path.basename(this.rootDir)
    };

    let raw: string;
    try {
      raw = await fs.readFile(this.configPath, 'utf-8');
    } catch {
      return { config: fallback, usedDefaults: true, issues: [] };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      return {
        config: fallback,
        usedDefaults: true,
        issues: [
          { path: '(root)', message: `Config is not valid JSON: ${(err as Error).message}` }
        ]
      };
    }

    const migratedFrom = this.migrateConfigShape(parsedJson as Record<string, unknown>);
    const result = SyncytiumConfigSchema.safeParse(parsedJson);

    if (!result.success) {
      // Salvage what we can: keep known-good fields, report the rest.
      const salvaged = this.salvageConfig(parsedJson as Record<string, unknown>);
      return {
        config: salvaged,
        usedDefaults: true,
        migratedFrom,
        issues: result.error.issues.map(issue => ({
          path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
          message: issue.message
        }))
      };
    }

    return { config: result.data, usedDefaults: false, issues: [], migratedFrom };
  }

  /**
   * Best-effort in-place upgrade of legacy config shapes.
   * `1.0.0` had no `customAdapters` and a narrower `options` object.
   */
  private migrateConfigShape(config: Record<string, unknown>): string | undefined {
    const version = typeof config.version === 'string' ? config.version : undefined;
    if (version === CONFIG_SCHEMA_VERSION) return undefined;
    if (version === undefined) return undefined;

    if (!Array.isArray(config.customAdapters)) config.customAdapters = [];
    if (typeof config.options !== 'object' || config.options === null) config.options = {};
    config.version = CONFIG_SCHEMA_VERSION;
    return version;
  }

  /** Keeps individually valid fields when the whole document fails validation. */
  private salvageConfig(config: Record<string, unknown>): SyncytiumConfig {
    const base = deepClone(DEFAULT_CONFIG) as SyncytiumConfig;
    const projectName = typeof config.projectName === 'string' && config.projectName.trim()
      ? config.projectName
      : path.basename(this.rootDir);

    const enabled =
      Array.isArray(config.enabledAdapters) &&
      config.enabledAdapters.every((id): id is string => typeof id === 'string' && id.length > 0)
        ? config.enabledAdapters
        : base.enabledAdapters;

    const options =
      typeof config.options === 'object' && config.options !== null
        ? { ...base.options, ...(config.options as Record<string, unknown>) }
        : base.options;

    return SyncytiumConfigSchema.parse({
      version: CONFIG_SCHEMA_VERSION,
      projectName,
      enabledAdapters: enabled,
      customAdapters: Array.isArray(config.customAdapters) ? config.customAdapters : [],
      options
    });
  }

  async loadConfig(): Promise<SyncytiumConfig> {
    const { config } = await this.loadConfigDetailed();
    return config;
  }

  async saveConfig(config: SyncytiumConfig): Promise<void> {
    const validated = SyncytiumConfigSchema.parse(config);
    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(validated, null, 2) + '\n', 'utf-8');
  }

  async listRuleFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.rulesDir);
      // Stable ordering: generated output must be byte-identical across platforms.
      return files.filter(file => file.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'en'));
    } catch {
      return [];
    }
  }

  async loadRules(): Promise<CanonicalRule[]> {
    const rules: CanonicalRule[] = [];
    const files = await this.listRuleFiles();
    for (const file of files) {
      const fullPath = path.join(this.rulesDir, file);
      try {
        const raw = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(raw);
        rules.push({
          id: (parsed.data.id as string) || path.basename(file, '.md'),
          title: (parsed.data.title as string) || path.basename(file, '.md'),
          description: parsed.data.description as string | undefined,
          globs: Array.isArray(parsed.data.globs) ? (parsed.data.globs as string[]) : undefined,
          alwaysApply: parsed.data.alwaysApply !== false,
          tags: Array.isArray(parsed.data.tags) ? (parsed.data.tags as string[]) : undefined,
          priority: ['low', 'medium', 'high'].includes(parsed.data.priority)
            ? (parsed.data.priority as 'low' | 'medium' | 'high')
            : undefined,
          content: parsed.content.trim(),
          sourceFile: toPosix(path.relative(this.rootDir, fullPath))
        });
      } catch {
        // A single unparsable file must not take down the whole catalog;
        // `lint` reports it with the exact filename.
      }
    }
    return rules;
  }
  getRulePath(id: string): string {
    return path.join(this.rulesDir, `${id}.md`);
  }

  async loadArchitecture(): Promise<string> {
    try {
      return await fs.readFile(this.architecturePath, 'utf-8');
    } catch {
      return '';
    }
  }

  async loadDecisions(): Promise<MemoryDecision[]> {
    try {
      const raw = await fs.readFile(this.decisionsPath, 'utf-8');
      const parsed = matter(raw);
      if (Array.isArray(parsed.data.decisions)) {
        return clone(parsed.data.decisions) as MemoryDecision[];
      }
      // v0.1.x files stored the ADR list only in the markdown body. Re-parse it
      // instead of silently injecting a template ADR into the project.
      return this.parseDecisionsFromMarkdown(parsed.content);
    } catch {
      // No decisions recorded yet is a valid state, not an error.
      return [];
    }
  }

  /** Recovers ADRs from the human-readable body used before the JSON frontmatter. */
  private parseDecisionsFromMarkdown(markdown: string): MemoryDecision[] {
    const decisions: MemoryDecision[] = [];
    const blockRe = /^###\s+\[([^\]]+)\]\s+(.+)$/gm;
    const matches: { id: string; title: string; index: number; body: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(markdown)) !== null) {
      matches.push({ id: match[1].trim(), title: match[2].trim(), index: match.index, body: '' });
    }
    matches.forEach((entry, i) => {
      const start = entry.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
      const body = markdown.slice(start + entry.title.length, end);
      const pick = (label: string): string => {
        const found = new RegExp(`\\*\\*${label}:\\*\\*\\s*\\n?([\\s\\S]*?)(?=\\n\\*\\*|\\n---|$)`).exec(body);
        return found ? found[1].trim() : '';
      };
      const status = /- \*\*Status:\*\*\s*(\w+)/.exec(body);
      const date = /- \*\*Date:\*\*\s*(\S+)/.exec(body);
      if (!pick('Context') && !pick('Decision')) return;
      decisions.push({
        id: entry.id,
        title: entry.title,
        status: (status?.[1] as MemoryDecision['status']) || 'accepted',
        date: date?.[1] || new Date().toISOString().split('T')[0],
        context: pick('Context'),
        decision: pick('Decision'),
        consequences: pick('Consequences')
      });
    });
    return decisions;
  }

  async writeDecisions(decisions: MemoryDecision[]): Promise<void> {
    let mdBody = '# Architectural Decision Records (ADR)\n\n';
    for (const d of decisions) {
      mdBody += `### [${d.id}] ${d.title}\n`;
      mdBody += `- **Status:** ${d.status}\n`;
      mdBody += `- **Date:** ${d.date}\n\n`;
      mdBody += `**Context:**\n${d.context}\n\n`;
      mdBody += `**Decision:**\n${d.decision}\n\n`;
      mdBody += `**Consequences:**\n${d.consequences}\n\n---\n\n`;
    }
    const content = matter.stringify(mdBody, { decisions });
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.decisionsPath, content, 'utf-8');
  }

  async addDecision(decision: MemoryDecision): Promise<void> {
    const decisions = await this.loadDecisions();
    const existingIndex = decisions.findIndex(d => d.id === decision.id);
    if (existingIndex >= 0) {
      decisions[existingIndex] = decision;
    } else {
      // `decisions` is a fresh deep copy, so this push is safe.
      decisions.push(decision);
    }
    await this.writeDecisions(decisions);
  }

  async removeDecision(id: string): Promise<boolean> {
    const decisions = await this.loadDecisions();
    const next = decisions.filter(d => d.id !== id);
    if (next.length === decisions.length) return false;
    await this.writeDecisions(next);
    return true;
  }

  /** Returns the next free ADR id, filling gaps without reusing existing ones. */
  async nextDecisionId(): Promise<string> {
    const decisions = await this.loadDecisions();
    const used = new Set(
      decisions
        .map(d => /^ADR-(\d+)$/i.exec(d.id)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(value => Number.parseInt(value, 10))
    );
    let candidate = 1;
    while (used.has(candidate)) candidate++;
    return `ADR-${String(candidate).padStart(3, '0')}`;
  }

  async loadHandoff(): Promise<HandoffState> {
    try {
      const raw = await fs.readFile(this.handoffPath, 'utf-8');
      const parsed = matter(raw);
      const data = parsed.data;
      return clone({
        activeAgent: data.activeAgent || 'Unknown',
        nextAgent: data.nextAgent,
        status: data.status || 'in_progress',
        goal: data.goal || '',
        completedWork: data.completedWork || [],
        pendingTasks: data.pendingTasks || [],
        touchedFiles: data.touchedFiles || [],
        contextNotes: (data.contextNotes as string) || (data.notes as string) || '',
        lastUpdated: data.lastUpdated || new Date().toISOString()
      }) as HandoffState;
    } catch {
      // A missing HANDOFF.md means "nothing handed off yet" - not the template.
      return {
        activeAgent: 'None',
        nextAgent: undefined,
        status: 'ready_for_review',
        goal: '',
        completedWork: [],
        pendingTasks: [],
        touchedFiles: [],
        contextNotes: '',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async writeHandoff(handoff: HandoffState): Promise<void> {
    const body = `# 🤝 Syncytium Handoff & Live State

> **Active Agent:** \`${handoff.activeAgent}\`  
> **Next Recommended Agent:** \`${handoff.nextAgent || 'Any'}\`  
> **Status:** \`${handoff.status.toUpperCase()}\`  
> **Last Updated:** \`${handoff.lastUpdated}\`

## 🎯 Current Goal
${handoff.goal || '_No active goal recorded._'}

## ✅ Completed in Recent Turns
${handoff.completedWork.map(item => `- ${item}`).join('\n') || '- None recorded yet.'}

## 📋 Pending Tasks (Next Agent Action Items)
${handoff.pendingTasks.map(item => `- [ ] ${item}`).join('\n') || '- No pending tasks.'}

## 📂 Recently Touched Files
${handoff.touchedFiles.map(f => `- \`${f}\``).join('\n') || '- None recorded.'}

## 🧠 Context & Handoff Notes for Next Agent
${handoff.contextNotes || 'No specific notes provided.'}
`;

    const fileContent = matter.stringify(body, {
      activeAgent: handoff.activeAgent,
      nextAgent: handoff.nextAgent,
      status: handoff.status,
      goal: handoff.goal,
      completedWork: handoff.completedWork,
      pendingTasks: handoff.pendingTasks,
      touchedFiles: handoff.touchedFiles,
      contextNotes: handoff.contextNotes,
      lastUpdated: handoff.lastUpdated
    });

    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.writeFile(this.handoffPath, fileContent, 'utf-8');
  }

  async loadCanonicalContext(): Promise<CanonicalContext> {
    const config = await this.loadConfig();
    const rules = await this.loadRules();
    const architecture = await this.loadArchitecture();
    const decisions = await this.loadDecisions();
    const handoff = await this.loadHandoff();

    return {
      projectName: config.projectName,
      rules,
      architecture,
      decisions,
      handoff,
      rootDir: this.rootDir,
      config
    };
  }

  async loadHandoffHistory(): Promise<HandoffHistoryEntry[]> {
    try {
      const data = await fs.readFile(this.handoffHistoryPath, 'utf-8');
      const list = JSON.parse(data);
      return Array.isArray(list) ? (clone(list) as HandoffHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  async recordHandoffHistory(entry: HandoffHistoryEntry): Promise<void> {
    const history = await this.loadHandoffHistory();
    history.unshift(entry); // newest first
    const capped = history.slice(0, MAX_HISTORY_ENTRIES);
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.handoffHistoryPath, JSON.stringify(capped, null, 2) + '\n', 'utf-8');
  }

  async saveRule(filename: string, content: string): Promise<string> {
    await fs.mkdir(this.rulesDir, { recursive: true });
    const target = path.join(this.rulesDir, filename.endsWith('.md') ? filename : `${filename}.md`);
    await fs.writeFile(target, content.trim() + '\n', 'utf-8');
    return target;
  }

  async deleteRuleFile(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getRulePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async saveArchitecture(content: string): Promise<void> {
    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.writeFile(this.architecturePath, content.trim() + '\n', 'utf-8');
  }

  async loadLock(): Promise<SyncytiumLock> {
    try {
      const data = await fs.readFile(this.lockPath, 'utf-8');
      const parsed = SyncytiumLockSchema.safeParse(JSON.parse(data));
      if (parsed.success) return parsed.data;
      return JSON.parse(data) as SyncytiumLock;
    } catch {
      return { locked: false };
    }
  }

  async saveLock(lock: SyncytiumLock): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }
}

export type { Stack };
