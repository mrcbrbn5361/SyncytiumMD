import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class AntigravityAdapter implements AgentAdapter {
  readonly id = 'antigravity';
  readonly name = 'Google Antigravity';
  readonly category = 'agent' as const;
  readonly description = 'Google Antigravity agent rules (.gemini/antigravity/rules/*.md)';
  readonly defaultTargetFiles = ['.gemini/antigravity/rules/'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Individual rules in .gemini/antigravity/rules/
    for (const rule of context.rules) {
      const content = `${formatBanner()}\n# ${rule.title}\n\n${rule.content}\n`;
      files.push({
        relativePath: `.gemini/antigravity/rules/${rule.id}.md`,
        content,
        description: `Antigravity rule: ${rule.title}`
      });
    }

    // Antigravity active handoff rule
    const handoffContent = `${formatBanner()}\n# 🤝 Syncytium Active Handoff State\n\n${compileHandoffSummary(context)}\n`;
    files.push({
      relativePath: '.gemini/antigravity/rules/handoff.md',
      content: handoffContent,
      description: 'Antigravity Handoff State Rule'
    });

    return files;
  }
}
