import matter from 'gray-matter';
import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import {
  formatBanner,
  ruleFileId,
  compileHandoffSummary,
  compileRulesMarkdown,
  makeFile
} from '../base.js';

export class CursorAdapter implements AgentAdapter {
  readonly id = 'cursor';
  readonly name = 'Cursor IDE';
  readonly category = 'ide' as const;
  readonly description = 'Cursor .cursor/rules/*.mdc modular rules and .cursorrules legacy support';
  readonly defaultTargetFiles = ['.cursor/rules/', '.cursorrules'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const rule of context.rules) {
      const frontmatter: Record<string, unknown> = {
        description: rule.description || rule.title,
        alwaysApply: rule.alwaysApply ?? false
      };
      if (rule.globs && rule.globs.length > 0) {
        // Cursor expects a comma-separated string for `globs` in .mdc files.
        frontmatter.globs = rule.globs.join(', ');
      }

      files.push(
        makeFile(
          `.cursor/rules/${ruleFileId(rule)}.mdc`,
          matter.stringify(`${formatBanner()}\n${rule.content}\n`, frontmatter),
          `Cursor MDC rule: ${rule.title}`,
          this.id
        )
      );
    }

    files.push(
      makeFile(
        '.cursor/rules/syncytium-handoff.mdc',
        matter.stringify(
          `${formatBanner()}\n# 🤝 Syncytium Active Handoff\n\n${compileHandoffSummary(context)}\n`,
          { description: 'Active Syncytium handoff and agent state', alwaysApply: true }
        ),
        'Cursor handoff rule (always applied)',
        this.id
      )
    );

    if (context.architecture?.trim()) {
      files.push(
        makeFile(
          '.cursor/rules/syncytium-architecture.mdc',
          matter.stringify(
            `${formatBanner()}\n# 🏗️ Syncytium Architecture Blueprint\n\n${context.architecture.trim()}\n`,
            { description: 'Project architecture blueprint from .syncytium/architecture.md', alwaysApply: true }
          ),
          'Cursor architecture rule (always applied)',
          this.id
        )
      );
    }

    files.push(
      makeFile(
        '.cursorrules',
        `${formatBanner()}\n${compileRulesMarkdown(context.rules, `${context.projectName} - Cursor Rules`)}\n\n${compileHandoffSummary(context)}`,
        'Cursor legacy rules file',
        this.id
      )
    );

    return files;
  }
}
