/**
 * Generates the machine-readable discovery surface for AI agents and
 * catalogues: `llms.txt` (concise) and `llms-full.txt` (canonical rules + ADRs).
 *
 * Deterministic on purpose: `discoverability.yml` regenerates both files and
 * fails if they differ from what is committed, so a release can never advertise
 * stale context. Every list is sorted so the output is byte-identical on every
 * platform.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SyncytiumEngine, TOOL_SAFETY, VERSION } from '../dist/index.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

const engine = new SyncytiumEngine(projectRoot);
const context = await engine.storage.loadCanonicalContext().catch(() => null);

const tools = Object.entries(TOOL_SAFETY)
  .map(([name, policy]) => ({
    name,
    title: policy.annotations.title ?? name,
    effect: policy.effect
  }))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const mcpName = pkg.mcpName ?? 'io.github.mrcbrbn5361/syncytiummd';
const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
const repoUrl = 'https://github.com/mrcbrbn5361/SyncytiumMD';

const header = [
  '# SyncytiumMD',
  '',
  '> One canonical `.syncytium/` context transpiled into every AI coding tool,',
  '> with a multi-agent handoff baton and a lease-based workspace lock.',
  '',
  `- Version: ${VERSION}`,
  `- npm: ${npmUrl}`,
  `- Repository: ${repoUrl}`,
  `- MCP Registry name: ${mcpName}`,
  `- License: ${pkg.license}`,
  ''
].join('\n');

const quickstart = [
  '## Run the MCP server',
  '',
  '```json',
  JSON.stringify(
    {
      mcpServers: {
        syncytium: {
          command: 'npx',
          args: ['--ignore-scripts', '-y', '-p', `${pkg.name}@${VERSION}`, 'syncytium-mcp']
        }
      }
    },
    null,
    2
  ),
  '```',
  '',
  '```bash',
  `npx -y -p ${pkg.name}@${VERSION} syncytium-mcp`,
  '```',
  ''
].join('\n');

const toolSection = [
  `## Tools (${tools.length})`,
  '',
  'Every input is validated with zod before it reaches the engine, every tool',
  'declares MCP safety annotations, and all calls are rate limited in-process.',
  '',
  ...tools.map(tool => `- \`${tool.name}\` — ${tool.title} (${tool.effect})`),
  ''
].join('\n');

const workspace = [
  '## Canonical workspace',
  '',
  '- `.syncytium/rules/` — stack-aware rules with zod-validated frontmatter',
  '- `.syncytium/memory/decisions.md` — architectural decision records',
  '- `.syncytium/HANDOFF.md` — live agent handoff baton',
  '- `.syncytium/memory/lock.json` — machine-local workspace lease',
  '- `syncytium sync` — regenerate bridge files; `syncytium diff --check` — drift gate',
  ''
].join('\n');

const links = [
  '## More',
  '',
  '- `llms-full.txt` — full rule and ADR text',
  '- `server.json` — MCP Registry manifest',
  '- `README.md` — setup and CLI reference',
  ''
].join('\n');

const llms = [header, quickstart, toolSection, workspace, links].join('\n');

const rules = [...(context?.rules ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const decisions = [...(context?.decisions ?? [])].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0
);

const ruleSection = [
  `## Canonical rules (${rules.length})`,
  '',
  ...rules.flatMap(rule => [
    `### ${rule.id} — ${rule.title}`,
    '',
    rule.description ? `> ${rule.description}` : '',
    '',
    rule.globs && rule.globs.length > 0 ? `Globs: \`${rule.globs.join('`, `')}\`` : '',
    rule.tags && rule.tags.length > 0 ? `Tags: ${rule.tags.map(t => `#${t}`).join(' ')}` : '',
    '',
    rule.content.trim(),
    ''
  ])
].filter(line => line !== undefined).join('\n');

const adrSection = [
  `## Architectural decisions (${decisions.length})`,
  '',
  ...decisions.map(
    decision =>
      `### ${decision.id} — ${decision.title}\n\nStatus: ${decision.status} · ${decision.date}\n\n**Context:** ${decision.context}\n\n**Decision:** ${decision.decision}\n\n**Consequences:** ${decision.consequences}\n`
  )
].join('\n');

const full = [llms, '', ruleSection, '', adrSection].join('\n');

// Trailing whitespace is normalised so a CRLF checkout cannot create a diff.
const write = async (name, content) => {
  const normalised = content.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  await fs.writeFile(path.join(projectRoot, name), normalised, 'utf8');
  console.log(`wrote ${name} (${normalised.length} chars)`);
};

await write('llms.txt', llms);
await write('llms-full.txt', full);
