import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { SyncytiumEngine } from '../core/engine.js';
import type { MemoryDecision } from '../core/types.js';

export function createSyncytiumMcpServer(rootDir: string = process.cwd()) {
  const engine = new SyncytiumEngine(rootDir);

  const server = new Server(
    {
      name: 'syncytium-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'syncytium_get_context',
          description: 'Get project rules, architecture, architectural decisions (ADR), and active handoff state.',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Optional filter: rules, architecture, decisions, or handoff'
              }
            }
          }
        },
        {
          name: 'syncytium_handoff',
          description: 'Pass task baton to the next AI agent or update current progress in the shared Syncytium blackboard.',
          inputSchema: {
            type: 'object',
            properties: {
              activeAgent: {
                type: 'string',
                description: 'Name of the current finishing agent (e.g. Cursor, Claude Code, Antigravity, Cline)'
              },
              nextAgent: {
                type: 'string',
                description: 'Designated next agent or "Any"'
              },
              status: {
                type: 'string',
                enum: ['in_progress', 'ready_for_review', 'blocked', 'completed'],
                description: 'Current task completion status'
              },
              goal: {
                type: 'string',
                description: 'Primary objective being worked on'
              },
              completedWork: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of completed items in this turn'
              },
              pendingTasks: {
                type: 'array',
                items: { type: 'string' },
                description: 'Remaining tasks for next agent to perform'
              },
              touchedFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of files modified or created during this session'
              },
              notes: {
                type: 'string',
                description: 'Context, warnings, or rationale for the next agent'
              }
            },
            required: ['activeAgent']
          }
        },
        {
          name: 'syncytium_record_decision',
          description: 'Record an Architectural Decision (ADR) that will be shared across all AI agents.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Decision ID (e.g. ADR-002)' },
              title: { type: 'string', description: 'Title of the architectural decision' },
              status: {
                type: 'string',
                enum: ['proposed', 'accepted', 'superseded', 'deprecated'],
                default: 'accepted'
              },
              context: { type: 'string', description: 'Context and background problem' },
              decision: { type: 'string', description: 'The chosen solution/decision' },
              consequences: { type: 'string', description: 'Pros, cons, and implications' }
            },
            required: ['title', 'context', 'decision', 'consequences']
          }
        },
        {
          name: 'syncytium_sync',
          description: 'Re-synchronize all rules and handoff states to all IDE & CLI files (CLAUDE.md, .cursor/rules/, .clinerules, etc.).',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'syncytium_get_history',
          description: 'Get past multi-agent handoff audit trail, past goals, and completed task milestones.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of past handoff events to fetch (default: 5)'
              }
            }
          }
        },
        {
          name: 'syncytium_lint',
          description: 'Validate canonical rules, frontmatter schema, and structure in .syncytium/.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'syncytium_diff',
          description: 'Check context drift between .syncytium/ source of truth and target bridge files.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      if (name === 'syncytium_get_context') {
        const topic = (args.topic as string)?.toLowerCase();
        const context = await engine.storage.loadCanonicalContext();

        if (topic === 'rules') {
          return { content: [{ type: 'text', text: JSON.stringify(context.rules, null, 2) }] };
        }
        if (topic === 'handoff') {
          return { content: [{ type: 'text', text: JSON.stringify(context.handoff, null, 2) }] };
        }
        if (topic === 'decisions') {
          return { content: [{ type: 'text', text: JSON.stringify(context.decisions, null, 2) }] };
        }
        if (topic === 'architecture') {
          return { content: [{ type: 'text', text: context.architecture || 'None recorded' }] };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  projectName: context.projectName,
                  handoff: context.handoff,
                  rulesCount: context.rules.length,
                  decisionsCount: context.decisions.length,
                  rules: context.rules.map(r => ({ id: r.id, title: r.title, description: r.description }))
                },
                null,
                2
              )
            }
          ]
        };
      }

      if (name === 'syncytium_handoff') {
        const result = await engine.handoff({
          activeAgent: args.activeAgent as string,
          nextAgent: args.nextAgent as string | undefined,
          status: args.status as any,
          goal: args.goal as string | undefined,
          completed: args.completedWork as string[] | undefined,
          pending: args.pendingTasks as string[] | undefined,
          touchedFiles: args.touchedFiles as string[] | undefined,
          notes: args.notes as string | undefined,
          autoSync: true
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated Syncytium Handoff and propagated to all IDE bridge files:\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      }

      if (name === 'syncytium_record_decision') {
        const decisions = await engine.storage.loadDecisions();
        const nextId = (args.id as string) || `ADR-${String(decisions.length + 1).padStart(3, '0')}`;
        const newDecision: MemoryDecision = {
          id: nextId,
          title: args.title as string,
          status: (args.status as any) || 'accepted',
          date: new Date().toISOString().split('T')[0],
          context: args.context as string,
          decision: args.decision as string,
          consequences: args.consequences as string
        };

        await engine.addDecision(newDecision);

        return {
          content: [
            {
              type: 'text',
              text: `Recorded architectural decision ${nextId}: "${newDecision.title}" and synchronized context.`
            }
          ]
        };
      }

      if (name === 'syncytium_sync') {
        const result = await engine.sync();
        return {
          content: [
            {
              type: 'text',
              text: `Synchronized ${result.count} bridge files:\n${result.paths.join('\n')}`
            }
          ]
        };
      }

      if (name === 'syncytium_get_history') {
        const limit = typeof args.limit === 'number' ? args.limit : 5;
        const history = await engine.getHandoffHistory(limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(history, null, 2)
            }
          ]
        };
      }

      if (name === 'syncytium_lint') {
        const report = await engine.lint();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }
          ]
        };
      }

      if (name === 'syncytium_diff') {
        const diffReport = await engine.diff();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diffReport, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Syncytium Error: ${err.message}` }]
      };
    }
  });

  return { server, engine };
}

export async function runMcpServer(rootDir: string = process.cwd()) {
  const { server } = createSyncytiumMcpServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
