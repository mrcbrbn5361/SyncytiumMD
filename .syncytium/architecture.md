# System Architecture & Technology Stack

## Overview
Briefly describe the purpose of this project, primary architectural patterns, and system boundaries.

## Technology Stack
- **Runtime:** Node.js (ESM) / TypeScript
- **Frameworks:** Core libraries & CLI
- **Communication:** Model Context Protocol (MCP), File Watchers, Markdown Bridges

## Directory Layout
- `src/`: Source code and adapters
- `.syncytium/`: Single Source of Truth (SSoT) for all AI agents
  - `rules/`: Universal coding and architecture rules
  - `memory/`: Architectural decisions (ADRs) and domain knowledge
  - `HANDOFF.md`: Live agent state and task handoff
