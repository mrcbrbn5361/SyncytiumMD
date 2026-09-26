#!/usr/bin/env node
/**
 * Release pipeline for SyncytiumMD.
 *
 * Steps: verify (typecheck + build + test) -> publish -> wait for the npm CDN
 * to serve the version -> install globally.
 *
 * Every step is skippable:
 *   node scripts/release.mjs --dry-run      verify only, touch nothing
 *   node scripts/release.mjs --bump patch   bump the version, then run the rest
 *   node scripts/release.mjs --no-install   verify + publish only
 *   node scripts/release.mjs --otp 123456   supply a current 2FA code
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// Resolved relative to this file, not the CWD, so the script behaves the same
// when invoked as `node scripts/release.mjs` from anywhere.
const projectRoot = path.resolve(scriptDir, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const noInstall = argv.includes('--no-install');
const bumpIndex = argv.indexOf('--bump');
const bump = bumpIndex >= 0 ? argv[bumpIndex + 1] : null;
// npm requires 2FA for publishing. Either pass a current one-time code here,
// or authenticate with a granular access token that has "bypass 2FA" enabled.
const otpIndex = argv.indexOf('--otp');
const otp = otpIndex >= 0 ? argv[otpIndex + 1] : null;

const PKG_NAME = 'syncytium-md';

const dim = s => `\x1b[2m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;

function readPkg() {
  return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
}

function run(command, { silent = false } = {}) {
  process.stdout.write(`${dim('$')} ${command}\n`);
  return execSync(command, {
    cwd: projectRoot,
    stdio: silent ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf-8',
    // `version` reaches a shell via the npm commands below, so keep it a
    // strictly-formed semver string and reject anything else outright.
    shell: process.platform === 'win32'
  });
}

function runCaptured(command) {
  try {
    return execSync(command, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      shell: process.platform === 'win32'
    }).trim();
  } catch (err) {
    // Keep stderr: the caller inspects it to distinguish "not published" from
    // "registry unreachable".
    return `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim();
  }
}

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
function assertSemver(version) {
  if (!SEMVER.test(version)) {
    throw new Error(`Refusing to continue: "${version}" is not a valid semver version.`);
  }
}

function bumpVersion(level) {
  if (!['major', 'minor', 'patch'].includes(level)) {
    throw new Error(`--bump expects major | minor | patch (got "${level}").`);
  }
  const pkg = readPkg();
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  const next =
    level === 'major' ? `${major + 1}.0.0`
    : level === 'minor' ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

  pkg.version = next;
  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  // src/version.ts is the single in-code copy of the version and a unit test
  // asserts it matches package.json, so it has to move in lockstep.
  const versionFile = path.join(projectRoot, 'src', 'version.ts');
  const source = readFileSync(versionFile, 'utf-8');
  writeFileSync(
    versionFile,
    source.replace(/export const VERSION = '[^']*';/, `export const VERSION = '${next}';`),
    'utf-8'
  );

  console.log(green(`  bumped ${bold(pkg.version)} -> ${bold(next)}`));
  return next;
}

async function waitForCdn(version, { attempts = 20, baseDelayMs = 1000 } = {}) {
  // Exponential backoff with a cap: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
  let delay = baseDelayMs;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const versions = runCaptured(`npm view ${PKG_NAME} versions --json`);
    let list = [];
    try {
      const parsed = JSON.parse(versions);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Registry still propagating, or offline. Keep waiting.
    }
    if (list.includes(version)) return true;
    const wait = Math.min(delay, 30_000);
    console.log(dim(`  not live yet (attempt ${attempt}/${attempts}), waiting ${wait}ms...`));
    await new Promise(resolve => setTimeout(resolve, wait));
    delay *= 2;
  }
  return false;
}

/** Reads the version literal from src/version.ts, the other copy of it. */
function readVersionLiteral() {
  const source = readFileSync(path.join(projectRoot, 'src', 'version.ts'), 'utf-8');
  return /export const VERSION = '([^']*)'/.exec(source)?.[1];
}

/**
 * Refuses to publish unless the tree is clean and both version copies agree.
 *
 * This exists because of a real incident: during the 0.2.0 release, an external
 * process rewrote package.json and src/version.ts to 0.2.9 while the release
 * was in flight. A unit test caught it, but only after the damage - had it run
 * between the bump and the publish, a wrong version would have shipped. A
 * release must go out from a known commit, not from whatever is on disk now.
 */
