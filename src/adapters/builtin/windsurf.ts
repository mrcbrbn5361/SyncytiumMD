import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class WindsurfAdapter implements AgentAdapter {
  readonly id = 'windsurf';
  readonly name = 'Windsurf IDE';
  readonly category = 'ide' as const;
  readonly description = 'Windsurf / Codeium rules (.windsurfrules)';
  readonly defaultTargetFiles = ['.windsurfrules'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();

    content += `# Windsurf Rules - ${context.projectName}\n\n`;
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += `${compileRulesMarkdown(context.rules, 'Guidelines & Code Standards')}\n\n`;

    if (context.architecture) {
      content += `## Architecture\n${context.architecture.trim()}\n\n`;
    }

    return [
      {
        relativePath: '.windsurfrules',
        content,
        description: 'Windsurf rules file'
      }
    ];
  }
}
