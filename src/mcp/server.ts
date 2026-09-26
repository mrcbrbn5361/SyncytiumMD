import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SyncytiumEngine } from '../core/engine.js';
import { VERSION } from '../version.js';
import {
  DecisionStatusSchema,
  flattenZodError
} from '../core/schemas.js';

/**
 * Every tool input is parsed with zod before it reaches the engine. The CLI and
 * the HTTP API take user input too, so validating only here would leave the
 * other two entry points as the weak link.
 */
const stringArray = z.array(z.string().min(1)).optional();
const handoffStatus = z.enum(['in_progress', 'ready_for_review', 'blocked', 'completed']);
const limitSchema = z.coerce.number().int().min(1).max(200).default(5);

const HandoffInput = z.object({
  activeAgent: z.string().min(1),
  nextAgent: z.string().min(1).nullish(),
  status: handoffStatus.optional(),
  goal: z.string().optional(),
  completedWork: stringArray,
  pendingTasks: stringArray,
  touchedFiles: stringArray,
  notes: z.string().optional(),
  force: z.boolean().default(false)
});

const RecordDecisionInput = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  status: DecisionStatusSchema.default('accepted'),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1)
});

const AddRuleInput = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  body: z.string().min(1),
  globs: stringArray,
  tags: stringArray,
  alwaysApply: z.boolean().optional(),
  sync: z.boolean().default(true)
});

const LockInput = z.object({
  agent: z.string().min(1),
  goal: z.string().optional(),
  leaseMinutes: z.coerce.number().int().min(1).max(24 * 60).default(30),
  force: z.boolean().default(false)
});

const UpdateRuleInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  body: z.string().min(1).optional(),
  globs: stringArray,
  tags: stringArray,
  alwaysApply: z.boolean().optional(),
  sync: z.boolean().default(true)
});

const RemoveRuleInput = z.object({ id: z.string().min(1) });
const RemoveDecisionInput = z.object({ id: z.string().min(1) });
const ReleaseLockInput = z.object({
  agent: z.string().optional(),
  force: z.boolean().default(false)
});

