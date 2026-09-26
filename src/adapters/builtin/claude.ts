import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  compileRulesMarkdown,
  compileRuleIndex,
  compileHandoffSummary,
  compileArchitecture,
  compileDecisions,
  makeFile
} from '../base.js';

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = 'claude';
  readonly name = 'Claude Code CLI';
  readonly category = 'cli' as const;
  readonly description = 'Claude Code CLI project context and instructions (CLAUDE.md)';
  readonly defaultTargetFiles = ['CLAUDE.md'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const emitIndex = context.config?.options.emitRuleIndex ?? false;

    let content = formatBanner();
    content += `# CLAUDE.md - ${context.projectName}\n\n`;
    content += `> This project uses **SyncytiumMD** to bridge context between AI tools.\n\n`;
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += `${compileArchitecture(context, '🏗️ Architecture & Stack')}\n`;
    if (emitIndex) content += compileRuleIndex(context.rules);
    content += `${compileRulesMarkdown(context.rules, 'Guidelines & Engineering Rules')}\n\n`;
    content += compileDecisions(context);

    return [
      makeFile('CLAUDE.md', content, 'Claude Code CLI instructions file', this.id)
    ];
  }
}
