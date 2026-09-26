import type { z } from 'zod';
import {
  SyncytiumConfigSchema,
  CustomAdapterSchema,
  RuleFrontmatterSchema,
  MemoryDecisionSchema,
  HandoffStateSchema,
  SyncytiumLockSchema,
  type FieldIssue
} from './schemas.js';

export * from './schemas.js';

export interface CanonicalRule {
  id: string;
  title: string;
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  content: string;
  /** Absolute path of the source file, when known. */
  sourceFile?: string;
}

export type MemoryDecision = z.infer<typeof MemoryDecisionSchema>;
export type HandoffState = z.infer<typeof HandoffStateSchema>;
export type SyncytiumLock = z.infer<typeof SyncytiumLockSchema>;
export type SyncytiumConfig = z.infer<typeof SyncytiumConfigSchema>;
export type CustomAdapterConfig = z.infer<typeof CustomAdapterSchema>;
export type RuleFrontmatter = z.infer<typeof RuleFrontmatterSchema>;

export interface CanonicalContext {
  projectName: string;
  rules: CanonicalRule[];
  architecture?: string;
  decisions: MemoryDecision[];
  handoff: HandoffState;
  rootDir: string;
  /** Present when loaded through `SyncytiumStorage.loadCanonicalContext`. */
  config?: SyncytiumConfig;
}

export interface GeneratedFile {
  relativePath: string;
  content: string;
  description: string;
  /** Adapter that produced the file, for provenance and orphan detection. */
  adapterId?: string;
}

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly category: 'ide' | 'extension' | 'cli' | 'agent' | 'generic';
  readonly description: string;
  readonly defaultTargetFiles: string[];
  generate(context: CanonicalContext): Promise<GeneratedFile[]>;
}

export interface DoctorCheckItem {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
  /** Stable machine-readable identifier, used by `--json` consumers. */
  id?: string;
  /** Actionable remediation hint rendered by the CLI. */
  fix?: string;
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

export type DiffStatus = 'identical' | 'modified' | 'missing_on_disk' | 'unmanaged';

export interface FileDiffItem {
  relativePath: string;
  status: DiffStatus;
  driftSummary?: string;
  adapterId?: string;
  /** Number of changed lines vs the generated content (modified only). */
  changedLines?: number;
  /** Unified diff hunks, capped to a readable number of lines. */
  patch?: string;
}

export interface DiffReport {
  hasDrift: boolean;
  items: FileDiffItem[];
  summary: {
    identical: number;
    modified: number;
    missingOnDisk: number;
    unmanaged: number;
  };
}

export interface HandoffHistoryEntry {
  id: string;
  timestamp: string;
  fromAgent: string;
  toAgent: string;
  status: 'in_progress' | 'ready_for_review' | 'blocked' | 'completed';
  goal: string;
  tasksDone: string[];
  nextTasks: string[];
  activeFiles: string[];
  notes?: string;
}

export interface LintIssue {
  file: string;
  line?: number;
  type: 'error' | 'warning';
  message: string;
  ruleId?: string;
  code?: string;
}

export interface LintReport {
  valid: boolean;
  issues: LintIssue[];
  totalChecked: number;
  fixedCount?: number;
}

export interface ImportItem {
  sourceFile: string;
  adapterName: string;
  targetRuleFile: string;
  extractedTitle: string;
}

export interface ImportReport {
  importedCount: number;
  items: ImportItem[];
  /** Files that were skipped because they are already Syncytium-managed. */
  skippedCount?: number;
}

export type GraphNodeType =
  | 'root'
  | 'rule'
  | 'tag'
  | 'decision'
  | 'agent'
  | 'adapter'
  | 'file'
  | 'doc';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  group: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  type?: 'contains' | 'tagged' | 'implements' | 'hands_off_to' | 'generates' | 'references';
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    rulesCount: number;
    tagsCount: number;
    decisionsCount: number;
    activeAgentsCount: number;
    bridgeFilesCount: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: FieldIssue[];
  warnings: FieldIssue[];
}

export interface ExportBundleOptions {
  includeHandoff?: boolean;
  includeDecisions?: boolean;
  includeArchitecture?: boolean;
  /** Maximum characters per rule body; 0 disables truncation. */
  maxRuleChars?: number;
}

export interface ExportedSection {
  heading: string;
  body: string;
  truncated?: boolean;
}

export interface ExportBundle {
  projectName: string;
  generatedAt: string;
  version: string;
  sections: ExportedSection[];
  markdown: string;
}
