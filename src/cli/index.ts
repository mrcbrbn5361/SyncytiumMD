#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { SyncytiumEngine } from '../core/engine.js';

const program = new Command();
const engine = new SyncytiumEngine();

program
  .name('syncytium')
  .description('Universal Context & Handoff Bridge for AI Coding Tools (IDEs, VSCode extensions, CLIs)')
  .version('0.1.3');

// INIT
program
  .command('init [projectName]')
  .description('Initialize .syncytium/ single source of truth in the current directory')
  .action(async (projectName) => {
    try {
      console.log(pc.cyan('🧬 Initializing SyncytiumMD workspace...'));
      await engine.init(projectName);
      console.log(pc.green('✨ Successfully initialized .syncytium/'));
      console.log(pc.dim('Generated rules, architecture, decisions and HANDOFF.md'));
      console.log(pc.yellow('\nNext step: Run `syncytium sync` to generate bridge files for all AI tools.'));
    } catch (err: any) {
      console.error(pc.red(`❌ Initialization failed: ${err.message}`));
      process.exit(1);
    }
  });

// SYNC
program
  .command('sync')
  .description('Synchronize and compile rules to all configured AI tool files')
  .option('-t, --target <adapters...>', 'Specific adapter targets (e.g. cursor claude copilot cline)')
  .action(async (options) => {
    try {
      console.log(pc.cyan('🔄 Synchronizing context across AI targets...'));
      const result = await engine.sync(options.target);
      console.log(pc.green(`⚡ Generated ${result.count} bridge files in ${result.elapsedMs}ms (${result.rulesCount} rules, ${result.decisionsCount} ADR):`));
      for (const p of result.paths) {
        console.log(`  ${pc.dim('•')} ${pc.white(p)}`);
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Sync failed: ${err.message}`));
      process.exit(1);
    }
  });

// DOCTOR
program
  .command('doctor')
  .description('Run comprehensive health check on Syncytium workspace and bridge files')
  .action(async () => {
    try {
      console.log(pc.bold(pc.cyan('\n🩺 Syncytium Doctor - Health & Diagnostics:')));
      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));

      const report = await engine.doctor();

      for (const check of report.checks) {
        let icon = pc.green('✅');
        if (check.status === 'warn') icon = pc.yellow('⚠️');
        if (check.status === 'error') icon = pc.red('❌');

        console.log(`${icon} ${pc.bold(check.name)}: ${check.message}`);
        if (check.detail) {
          console.log(`   ${pc.dim('↳ ' + check.detail)}`);
        }
      }

      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));

      if (report.overallStatus === 'healthy') {
        console.log(pc.bold(pc.green('🎉 All checks passed! Your Syncytium bridge is fully operational.')));
      } else if (report.overallStatus === 'warning') {
        console.log(pc.bold(pc.yellow('⚠️ Workspace has warnings. Run `syncytium sync` to resolve discrepancies.')));
      } else {
        console.log(pc.bold(pc.red('❌ Workspace requires initialization or fix. Run `syncytium init`.')));
      }
      console.log('');
    } catch (err: any) {
      console.error(pc.red(`❌ Doctor check failed: ${err.message}`));
      process.exit(1);
    }
  });

// DIFF
program
  .command('diff')
  .description('Inspect differences (context drift) between .syncytium/ and generated tool files')
  .option('-t, --target <adapters...>', 'Specific adapter targets to inspect')
  .action(async (options) => {
    try {
      console.log(pc.cyan('🔍 Inspecting context drift between .syncytium/ and bridge files...'));
      const diffResult = await engine.diff(options.target);

      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));
      for (const item of diffResult.items) {
        if (item.status === 'identical') {
          console.log(`  ${pc.green('✓ In Sync:    ')} ${item.relativePath}`);
        } else if (item.status === 'modified') {
          console.log(`  ${pc.yellow('⚠ Modified:   ')} ${item.relativePath} ${pc.dim('(' + (item.driftSummary || '') + ')')}`);
        } else {
          console.log(`  ${pc.red('✗ Missing:    ')} ${item.relativePath}`);
        }
      }
      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));

      const s = diffResult.summary;
      console.log(`Summary: ${pc.green(s.identical + ' in sync')}, ${pc.yellow(s.modified + ' modified')}, ${pc.red(s.missingOnDisk + ' missing')}`);

      if (diffResult.hasDrift) {
        console.log(pc.yellow('Tip: Run `syncytium sync` to synchronize all modified or missing files.'));
      }
      console.log('');
    } catch (err: any) {
      console.error(pc.red(`❌ Diff inspection failed: ${err.message}`));
      process.exit(1);
    }
  });

// WATCH
program
  .command('watch')
  .description('Watch .syncytium/ and continuously auto-sync changes to all AI tools')
  .action(async () => {
    try {
      console.log(pc.cyan('👁️  Syncytium Daemon watching .syncytium/ for changes...'));
      console.log(pc.dim('Press Ctrl+C to stop.\n'));

      // Perform initial sync
      const initResult = await engine.sync();
      console.log(pc.green(`Initial sync complete (${initResult.count} files in ${initResult.elapsedMs}ms). Watching...`));

      engine.watch((paths) => {
        const time = new Date().toLocaleTimeString();
        console.log(`${pc.dim(`[${time}]`)} ${pc.green('⚡ Auto-synchronized:')} ${paths.length} files updated.`);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (err: any) {
      console.error(pc.red(`❌ Watcher failed: ${err.message}`));
      process.exit(1);
    }
  });

// HANDOFF
program
  .command('handoff')
  .description('Pass the baton to the next AI agent or update active task state')
  .option('--from <agent>', 'Name of currently finishing agent (e.g. Antigravity, Cursor, Human)')
  .option('--to <agent>', 'Name of next designated agent (e.g. Claude Code, Cline, Cursor)')
  .option('-g, --goal <goal>', 'Primary objective / goal')
  .option('-s, --status <status>', 'Status (in_progress, ready_for_review, blocked, completed)')
  .option('-t, --task <tasks...>', 'Pending tasks for next agent')
  .option('-d, --done <completed...>', 'Completed work items')
  .option('-f, --file <files...>', 'Recently touched / modified files')
  .option('-n, --notes <notes>', 'Contextual guidance or warnings for next agent')
  .action(async (options) => {
    try {
      console.log(pc.cyan('🤝 Updating Syncytium Handoff...'));
      const handoff = await engine.handoff({
        activeAgent: options.from,
        nextAgent: options.to,
        status: options.status,
        goal: options.goal,
        completed: options.done,
        pending: options.task,
        touchedFiles: options.file,
        notes: options.notes,
        autoSync: true
      });

      console.log(pc.green('✅ Handoff updated and propagated to all AI tools:'));
      console.log(`  ${pc.bold('Active Agent:')} ${pc.yellow(handoff.activeAgent)}`);
      console.log(`  ${pc.bold('Next Agent:')}   ${pc.magenta(handoff.nextAgent || 'Any')}`);
      console.log(`  ${pc.bold('Status:')}       ${pc.blue(handoff.status.toUpperCase())}`);
      console.log(`  ${pc.bold('Goal:')}         ${handoff.goal}`);
      if (handoff.pendingTasks.length > 0) {
        console.log(`  ${pc.bold('Pending:')}      ${handoff.pendingTasks.join(', ')}`);
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Handoff failed: ${err.message}`));
      process.exit(1);
    }
  });

