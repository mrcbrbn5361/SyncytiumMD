import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class OpenCodeAdapter implements AgentAdapter {
  readonly id = 'opencode';
  readonly name = 'OpenCode & Terminal Agents';
  readonly category = 'agent' as const;
  readonly description = 'Universal AGENT.md and CONVENTIONS.md (Aider, OpenCode, Qoder, Kiro, Zed)';
  readonly defaultTargetFiles = ['AGENT.md', 'CONVENTIONS.md'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const banner = formatBanner();

    // AGENT.md
    let agentMd = banner;
    agentMd += `# AGENT.md - ${context.projectName}\n\n`;
    agentMd += `> Universal agent context powered by SyncytiumMD.\n\n`;
    agentMd += `${compileHandoffSummary(context)}\n\n---\n\n`;
    agentMd += `${compileRulesMarkdown(context.rules, 'Engineering Guidelines')}\n\n`;
    if (context.architecture) {
      agentMd += `## System Architecture\n${context.architecture.trim()}\n\n`;
    }

    // CONVENTIONS.md (Aider & CLI tools)
    let conventionsMd = banner;
    conventionsMd += `# CONVENTIONS.md - ${context.projectName}\n\n`;
    conventionsMd += `${compileRulesMarkdown(context.rules, 'Repository Conventions')}\n\n`;

    return [
      {
        relativePath: 'AGENT.md',
        content: agentMd,
        description: 'Universal agent guidance file (OpenCode, Zed, Kiro, Qoder)'
      },
      {
        relativePath: 'CONVENTIONS.md',
        content: conventionsMd,
        description: 'Conventions file for Aider and CLI tools'
      }
    ];
  }
}
