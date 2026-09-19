import { Command } from 'commander';
import pc from 'picocolors';
import { SyncytiumEngine } from '../core/engine.js';

const program = new Command();
const engine = new SyncytiumEngine();

program
  .name('syncytium')
  .description('Universal Context & Handoff Bridge for AI Coding Tools (IDEs, VSCode extensions, CLIs)')
  .version('0.1.0');

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
      console.log(pc.green(`✅ Successfully generated ${result.count} bridge files:`));
      for (const p of result.paths) {
        console.log(`  ${pc.dim('•')} ${pc.white(p)}`);
      }
    } catch (err: any) {
      console.error(pc.red(`❌ Sync failed: ${err.message}`));
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
      console.log(pc.green(`Initial sync complete (${initResult.count} files). Watching...`));

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

program.parse();