// STATUS
program
  .command('status')
  .description('Display SyncytiumMD status and active agent handoff')
  .action(async () => {
    try {
      const status = await engine.getStatus();
      if (!status.initialized) {
        console.log(pc.yellow('Syncytium is not initialized in this directory. Run `syncytium init`.'));
        return;
      }

      console.log(pc.bold(pc.cyan(`\n🧬 SyncytiumMD: ${status.projectName}`)));
      console.log(pc.dim('─────────────────────────────────────────'));
      console.log(`${pc.bold('Rules:')}            ${status.rulesCount} canonical rules`);
      console.log(`${pc.bold('ADR Decisions:')}    ${status.decisionsCount} recorded decisions`);
      console.log(`${pc.bold('Active Adapters:')}  ${status.activeAdapters.join(', ')}`);
      console.log(pc.dim('─────────────────────────────────────────'));
      console.log(pc.bold('🤝 Live Handoff State:'));
      console.log(`  Current Agent:   ${pc.yellow(status.handoff.activeAgent)}`);
      console.log(`  Next Agent:      ${pc.magenta(status.handoff.nextAgent || 'Any')}`);
      console.log(`  Status:          ${pc.blue(status.handoff.status.toUpperCase())}`);
      console.log(`  Goal:            ${status.handoff.goal}`);
      console.log(`  Last Updated:    ${pc.dim(status.handoff.lastUpdated)}`);
      console.log(pc.dim('─────────────────────────────────────────\n'));
    } catch (err: any) {
      console.error(pc.red(`❌ Status check failed: ${err.message}`));
      process.exit(1);
    }
  });

