import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary, compileArchitecture, makeFile } from '../base.js';

/**
 * Shape accepted by `GenericAdapter`. Everything except the id/name/target is
 * optional so a config entry can be as small as three fields.
 */
export interface GenericAdapterConfig {
  id: string;
  name: string;
  targetFile: string;
  category?: 'ide' | 'extension' | 'cli' | 'agent' | 'generic';
  header?: string;
  includeArchitecture?: boolean;
  includeHandoff?: boolean;
}

export class GenericAdapter implements AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly category: 'ide' | 'extension' | 'cli' | 'agent' | 'generic';
  readonly description: string;
  readonly defaultTargetFiles: string[];

  private config: GenericAdapterConfig;

  constructor(config: GenericAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.category = config.category ?? 'generic';
    this.description = `Custom user adapter for ${config.name} (${config.targetFile})`;
    this.defaultTargetFiles = [config.targetFile];
    this.config = config;
  }

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();
    content += `# ${this.config.header || this.config.name} - ${context.projectName}\n\n`;

    if (this.config.includeHandoff !== false) {
      content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    }
    if (this.config.includeArchitecture) {
      content += compileArchitecture(context, 'Architecture');
    }
    content += `${compileRulesMarkdown(context.rules, 'Project Rules')}\n\n`;

    return [
      makeFile(this.config.targetFile, content, `Generic target file for ${this.name}`, this.id)
    ];
  }
}
