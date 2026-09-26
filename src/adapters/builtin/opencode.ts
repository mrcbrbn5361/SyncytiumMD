import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  compileRulesMarkdown,
  compileHandoffSummary,
  compileArchitecture,
  compileDecisions,
  makeFile
} from '../base.js';

export class OpenCodeAdapter implements AgentAdapter {
  readonly id = 'opencode';
  readonly name = 'OpenCode & Terminal Agents';
  readonly category = 'agent' as const;
  readonly description = 'AGENT.md and CONVENTIONS.md for OpenCode, Zed, Kiro, Qoder and Aider';
  readonly defaultTargetFiles = ['AGENT.md', 'CONVENTIONS.md'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let agentMd = formatBanner();
    agentMd += `# AGENT.md - ${context.projectName}\n\n`;
    agentMd += `> Universal agent context powered by SyncytiumMD.\n\n`;
    agentMd += `${compileHandoffSummary(context)}\n\n---\n\n`;
    agentMd += compileArchitecture(context, 'System Architecture');
    agentMd += `${compileRulesMarkdown(context.rules, 'Engineering Guidelines')}\n\n`;
    agentMd += compileDecisions(context, 5);

    let conventionsMd = formatBanner();
    conventionsMd += `# CONVENTIONS.md - ${context.projectName}\n\n`;
    conventionsMd += `${compileRulesMarkdown(context.rules, 'Repository Conventions')}\n\n`;

    return [
      makeFile('AGENT.md', agentMd, 'Universal agent guidance file (OpenCode, Zed, Kiro, Qoder)', this.id),
      makeFile('CONVENTIONS.md', conventionsMd, 'Conventions file for Aider and CLI tools', this.id)
    ];
  }
}
