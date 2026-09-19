# 🧬 SyncytiumMD — System Architecture & Technology Stack

## Overview
SyncytiumMD is the universal, bi-directional context and handoff bridge for modern AI coding tools (Cursor, Claude Code, GitHub Copilot, Cline, Google Antigravity, Windsurf, Trae, OpenCode, and MCP-compatible agents). It provides a single source of truth (`.syncytium/`) to eliminate rule fragmentation, context drift, and agent collisions across multi-agent AI development workflows.

## Technology Stack
- **Runtime:** Node.js 18+ (ESM native)
- **Language:** TypeScript (strict mode, target ES2022)
- **Bundler:** tsup (esbuild under the hood, generates clean ESM with dts)
- **CLI Framework:** Commander.js with picocolors
- **Communication Protocol:** Model Context Protocol (MCP) via `@modelcontextprotocol/sdk` (Stdio transport)
- **Visual Knowledge Graph:** Zero-dependency native Node.js HTTP server + HTML5 Canvas force-directed graph with live Server-Sent Events (SSE)
- **Testing:** Node.js native test runner (`node --experimental-strip-types --test`)

## Architectural Modules
- `src/core/`:
  - `types.ts`: Zod and TypeScript interfaces for rules, decisions, handoff, locks, adapters, and graph nodes.
  - `storage.ts`: Filesystem persistence layer managing `.syncytium/` (rules, ADRs, lock, handoff history).
  - `engine.ts`: Core orchestrator providing `init`, `sync`, `diff`, `doctor`, `lint`, `handoff`, `lock`, `listRules`, and `startUiServer`.
  - `templates.ts`: Embedded starter templates for TypeScript, Python, Go, Rust, and generic stacks.
- `src/adapters/`:
  - `registry.ts`: Pluggable adapter registry.
  - Adapter implementations for Cursor, Claude Code, GitHub Copilot, Cline, Google Antigravity, Windsurf, Trae, and OpenCode.
- `src/ui/`:
  - `template.ts`: Embedded Obsidian-style dark mode single-page application with 2D physics graph and detail drawer.
- `src/cli/`: Command-line entry point with interactive prompt wizards.
- `src/mcp/`: Headless runtime server exposing autonomous tools to AI agents.
