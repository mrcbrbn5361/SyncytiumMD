import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class GitHubCopilotAdapter implements AgentAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly category = 'extension' as const;
  readonly description = 'GitHub Copilot instructions (.github/copilot-instructions.md)';
  readonly defaultTargetFiles = ['.github/copilot-instructions.md'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();

    content += `# GitHub Copilot Instructions for ${context.projectName}\n\n`;
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += `${compileRulesMarkdown(context.rules, 'Engineering Guidelines')}\n\n`;

    if (context.architecture) {
      content += `## Architecture Overview\n${context.architecture.trim()}\n\n`;
    }

    return [
      {
        relativePath: '.github/copilot-instructions.md',
        content,
        description: 'GitHub Copilot repository instructions'
      }
    ];
  }
}
