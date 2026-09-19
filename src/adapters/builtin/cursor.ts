import matter from 'gray-matter';
import type { AgentAdapter, CanonicalContext, GeneratedFile } from '../../core/types.js';
import { formatBanner, compileRulesMarkdown, compileHandoffSummary } from '../base.js';

export class CursorAdapter implements AgentAdapter {
  readonly id = 'cursor';
  readonly name = 'Cursor IDE';
  readonly category = 'ide' as const;
  readonly description = 'Cursor .cursor/rules/*.mdc modular rules and .cursorrules legacy support';
  readonly defaultTargetFiles = ['.cursor/rules/', '.cursorrules'];

  async generate(context: CanonicalContext): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // 1. Generate individual .cursor/rules/*.mdc files
    for (const rule of context.rules) {
      const frontmatter: Record<string, any> = {
        description: rule.description || rule.title,
        alwaysApply: rule.alwaysApply ?? false
      };
      if (rule.globs && rule.globs.length > 0) {
        frontmatter.globs = rule.globs.join(', ');
      }

      const mdcBody = `${formatBanner()}\n${rule.content}\n`;
      const mdcContent = matter.stringify(mdcBody, frontmatter);

      files.push({
        relativePath: `.cursor/rules/${rule.id}.mdc`,
        content: mdcContent,
        description: `Cursor MDC rule: ${rule.title}`
      });
    }

    // 2. Generate .cursor/rules/syncytium-handoff.mdc so Cursor agents always see active handoff
    const handoffFrontmatter = {
      description: 'Active Syncytium Handoff and agent state',
      alwaysApply: true
    };
    const handoffBody = `${formatBanner()}\n# 🤝 Syncytium Active Handoff\n\n${compileHandoffSummary(context)}\n`;
    files.push({
      relativePath: '.cursor/rules/syncytium-handoff.mdc',
      content: matter.stringify(handoffBody, handoffFrontmatter),
      description: 'Cursor Handoff Rule'
    });

    // 3. Generate legacy .cursorrules
    const legacyContent = `${formatBanner()}\n${compileRulesMarkdown(context.rules, `${context.projectName} - Cursor Rules`)}\n\n${compileHandoffSummary(context)}`;
    files.push({
      relativePath: '.cursorrules',
      content: legacyContent,
      description: 'Cursor legacy rules file'
    });

    return files;
  }
}
