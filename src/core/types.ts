import { z } from 'zod';

export interface CanonicalRule {
  id: string;
  title: string;
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
  tags?: string[];
  content: string;
}

export interface MemoryDecision {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'superseded' | 'deprecated';
  date: string;
  context: string;
  decision: string;
  consequences: string;
}

export interface HandoffState {
  activeAgent: string;
  nextAgent?: string;
  status: 'in_progress' | 'ready_for_review' | 'blocked' | 'completed';
  goal: string;
  completedWork: string[];
  pendingTasks: string[];
  touchedFiles: string[];
  contextNotes: string;
  lastUpdated: string;
}

export interface CanonicalContext {
  projectName: string;
  rules: CanonicalRule[];
  architecture?: string;
  decisions: MemoryDecision[];
  handoff: HandoffState;
  rootDir: string;
}

export interface GeneratedFile {
  relativePath: string;
  content: string;
  description: string;
}

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly category: 'ide' | 'extension' | 'cli' | 'agent' | 'generic';
  readonly description: string;
  readonly defaultTargetFiles: string[];
  generate(context: CanonicalContext): Promise<GeneratedFile[]>;
}

export const SyncytiumConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  projectName: z.string(),
  enabledAdapters: z.array(z.string()).default([
    'cursor',
    'claude',
    'copilot',
    'cline',
    'antigravity',
    'windsurf',
    'trae',
    'opencode'
  ]),
  options: z.object({
    addSyncytiumBanner: z.boolean().default(true),
    preserveCustomSections: z.boolean().default(true)
  }).default({})
});

export type SyncytiumConfig = z.infer<typeof SyncytiumConfigSchema>;

export interface DoctorCheckItem {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface DoctorReport {
  overallStatus: 'healthy' | 'warning' | 'unhealthy';
  checks: DoctorCheckItem[];
  stats: {
    rulesCount: number;
    decisionsCount: number;
    enabledAdaptersCount: number;
    activeHandoffGoal: string;
    activeAgent: string;
  };
}

export interface FileDiffItem {
  relativePath: string;
  status: 'identical' | 'modified' | 'missing_on_disk' | 'unmanaged';
  driftSummary?: string;
}

export interface DiffReport {
  hasDrift: boolean;
  items: FileDiffItem[];
  summary: {
    identical: number;
    modified: number;
    missingOnDisk: number;
  };
}

