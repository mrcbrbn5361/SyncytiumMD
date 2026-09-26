#!/usr/bin/env node
import { Command, Option } from 'commander';
import pc from 'picocolors';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { SyncytiumEngine } from '../core/engine.js';
import { runMcpServer } from '../mcp/server.js';
import { VERSION } from '../version.js';
import { listSupportedStacks, normalizeStack } from '../core/templates.js';
import { renderMarkdownToHtml } from '../ui/markdown.js';
import type { DoctorReport, DiffReport, LintReport } from '../core/types.js';

/** Every command honours this for machine-readable output. */
let jsonMode = false;

function emit(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function line(text: string): void {
  if (!jsonMode) console.log(pc.dim(text));
}

const program = new Command();
const engine = new SyncytiumEngine();

program
  .name('syncytium')
  .description('Universal Context & Handoff Bridge for AI Coding Tools (IDEs, VSCode extensions, CLIs, MCP)')
  .version(VERSION)
  .option('--json', 'Emit machine-readable JSON instead of formatted text', false)
  .hook('preAction', (thisCommand) => {
    jsonMode = Boolean(thisCommand.opts().json);
  });

// ------------------------------------------------------------------ init ---
program
  .command('init [projectName]')
  .description('Initialize .syncytium/ single source of truth in the current directory')
  .addOption(
    new Option(
      '-t, --template <stack>',
      `Technology stack template: ${listSupportedStacks().join(', ')}`
    ).choices(listSupportedStacks() as unknown as string[])
  )
  .option('-f, --force', 'Re-initialize even if .syncytium/ already exists', false)
  .action(async (projectName, options) => {
    try {
      if (!jsonMode) console.log(pc.cyan('🧬 Initializing SyncytiumMD workspace...'));
      const stack = normalizeStack(options.template || (await engine.detectStack()));
      const result = await engine.init(projectName, stack, options.force);
      if (jsonMode) {
        emit({ ok: true, projectName: projectName ?? null, stack: result.stack, version: VERSION });
        return;
      }
      console.log(
        pc.green(
          `✨ Successfully initialized .syncytium/ with [${pc.bold(stack.toUpperCase())}] standards.`
        )
      );
      console.log(pc.dim('Generated rules, stack-aware architecture, ADR-001 and HANDOFF.md'));
      console.log(
        pc.yellow('\nNext step: Run `syncytium sync` to generate bridge files for all AI tools.')
      );
    } catch (err) {
      fail(err, 'Initialization failed');
    }
  });

// ------------------------------------------------------------------ sync ---
program
  .command('sync')
  .description('Synchronize and compile rules to all configured AI tool files')
  .option('-t, --target <adapters...>', 'Specific adapter targets (e.g. cursor claude copilot cline)')
  .option('--no-prune', 'Keep generated files whose source rule no longer exists')
  .option('-f, --force', 'Ignore an active multi-agent lock', false)
  .action(async (options) => {
    try {
      if (!jsonMode) console.log(pc.cyan('🔄 Synchronizing context across AI targets...'));
      const result = await engine.sync(options.target, {
        force: options.force,
        noPrune: options.prune === false
      });
      if (jsonMode) {
        emit(result);
        return;
      }
      console.log(
        pc.green(
          `⚡ Generated ${result.count} bridge files in ${result.elapsedMs}ms (${result.rulesCount} rules, ${result.decisionsCount} ADR):`
        )
      );
      for (const p of result.paths) console.log(`  ${pc.dim('•')} ${pc.white(p)}`);
      if (result.pruned.length > 0) {
        console.log(pc.yellow(`🧹 Pruned ${result.pruned.length} orphaned file(s):`));
        for (const p of result.pruned) console.log(`  ${pc.dim('•')} ${pc.white(p)}`);
      }
    } catch (err) {
      fail(err, 'Sync failed');
    }
  });

// ---------------------------------------------------------------- doctor ---
program
  .command('doctor')
  .description('Run comprehensive health check on Syncytium workspace and bridge files')
  .option('--strict', 'Exit with code 1 on warnings as well as errors', false)
  .action(async (options) => {
    try {
      if (!jsonMode) {
        console.log(pc.bold(pc.cyan('\n🩺 Syncytium Doctor - Health & Diagnostics:')));
        line('─'.repeat(74));
      }

      const report = await engine.doctor();

      if (jsonMode) {
        emit(report);
      } else {
        for (const check of report.checks) {
          const icon =
            check.status === 'ok' ? pc.green('✅') : check.status === 'warn' ? pc.yellow('⚠️') : pc.red('❌');
          console.log(`${icon} ${pc.bold(check.name)}: ${check.message}`);
          if (check.detail) console.log(`   ${pc.dim('↳ ' + check.detail)}`);
          if (check.fix) console.log(`   ${pc.cyan('fix:')} ${pc.dim(check.fix)}`);
        }
        line('─'.repeat(74));
        printVerdict(report);
      }

      if (report.overallStatus === 'unhealthy') process.exit(1);
      if (options.strict && report.overallStatus === 'warning') process.exit(1);
    } catch (err) {
      fail(err, 'Doctor check failed');
    }
  });

function printVerdict(report: DoctorReport): void {
  if (report.overallStatus === 'healthy') {
    console.log(pc.bold(pc.green('🎉 All checks passed! Your Syncytium bridge is fully operational.')));
  } else if (report.overallStatus === 'warning') {
    console.log(
      pc.bold(pc.yellow('⚠️ Workspace has warnings. Apply the suggested `fix:` commands above.'))
    );
  } else {
    console.log(pc.bold(pc.red('❌ Workspace requires a fix. See the `fix:` hints above.')));
  }
  console.log('');
}

// ----------------------------------------------------------------- diff ---
program
  .command('diff')
  .description('Inspect context drift between .syncytium/ and generated tool files')
  .option('-t, --target <adapters...>', 'Specific adapter targets to inspect')
  .option('--check', 'Exit with code 1 when any drift or orphan is detected (for CI)', false)
  .option('--full', 'Show complete patches instead of truncated hunks', false)
  .action(async (options) => {
    try {
      if (!jsonMode) {
        console.log(pc.cyan('🔍 Inspecting context drift between .syncytium/ and bridge files...'));
        line('─'.repeat(74));
      }

      const diffResult = await engine.diff(options.target, { full: options.full });

      if (jsonMode) {
        emit(diffResult);
      } else {
        printDiff(diffResult, options.full);
        line('─'.repeat(74));
        const s = diffResult.summary;
        console.log(
          `Summary: ${pc.green(s.identical + ' in sync')}, ${pc.yellow(s.modified + ' modified')}, ` +
            `${pc.red(s.missingOnDisk + ' missing')}, ${pc.magenta(s.unmanaged + ' orphaned')}`
        );
        if (diffResult.hasDrift) {
          console.log(pc.yellow('Tip: Run `syncytium sync` to synchronize and prune.'));
        }
        console.log('');
      }

      // The whole point of the flag: make CI and git hooks able to fail.
      if (options.check && diffResult.hasDrift) {
        if (!jsonMode) {
          console.error(pc.red('❌ Context drift detected. Run `syncytium sync` and commit the result.'));
        }
        process.exit(1);
      }
    } catch (err) {
      fail(err, 'Diff inspection failed');
    }
  });

function printDiff(diffResult: DiffReport, full: boolean): void {
  for (const item of diffResult.items) {
    if (item.status === 'identical') {
      console.log(`  ${pc.green('✓ In Sync:    ')} ${item.relativePath}`);
      continue;
    }
    if (item.status === 'unmanaged') {
      console.log(`  ${pc.magenta('◇ Orphaned:   ')} ${item.relativePath} ${pc.dim('(' + (item.driftSummary ?? '') + ')')}`);
      continue;
    }
    const icon = item.status === 'modified' ? pc.yellow('⚠ Modified:   ') : pc.red('✗ Missing:    ');
    console.log(`  ${icon} ${item.relativePath} ${pc.dim('(' + (item.driftSummary ?? '') + ')')}`);
    if (item.patch) {
      for (const line of (full ? item.patch : item.patch.split('\n')).slice(0, full ? 200 : 18)) {
        console.log(pc.dim('      ' + line));
      }
      if (!full) console.log(pc.dim('      … (use --full for the complete patch)'));
    }
  }
}

// ---------------------------------------------------------------- watch ---
program
  .command('watch')
  .description('Watch .syncytium/ and continuously auto-sync changes to all AI tools')
  .option('-a, --agent <name>', 'Hold and auto-renew the workspace lock under this agent name')
  .option('-l, --lease <minutes>', 'Lock lease duration in minutes (default: 30)', '30')
  .action(async (options) => {
    try {
      if (!jsonMode) {
        console.log(pc.cyan('👁️  Syncytium Daemon watching .syncytium/ for changes...'));
        console.log(pc.dim('Press Ctrl+C to stop.\n'));
      }

      const initResult = await engine.sync();
      if (!jsonMode) {
        console.log(
          pc.green(`Initial sync complete (${initResult.count} files in ${initResult.elapsedMs}ms). Watching...`)
        );
      }

      if (options.agent) {
        const lease = parseInt(options.lease, 10) || 30;
        const lock = await engine.acquireLock(options.agent, 'watch daemon', lease, true);
        if (!jsonMode) console.log(pc.dim(lock.message));
      }

      const stop = engine.watch({
        onChange: result => {
          if (jsonMode) {
            emit({ event: 'sync', at: new Date().toISOString(), ...result });
            return;
          }
          const time = new Date().toLocaleTimeString();
          const pruned = result.pruned.length > 0 ? `, ${result.pruned.length} pruned` : '';
          console.log(
            `${pc.dim(`[${time}]`)} ${pc.green('⚡ Auto-synchronized:')} ${result.paths.length} files updated${pruned}.`
          );
        },
        onError: err => console.error(pc.red('Auto-sync failed:'), err.message)
      });

      const shutdown = async (): Promise<void> => {
        await stop();
        if (options.agent) await engine.releaseLock(options.agent, true);
        process.exit(0);
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);

      await new Promise(() => {});
    } catch (err) {
      fail(err, 'Watcher failed');
    }
  });

// -------------------------------------------------------------- handoff ---
program
  .command('handoff')
  .description('Pass the baton to the next AI agent or update active task state')
  .option('-i, --interactive', 'Run interactive guided wizard in terminal', false)
  .option('--from <agent>', 'Name of currently finishing agent (e.g. Antigravity, Cursor, Human)')
  .option('--to <agent>', 'Name of next designated agent (e.g. Claude Code, Cline, Cursor)')
  .addOption(
    new Option('-s, --status <status>', 'Handoff status')
      .choices(['in_progress', 'ready_for_review', 'blocked', 'completed'])
  )
  .option('-g, --goal <goal>', 'Primary objective / goal')
  .option('-t, --task <tasks...>', 'Pending tasks for next agent')
  .option('-d, --done <completed...>', 'Completed work items')
  .option('-f, --file <files...>', 'Recently touched / modified files')
  .option('-n, --notes <notes>', 'Contextual guidance or warnings for next agent')
  .option('--no-sync', 'Update state without propagating to bridge files', false)
  .option('-F, --force', 'Ignore an active multi-agent lock', false)
  .action(async (options) => {
    try {
      let fromAgent = options.from;
      let toAgent = options.to;
      let status = options.status;
      let goal = options.goal;
      let completed = options.done;
      let pending = options.task;
      let touchedFiles = options.file;
      let notes = options.notes;

      if (options.interactive) {
        const current = await engine.storage.loadHandoff();
        if (!jsonMode) {
          console.log(pc.bold(pc.cyan('\n🤝 Interactive Syncytium Handoff Wizard')));
          console.log(pc.dim('Press [Enter] to accept the current/default value shown in brackets.\n'));
        }

        const rl = readline.createInterface({ input, output });
        try {
          const ask = async (q: string): Promise<string> => (await rl.question(q)).trim();
          const split = (v: string): string[] => v.split(',').map(s => s.trim()).filter(Boolean);

          fromAgent = (await ask(`Active agent taking over [${pc.yellow(current.activeAgent)}]: `)) || fromAgent;
          toAgent = (await ask(`Next designated agent [${pc.magenta(current.nextAgent || 'Any')}]: `)) || toAgent;
          status = (await ask(`Status (in_progress/ready_for_review/blocked/completed) [${pc.blue(current.status)}]: `)) || status;
          goal = (await ask(`Primary Goal [${current.goal}]: `)) || goal;

          const doneInput = await ask('Completed tasks (comma-separated, blank to skip): ');
          if (doneInput) completed = split(doneInput);

          const pendingInput = await ask('Pending tasks for next agent (comma-separated, blank to keep existing): ');
          if (pendingInput) pending = split(pendingInput);

          notes = (await ask(`Context & advice notes for next agent [${current.contextNotes || 'None'}]: `)) || notes;
        } finally {
          rl.close();
        }
      }

      if (!jsonMode) console.log(pc.cyan('\n🤝 Updating Syncytium Handoff...'));
      const handoff = await engine.handoff({
        activeAgent: fromAgent,
        nextAgent: toAgent,
        status,
        goal,
        completed,
        pending,
        touchedFiles,
        notes,
        autoSync: options.sync !== false,
        force: options.force
      });

      if (jsonMode) {
        emit({ ok: true, handoff });
        return;
      }
      console.log(pc.green('✅ Handoff updated and propagated to all AI tools:'));
      console.log(`  ${pc.bold('Active Agent:')} ${pc.yellow(handoff.activeAgent)}`);
      console.log(`  ${pc.bold('Next Agent:')}   ${pc.magenta(handoff.nextAgent || 'Any')}`);
      console.log(`  ${pc.bold('Status:')}       ${pc.blue(handoff.status.toUpperCase())}`);
      console.log(`  ${pc.bold('Goal:')}         ${handoff.goal}`);
      if (handoff.pendingTasks.length > 0) {
        console.log(`  ${pc.bold('Pending:')}      ${handoff.pendingTasks.join(', ')}`);
      }
    } catch (err) {
      fail(err, 'Handoff failed');
    }
  });

// --------------------------------------------------------------- status ---
program
  .command('status')
  .description('Display SyncytiumMD status and active agent handoff')
  .action(async () => {
    try {
      const status = await engine.getStatus();
      if (jsonMode) {
        emit(status);
        return;
      }
      if (!status.initialized) {
        console.log(pc.yellow('Syncytium is not initialized in this directory. Run `syncytium init`.'));
        return;
      }

      console.log(pc.bold(pc.cyan(`\n🧬 SyncytiumMD: ${status.projectName}  ${pc.dim('v' + status.version)}`)));
      line('─'.repeat(74));
      console.log(`${pc.bold('Rules:')}            ${status.rulesCount} canonical rules`);
      console.log(`${pc.bold('ADR Decisions:')}    ${status.decisionsCount} recorded decisions`);
      console.log(`${pc.bold('Active Adapters:')}  ${status.activeAdapters.join(', ')}`);
      console.log(
        `${pc.bold('Lock:')}             ${
          status.lock.locked
            ? `${pc.yellow('HELD')} by ${status.lock.agent}${status.lock.isExpired ? pc.red(' (expired)') : ''}`
            : pc.green('free')
        }`
      );
      line('─'.repeat(74));
      console.log(pc.bold('🤝 Live Handoff State:'));
      console.log(`  Current Agent:   ${pc.yellow(status.handoff.activeAgent)}`);
      console.log(`  Next Agent:      ${pc.magenta(status.handoff.nextAgent || 'Any')}`);
      console.log(`  Status:          ${pc.blue(status.handoff.status.toUpperCase())}`);
      console.log(`  Goal:            ${status.handoff.goal}`);
      console.log(`  Last Updated:    ${pc.dim(status.handoff.lastUpdated)}`);
      line('─'.repeat(74));
      console.log('');
    } catch (err) {
      fail(err, 'Status check failed');
    }
  });

// ------------------------------------------------------------- adapters ---
program
  .command('adapters')
  .description('List all registered AI tool adapters')
  .action(() => {
    const list = engine.registry.list();
    if (jsonMode) {
      emit(list);
      return;
    }
    console.log(pc.bold(pc.cyan('\n🔌 Supported AI Tool Adapters:')));
    line('─'.repeat(74));
    for (const a of list) {
      console.log(
        `${pc.green(a.id.padEnd(12))} [${pc.blue(a.category.toUpperCase().padEnd(9))}] ${pc.bold(a.name)} - ${pc.dim(a.description)}`
      );
      console.log(`   ${pc.dim('Targets:')} ${a.defaultTargetFiles.join(', ')}`);
    }
    line('─'.repeat(74));
    console.log('');
  });

// ---------------------------------------------------------------- clean ---
program
  .command('clean')
  .description('Safely remove generated bridge files (hand-written files are always preserved)')
  .option('-t, --target <adapters...>', 'Specific adapter targets to clean')
  .option('--dry-run', 'List what would be removed without deleting', false)
  .action(async (options) => {
    try {
      if (options.dryRun) {
        const report = await engine.diff(options.target);
        const orphans = report.items.filter(i => i.status === 'unmanaged');
        if (jsonMode) {
          emit({ dryRun: true, removable: orphans });
          return;
        }
        if (orphans.length === 0) {
          console.log(pc.dim('No removable generated files found.'));
          return;
        }
        console.log(pc.yellow(`[Dry Run] ${orphans.length} file(s) would be removed:`));
        for (const o of orphans) console.log(`  ${pc.dim('•')} ${o.relativePath}`);
        return;
      }

      if (!jsonMode) console.log(pc.yellow('🧹 Cleaning generated Syncytium bridge files...'));
      const cleaned = await engine.clean(options.target);
      if (jsonMode) {
        emit({ removed: cleaned, count: cleaned.length });
        return;
      }
      if (cleaned.length === 0) {
        console.log(pc.dim('No generated files found to clean.'));
      } else {
        console.log(pc.green(`Removed ${cleaned.length} Syncytium-managed files:`));
        for (const f of cleaned) console.log(`  ${pc.dim('•')} ${f}`);
        console.log(pc.dim('Any files you authored yourself were left untouched.'));
      }
    } catch (err) {
      fail(err, 'Clean failed');
    }
  });

// --------------------------------------------------------------- import ---
program
  .command('import')
  .description('Reverse migrate existing AI rule files (CLAUDE.md, .cursorrules, .clinerules, etc.) into .syncytium/')
  .option('--dry-run', 'Preview imported files without writing to disk')
  .action(async (options) => {
    try {
      if (!jsonMode) console.log(pc.cyan('📥 Scanning workspace for existing AI rule files...'));
      const report = await engine.importExisting({ dryRun: options.dryRun });
      if (jsonMode) {
        emit(report);
        return;
      }
      if (report.importedCount === 0) {
        console.log(
          pc.yellow(
            `ℹ️ No unmanaged AI rule files found to import.${report.skippedCount ? ` (${report.skippedCount} already Syncytium-managed)` : ''}`
          )
        );
        return;
      }
      console.log(pc.green(`✨ Successfully discovered ${report.importedCount} AI instruction sources:`));
      for (const item of report.items) {
        console.log(
          `  ${pc.bold(pc.white(item.sourceFile))} (${pc.blue(item.adapterName)}) ➔ ${pc.cyan(`.syncytium/rules/${item.targetRuleFile}`)}`
        );
      }
      console.log(
        options.dryRun
          ? pc.yellow('\n[Dry Run] No files were modified. Run `syncytium import` without --dry-run to apply.')
          : pc.green('\n🎉 Imported rules saved and synchronized across all adapters!')
      );
    } catch (err) {
      fail(err, 'Import failed');
    }
  });

// ------------------------------------------------------------------ log ---
program
  .command('log')
  .description('Display multi-agent handoff audit history and timeline')
  .option('-n, --limit <number>', 'Number of past handoff entries to show', '10')
  .action(async (options) => {
    try {
      const limit = Math.max(0, parseInt(options.limit, 10) || 10);
      const history = await engine.getHandoffHistory(limit);
      if (jsonMode) {
        emit(history);
        return;
      }

      console.log(pc.bold(pc.cyan('\n📜 Syncytium Multi-Agent Handoff History:')));
      line('─'.repeat(74));
      if (history.length === 0) {
        console.log(pc.dim('No handoff history recorded yet. Use `syncytium handoff` to pass the baton.'));
        line('─'.repeat(74));
        console.log('');
        return;
      }

      history.forEach((item, i) => {
        const statusColor =
          item.status === 'completed'
            ? pc.green
            : item.status === 'in_progress'
              ? pc.yellow
              : item.status === 'blocked'
                ? pc.red
                : pc.blue;
        console.log(`${pc.bold(pc.magenta(`[${item.id}]`))} ${pc.dim(new Date(item.timestamp).toLocaleString())}`);
        console.log(`  ${pc.yellow(item.fromAgent)} ➔ ${pc.cyan(item.toAgent)} [${statusColor(item.status.toUpperCase())}]`);
        console.log(`  ${pc.bold('Goal:')} "${item.goal}"`);
        if (item.tasksDone?.length) console.log(`  ${pc.green('Completed:')} ${item.tasksDone.join(', ')}`);
        if (item.nextTasks?.length) console.log(`  ${pc.cyan('Next Tasks:')} ${item.nextTasks.join(', ')}`);
        if (item.notes) console.log(`  ${pc.dim('Notes:')} ${item.notes}`);
        if (i < history.length - 1) console.log(pc.dim('  ↓'));
      });
      line('─'.repeat(74));
      console.log('');
    } catch (err) {
      fail(err, 'Failed to read handoff log');
    }
  });

// ----------------------------------------------------------------- lint ---
program
  .command('lint')
  .description('Validate canonical rules, frontmatter schema, ADR schema and structure in .syncytium/')
  .option('--fix', 'Automatically heal missing frontmatter and kebab-case rule filenames', false)
  .action(async (options) => {
    try {
      if (!jsonMode) console.log(pc.cyan('🔍 Linting Syncytium canonical rules and context...'));
      const report = await engine.lint({ fix: options.fix });

      if (jsonMode) {
        emit(report);
      } else {
        printLint(report);
        if (!report.valid) process.exit(1);
      }
      if (!report.valid) process.exit(1);
    } catch (err) {
      fail(err, 'Lint failed');
    }
  });

function printLint(report: LintReport): void {
  if (report.fixedCount) console.log(pc.green(`🔧 Automatically healed ${report.fixedCount} issue(s).`));
  if (report.issues.length === 0) {
    console.log(pc.green(`✅ All ${report.totalChecked} checked files are valid and follow best practices!`));
    return;
  }
  for (const issue of report.issues) {
    const icon = issue.type === 'error' ? pc.red('✖ error  ') : pc.yellow('⚠ warning');
    const code = issue.code ? pc.dim(` [${issue.code}]`) : '';
    console.log(`  ${icon} ${pc.bold(issue.file)}${code}: ${issue.message}`);
  }
  line('─'.repeat(74));
  const errors = report.issues.filter(i => i.type === 'error').length;
  if (errors > 0) {
    console.log(pc.red(`Found ${errors} error(s). Run \`syncytium lint --fix\` or fix them before committing.`));
  } else {
    console.log(pc.yellow(`Found ${report.issues.length} warning(s). All critical checks passed.`));
  }
}

// ----------------------------------------------------------------- lock ---
program
  .command('lock [action]')
  .description('Manage the multi-agent lease (actions: acquire, release, status, heartbeat)')
  .addOption(new Option('-a, --agent <name>', 'Agent name (e.g. Cursor, Claude, Antigravity)'))
  .option('-g, --goal <goal>', 'Goal or task the agent is working on')
  .option('-l, --lease <minutes>', 'Lock lease duration in minutes (default: 30)', '30')
  .option('-f, --force', 'Force acquire override or release of another agent lock', false)
  .action(async (action = 'status', options) => {
    try {
      const lease = parseInt(options.lease, 10) || 30;

      if (action === 'acquire') {
        if (!options.agent && !jsonMode) {
          console.error(pc.red('🚫 --agent is required: syncytium lock acquire --agent "Cursor"'));
          process.exit(1);
        }
        const res = await engine.acquireLock(options.agent || 'UnknownAgent', options.goal, lease, options.force);
        if (jsonMode) {
          emit(res);
          if (!res.acquired) process.exit(1);
          return;
        }
        console.log(res.acquired ? pc.green(`🔒 ${res.message}`) : pc.red(`🚫 ${res.message}`));
        if (!res.acquired) process.exit(1);
        return;
      }

      if (action === 'release') {
        const res = await engine.releaseLock(options.agent, options.force);
        if (jsonMode) {
          emit(res);
          if (!res.released) process.exit(1);
          return;
        }
        console.log(res.released ? pc.green(`🔓 ${res.message}`) : pc.red(`🚫 ${res.message}`));
        if (!res.released) process.exit(1);
        return;
      }

      if (action === 'heartbeat') {
        if (!options.agent) {
          console.error(pc.red('🚫 --agent is required: syncytium lock heartbeat --agent "Cursor"'));
          process.exit(1);
        }
        const res = await engine.renewLock(options.agent, lease);
        if (jsonMode) {
          emit(res);
          if (!res.renewed) process.exit(1);
          return;
        }
        console.log(res.renewed ? pc.green(`💓 ${res.message}`) : pc.yellow(`⚠️ ${res.message}`));
        if (!res.renewed) process.exit(1);
        return;
      }

      if (action === 'status') {
        const lock = await engine.getLockStatus();
        if (jsonMode) {
          emit(lock);
          return;
        }
        console.log(pc.bold(pc.cyan('\n🔒 Syncytium Multi-Agent Lock Status:')));
        line('─'.repeat(74));
        if (!lock.locked) {
          console.log(`  State: ${pc.green('UNLOCKED')} (no agent holds the workspace lease)`);
        } else {
          console.log(`  State:       ${pc.yellow('LOCKED')}${lock.isExpired ? pc.red(' (EXPIRED)') : ''}`);
          console.log(`  Agent:       ${pc.bold(pc.yellow(lock.agent || 'Unknown'))}`);
          if (lock.goal) console.log(`  Goal:        ${lock.goal}`);
          console.log(`  Acquired At: ${pc.dim(lock.acquiredAt || '')}`);
          console.log(`  Expires At:  ${pc.magenta(lock.expiresAt || '')}`);
          if (lock.host) console.log(`  Host:        ${pc.dim(lock.host)}`);
        }
        line('─'.repeat(74));
        console.log('');
        return;
      }

      console.error(pc.red(`Unknown lock action "${action}". Available: acquire, release, heartbeat, status`));
      process.exit(1);
    } catch (err) {
      fail(err, 'Lock management failed');
    }
  });

// ---------------------------------------------------------------- rules ---
program
  .command('rules [query]')
  .description('Catalog and search canonical rules in .syncytium/rules/')
  .action(async (query) => {
    try {
      const rules = await engine.listRules(query);
      if (jsonMode) {
        emit(rules);
        return;
      }
      if (rules.length === 0) {
        console.log(
          pc.yellow(query ? `No canonical rules found matching "${query}".` : 'No canonical rules found.')
        );
        return;
      }

      console.log(pc.bold(pc.cyan(`\n📚 Syncytium Canonical Rules (${rules.length}):`)));
      line('─'.repeat(74));
      for (const r of rules) {
        const applyBadge = r.alwaysApply ? pc.green('[always-apply]') : pc.dim('[glob-based]');
        const tagStr = r.tags?.length ? pc.dim(`(${r.tags.join(', ')})`) : '';
        console.log(`  ${pc.bold(pc.white(r.id.padEnd(24)))} ${applyBadge} ${pc.bold(r.title)} ${tagStr}`);
        if (r.description) console.log(`    ${pc.dim(r.description)}`);
        if (r.globs?.length) console.log(`    ${pc.dim('Globs: ' + r.globs.join(', '))}`);
        console.log(`    ${pc.dim('Source: ' + (r.sourceFile ?? '.syncytium/rules/' + r.id + '.md'))}`);
      }
      line('─'.repeat(74));
      console.log('');
    } catch (err) {
      fail(err, 'Failed to list rules');
    }
  });

program
  .command('rule')
  .description('Manage canonical rules (actions: add, show, update, remove)')
  .arguments('<action> [id]')
  .addHelpText('after', 'Actions: add, show, update, remove')
  .option('-t, --title <title>', 'Rule title (for add)')
  .option('-d, --description <text>', 'Rule description (for add)')
  .option('-b, --body <text>', 'Rule body markdown (for add)')
  .option('-B, --body-file <path>', 'Read the rule body from a file (for add)')
  .option('-g, --glob <globs...>', 'Target globs; presence makes the rule glob-scoped')
  .option('--tag <tags...>', 'Tags for the rule')
  .option('-p, --priority <level>', 'Rule priority: low | medium | high')
  .option('--always-apply', 'Force alwaysApply=true (default when no globs given)', false)
  .option('-y, --yes', 'Skip the confirmation prompt (for remove)', false)
  .action(async (action, id, options) => {
    try {
      if (action === 'add') {
        const title = options.title || id;
        if (!title) {
          console.error(pc.red('🚫 A title or id is required: syncytium rule add --title "My Rule" --body "..."'));
          process.exit(1);
        }
        const body = options.bodyFile
          ? await readTextFile(options.bodyFile)
          : options.body;
        if (!body) {
          console.error(pc.red('🚫 A rule body is required: use --body or --body-file <path>'));
          process.exit(1);
        }
        const { rule, path } = await engine.addRule({
          id,
          title,
          description: options.description,
          body,
          globs: options.glob,
          tags: options.tag,
          alwaysApply: options.alwaysApply || undefined,
          priority: options.priority
        });
        if (jsonMode) {
          emit({ ok: true, rule });
          return;
        }
        console.log(pc.green(`✅ Rule "${rule.id}" created at ${path}`));
        console.log(pc.dim('Bridge files were regenerated. Review with `syncytium diff`.'));
        return;
      }

      if (action === 'show') {
        if (!id) {
          console.error(pc.red('🚫 Rule id required: syncytium rule show <id>'));
          process.exit(1);
        }
        const rule = await engine.getRule(id);
        if (!rule) {
          console.error(pc.red(`❌ No rule with id "${id}".`));
          process.exit(1);
        }
        if (jsonMode) {
          emit(rule);
          return;
        }
        console.log(pc.bold(pc.cyan(`\n📌 ${rule.title}  (${rule.id})`)));
        line('─'.repeat(74));
        if (rule.description) console.log(pc.dim(rule.description));
        console.log(`${pc.bold('Scope:')}   ${rule.alwaysApply ? 'always applied' : 'glob-scoped'}`);
        if (rule.globs?.length) console.log(`${pc.bold('Globs:')}   ${rule.globs.join(', ')}`);
        if (rule.tags?.length) console.log(`${pc.bold('Tags:')}    ${rule.tags.join(', ')}`);
        console.log(`${pc.bold('Source:')}  ${rule.sourceFile ?? '.'}`);
        line('─'.repeat(74));
        console.log(rule.content);
        console.log('');
        return;
      }

      if (action === 'remove' || action === 'rm') {
        if (!id) {
          console.error(pc.red('🚫 Rule id required: syncytium rule remove <id>'));
          process.exit(1);
        }
        if (!options.yes && !jsonMode) {
          const rl = readline.createInterface({ input, output });
          try {
            const answer = (await rl.question(`Delete canonical rule "${id}" and its generated files? [y/N] `))
              .trim()
              .toLowerCase();
            if (answer !== 'y' && answer !== 'yes') {
              console.log(pc.dim('Aborted.'));
              return;
            }
          } finally {
            rl.close();
          }
        }
        const removed = await engine.removeRule(id);
        if (jsonMode) {
          emit({ ok: removed, id });
          if (!removed) process.exit(1);
          return;
        }
        console.log(removed ? pc.green(`🗑️  Removed rule "${id}" and pruned its generated files.`) : pc.red(`❌ No rule with id "${id}".`));
        if (!removed) process.exit(1);
        return;
      }

      if (action === 'edit-body' || action === 'update') {
        if (!id) {
          console.error(pc.red('🚫 Rule id required: syncytium rule update <id> --body-file <path>'));
          process.exit(1);
        }
        const body = options.bodyFile ? await readTextFile(options.bodyFile) : options.body;
        const patch: Parameters<typeof engine.updateRule>[1] = { body };
        if (options.title) patch.title = options.title;
        if (options.description !== undefined) patch.description = options.description;
        if (options.glob) patch.globs = options.glob;
        if (options.tag) patch.tags = options.tag;
        if (options.alwaysApply) patch.alwaysApply = true;
        if (options.priority) patch.priority = options.priority as 'low' | 'medium' | 'high';

        const { rule: updated } = await engine.updateRule(id, patch);
        if (jsonMode) {
          emit({ ok: true, rule: updated });
          return;
        }
        console.log(pc.green(`✏️  Updated rule "${updated.id}" and regenerated bridge files.`));
        return;
      }

      console.error(pc.red(`Unknown rule action "${action}". Available: add, show, remove, edit-body`));
      process.exit(1);
    } catch (err) {
      fail(err, 'Rule command failed');
    }
  });

// ------------------------------------------------------------------ adr ---
program
  .command('adr')
  .alias('decision')
  .description('Manage architectural decision records (actions: list, add, show, remove)')
  .arguments('<action> [id]')
  .addHelpText('after', 'Actions: list, add, show, remove')
  .option('-t, --title <title>', 'ADR title')
  .option('-C, --context <text>', 'Background / problem statement')
  .option('-D, --decision <text>', 'The chosen solution')
  .option('-Q, --consequences <text>', 'Pros, cons and implications')
  .addOption(
    new Option('-s, --status <status>', 'ADR status')
      .choices(['proposed', 'accepted', 'superseded', 'deprecated'])
  )
  .option('-n, --limit <number>', 'How many ADRs to list', '20')
  .action(async (action, id, options) => {
    try {
      if (action === 'list') {
        const decisions = await engine.listDecisions({ query: id });
        const limit = Math.max(0, parseInt(options.limit, 10) || 20);
        const sliced = decisions.slice(0, limit);
        if (jsonMode) {
          emit(sliced);
          return;
        }
        console.log(pc.bold(pc.cyan(`\n⚖️  Architectural Decision Records (${sliced.length}/${decisions.length}):`)));
        line('─'.repeat(74));
        if (sliced.length === 0) {
          console.log(pc.dim('No ADRs recorded yet. Add one with `syncytium adr add`.'));
        }
        for (const d of sliced) {
          const color = d.status === 'accepted' ? pc.green : d.status === 'deprecated' || d.status === 'superseded' ? pc.red : pc.yellow;
          console.log(`  ${pc.bold(pc.white(d.id.padEnd(10)))} ${color(d.status.padEnd(11))} ${d.title}`);
          console.log(`     ${pc.dim(d.decision.slice(0, 100))}${d.decision.length > 100 ? '…' : ''}`);
        }
        line('─'.repeat(74));
        console.log('');
        return;
      }

      if (action === 'add') {
        const title = options.title || id;
        if (!title || !options.context || !options.decision || !options.consequences) {
          console.error(
            pc.red(
              '🚫 Title, context, decision and consequences are all required:\n' +
                '   syncytium adr add --title "..." --context "..." --decision "..." --consequences "..."'
            )
          );
          process.exit(1);
        }
        const nextId = id && /^ADR-/i.test(id) ? id : await engine.storage.nextDecisionId();
        const decision = await engine.addDecision({
          id: nextId,
          title,
          status: options.status || 'accepted',
          date: new Date().toISOString().split('T')[0],
          context: options.context,
          decision: options.decision,
          consequences: options.consequences
        });
        if (jsonMode) {
          emit({ ok: true, decision });
          return;
        }
        console.log(pc.green(`📝 Recorded ${decision.id}: "${decision.title}" and synchronized all adapters.`));
        return;
      }

      if (action === 'show') {
        if (!id) {
          console.error(pc.red('🚫 ADR id required: syncytium adr show ADR-001'));
          process.exit(1);
        }
        const decisions = await engine.listDecisions();
        const found = decisions.find(d => d.id.toLowerCase() === id.toLowerCase());
        if (!found) {
          console.error(pc.red(`❌ No ADR with id "${id}".`));
          process.exit(1);
        }
        if (jsonMode) {
          emit(found);
          return;
        }
        console.log(pc.bold(pc.cyan(`\n⚖️  [${found.id}] ${found.title}`)));
        line('─'.repeat(74));
        console.log(`${pc.bold('Status:')}       ${found.status}`);
        console.log(`${pc.bold('Date:')}         ${found.date}`);
        console.log(`\n${pc.bold('Context:')}\n${found.context}`);
        console.log(`\n${pc.bold('Decision:')}\n${found.decision}`);
        console.log(`\n${pc.bold('Consequences:')}\n${found.consequences}\n`);
        return;
      }

      if (action === 'remove' || action === 'rm') {
        if (!id) {
          console.error(pc.red('🚫 ADR id required: syncytium adr remove ADR-001'));
          process.exit(1);
        }
        const removed = await engine.removeDecision(id);
        if (jsonMode) {
          emit({ ok: removed, id });
          if (!removed) process.exit(1);
          return;
        }
        console.log(removed ? pc.green(`🗑️  Removed ${id}.`) : pc.red(`❌ No ADR with id "${id}".`));
        if (!removed) process.exit(1);
        return;
      }

      console.error(pc.red(`Unknown adr action "${action}". Available: list, add, show, remove`));
      process.exit(1);
    } catch (err) {
      fail(err, 'ADR command failed');
    }
  });

// ----------------------------------------------------------------- hook ---
program
  .command('hook <action>')
  .description('Manage the Git pre-commit hook (actions: install, uninstall, status)')
  .option('--auto-sync', 'Automatically sync bridge files instead of blocking on drift', false)
  .action(async (action, options) => {
    try {
      if (action === 'install') {
        const res = await engine.installGitHook({ autoSync: options.autoSync });
        if (jsonMode) {
          emit(res);
          return;
        }
        console.log(pc.green('🪝 Git pre-commit hook installed successfully!'));
        console.log(pc.dim(`Hook location: ${res.hookPath}`));
        console.log(
          options.autoSync
            ? pc.cyan('Mode: auto-sync bridge files on every git commit.')
            : pc.cyan('Mode: block the commit when bridge files drifted (syncytium diff --check).')
        );
        return;
      }
      if (action === 'uninstall') {
        const res = await engine.uninstallGitHook();
        if (jsonMode) {
          emit(res);
          return;
        }
        console.log(
          res.success ? pc.green('🪝 Git pre-commit hook removed.') : pc.yellow('No Syncytium hook found.')
        );
        return;
      }
      console.error(pc.red(`Unknown action "${action}". Available: install, uninstall`));
      process.exit(1);
    } catch (err) {
      fail(err, 'Hook management failed');
    }
  });

// ------------------------------------------------------------------- ci ---
program
  .command('ci [action]')
  .description('Manage the GitHub Actions drift gate (actions: install, uninstall, status)')
  .option('-f, --force', 'Overwrite an existing CI workflow', false)
  .action(async (action = 'install', options) => {
    try {
      if (action === 'install') {
        const res = await engine.installCiWorkflow({ overwrite: options.force });
        if (jsonMode) {
          emit(res);
          return;
        }
        console.log(pc.green('✨ GitHub Actions CI workflow installed!'));
        console.log(pc.dim(`Workflow location: ${res.path}`));
        console.log(
          pc.yellow('\nCI now runs `syncytium lint`, `syncytium validate` and `syncytium diff --check` on every push and PR.')
        );
        return;
      }
      if (action === 'uninstall') {
        const res = await engine.uninstallCiWorkflow();
        if (jsonMode) {
          emit(res);
          return;
        }
        console.log(
          res.removed ? pc.green('🗑️  CI workflow removed.') : pc.yellow('No Syncytium CI workflow found.')
        );
        return;
      }
      if (action === 'status') {
        const report = await engine.doctor();
        const ci = report.checks.find(c => c.id === 'ci');
        if (jsonMode) {
          emit(ci);
          return;
        }
        console.log(ci ? `${ci.status === 'ok' ? pc.green('✅') : pc.yellow('⚠️')} ${ci.message}` : pc.dim('No CI status available.'));
        return;
      }
      console.error(pc.red(`Unknown ci action "${action}". Available: install, uninstall, status`));
      process.exit(1);
    } catch (err) {
      fail(err, 'CI installation failed');
    }
  });

// ------------------------------------------------------------- validate ---
program
  .command('validate')
  .description('Validate syncytium.config.json and every rule frontmatter against the schema')
  .option('--fix', 'Rewrite the config file with the corrected/defaulted values', false)
  .action(async (options) => {
    try {
      const result = await engine.validate({ fix: options.fix });
      if (jsonMode) {
        emit(result);
        if (!result.valid) process.exit(1);
        return;
      }
      for (const issue of result.issues) {
        console.log(`  ${pc.red('✖ error')}   ${pc.bold(issue.path)}: ${issue.message}`);
      }
      for (const warning of result.warnings) {
        console.log(`  ${pc.yellow('⚠ warning')} ${pc.bold(warning.path)}: ${warning.message}`);
      }
      if (result.valid && result.warnings.length === 0) {
        console.log(pc.green('✅ Configuration and all rule frontmatter are valid.'));
      } else if (result.valid) {
        console.log(pc.yellow(`✅ Valid with ${result.warnings.length} warning(s).`));
      } else {
        console.log(pc.red(`❌ ${result.issues.length} error(s). Run \`syncytium validate --fix\` to repair the config.`));
        process.exit(1);
      }
    } catch (err) {
      fail(err, 'Validation failed');
    }
  });

// --------------------------------------------------------------- export ---
program
  .command('export')
  .description('Produce a single portable markdown bundle of the whole context (paste into any chat/agent)')
  .option('-o, --output <path>', 'Write the bundle to a file instead of stdout')
  .option('--no-handoff', 'Omit the live handoff section')
  .option('--no-decisions', 'Omit the ADR section')
  .option('--no-architecture', 'Omit the architecture section')
  .option('--max-rule-chars <number>', 'Truncate each rule body to N characters', '0')
  .option('--html', 'Render the bundle as HTML instead of markdown', false)
  .action(async (options) => {
    try {
      const bundle = await engine.exportBundle({
        includeHandoff: options.handoff !== false,
        includeDecisions: options.decisions !== false,
        includeArchitecture: options.architecture !== false,
        maxRuleChars: parseInt(options.maxRuleChars, 10) || 0
      });

      let body = options.html ? renderMarkdownToHtml(bundle.markdown) : bundle.markdown;

      if (options.output) {
        await writeTextFile(options.output, body);
        if (jsonMode) {
          emit({ ok: true, path: options.output, chars: body.length });
          return;
        }
        console.log(pc.green(`📦 Context bundle written to ${options.output} (${body.length} chars).`));
        return;
      }

      if (jsonMode) {
        emit(bundle);
        return;
      }
      process.stdout.write(body.endsWith('\n') ? body : body + '\n');
    } catch (err) {
      fail(err, 'Export failed');
    }
  });

// ------------------------------------------------------------------ mcp ---
program
  .command('mcp')
  .description('Run the Syncytium MCP server on stdio (for MCP-capable agents)')
  .option('-C, --cwd <path>', 'Workspace root to serve (default: current directory)')
  .action(async (options) => {
    try {
      // stdout is the JSON-RPC transport, so nothing may be written to it here.
      await runMcpServer(options.cwd ?? process.cwd());
    } catch (err) {
      console.error('Fatal MCP server error:', err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------- graph ---
program
  .command('graph')
  .alias('ui')
  .description('Launch the interactive 3D Obsidian Studio knowledge graph in the browser')
  .option('-p, --port <number>', 'Local server port (default: 3737)', '3737')
  .addOption(
    new Option('--category <type>', 'Filter perspective: all, ide, cli, extension, agent, brain')
      .choices(['all', 'ide', 'cli', 'extension', 'agent', 'brain'])
      .default('all')
  )
  .option('-c, --compact', 'Start in compact view (hides file and tag nodes)', false)
  .option('--no-files', 'Hide generated AI tool file nodes', false)
  .option('--no-tags', 'Hide tag category nodes', false)
  .option('--no-open', 'Start the server without opening a browser', false)
  .option('--allow-remote', 'Accept requests from non-loopback hosts (unsafe)', false)
  .action(async (options) => {
    try {
      const portNum = parseInt(options.port, 10) || 3737;
      if (!jsonMode) {
        console.log(pc.bold(pc.cyan('\n🧠 Syncytium Obsidian Studio — 3D Knowledge Galaxy')));
        if (options.category !== 'all') {
          console.log(pc.magenta(`🎯 Perspective: [${options.category.toUpperCase()}]`));
        }
        if (options.compact) console.log(pc.yellow('⚡ Compact mode (file & tag nodes hidden).'));
        if (options.allowRemote) {
          console.log(pc.red('⚠️  --allow-remote disables the loopback/Host guard. Use only on a trusted network.'));
        }
        console.log(pc.dim('Starting local server...'));
      }

      const ui = await engine.startUiServer({
        port: portNum,
        open: options.open !== false,
        compact: options.compact === true,
        excludeFiles: options.files === false,
        excludeTags: options.tags === false,
        category: options.category,
        allowRemote: options.allowRemote === true
      });

      if (jsonMode) {
        emit({ ok: true, url: ui.url, port: ui.port });
      } else {
        console.log(pc.green(`✨ Visual Knowledge Graph running at: ${pc.bold(pc.underline(ui.url))}`));
        console.log(pc.dim('Live SSE sync is active: editing .syncytium/ updates the graph.'));
        console.log(pc.dim('Press Ctrl+C to stop.\n'));
      }

      await new Promise(() => {});
    } catch (err) {
      fail(err, 'Failed to start UI server');
    }
  });

// ---------------------------------------------------------------- utils ---

function fail(err: unknown, prefix: string): never {
  if (jsonMode) {
    emit({ ok: false, error: (err as Error).message });
  } else {
    console.error(pc.red(`❌ ${prefix}: ${(err as Error).message}`));
  }
  process.exit(1);
}

async function readTextFile(target: string): Promise<string> {
  const fs = await import('node:fs/promises');
  return fs.readFile(target, 'utf-8');
}

async function writeTextFile(target: string, content: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const nodePath = await import('node:path');
  await fs.mkdir(nodePath.dirname(nodePath.resolve(target)), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

program.parse();
