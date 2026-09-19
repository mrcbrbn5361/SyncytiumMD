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
import {
  DEFAULT_CONFIG,
  INITIAL_RULES,
  INITIAL_ARCHITECTURE,
  INITIAL_DECISIONS,
  INITIAL_HANDOFF,
  getRulesForStack
} from './templates.js';

export class SyncytiumStorage {
  readonly rootDir: string;
  readonly syncytiumDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.syncytiumDir = path.join(rootDir, '.syncytium');
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
        .split('\n')
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

  async init(projectName?: string, stack: string = 'generic'): Promise<void> {
    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.mkdir(this.rulesDir, { recursive: true });
    await fs.mkdir(this.memoryDir, { recursive: true });

    // Config
    const config: SyncytiumConfig = {
      ...DEFAULT_CONFIG,
      projectName: projectName || path.basename(this.rootDir)
    };
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Rules tailored to project technology stack
    const initialRules = getRulesForStack(stack);
    for (const rule of initialRules) {
      const filePath = path.join(this.rulesDir, `${rule.id}.md`);
      const fileContent = matter.stringify(rule.content, {
        id: rule.id,
        title: rule.title,
        description: rule.description,
        alwaysApply: rule.alwaysApply ?? true,
        globs: rule.globs ?? [],
        tags: rule.tags ?? []
      });
      await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    // Architecture
    await fs.writeFile(this.architecturePath, INITIAL_ARCHITECTURE, 'utf-8');

    // Decisions
    await this.writeDecisions(INITIAL_DECISIONS);

    // Handoff
    await this.writeHandoff(INITIAL_HANDOFF);
  }

  async loadConfig(): Promise<SyncytiumConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as SyncytiumConfig;
    } catch {
      return {
        ...DEFAULT_CONFIG,
        projectName: path.basename(this.rootDir)
      };
    }
  }

  async loadRules(): Promise<CanonicalRule[]> {
    const rules: CanonicalRule[] = [];
    try {
      const files = await fs.readdir(this.rulesDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const fullPath = path.join(this.rulesDir, file);
        const raw = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(raw);
        rules.push({
          id: (parsed.data.id as string) || path.basename(file, '.md'),
          title: (parsed.data.title as string) || path.basename(file, '.md'),
          description: parsed.data.description as string | undefined,
          globs: parsed.data.globs as string[] | undefined,
          alwaysApply: parsed.data.alwaysApply !== false,
          tags: parsed.data.tags as string[] | undefined,
          content: parsed.content.trim()
        });
      }
    } catch {
      // Ignore if dir doesn't exist yet
    }
    return rules;
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
        return parsed.data.decisions as MemoryDecision[];
      }
      return INITIAL_DECISIONS;
    } catch {
      return INITIAL_DECISIONS;
    }
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
    await fs.writeFile(this.decisionsPath, content, 'utf-8');
  }

  async addDecision(decision: MemoryDecision): Promise<void> {
    const decisions = await this.loadDecisions();
    const existingIndex = decisions.findIndex(d => d.id === decision.id);
    if (existingIndex >= 0) {
      decisions[existingIndex] = decision;
    } else {
      decisions.push(decision);
    }
    await this.writeDecisions(decisions);
  }

  async loadHandoff(): Promise<HandoffState> {
    try {
      const raw = await fs.readFile(this.handoffPath, 'utf-8');
      const parsed = matter(raw);
      const data = parsed.data;
      return {
        activeAgent: data.activeAgent || 'Unknown',
        nextAgent: data.nextAgent,
        status: data.status || 'in_progress',
        goal: data.goal || '',
        completedWork: data.completedWork || [],
        pendingTasks: data.pendingTasks || [],
        touchedFiles: data.touchedFiles || [],
        contextNotes: (data.contextNotes as string) || (data.notes as string) || '',
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    } catch {
      return INITIAL_HANDOFF;
    }
  }

  async writeHandoff(handoff: HandoffState): Promise<void> {
    let body = `# 🤝 Syncytium Handoff & Live State

> **Active Agent:** \`${handoff.activeAgent}\`  
> **Next Recommended Agent:** \`${handoff.nextAgent || 'Any'}\`  
> **Status:** \`${handoff.status.toUpperCase()}\`  
> **Last Updated:** \`${handoff.lastUpdated}\`

## 🎯 Current Goal
${handoff.goal}

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
      rootDir: this.rootDir
    };
  }

  async loadHandoffHistory(): Promise<HandoffHistoryEntry[]> {
    try {
      const data = await fs.readFile(this.handoffHistoryPath, 'utf-8');
      const list = JSON.parse(data);
      return Array.isArray(list) ? (list as HandoffHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  async recordHandoffHistory(entry: HandoffHistoryEntry): Promise<void> {
    const history = await this.loadHandoffHistory();
    history.unshift(entry); // newest first
    // Keep max 50 entries to prevent infinite growth
    const capped = history.slice(0, 50);
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.handoffHistoryPath, JSON.stringify(capped, null, 2), 'utf-8');
  }

  async saveRule(filename: string, content: string): Promise<void> {
    await fs.mkdir(this.rulesDir, { recursive: true });
    const target = path.join(this.rulesDir, filename.endsWith('.md') ? filename : `${filename}.md`);
    await fs.writeFile(target, content.trim() + '\n', 'utf-8');
  }

  async saveArchitecture(content: string): Promise<void> {
    await fs.mkdir(this.syncytiumDir, { recursive: true });
    await fs.writeFile(this.architecturePath, content.trim() + '\n', 'utf-8');
  }

  async loadLock(): Promise<SyncytiumLock> {
    try {
      const data = await fs.readFile(this.lockPath, 'utf-8');
      return JSON.parse(data) as SyncytiumLock;
    } catch {
      return { locked: false };
    }
  }

  async saveLock(lock: SyncytiumLock): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.lockPath, JSON.stringify(lock, null, 2), 'utf-8');
  }
}
