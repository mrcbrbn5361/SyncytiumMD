import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * Machine-readable safety contract for every MCP tool.
 *
 * The MCP spec defines `readOnlyHint` / `destructiveHint` / `idempotentHint` /
 * `openWorldHint`, and scanners and gateways use those hints to decide whether
 * an agent may call a tool unattended. Advertising them accurately is only half
 * of the contract: this module also enforces per-tool call budgets in-process,
 * so a loop cannot call a mutating tool without limit even when the client
 * ignores the hints.
 */
export type ToolEffect = 'read' | 'write' | 'destructive';

export interface ToolSafetyPolicy {
  effect: ToolEffect;
  annotations: ToolAnnotations;
  /** Maximum calls allowed inside one sliding window. */
  maxCalls: number;
  /** Sliding-window length in milliseconds. */
  windowMs: number;
}

const MINUTE = 60_000;

const read = (title: string): ToolAnnotations => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

const write = (title: string, idempotent = false): ToolAnnotations => ({
  title,
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: idempotent,
  openWorldHint: false
});

const destructive = (title: string, idempotent = true): ToolAnnotations => ({
  title,
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: idempotent,
  openWorldHint: false
});

export const TOOL_SAFETY: Record<string, ToolSafetyPolicy> = {
  syncytium_get_context: { effect: 'read', annotations: read('Get canonical context'), maxCalls: 120, windowMs: MINUTE },
  syncytium_handoff: { effect: 'write', annotations: write('Record agent handoff'), maxCalls: 30, windowMs: MINUTE },
  syncytium_record_decision: { effect: 'write', annotations: write('Record an ADR', true), maxCalls: 20, windowMs: MINUTE },
  syncytium_remove_decision: {
    effect: 'destructive',
    annotations: destructive('Archive and remove an ADR'),
    maxCalls: 5,
    windowMs: MINUTE
  },
  syncytium_list_decisions: { effect: 'read', annotations: read('List ADRs'), maxCalls: 120, windowMs: MINUTE },
  syncytium_create_rule: { effect: 'write', annotations: write('Create a canonical rule'), maxCalls: 20, windowMs: MINUTE },
  syncytium_list_rules: { effect: 'read', annotations: read('List canonical rules'), maxCalls: 120, windowMs: MINUTE },
  syncytium_update_rule: { effect: 'write', annotations: write('Update a canonical rule', true), maxCalls: 30, windowMs: MINUTE },
  syncytium_remove_rule: {
    effect: 'destructive',
    annotations: destructive('Archive and remove a canonical rule'),
    maxCalls: 5,
    windowMs: MINUTE
  },
  syncytium_sync: {
    effect: 'destructive',
    annotations: destructive('Regenerate bridge files and prune orphans', true),
    maxCalls: 10,
    windowMs: MINUTE
  },
  syncytium_get_history: { effect: 'read', annotations: read('Get handoff history'), maxCalls: 60, windowMs: MINUTE },
  syncytium_lint: { effect: 'read', annotations: read('Lint canonical content'), maxCalls: 30, windowMs: MINUTE },
  syncytium_validate: { effect: 'read', annotations: read('Validate config and rule frontmatter'), maxCalls: 60, windowMs: MINUTE },
  syncytium_validate_fix: { effect: 'write', annotations: write('Repair invalid config or frontmatter', true), maxCalls: 15, windowMs: MINUTE },
  syncytium_diff: { effect: 'read', annotations: read('Check context drift'), maxCalls: 60, windowMs: MINUTE },
  syncytium_doctor: { effect: 'read', annotations: read('Read-only workspace health check'), maxCalls: 20, windowMs: MINUTE },
  syncytium_lock_acquire: { effect: 'write', annotations: write('Acquire the workspace lease'), maxCalls: 60, windowMs: MINUTE },
  syncytium_lock_release: { effect: 'write', annotations: write('Release the workspace lease', true), maxCalls: 60, windowMs: MINUTE },
  syncytium_lock_status: { effect: 'read', annotations: read('Read lease status'), maxCalls: 120, windowMs: MINUTE },
  syncytium_get_graph: { effect: 'read', annotations: read('Get the knowledge graph'), maxCalls: 60, windowMs: MINUTE },
  syncytium_import: { effect: 'write', annotations: write('Import unmanaged rule files', true), maxCalls: 5, windowMs: MINUTE },
  syncytium_list_trash: { effect: 'read', annotations: read('List recoverable deletions'), maxCalls: 60, windowMs: MINUTE },
  syncytium_restore: { effect: 'write', annotations: write('Restore an archived rule or ADR', true), maxCalls: 10, windowMs: MINUTE }
};

export const READ_ONLY_TOOLS = Object.freeze(
  Object.entries(TOOL_SAFETY)
    .filter(([, policy]) => policy.effect === 'read')
    .map(([name]) => name)
);

export const DESTRUCTIVE_TOOLS = Object.freeze(
  Object.entries(TOOL_SAFETY)
    .filter(([, policy]) => policy.effect === 'destructive')
    .map(([name]) => name)
);

export interface LimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Fixed-window-per-tool limiter. It is deliberately small and synchronous:
 * the MCP transport is a single stdio stream, so no cross-process coordination
 * is required to stop a runaway agent loop.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  consume(tool: string): LimitDecision {
    const policy = TOOL_SAFETY[tool];
    if (!policy) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, retryAfterMs: 0 };

    const timestamp = this.now();
    const windowStart = timestamp - policy.windowMs;
    const recent = (this.hits.get(tool) ?? []).filter(at => at > windowStart);

    if (recent.length >= policy.maxCalls) {
      const retryAfterMs = Math.max(1, recent[0] + policy.windowMs - timestamp);
      this.hits.set(tool, recent);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    recent.push(timestamp);
    this.hits.set(tool, recent);
    return {
      allowed: true,
      remaining: policy.maxCalls - recent.length,
      retryAfterMs: 0
    };
  }

  /** Used by tests and by future long-lived server reconfiguration. */
  reset(): void {
    this.hits.clear();
  }
}
