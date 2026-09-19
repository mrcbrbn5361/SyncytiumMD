import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = 'claude';
  readonly name = 'Claude Code CLI';
  readonly category = 'cli' as const;
  readonly description = 'Claude Code CLI project context and instructions (CLAUDE.md)';
  readonly defaultTargetFiles = ['CLAUDE.md'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();

    content += `# CLAUDE.md - ${context.projectName}\n\n`;
    content += `> This project uses **SyncytiumMD** to bridge context between AI tools.\n\n`;

    // Active Handoff
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;

    // Architecture
    if (context.architecture) {
      content += `## 🏗️ Architecture & Stack\n\n${context.architecture.trim()}\n\n---\n\n`;
    }

    // Rules
    content += `${compileRulesMarkdown(context.rules, 'Guidelines & Engineering Rules')}\n\n`;

    // Memory decisions
    if (context.decisions && context.decisions.length > 0) {
      content += `## 🧠 Key Decisions (ADR)\n`;
      for (const d of context.decisions.slice(0, 5)) {
        content += `- **[${d.id}] ${d.title}:** ${d.decision} *(Status: ${d.status})*\n`;
      }
      content += '\n';
    }

    return [
      {
        relativePath: 'CLAUDE.md',
        content,
        description: 'Claude Code CLI instructions file'
      }
    ];
  }
}
