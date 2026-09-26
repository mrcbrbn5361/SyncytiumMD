import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  compileRulesMarkdown,
  compileHandoffSummary,
  compileArchitecture,
  compileDecisions,
  makeFile
} from '../base.js';

export class GitHubCopilotAdapter implements AgentAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly category = 'extension' as const;
  readonly description =
    'GitHub Copilot repository instructions and path-specific .instructions.md files';
  readonly defaultTargetFiles = [
    '.github/copilot-instructions.md',
    '.github/instructions/'
  ];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    let content = formatBanner();
    content += `# GitHub Copilot Instructions for ${context.projectName}\n\n`;
    content += `${compileHandoffSummary(context)}\n\n---\n\n`;
    content += compileArchitecture(context, 'Architecture Overview');
    content += `${compileRulesMarkdown(context.rules, 'Engineering Guidelines')}\n\n`;
    content += compileDecisions(context);
    files.push(
      makeFile(
        '.github/copilot-instructions.md',
        content,
        'GitHub Copilot repository instructions',
        this.id
      )
    );

    // Path-specific instructions mirror glob-scoped rules so Copilot can
    // attach them automatically to matching files.
    for (const rule of context.rules) {
      if (!rule.globs || rule.globs.length === 0) continue;
      const frontmatter = [
        '---',
        `description: ${(rule.description || rule.title).replace(/"/g, "'")}`,
        `applyTo: ${JSON.stringify(rule.globs.join(','))}`,
        '---',
        ''
      ].join('\n');
      files.push(
        makeFile(
          `.github/instructions/${ruleFileIdSafe(rule.id)}.instructions.md`,
          `${frontmatter}${formatBanner()}\n${rule.content}\n`,
          `Copilot path-specific instruction: ${rule.title}`,
          this.id
        )
      );
    }

    return files;
  }
}

function ruleFileIdSafe(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '') || 'rule';
}
