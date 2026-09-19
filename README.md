<div align="center">

# 🧬 SyncytiumMD

### The Universal Context Engine & Multi-Agent Handoff Protocol for AI-Assisted Development

[![NPM Version](https://img.shields.io/npm/v/syncytium-md?color=6366f1&style=for-the-badge&logo=npm)](https://www.npmjs.com/package/syncytium-md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=for-the-badge&logo=node.js)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](tsconfig.json)
[![Architecture](https://img.shields.io/badge/Architecture-Zero--Budget%20Engineered-orange?style=for-the-badge)](architecture.md)

<p align="center">
  <b>Unify fragmented rulebases across Cursor, Claude Code, GitHub Copilot, Cline, and Antigravity into a single canonical brain — complete with lease-based collision locks, baton-passing handoffs, and an interactive 3D WebGL knowledge galaxy.</b>
</p>

[Quick Start](#-quick-start) • [Why SyncytiumMD?](#-the-problem-context-fragmentation--agent-collisions) • [Key Architecture](#-core-features) • [3D Galaxy View](#-3d-visual-knowledge-galaxy) • [API Grant Request](#-open-call-for-api-grants--research-sponsorship)

</div>

---

> [!IMPORTANT]
> **What is a "Syncytium"?**  
> In biology, a *syncytium* is a single multinucleated cell formed by the fusion of multiple cells, allowing shared cytoplasm and coordinated pulses of action. **SyncytiumMD** applies this biological paradigm to software engineering: fusing fragmented AI coding agents into a single, cohesive, collision-free nervous system.

---

## 🌪️ The Problem: Context Fragmentation & Agent Collisions

Modern engineering teams rarely use a single AI tool. Developers switch between **Cursor** for inline completions, **Claude Code** for large-scale CLI terminal refactors, **GitHub Copilot** inside VSCode/JetBrains, **Cline/Roo Code** for autonomous iterations, and **Antigravity** for complex multi-step reasoning.

This multi-agent reality introduces three critical points of failure:

1. **Fragmented Rules & Context Drift:** Canonical guidelines are scattered across `.cursorrules`, `CLAUDE.md`, `.clinerules`, and `.github/copilot-instructions.md`. Updating a standard in one file leaves other agents working on stale, contradictory rules.
2. **Multi-Agent Race Conditions:** When multiple autonomous agents (or human-agent pairs) operate on the same repository concurrently, they overwrite each other’s work with zero lease awareness or lock coordination.
3. **Black-Box Architectural Memory:** Architecture Decision Records (ADRs) and ongoing task states remain invisible to the developer, leading to duplicated reasoning tokens and redundant LLM API calls.

```
❌ WITHOUT SYNCYTIUM-MD (Fragmented Chaos)
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ .cursorrules │     │  CLAUDE.md   │     │  .clinerules │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │ (Stale)            │ (Out of Sync)      │ (Conflicting)
       ▼                    ▼                    ▼
   [Cursor AI]         [Claude Code]          [Cline]
       │                    │                    │
       └───────────┬────────┴────────────────────┘
                   ▼
       💥 Race Conditions & Overwritten Commits

─────────────────────────────────────────────────────────────

✅ WITH SYNCYTIUM-MD (Single Source of Truth)
            ┌─────────────────────────────┐
            │   .syncytium/ (The Brain)   │
            │  Rules • ADRs • Live Lock   │
            └──────────────┬──────────────┘
                           │ ⚡ Bidirectional Sync (Transpiler)
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐     ┌───────────┐     ┌───────────┐
   │  Cursor   │     │Claude Code│     │Copilot/MCP│
   └───────────┘     └───────────┘     └───────────┘
         │                 │                 │
         └─────────► [Lease-Based Lock] ◄────┘
                  Zero Collisions & Full State Transfer
```

---

## ⚡ Core Features

### 1. 🔄 Bi-Directional Canonical Transpiler
Store your engineering standards, formatting guidelines, and security policies once inside `.syncytium/rules/` as clean, frontmatter-enriched Markdown. SyncytiumMD automatically transpiles and distributes compliant formats across:
- **Cursor** (`.cursor/rules/*.mdc` & `.cursorrules`)
- **Claude Code** (`CLAUDE.md`)
- **GitHub Copilot** (`.github/copilot-instructions.md`)
- **Cline / Roo Code** (`.clinerules`)
- **Google Antigravity** (`.gemini/antigravity/rules/*.md`)
- **Windsurf** (`.windsurfrules`)
- **Trae** (`.traerules`)
- **OpenCode** (`AGENT.md` & `CONVENTIONS.md`)

### 2. 🔒 Lease-Based Multi-Agent Collision Lock (`syncytium lock`)
Prevents concurrent agents from destroying active work in progress:
- **Time-Bounded Leases:** Acquire an exclusive execution lock for a specified duration (e.g., 30–60 min).
- **Auto-Expiration:** If an agent or session dies unexpectedly, locks expire safely without blocking the repository indefinitely.
- **Audit Traceability:** Inspect lock states, active goals, and session owners in real-time.

```bash
# Acquire lock before autonomous execution
npx syncytium lock acquire --agent ClaudeCode --goal "Refactoring Auth Middleware" --lease 45

# Verify lock status
npx syncytium lock status

# Safe release upon task completion
npx syncytium lock release --agent ClaudeCode
```

### 3. 🤝 The Baton Protocol: Structured Multi-Agent Handoff (`syncytium handoff`)
Pass live tasks, touchsets, and operational context seamlessly between distinct LLM architectures:
- **CLI & Interactive TUI:** Run `syncytium handoff -i` for an intuitive terminal prompt wizard.
- **Top-of-Chat Injection:** Generates active handoff state directly injected into the target tool's prompt buffer.
- **Milestone History:** Maintains an append-only JSON audit trail of task transitions, completed subtasks, and architectural deviations.

### 4. 🌌 3D WebGL Knowledge Galaxy (`syncytium graph`)
Visualizes your entire engineering topology as an interactive 3D celestial galaxy inside the browser:
- **Real-Time Physics Simulation:** Built on Three.js with bounded, softened Coulomb repulsion and velocity damping (zero node drift or canvas fly-away).
- **Relational Node Clusters:** Visualizes Project Brain Core, Canonical Rules, Tag Categories, Architectural Decisions (ADRs), Active Agents, and Generated Bridge Targets.
- **Live SSE Sync:** Modifying any rule or handoff on disk updates the 3D space in real-time without refreshing.
- **Deep Inspector Drawer:** Click any node or search to smoothly fly the camera to it, rendering markdown content and connected node dependencies.

### 5. 🛠️ Autonomous MCP Server (`syncytium-mcp`)
Native Model Context Protocol integration exposing headless endpoints to agents like Claude Desktop, Cursor, or Cline:
- `syncytium_get_context`: Query rules, architecture, and current handoff state.
- `syncytium_handoff`: Programmatically yield control to the next agent.
- `syncytium_record_decision`: Auto-commit ADRs directly from chat conversations.
- `syncytium_get_graph`: Fetch topological knowledge graph data as structured JSON.
- `syncytium_diff`: Verify context drift between target bridge files and canonical storage.

---

## 📐 Architecture & Directory Structure

SyncytiumMD treats the filesystem as an immutable database and git as a decentralized transport layer:

```
my-project/
├── .syncytium/                     # 🧠 Single Source of Truth
│   ├── syncytium.config.json       # Project-wide adapter configurations
│   ├── architecture.md             # High-level architecture & stack boundaries
│   ├── HANDOFF.md                  # Live handoff state (active agent, goal, files)
│   ├── rules/                      # Canonical Markdown Rules
│   │   ├── code-style.md           # Enforced naming, typing & formatting
│   │   ├── security.md             # Secret sanitation, authentication rules
│   │   └── testing-standards.md    # Coverage & test execution guidelines
│   └── memory/
│       ├── decisions.md            # Lightweight Architectural Decision Records (ADR)
│       ├── lock.json               # Active agent lease lock metadata
│       └── handoff-history.json    # Append-only multi-agent audit trail
│
├── .syncytiumignore                 # Selective ignore manifest for generated files
│
├── .cursor/rules/*.mdc             # ⚡ Auto-generated by SyncytiumMD
├── CLAUDE.md                       # ⚡ Auto-generated by SyncytiumMD
├── .clinerules                     # ⚡ Auto-generated by SyncytiumMD
└── .github/copilot-instructions.md # ⚡ Auto-generated by SyncytiumMD
```

---

## 🚀 Quick Start

Get up and running in your repository in under 60 seconds:

### 1. Initialize Canonical Brain
```bash
# Detects your technology stack (TypeScript, Python, Go, Rust) automatically:
npx syncytium init
```

### 2. Synchronize Bridge Files
```bash
# Transpiles canonical rules to all active AI tool files across your project:
npx syncytium sync
```

### 3. Launch 3D Knowledge Galaxy
```bash
# Opens the interactive 3D WebGL knowledge visualizer on http://localhost:3737:
npx syncytium graph
```

### 4. Continuous Guardrails & CI
```bash
# Validate rule schema and heal frontmatter issues:
npx syncytium lint --fix

# Install pre-commit hook to prevent context drift:
npx syncytium hook install

# Generate GitHub Actions CI workflow:
npx syncytium ci
```

---

## 💡 Engineering Under Zero Budget: Our Philosophy

SyncytiumMD is intentionally engineered with **zero external runtime dependencies for its core servers**, prioritizing performance, longevity, and sustainability:

- **Ultra-Lightweight Footprint:** Built on native Node.js APIs (`node:http`, `node:readline/promises`, `node:fs/promises`).
- **No Heavy Middlewares:** Zero Express, Nest, or heavy Docker containers required to run the local UI, linter, or MCP bridge.
- **Free-Tier Resilient:** Optimized to run within standard developer workstations and resource-constrained CI environments without incurring cloud infrastructure bills.

---

## 🤝 Open Call for API Grants & Research Sponsorship

> [!NOTE]
> ### 📢 Dear AI Foundations, Model Providers & Developer Tools Teams:
> **(OpenAI, Anthropic, Groq, OpenRouter, Mistral, Google DeepMind, Cohere)**
>
> SyncytiumMD is an independent, community-driven open-source initiative developed by engineers dedicated to solving the real-world fragmentation of the AI coding ecosystem.
>
> **We are NOT asking for cash donations or venture equity.**  
>
> To push this project to its next frontier, we are seeking **API Token Grants and Model Evaluation Credits**:
> - **Multi-Agent Collision Benchmarking:** Stress-testing autonomous handoffs across hundreds of concurrent turns between different models (e.g., Claude 3.7 Sonnet, GPT-4.5, DeepSeek-R1, and ultra-fast inference via Groq).
> - **Self-Healing Linter Accuracy:** Fine-tuning and verifying rule repair routines across diverse multilingual codebases (TypeScript, Python, Go, Rust, C++).
> - **Context Drift Prevention Metrics:** Developing automated testbeds to quantify context degradation during multi-agent session transfers.
>
> If your organization provides developer grants, startup credits, or open-source research sponsorships, your support will directly fund our automated evaluation runners and benchmark testbeds.
>
> **Contact:** [Reach out via GitHub Issues](https://github.com/mrcbrbn5361/SyncytiumMD/issues) or directly via LinkedIn: [linkedin.com/in/mrcbrbn5361](https://www.linkedin.com/in/mrcbrbn5361).

---

## 🗺️ Roadmap

- [x] Canonical Rules Transpiler (8+ AI coding adapters)
- [x] Lease-based Multi-Agent Collision Lock (`syncytium lock`)
- [x] Interactive Terminal Handoff Wizard (`syncytium handoff -i`)
- [x] Full Model Context Protocol (MCP) Autonomous Server
- [x] 3D WebGL Force-Directed Knowledge Galaxy (`syncytium graph`)
- [x] Automated CI Pipeline Generator (`syncytium ci`)
- [ ] **v0.2.0:** Extended Adapters: Continue.dev, Zed, OpenHands, Goose, Amazon Q, Void
- [ ] **v0.2.1:** Semantic Vector Search over ADRs and Canonical Rules
- [ ] **v0.3.0:** Distributed Agent Lock Protocol over Git Remote Reflocks

---

## 👥 Contributing

We welcome community contributions from developers, researchers, and prompt engineers!

1. Fork the repository: `https://github.com/mrcbrbn5361/SyncytiumMD`
2. Create your feature branch: `git checkout -b feat/my-new-adapter`
3. Commit your changes: `git commit -m 'feat: add adapter for X'`
4. Verify all tests pass: `npm test`
5. Push to the branch: `git push origin feat/my-new-adapter`
6. Open a Pull Request!

---

## 📄 License

SyncytiumMD is open-source software licensed under the **MIT License**.  
Free for individual developers, open-source contributors, and commercial enterprise engineering teams.

---

<div align="center">
  <sub>Engineered with precision for the next generation of autonomous multi-agent software development.</sub>
</div>
