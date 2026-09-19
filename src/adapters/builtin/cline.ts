import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class ClineAdapter implements AgentAdapter {
  readonly id = 'cline';
  readonly name = 'Cline / Roo Code';
  readonly category = 'extension' as const;
  readonly description = 'Autonomous agent instructions (.clinerules)';
  readonly defaultTargetFiles = ['.clinerules'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();

    content += `# Cline & Roo Code System Instructions - ${context.projectName}\n\n`;
    content += `> You are acting as an autonomous software engineer connected to SyncytiumMD.\n\n`;

    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += `${compileRulesMarkdown(context.rules, 'Project Execution Rules')}\n\n`;

    content += `## Syncytium Handoff Protocol
- Before completing your task, update \`.syncytium/HANDOFF.md\` or run \`syncytium handoff\` with your progress, touched files, and next tasks.
- If you made architectural changes, note them in \`.syncytium/memory/decisions.md\`.
`;

    return [
      {
        relativePath: '.clinerules',
        content,
        description: 'Cline / Roo Code rules file'
      }
    ];
  }
}
