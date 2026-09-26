import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  compileRulesMarkdown,
  compileHandoffSummary,
  compileArchitecture,
  compileDecisions,
  makeFile
} from '../base.js';

export class TraeAdapter implements AgentAdapter {
  readonly id = 'trae';
  readonly name = 'Trae IDE';
  readonly category = 'ide' as const;
  readonly description = 'Trae AI IDE instructions (.traerules)';
  readonly defaultTargetFiles = ['.traerules'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();
    content += `# Trae Workspace Guidelines - ${context.projectName}\n\n`;
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += compileArchitecture(context, 'System Architecture');
    content += `${compileRulesMarkdown(context.rules, 'Coding Standards & Rules')}\n\n`;
    content += compileDecisions(context, 5);

    return [makeFile('.traerules', content, 'Trae workspace rules file', this.id)];
  }
}
