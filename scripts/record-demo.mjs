#!/usr/bin/env node
/**
 * Reproducible demo-asset generator for the README.
 *
 * Records the REAL CLI (no mocked output): each step is executed with
 * FORCE_COLOR=1, its ANSI stream is captured, then replayed through a
 * terminal-styled HTML page screenshotted by headless Chromium. The 3D
 * graph frames come from the actual `syncytium graph` server.
 *
 * Usage:  node scripts/record-demo.mjs [--out docs/assets]
 * Deps:   playwright-core + ansi_up (devDependencies), ffmpeg on PATH
 *         (or FFMPEG=/abs/path). Chromium is located in PLAYWRIGHT_BROWSERS_PATH.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { AnsiUp } from 'ansi_up';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CLI = path.join(ROOT, 'dist', 'cli', 'index.js');
const outIdx = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outIdx > -1 ? process.argv[outIdx + 1] : 'docs/assets');

function isFile(p) { try { return fssync.statSync(p).isFile(); } catch { return false; } }

function findChromium() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    'D:\\xdg\\cache\\ms-playwright'
  ].filter(Boolean);
  for (const root of roots) {
    if (!fssync.existsSync(root)) continue;
    const versions = fssync.readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const v of versions) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(root, v, rel);
        if (isFile(p)) return p;
      }
    }
  }
  throw new Error('Chromium not found. Set PLAYWRIGHT_BROWSERS_PATH.');
}

function which(cmd) {
  // On Windows a `where`/`which` probe mangles non-ASCII path bytes under the
  // console codepage (e.g. a `İ` in the user profile), yielding an ENOENT path.
  // Hand the bare name to spawnSync instead: Node's own PATH resolution is
  // Unicode-correct. Only fall back to an env override.
  return process.env.FFMPEG || cmd;
}

async function runCli(args, cwd) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => resolve({ out, code }));
  });
}

const ANSI_RE = /\u001b\[[0-9;]*m/g;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-demo-'));
  await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'acme-dashboard', version: '1.0.0', type: 'module' }));
  await fs.mkdir(path.join(workspace, 'src'));
  await fs.writeFile(path.join(workspace, 'src', 'index.ts'), 'export const app = () => "hello";\n');

  // --- record the real session -------------------------------------------
  const steps = [];
  const prompt = 'acme-dashboard $';
  const record = async (label, args, expectCode = 0) => {
    const { out, code } = await runCli(args, workspace);
    if (expectCode !== null && code !== expectCode) {
      throw new Error(`demo step "${label}" exited ${code}, expected ${expectCode}\n${out.replace(ANSI_RE, '')}`);
    }
    steps.push({ cmd: `npx syncytium ${args.join(' ')}`, ansi: out });
    return { out, code };
  };

  await record('init', ['init', 'acme-dashboard']);
  await record('sync', ['sync']);
  await record('handoff', ['handoff', '--from', 'Claude Code', '--to', 'Cursor', '-s', 'in_progress', '-g', 'Add JWT auth', '-d', 'scaffolded login form', '-t', 'wire token refresh']);
  // A rule edit that CI would catch: append one bullet to a canonical rule.
  await fs.appendFile(path.join(workspace, '.syncytium', 'rules', 'code-style.md'), '\n- Never use default exports.\n');
  await record('diff-check', ['diff', '--check'], 1);
  await record('sync2', ['sync']);
  await record('check2', ['diff', '--check']);

  // --- replay through a terminal UI, screenshot frames --------------------
  const exePath = await findChromium();
  const browser = await chromium.launch({
    executablePath: exePath,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 620 }, deviceScaleFactor: 2 });
  const ansiUp = new AnsiUp();
  ansiUp.url_allowlist = [];

  const frameDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-frames-'));
  const terminalHtml = (body) => `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:#0d1117}
    .win{margin:24px;width:932px;border-radius:10px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.55);
      font:13.5px/1.45 "Cascadia Code","SF Mono",Consolas,monospace;background:#0b0f14;color:#e6edf3}
    .bar{display:flex;gap:7px;align-items:center;padding:10px 14px;background:#161b22}
    .dot{width:12px;height:12px;border-radius:50%}
    .title{margin-left:8px;color:#8b949e;font-size:12px}
    pre{margin:0;padding:14px 18px;height:528px;overflow:hidden;white-space:pre-wrap;word-break:break-word;
      display:flex;flex-direction:column;justify-content:flex-end}
    .ps{color:#3fb950}.cmd{color:#e6edf3;font-weight:600}.dim{color:#8b949e}
    .cur{background:#e6edf3;color:#0b0f14}
  </style><div class="win"><div class="bar">
    <div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div>
    <div class="dot" style="background:#28c840"></div><div class="title">syncytium — acme-dashboard</div>
  </div><pre>${body}</pre></div>`;

  let frameIndex = 0;
  const shot = async (body) => {
    const f = path.join(frameDir, `f${String(frameIndex++).padStart(3, '0')}.png`);
    await page.setContent(terminalHtml(body), { waitUntil: 'load' });
    await page.screenshot({ path: f });
    return f;
  };
  const held = [];
  const push = async (extra = '') => { await shot(held.join('') + extra); };

  for (const step of steps) {
    const cmdLine = `<span class="ps">${prompt}</span> <span class="cmd">${step.cmd}</span>\n`;
    const shown = ansiUp.ansi_to_html(step.out);
    const lines = shown.split('\n');
    // hold the typed command for ~1s before the output appears
    await push(cmdLine + '<span class="cur">█</span>');
    await push(cmdLine + '<span class="cur">█</span>');
    await push(cmdLine);
    for (let i = 0; i < lines.length; i += 5) {
      const partial = lines.slice(0, i + 5).join('\n');
      const tail = i + 5 < lines.length ? '<span class="cur">█</span>' : '';
      await push(cmdLine + partial + tail);
      await push(cmdLine + partial + tail);
    }
    held.push(cmdLine + shown.replace(/\n$/, '') + '\n\n');
    for (let i = 0; i < 4; i++) await push();
  }
  // end card lingers ~2s
  for (let i = 0; i < 10; i++) await push();
  await browser.close();

  const ffmpeg = which('ffmpeg');
  if (spawnSync(ffmpeg, ['-hide_banner', '-version']).status !== 0) {
    throw new Error('ffmpeg not found on PATH (or set FFMPEG=/abs/path).');
  }
  const palette = path.join(frameDir, 'p.png');
  const run = (args) => {
    const r = spawnSync(ffmpeg, args, { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}\n${(r.stderr || r.stdout || '').split(/\r?\n/).slice(-12).join('\n')}`);
  };
  run(['-y', '-framerate', '5', '-i', path.join(frameDir, 'f%03d.png'), '-vf', 'palettegen=max_colors=160:stats_mode=diff', '-frames:v', '1', '-update', '1', palette]);
  run(['-y', '-framerate', '5', '-i', path.join(frameDir, 'f%03d.png'), '-i', palette,
    '-filter_complex', '[0:v]scale=640:-1:flags=lanczos[s];[s][1:v]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', path.join(OUT, 'demo.gif')]);

  // --- the real 3D graph --------------------------------------------------
  const graphPng = path.join(OUT, 'graph.png');
  const b2 = await chromium.launch({ executablePath: exePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const g = await b2.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const server = spawn(process.execPath, [CLI, 'graph', '--no-open', '--port', '4573'], {
    cwd: workspace, stdio: 'ignore', env: { ...process.env, NO_COLOR: '1' }
  });
  try {
    await new Promise(r => setTimeout(r, 2500));
    await g.goto('http://127.0.0.1:4573', { waitUntil: 'load' });
    await g.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 4500)); // let the cosmos settle
    await g.screenshot({ path: graphPng });

    const gframes = await fs.mkdtemp(path.join(os.tmpdir(), 'syncytium-gframes-'));
    const gf = [];
    for (let i = 0; i < 16; i++) {
      const f = path.join(gframes, `g${String(i).padStart(3, '0')}.png`);
      await g.screenshot({ path: f });
      gf.push(f);
      await new Promise(r => setTimeout(r, 260));
    }
    const gpalette = path.join(gframes, 'gp.png');
    run(['-y', '-framerate', '5', '-i', path.join(gframes, 'g%03d.png'), '-vf', 'palettegen=max_colors=128:stats_mode=diff', '-frames:v', '1', '-update', '1', gpalette]);
    run(['-y', '-framerate', '5', '-i', path.join(gframes, 'g%03d.png'), '-i', gpalette,
      '-filter_complex', '[0:v]scale=640:-1:flags=lanczos[s];[s][1:v]paletteuse=dither=bayer:bayer_scale=4',
      '-loop', '0', path.join(OUT, 'graph.gif')]);
    await fs.rm(gframes, { recursive: true, force: true });
  } finally {
    server.kill();
    await b2.close();
  }

  // hero capture: the finished session in one frame
  const hero = path.join(OUT, 'terminal.png');
  const browser3 = await chromium.launch({ executablePath: exePath });
  const p3 = await browser3.newPage({ viewport: { width: 980, height: 620 }, deviceScaleFactor: 2 });
  await p3.setContent(terminalHtml(held.join('')), { waitUntil: 'load' });
  await p3.screenshot({ path: hero });
  await browser3.close();

  await fs.rm(workspace, { recursive: true, force: true });
  await fs.rm(frameDir, { recursive: true, force: true });
  const list = await fs.readdir(OUT);
  console.log('wrote:', list.join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