// ADAPTERS
program
  .command('adapters')
  .description('List all registered AI tool adapters')
  .action(() => {
    const list = engine.registry.list();
    console.log(pc.bold(pc.cyan('\n🔌 Supported AI Tool Adapters:')));
    console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));
    for (const a of list) {
      console.log(`${pc.green(a.id.padEnd(14))} [${pc.blue(a.category.toUpperCase().padEnd(9))}] ${pc.bold(a.name)} - ${pc.dim(a.description)}`);
      console.log(`   ${pc.dim('Targets:')} ${a.defaultTargetFiles.join(', ')}`);
    }
    console.log(pc.dim('──────────────────────────────────────────────────────────────────────────\n'));
  });

// CLEAN
program
  .command('clean')
  .description('Safely remove generated bridge files to keep the git repository clean')
  .option('-t, --target <adapters...>', 'Specific adapter targets to clean')
  .action(async (options) => {
    try {
      console.log(pc.yellow('🧹 Cleaning generated Syncytium bridge files...'));
      const cleaned = await engine.clean(options.target);
      if (cleaned.length === 0) {
        console.log(pc.dim('No generated files found to clean.'));
      } else {
        console.log(pc.green(`Removed ${cleaned.length} files:`));
        for (const f of cleaned) {
          console.log(`  ${pc.dim('•')} ${f}`);
        }
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Clean failed: ${err.message}`));
      process.exit(1);
    }
  });

// IMPORT
program
  .command('import')
  .description('Reverse migrate existing AI rule files (CLAUDE.md, .cursorrules, .clinerules, etc.) into .syncytium/')
  .option('--dry-run', 'Preview imported files without writing to disk')
  .action(async (options) => {
    try {
      console.log(pc.cyan('📥 Scanning workspace for existing AI rule files...'));
      const report = await engine.importExisting({ dryRun: options.dryRun });
      if (report.importedCount === 0) {
        console.log(pc.yellow('ℹ️ No unmanaged AI rule files found to import.'));
        return;
      }
      console.log(pc.green(`✨ Successfully discovered ${report.importedCount} AI instruction sources:`));
      for (const item of report.items) {
        console.log(`  ${pc.bold(pc.white(item.sourceFile))} (${pc.blue(item.adapterName)}) ➔ ${pc.cyan(`.syncytium/rules/${item.targetRuleFile}`)}`);
      }
      if (options.dryRun) {
        console.log(pc.yellow('\n[Dry Run] No files were modified. Run `syncytium import` without --dry-run to apply.'));
      } else {
        console.log(pc.green('\n🎉 Imported rules saved and synchronized across all adapters!'));
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Import failed: ${err.message}`));
      process.exit(1);
    }
  });

