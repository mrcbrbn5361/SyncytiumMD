import { z } from 'zod';

/** Current on-disk config schema version. Bump when a migration is added. */
export const CONFIG_SCHEMA_VERSION = '2.0.0';

const adapterCategorySchema = z.enum(['ide', 'extension', 'cli', 'agent', 'generic']);

/** A user-defined adapter declared inside `syncytium.config.json`. */
export const CustomAdapterSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, 'Custom adapter id must be alphanumeric/dash only'),
  name: z.string().min(1),
  targetFile: z.string().min(1),
  category: adapterCategorySchema.default('generic'),
  header: z.string().optional(),
  includeArchitecture: z.boolean().default(false),
  includeHandoff: z.boolean().default(true)
});
export type CustomAdapterConfig = z.infer<typeof CustomAdapterSchema>;

/**
 * What a caller may supply before validation. `saveConfig` runs the schema, so
 * defaulted fields can be omitted in TypeScript too.
 */
export type CustomAdapterInput = z.input<typeof CustomAdapterSchema>;

/** Frontmatter schema for a canonical rule file. */
export const RuleFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  globs: z.array(z.string()).default([]),
  alwaysApply: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  /** Optional, semver-ish constraint used by `rule add` to document intent. */
  priority: z.enum(['low', 'medium', 'high']).optional()
});
export type RuleFrontmatter = z.infer<typeof RuleFrontmatterSchema>;

/** Default adapter ids enabled for a brand new workspace. */
export const DEFAULT_ADAPTERS = [
  'cursor',
  'claude',
  'copilot',
  'cline',
  'antigravity',
  'windsurf',
  'trae',
  'opencode',
  'agents',
  'gemini'
] as const;

export const SyncytiumConfigSchema = z.object({
  version: z.string().default(CONFIG_SCHEMA_VERSION),
  projectName: z.string().min(1),
  enabledAdapters: z.array(z.string().min(1)).min(1).default([...DEFAULT_ADAPTERS]),
  customAdapters: z.array(CustomAdapterSchema).default([]),
  options: z
    .object({
      addSyncytiumBanner: z.boolean().default(true),
      preserveCustomSections: z.boolean().default(true),
      /** Emit a per-rule "Rule <id>" anchor table in generated files. */
      emitRuleIndex: z.boolean().default(false),
      /** Prune generated files whose source rule no longer exists. */
      pruneOrphans: z.boolean().default(true),
      /** Refuse to sync/handoff while another agent holds the lock. */
      enforceLock: z.boolean().default(false)
    })
    .default({})
});
export type SyncytiumConfig = z.infer<typeof SyncytiumConfigSchema>;

export const DecisionStatusSchema = z.enum(['proposed', 'accepted', 'superseded', 'deprecated']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const MemoryDecisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: DecisionStatusSchema,
  date: z.string().min(1),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1)
});
export type MemoryDecisionInput = z.infer<typeof MemoryDecisionSchema>;

export const HandoffStatusSchema = z.enum([
  'in_progress',
  'ready_for_review',
  'blocked',
  'completed'
]);
export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;

export const HandoffStateSchema = z.object({
  activeAgent: z.string(),
  nextAgent: z.string().optional(),
  status: HandoffStatusSchema,
  goal: z.string(),
  completedWork: z.array(z.string()),
  pendingTasks: z.array(z.string()),
  touchedFiles: z.array(z.string()),
  contextNotes: z.string(),
  lastUpdated: z.string()
});

export const SyncytiumLockSchema = z.object({
  locked: z.boolean(),
  agent: z.string().optional(),
  goal: z.string().optional(),
  acquiredAt: z.string().optional(),
  expiresAt: z.string().optional(),
  /** Free-form lease metadata (pid, host) to ease crash triage. */
  host: z.string().optional(),
  pid: z.number().int().optional()
});
export type SyncytiumLock = z.infer<typeof SyncytiumLockSchema>;

export const StackSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'kotlin',
  'php',
  'ruby',
  'dotnet',
  'swift',
  'elixir',
  'generic'
]);
export type Stack = z.infer<typeof StackSchema>;

/** Human-readable field error -> path map, used by `validate` and `doctor`. */
export interface FieldIssue {
  path: string;
  message: string;
}

export function flattenZodError(error: z.ZodError): FieldIssue[] {
  return error.issues.map(issue => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message
  }));
}
