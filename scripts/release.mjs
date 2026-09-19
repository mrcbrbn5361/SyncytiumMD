#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd, options = {}) {
  return execSync(cmd, { stdio: 'inherit', ...options });
}

function runSilent(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const pkgPath = path.resolve('package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const version = pkg.version;

  console.log(`\n🚀 Starting Automated Release for syncytium-md v${version}`);
  console.log('──────────────────────────────────────────────────────────────────────────');

  // 1. Build and verify test suite
  console.log('\n📦 Step 1: Building project and running test suite...');
  run('npm run build');
  run('npm test');
  console.log('✅ Build and tests passed with 100% success.');

  // 2. Publish to NPM with retry and duplicate version detection
  console.log(`\n🌐 Step 2: Publishing v${version} to NPM registry...`);
  const alreadyPublished = runSilent(`npm view syncytium-md@${version} version`);
  if (alreadyPublished === version) {
    console.log(`ℹ️ Version ${version} is already published on NPM. Proceeding to verification & global upgrade...`);
  } else {
    let publishSuccess = false;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`  ↳ Executing npm publish (attempt ${attempt}/${maxRetries})...`);
        run('npm publish --access public');
        publishSuccess = true;
        console.log('✅ Package successfully published to NPM registry.');
        break;
      } catch (err) {
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('EPUBLISHCONFLICT') || errMsg.includes('cannot publish over')) {
          console.log(`ℹ️ Version ${version} was successfully received by NPM registry.`);
          publishSuccess = true;
          break;
        }
        console.warn(`⚠️ npm publish attempt ${attempt} failed: ${errMsg.slice(0, 120)}`);
        if (attempt < maxRetries) {
          console.log('  ↳ Retrying in 5 seconds...');
          await sleep(5000);
        } else {
          throw err;
        }
      }
    }
  }

  // 3. Smart CDN Propagation Polling
  console.log('\n⏳ Step 3: Verifying NPM global CDN replication (polling registry)...');
  let isAvailable = false;
  const maxAttempts = 30; // 30 * 5s = 150s max
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rawVersions = runSilent('npm view syncytium-md versions --json');
    try {
      const versions = JSON.parse(rawVersions || '[]');
      if (Array.isArray(versions) && versions.includes(version)) {
        isAvailable = true;
        console.log(`✨ Succeeded! v${version} is verified and active on the global NPM CDN (attempt ${attempt}).`);
        break;
      }
    } catch {
      // ignore JSON parse error while CDN updates
    }
    process.stdout.write(`  ↳ Waiting for edge replication... (attempt ${attempt}/${maxAttempts})\r`);
    await sleep(5000);
  }

  if (!isAvailable) {
    console.warn('\n⚠️ CDN propagation is taking longer than usual, proceeding with install attempt...');
  }

  // 4. Update local global install
  console.log(`\n💻 Step 4: Updating global CLI on your machine (npm install -g syncytium-md@${version})...`);
  try {
    run(`npm install -g syncytium-md@${version}`);
    console.log(`✅ Global installation upgraded to v${version}!`);
  } catch (err) {
    console.error(`❌ Global install failed: ${err.message}`);
  }

  console.log('\n🎉 Release Complete!');
  console.log(`   NPM: https://www.npmjs.com/package/syncytium-md`);
  console.log(`   CLI: syncytium --version\n`);
}

main().catch(err => {
  console.error('\n❌ Release process failed:', err);
  process.exit(1);
});
