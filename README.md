# 🧬 SyncytiumMD

**The Universal Context, Rules & Handoff Bridge for AI Coding Tools**

[English](README.md) | [Türkçe](README.tr.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

> **In Biology, a "Syncytium"** is a single cell structure containing multiple nuclei sharing common cytoplasm, acting in perfect harmony.  
> **In Software, "SyncytiumMD"** is the shared cytoplasm and neural bridge connecting multiple AI coding agents (Cursor, Claude Code, GitHub Copilot, Cline, Antigravity, Windsurf, Trae, OpenCode) through a single Markdown memory layer.

---

## 🚀 Why SyncytiumMD?

Modern developers don't rely on just one AI tool:
- **Planning & Architecture:** Google Antigravity / Claude Code
- **Inline Editing & Autocomplete:** Cursor / GitHub Copilot / Windsurf
- **Autonomous Subagent Loops:** Cline / Roo Code / OpenCode / Aider
- **Alternative AI IDEs:** Trae, Kiro, Qoder, Zed

However, each tool expects context and rules in fragmented formats:
`.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.clinerules`, `.windsurfrules`, `.traerules`, `AGENT.md`...

**SyncytiumMD** unifies this fragmentation into a **Single Source of Truth (`.syncytium/`)**, transpiling, live-syncing, and enabling **seamless baton handoffs** between all AI coding agents.

---

## 🔌 Supported Tools & Mapping Matrix

| AI Tool / IDE | Category | Bridge Output | Capabilities |
| :--- | :--- | :--- | :--- |
| **Cursor IDE** | IDE | `.cursor/rules/*.mdc`, `.cursorrules` | Glob patterns, `alwaysApply`, YAML Frontmatter, Active Handoff Rule |
| **Claude Code CLI** | CLI | `CLAUDE.md` | Unified architecture, engineering rules, active tasks, ADR decisions |
| **GitHub Copilot** | Extension | `.github/copilot-instructions.md` | Repository-level guidelines & security constraints |
| **Cline & Roo Code** | Extension | `.clinerules`, `.roomodes` | Autonomous execution rules, safety guardrails, handoff protocol |
| **Google Antigravity** | Agent | `.gemini/antigravity/rules/*.md` | Modular workspace rules and project skills |
| **Windsurf IDE** | IDE | `.windsurfrules` | Codeium / Windsurf workspace rules & architecture |
| **Trae IDE** | IDE | `.traerules` | ByteDance Trae AI IDE rules |
| **OpenCode / Aider / Zed / Kiro / Qoder** | CLI/Agent | `AGENT.md`, `CONVENTIONS.md` | Universal open-standard agent rules |
| **Custom / Generic** | Any | User-configured | Add any custom agent/file target in `syncytium.config.json` |

---

## 📦 Quickstart

### 1. Initialize Workspace
```bash
npx syncytium init
```
This generates the `.syncytium/` folder:
```text
.syncytium/
├── syncytium.config.json    # Configures enabled and custom adapters
├── architecture.md          # System architecture & technology stack
├── HANDOFF.md               # Live agent state & task baton
├── rules/                   # Modular rules (code style, security, tests)
│   ├── code-style.md
│   ├── security.md
│   └── testing-standards.md
└── memory/                  # Architectural Decision Records (ADRs)
    └── decisions.md
```

### 2. Synchronize to All AI Tools
```bash
npx syncytium sync
```
Transpiles and generates all target files (`CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.clinerules`, `AGENT.md`, etc.) in milliseconds.

### 3. Live Watcher Daemon
```bash
npx syncytium watch
```
Any modification made to rules, architecture, or handoff inside `.syncytium/` is instantly synchronized across all connected IDEs and CLIs.

---

## 🤝 Multi-Agent Handoff Protocol

Pass context and tasks seamlessly across tools:

```bash
# Antigravity planned the architecture, now handing off to Cursor for inline coding:
npx syncytium handoff \
  --from Antigravity \
  --to Cursor \
  --status in_progress \
  --goal "Implement authentication controller" \
  --done "Database migrations completed" \
  --task "Write src/routes/auth.ts controller" \
  --file "src/routes/auth.ts" \
  --notes "Use JWT with 15min expiry, store refresh tokens in Redis"
```

When you open Cursor, `.cursor/rules/syncytium-handoff.mdc` immediately displays the active handoff context at the top of the chat!

---

## 🤖 Model Context Protocol (MCP) Server

SyncytiumMD includes a built-in MCP server, allowing agents to read and write state directly during runtime.

### Add to MCP Config (Cursor, Claude Desktop, Antigravity)
```json
{
  "mcpServers": {
    "syncytium": {
      "command": "node",
      "args": ["/path/to/SyncytiumMD/dist/mcp/index.js"]
    }
  }
}
```

### Exposed MCP Tools:
- `syncytium_get_context`: Query rules, architecture, ADR decisions, or handoff.
- `syncytium_handoff`: Complete turns and pass the baton to the next agent.
- `syncytium_record_decision`: Save an Architectural Decision Record (ADR).
- `syncytium_sync`: Trigger full project synchronization.

---

## 🧹 Clean Command

Keep your git repository clean when preparing commits:
```bash
npx syncytium clean
```
Safely removes generated bridge files (`CLAUDE.md`, `.cursorrules`, etc.) while leaving `.syncytium/` completely intact.

---

## 🛠️ Development & Testing

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run test suite
npm test
```

---

## 📄 License
MIT License © 2026 SyncytiumMD Team
