import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export interface GenericAdapterConfig {
  id: string;
  name: string;
  targetFile: string;
  header?: string;
  includeArchitecture?: boolean;
  includeHandoff?: boolean;
}

export class GenericAdapter implements AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly category = 'generic' as const;
  readonly description: string;
  readonly defaultTargetFiles: string[];

  private config: GenericAdapterConfig;

  constructor(config: GenericAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.description = `Custom user adapter for ${config.name} (${config.targetFile})`;
    this.defaultTargetFiles = [config.targetFile];
  }

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    let content = formatBanner();

    content += `# ${this.config.header || this.config.name} - ${context.projectName}\n\n`;

    if (this.config.includeHandoff !== false) {
      content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    }

    content += `${compileRulesMarkdown(context.rules, 'Project Rules')}\n\n`;

    if (this.config.includeArchitecture && context.architecture) {
      content += `## Architecture\n${context.architecture.trim()}\n\n`;
    }

    return [
      {
        relativePath: this.config.targetFile,
        content,
        description: `Generic target file for ${this.name}`
      }
    ];
  }
}