function assertPublishableState(version) {
  const problems = [];

  const status = runCaptured('git status --porcelain');
  const dirty = status.split('\n').filter(Boolean);
  if (dirty.length > 0) {
    problems.push(
      `the working tree has ${dirty.length} uncommitted change(s):\n    ` +
        dirty.slice(0, 10).join('\n    ') +
        '\n  Commit (or stash) them, then re-run. A release must ship a known commit.'
    );
  }

  const literal = readVersionLiteral();
  if (literal !== version) {
    problems.push(
      `version mismatch: package.json says ${version} but src/version.ts says ${literal}.\n` +
        '  One of them was edited outside this script. Use --bump, or fix both by hand.'
    );
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to publish:\n\n  - ${problems.join('\n\n  - ')}\n`);
  }
}

async function main() {
  const pkg = readPkg();
  if (bump) bumpVersion(bump);
  const version = readPkg().version;
  assertSemver(version);

  console.log(bold(`\n🚀 ${PKG_NAME} v${version}${dryRun ? ' (dry run)' : ''}\n`));

  // ---- 1. Verify ---------------------------------------------------------
  console.log(bold('1/4  Verify'));
  // Build first, not last: the test suite imports ../dist/index.js, so
  // `tsc --noEmit` over tests/ cannot resolve the types until the build has
  // emitted dist/index.d.ts. Running typecheck first only worked on machines
  // that happened to have a stale dist/ lying around.
  run('npm run build');
  run('npm run typecheck');
  run('npm test');

  if (dryRun) {
    console.log(green('\n✅ Dry run complete: typecheck, build and tests all passed.'));
    return;
  }

  // ---- 2. Publish --------------------------------------------------------
  console.log(bold('\n2/4  Publish'));
  if (bump) {
    // --bump intentionally dirties the tree, so only the version-pairing
    // check is meaningful here; the caller still has to commit before the
    // tag makes sense.
    const literal = readVersionLiteral();
    if (literal !== version) {
      throw new Error(
        `Refusing to publish: package.json says ${version} but src/version.ts says ${literal}.`
      );
    }
    console.log(yellow('  note: --bump touched package.json and src/version.ts; commit them.'));
  } else {
    assertPublishableState(version);
  }
  const existing = runCaptured(`npm view ${PKG_NAME}@${version} version`);
  if (existing.trim() === version) {
    console.log(yellow(`  v${version} is already on the registry; skipping publish.`));
  } else {
    const otpFlag = otp ? ` --otp=${otp}` : '';
    try {
      run(`npm publish --access public${otpFlag}`);
    } catch (err) {
      const detail = (err.stdout ?? '') + (err.stderr ?? '');
      if (/403/.test(detail) && /2FA|two-factor|otp/i.test(detail)) {
        throw new Error(
          'npm refused the publish: two-factor authentication is required.\n' +
            '  Option A: re-run with a current code from your authenticator app:\n' +
            '             npm run release -- --otp 123456\n' +
            '  Option B: use a granular access token instead (no code needed):\n' +
            '             https://www.npmjs.com/settings/access-tokens\n' +
            '             -> package "syncytium-md", access "Read and write",\n' +
            '                and tick "Bypass 2FA for publishing".\n' +
            '             npm login && npm token set <token>'
        );
      }
      throw err;
    }
  }

  // ---- 3. CDN propagation ------------------------------------------------
  console.log(bold('\n3/4  Wait for npm CDN'));
  const live = await waitForCdn(version);
  if (!live) {
    // Not fatal for the publish itself, but the global install below would
    // fail with ETARGET, so fail loudly here instead of pretending success.
    throw new Error(
      `v${version} is still not served by the npm CDN after ${20} attempts. ` +
        'The publish may need manual investigation; nothing else was changed.'
    );
  }
  console.log(green(`  v${version} is live.`));

  // ---- 4. Global install -------------------------------------------------
  if (noInstall) {
    console.log(yellow('\n--no-install: skipping the global upgrade.'));
  } else {
    console.log(bold('\n4/4  Global install'));
    run(`npm install -g ${PKG_NAME}@${version}`);
    const installed = runCaptured(`npm ls -g ${PKG_NAME} --depth=0 --json`);
    let ok = false;
    try {
      const tree = JSON.parse(installed);
      const entry = tree.dependencies?.[PKG_NAME];
      ok = entry?.version === version;
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new Error(`Global install did not report v${version}. Re-run: npm install -g ${PKG_NAME}@${version}`);
    }
    console.log(green(`  global CLI is on v${version}`));
  }

  console.log(green(bold(`\n🎉 Release complete: ${PKG_NAME} v${version}\n`)));
  console.log(dim('  Reminders: git tag -a v' + version + ' -m "release" && git push --tags\n'));
}

main().catch(err => {
  console.error(red(`\n❌ Release failed: ${err.message}\n`));
  process.exit(1);
});
