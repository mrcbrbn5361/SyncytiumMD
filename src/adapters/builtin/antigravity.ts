import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  ruleFileId,
  compileHandoffSummary,
  makeFile
} from '../base.js';

export class AntigravityAdapter implements AgentAdapter {
  readonly id = 'antigravity';
  readonly name = 'Google Antigravity';
  readonly category = 'agent' as const;
  readonly description = 'Google Antigravity agent rules (.gemini/antigravity/rules/*.md)';
  readonly defaultTargetFiles = ['.gemini/antigravity/rules/'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const rule of context.rules) {
      files.push(
        makeFile(
          `.gemini/antigravity/rules/${ruleFileId(rule)}.md`,
          `${formatBanner()}\n# ${rule.title}\n\n${rule.content}\n`,
          `Antigravity rule: ${rule.title}`,
          this.id
        )
      );
    }

    files.push(
      makeFile(
        '.gemini/antigravity/rules/handoff.md',
        `${formatBanner()}\n# 🤝 Syncytium Active Handoff State\n\n${compileHandoffSummary(context)}\n`,
        'Antigravity handoff state rule',
        this.id
      )
    );

    if (context.architecture?.trim()) {
      files.push(
        makeFile(
          '.gemini/antigravity/rules/architecture.md',
          `${formatBanner()}\n# 🏗️ Syncytium Architecture Blueprint\n\n${context.architecture.trim()}\n`,
          'Antigravity architecture rule',
          this.id
        )
      );
    }

    return files;
  }
}