// LOG
program
  .command('log')
  .description('Display multi-agent handoff audit history and timeline')
  .option('-n, --limit <number>', 'Number of past handoff entries to show', '5')
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10) || 5;
      const history = await engine.getHandoffHistory(limit);
      console.log(pc.bold(pc.cyan('\n📜 Syncytium Multi-Agent Handoff History:')));
      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));

      if (history.length === 0) {
        console.log(pc.dim('No handoff history recorded yet. Use `syncytium handoff` to pass the baton.'));
        console.log(pc.dim('──────────────────────────────────────────────────────────────────────────\n'));
        return;
      }

      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const dateStr = new Date(item.timestamp).toLocaleString();
        const statusColor = item.status === 'completed' ? pc.green : item.status === 'in_progress' ? pc.yellow : item.status === 'blocked' ? pc.red : pc.blue;

        console.log(`${pc.bold(pc.magenta(`[${item.id}]`))} ${pc.dim(dateStr)}`);
        console.log(`  ${pc.yellow(item.fromAgent)} ➔ ${pc.cyan(item.toAgent)} [${statusColor(item.status.toUpperCase())}]`);
        console.log(`  ${pc.bold('Goal:')} "${item.goal}"`);
        if (item.tasksDone && item.tasksDone.length > 0) {
          console.log(`  ${pc.green('Completed:')} ${item.tasksDone.join(', ')}`);
        }
        if (item.nextTasks && item.nextTasks.length > 0) {
          console.log(`  ${pc.cyan('Next Tasks:')} ${item.nextTasks.join(', ')}`);
        }
        if (item.notes) {
          console.log(`  ${pc.dim('Notes:')} ${item.notes}`);
        }
        if (i < history.length - 1) {
          console.log(pc.dim('  ↓'));
        }
      }
      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────\n'));
    } catch (err: any) {
      console.error(pc.red(`❌ Failed to read handoff log: ${err.message}`));
      process.exit(1);
    }
  });

// LINT
program
  .command('lint')
  .description('Validate canonical rules, frontmatter schema, and structure in .syncytium/')
  .action(async () => {
    try {
      console.log(pc.cyan('🔍 Linting Syncytium canonical rules and context...'));
      const report = await engine.lint();

      if (report.issues.length === 0) {
        console.log(pc.green(`✅ All ${report.totalChecked} checked files are valid and follow best practices!`));
        return;
      }

      for (const issue of report.issues) {
        const icon = issue.type === 'error' ? pc.red('✖ error') : pc.yellow('⚠ warning');
        console.log(`  ${icon}  ${pc.bold(issue.file)}: ${issue.message}`);
      }

      console.log(pc.dim('──────────────────────────────────────────────────────────────────────────'));
      if (!report.valid) {
        console.log(pc.red(`Found ${report.issues.filter(i => i.type === 'error').length} error(s). Please fix before committing.`));
        process.exit(1);
      } else {
        console.log(pc.yellow(`Found ${report.issues.length} warning(s). All critical checks passed.`));
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Lint failed: ${err.message}`));
      process.exit(1);
    }
  });

// HOOK
program
  .command('hook <action>')
  .description('Manage Git pre-commit hook (actions: install, uninstall)')
  .option('--auto-sync', 'Automatically sync bridge files instead of blocking on drift', false)
  .action(async (action, options) => {
    try {
      if (action === 'install') {
        const res = await engine.installGitHook({ autoSync: options.autoSync });
        console.log(pc.green('🪝 Git pre-commit hook installed successfully!'));
        console.log(pc.dim(`Hook location: ${res.hookPath}`));
        if (options.autoSync) {
          console.log(pc.cyan('Mode: Auto-sync bridge files on every git commit.'));
        } else {
          console.log(pc.cyan('Mode: Verify context drift and block commit if bridge files are out of date.'));
        }
      } else if (action === 'uninstall') {
        const res = await engine.uninstallGitHook();
        if (res.success) {
          console.log(pc.green('🪝 Git pre-commit hook removed successfully.'));
        } else {
          console.log(pc.yellow('No Syncytium hook found to uninstall.'));
        }
      } else {
        console.error(pc.red(`Unknown action "${action}". Available actions: install, uninstall`));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Hook management failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