export function createSyncytiumMcpServer(rootDir: string = process.cwd()) {
  const engine = new SyncytiumEngine(rootDir);

  const server = new Server(
    { name: 'syncytium-mcp', version: VERSION },
    { capabilities: { tools: {} } }
  );

  const text = (body: string) => ({ content: [{ type: 'text' as const, text: body }] });
  const json = (value: unknown) => text(JSON.stringify(value, null, 2));
  const failure = (message: string) => ({
    isError: true,
    content: [{ type: 'text' as const, text: `Syncytium Error: ${message}` }]
  });

  /**
   * Parses `raw` with `schema`, returning either the parsed value or a
   * ready-made error result. Typed against `z.output` so schemas that declare
   * defaults report their post-parse (non-optional) shape.
   */
  const parse = <S extends z.ZodTypeAny>(
    raw: unknown,
    schema: S
  ):
    | { ok: true; value: z.output<S> }
    | { ok: false; error: ReturnType<typeof failure> } => {
    const result = schema.safeParse(raw ?? {});
    if (result.success) return { ok: true, value: result.data };
    const details = flattenZodError(result.error)
      .map(i => `${i.path}: ${i.message}`)
      .join('; ');
    return { ok: false, error: failure(`invalid input - ${details}`) };
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'syncytium_get_context',
        description:
          'Get project rules, architecture, architectural decisions (ADR), and the active handoff state. Use this first in any session.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              enum: ['rules', 'architecture', 'decisions', 'handoff', 'all'],
              description: 'Optional filter; defaults to a compact overview'
            },
            includeContent: {
              type: 'boolean',
              default: false,
              description: 'Include full rule bodies instead of just id/title/description'
            }
          }
        }
      },
      {
        name: 'syncytium_handoff',
        description:
          'Pass the baton to the next AI agent or record progress on the shared blackboard. Run this before you finish your turn.',
        inputSchema: {
          type: 'object',
          properties: {
            activeAgent: { type: 'string', description: 'Your name (e.g. Cursor, Claude Code, Antigravity)' },
            nextAgent: { type: 'string', description: 'Designated next agent, or omit' },
            status: { type: 'string', enum: ['in_progress', 'ready_for_review', 'blocked', 'completed'] },
            goal: { type: 'string', description: 'Primary objective' },
            completedWork: { type: 'array', items: { type: 'string' } },
            pendingTasks: { type: 'array', items: { type: 'string' } },
            touchedFiles: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string', description: 'Context, warnings or rationale for the next agent' },
            force: { type: 'boolean', default: false, description: 'Ignore an active lease' }
          },
          required: ['activeAgent']
        }
      },
      {
        name: 'syncytium_record_decision',
        description: 'Record an Architectural Decision (ADR) shared across all AI agents.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ADR id; auto-allocated when omitted (ADR-002, ADR-003, …)' },
            title: { type: 'string' },
            status: { type: 'string', enum: ['proposed', 'accepted', 'superseded', 'deprecated'], default: 'accepted' },
            context: { type: 'string', description: 'Background problem' },
            decision: { type: 'string', description: 'The chosen solution' },
            consequences: { type: 'string', description: 'Pros, cons and implications' }
          },
          required: ['title', 'context', 'decision', 'consequences']
        }
      },
      {
        name: 'syncytium_remove_decision',
        description: 'Delete an Architectural Decision Record by id.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      },
      {
        name: 'syncytium_list_decisions',
        description: 'List recorded ADRs (optionally filtered by status or free-text query).',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['proposed', 'accepted', 'superseded', 'deprecated', 'all'] },
            query: { type: 'string' },
            limit: { type: 'number', default: 20 }
          }
        }
      },
      {
        name: 'syncytium_create_rule',
        description: 'Add a new canonical rule to .syncytium/rules/ and regenerate every bridge file.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'kebab-case id; derived from the title when omitted' },
            title: { type: 'string' },
            description: { type: 'string' },
            body: { type: 'string', description: 'Markdown body of the rule' },
            globs: { type: 'array', items: { type: 'string' }, description: 'Makes the rule glob-scoped' },
            tags: { type: 'array', items: { type: 'string' } },
            alwaysApply: { type: 'boolean' },
            sync: { type: 'boolean', default: true, description: 'Regenerate bridge files afterwards' }
          },
          required: ['title', 'body']
        }
      },
      {
        name: 'syncytium_list_rules',
        description: 'Search the canonical rule catalog by id, title, tag or body text.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text search; omit to list all rules' }
          }
        }
      },
      {
        name: 'syncytium_update_rule',
        description: 'Edit an existing canonical rule in place (title, description, body, globs, tags).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            body: { type: 'string' },
            globs: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            alwaysApply: { type: 'boolean' },
            sync: { type: 'boolean', default: true }
          },
          required: ['id']
        }
      },
      {
        name: 'syncytium_remove_rule',
        description: 'Delete a canonical rule and prune its generated bridge files.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      },
      {
        name: 'syncytium_sync',
        description: 'Regenerate all AI tool bridge files (CLAUDE.md, .cursor/rules/, AGENTS.md, GEMINI.md, …).',
        inputSchema: {
          type: 'object',
          properties: {
            targets: { type: 'array', items: { type: 'string' }, description: 'Restrict to specific adapter ids' },
            force: { type: 'boolean', default: false }
          }
        }
      },
      {
        name: 'syncytium_get_history',
        description: 'Get the multi-agent handoff audit trail: past goals, completed tasks and baton passes.',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', default: 5 } }
        }
      },
      {
        name: 'syncytium_lint',
        description: 'Validate canonical rules, frontmatter and ADR schema. Returns a compact summary, not the full report.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'syncytium_validate',
        description: 'Validate syncytium.config.json and every rule frontmatter against the zod schema.',
        inputSchema: {
          type: 'object',
          properties: { fix: { type: 'boolean', default: false } }
        }
      },
      {
        name: 'syncytium_diff',
        description: 'Check context drift between .syncytium/ and the generated bridge files. Returns a summary plus the drifted paths.',
        inputSchema: {
          type: 'object',
          properties: { targets: { type: 'array', items: { type: 'string' } } }
        }
      },
      {
        name: 'syncytium_doctor',
        description: 'Run the full workspace health check: config, adapters, rules, drift, lock, git hook and CI gate.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'syncytium_lock_acquire',
        description: 'Take the exclusive workspace lease so other agents do not edit the same files concurrently.',
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string' },
            goal: { type: 'string' },
            leaseMinutes: { type: 'number', default: 30 },
            force: { type: 'boolean', default: false }
          },
          required: ['agent']
        }
      },
      {
        name: 'syncytium_lock_release',
        description: 'Release the workspace lease held by this agent.',
        inputSchema: {
          type: 'object',
          properties: { agent: { type: 'string' }, force: { type: 'boolean', default: false } }
        }
      },
      {
        name: 'syncytium_lock_status',
        description: 'Report who currently holds the workspace lease and when it expires.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'syncytium_get_graph',
        description: 'Get the project knowledge graph (rules, tags, ADRs, agents, adapters, bridge files) for visualisation.',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['all', 'ide', 'cli', 'extension', 'agent', 'brain'], default: 'all' },
            compact: { type: 'boolean', default: false }
          }
        }
      },
      {
        name: 'syncytium_import',
        description: 'Reverse-migrate existing unmanaged AI rule files (CLAUDE.md, .cursorrules, …) into .syncytium/.',
        inputSchema: {
          type: 'object',
          properties: { dryRun: { type: 'boolean', default: true } }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        // ------------------------------------------------------- context ---
        case 'syncytium_get_context': {
          const topic = typeof args.topic === 'string' ? args.topic.toLowerCase() : 'all';
          const includeContent = args.includeContent === true;
          const context = await engine.storage.loadCanonicalContext();

          if (topic === 'rules') return json(context.rules);
          if (topic === 'handoff') return json(context.handoff);
          if (topic === 'decisions') return json(context.decisions);
          if (topic === 'architecture') return text(context.architecture || 'None recorded');

          return json({
            projectName: context.projectName,
            handoff: context.handoff,
            rulesCount: context.rules.length,
            decisionsCount: context.decisions.length,
            rules: context.rules.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description,
              alwaysApply: r.alwaysApply,
              globs: r.globs,
              tags: r.tags,
              ...(includeContent ? { content: r.content } : {})
            }))
          });
        }

        // ------------------------------------------------------ handoff ---
        case 'syncytium_handoff': {
          const parsed = parse(args, HandoffInput);
          if (!parsed.ok) return parsed.error;
          const i = parsed.value;
          const result = await engine.handoff({
            activeAgent: i.activeAgent,
            nextAgent: i.nextAgent ?? undefined,
            status: i.status,
            goal: i.goal,
            completed: i.completedWork,
            pending: i.pendingTasks,
            touchedFiles: i.touchedFiles,
            notes: i.notes,
            force: i.force,
            autoSync: true
          });
          return text(
            `Handoff updated and propagated to all bridge files.\n${JSON.stringify(result, null, 2)}`
          );
        }

        // ---------------------------------------------------- decisions ---
        case 'syncytium_record_decision': {
          const parsed = parse(args, RecordDecisionInput);
          if (!parsed.ok) return parsed.error;
          const i = parsed.value;
          // nextDecisionId fills gaps instead of doing ADR-${length+1}, which
          // used to collide whenever ids were not a contiguous 1..n run.
          const nextId = i.id ?? (await engine.storage.nextDecisionId());
          const decision = await engine.addDecision({
            id: nextId,
            title: i.title,
            status: i.status,
            date: new Date().toISOString().split('T')[0],
            context: i.context,
            decision: i.decision,
            consequences: i.consequences
          });
          return text(`Recorded ${decision.id}: "${decision.title}". Bridge files synchronized.`);
        }

        case 'syncytium_list_decisions': {
          const limitResult = limitSchema.safeParse(args.limit ?? 20);
          const decisions = await engine.listDecisions({
            status: typeof args.status === 'string' ? args.status : undefined,
            query: typeof args.query === 'string' ? args.query : undefined
          });
          return json(decisions.slice(0, limitResult.success ? limitResult.data : 20));
        }

        case 'syncytium_remove_decision': {
          const parsed = parse(args, RemoveDecisionInput);
          if (!parsed.ok) return parsed.error;
          const removed = await engine.removeDecision(parsed.value.id);
          return removed
            ? text(`Removed ${parsed.value.id}.`)
            : failure(`no ADR with id "${parsed.value.id}"`);
        }

        // -------------------------------------------------------- rules ---
        case 'syncytium_create_rule': {
          const parsed = parse(args, AddRuleInput);
          if (!parsed.ok) return parsed.error;
          const i = parsed.value;
          const { rule } = await engine.addRule({
            id: i.id,
            title: i.title,
            description: i.description,
            body: i.body,
            globs: i.globs,
            tags: i.tags,
            alwaysApply: i.alwaysApply,
            sync: i.sync
          });
          return text(`Created rule "${rule.id}": ${rule.title}.`);
        }

        case 'syncytium_list_rules': {
          const rules = await engine.listRules(
            typeof args.query === 'string' && args.query.trim() ? args.query : undefined
          );
          return json(
            rules.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description,
              alwaysApply: r.alwaysApply,
              globs: r.globs,
              tags: r.tags,
              sourceFile: r.sourceFile
            }))
          );
        }

        case 'syncytium_update_rule': {
          const parsed = parse(args, UpdateRuleInput);
          if (!parsed.ok) return parsed.error;
          const i = parsed.value;
          const { rule } = await engine.updateRule(i.id, {
            title: i.title,
            description: i.description,
            body: i.body,
            globs: i.globs,
            tags: i.tags,
            alwaysApply: i.alwaysApply,
            sync: i.sync
          });
          return text(`Updated rule "${rule.id}".`);
        }

        case 'syncytium_remove_rule': {
          const parsed = parse(args, RemoveRuleInput);
          if (!parsed.ok) return parsed.error;
          const removed = await engine.removeRule(parsed.value.id);
          return removed
            ? text(`Removed rule "${parsed.value.id}" and pruned its generated files.`)
            : failure(`no rule with id "${parsed.value.id}"`);
        }

        // --------------------------------------------------------- sync ---
        case 'syncytium_sync': {
          const result = await engine.sync(
            Array.isArray(args.targets) ? (args.targets as string[]) : undefined,
            { force: args.force === true }
          );
          return text(
            `Synchronized ${result.count} bridge files in ${result.elapsedMs}ms` +
              (result.pruned.length > 0 ? `, pruned ${result.pruned.length} orphan(s)` : '') +
              `:\n${result.paths.join('\n')}`
          );
        }

        case 'syncytium_get_history': {
          const parsed = limitSchema.safeParse(args.limit ?? 5);
          const history = await engine.getHandoffHistory(parsed.success ? parsed.data : 5);
          return json(history);
        }

        // ------------------------------------------------- diagnostics ---
        case 'syncytium_lint': {
          const report = await engine.lint();
          const errors = report.issues.filter(i => i.type === 'error');
          const warnings = report.issues.filter(i => i.type === 'warning');
          // Summarised on purpose: dumping every issue would burn the context
          // window the caller is trying to protect.
          return json({
            valid: report.valid,
            totalChecked: report.totalChecked,
            errorCount: errors.length,
            warningCount: warnings.length,
            errors: errors.slice(0, 20).map(i => ({ file: i.file, code: i.code, message: i.message })),
            warnings: warnings.slice(0, 20).map(i => ({ file: i.file, code: i.code, message: i.message }))
          });
        }

        case 'syncytium_validate': {
          const result = await engine.validate({ fix: args.fix === true });
          return json(result);
        }

        case 'syncytium_diff': {
          const report = await engine.diff(
            Array.isArray(args.targets) ? (args.targets as string[]) : undefined
          );
          return json({
            hasDrift: report.hasDrift,
            summary: report.summary,
            // Patches are omitted here; run `syncytium diff` in the shell for them.
            drifted: report.items
              .filter(i => i.status !== 'identical')
              .map(i => ({ path: i.relativePath, status: i.status, changedLines: i.changedLines }))
          });
        }

        case 'syncytium_doctor': {
          const report = await engine.doctor();
          return json({
            overallStatus: report.overallStatus,
            stats: report.stats,
            checks: report.checks.map(c => ({
              id: c.id,
              name: c.name,
              status: c.status,
              message: c.message,
              fix: c.fix
            }))
          });
        }

        // --------------------------------------------------------- lock ---
        case 'syncytium_lock_acquire': {
          const parsed = parse(args, LockInput);
          if (!parsed.ok) return parsed.error;
          const i = parsed.value;
          const res = await engine.acquireLock(i.agent, i.goal, i.leaseMinutes, i.force);
          return res.acquired ? text(res.message) : failure(res.message);
        }

        case 'syncytium_lock_release': {
          const parsed = parse(args, ReleaseLockInput);
          if (!parsed.ok) return parsed.error;
          const res = await engine.releaseLock(parsed.value.agent, parsed.value.force);
          return res.released ? text(res.message) : failure(res.message);
        }

        case 'syncytium_lock_status': {
          return json(await engine.getLockStatus());
        }

        // -------------------------------------------------------- graph ---
        case 'syncytium_get_graph': {
          const graph = await engine.getKnowledgeGraph({
            category: typeof args.category === 'string' ? args.category : 'all',
            compact: args.compact === true
          });
          return json(graph);
        }

        case 'syncytium_import': {
          const report = await engine.importExisting({ dryRun: args.dryRun !== false });
          return json(report);
        }

        default:
          return failure(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return failure((err as Error).message);
    }
  });

  return { server, engine };
}

export async function runMcpServer(rootDir: string = process.cwd()): Promise<void> {
  const { server } = createSyncytiumMcpServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
