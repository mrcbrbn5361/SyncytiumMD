import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  compileRulesMarkdown,
  compileHandoffSummary,
  compileArchitecture,
  compileDecisions,
  makeFile
} from '../base.js';

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
    content += compileArchitecture(context, 'Architecture');
    content += `${compileRulesMarkdown(context.rules, 'Guidelines & Code Standards')}\n\n`;
    content += compileDecisions(context, 5);

    return [makeFile('.windsurfrules', content, 'Windsurf rules file', this.id)];
  }
}
