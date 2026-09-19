export function renderGraphHtml(
  projectName: string,
  initialConfig?: {
    compact?: boolean;
    excludeFiles?: boolean;
    excludeTags?: boolean;
    category?: string;
  }
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 SyncytiumMD Obsidian Studio & 3D Galaxy - ${projectName}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    :root {
      --bg-dark: #07090e;
      --bg-surface: #0c101a;
      --bg-elevated: #131926;
      --bg-hover: #1c2436;
      --panel-border: rgba(99, 102, 241, 0.18);
      --panel-border-bright: rgba(99, 102, 241, 0.45);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.35);
      --ide-color: #38bdf8;
      --cli-color: #fb923c;
      --ext-color: #a855f7;
      --rule-color: #22d3ee;
      --adr-color: #e879f9;
      --agent-color: #34d399;
      --brain-color: #818cf8;
      --tag-color: #fbbf24;
      --file-color: #4ade80;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-dark);
      color: var(--text-main);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    /* Top Studio Header */
    header {
      height: 56px;
      background: rgba(10, 13, 22, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 100;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .brand-icon {
      font-size: 1.25rem;
      filter: drop-shadow(0 0 10px var(--accent));
    }
    .version-tag {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Perspective Switcher Tabs */
    .perspective-nav {
      display: flex;
      align-items: center;
      background: rgba(18, 24, 38, 0.9);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 3px;
      gap: 2px;
    }
    .perspective-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 7px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s ease;
    }
    .perspective-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
    .perspective-btn.active {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tool-btn {
      background: rgba(20, 26, 42, 0.8);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      padding: 6px 11px;
      border-radius: 8px;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s;
    }
    .tool-btn:hover {
      background: var(--bg-hover);
      border-color: var(--panel-border-bright);
    }
    .tool-btn.active {
      background: var(--accent);
      border-color: #818cf8;
      color: #fff;
      box-shadow: 0 0 12px var(--accent-glow);
    }
    .status-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--agent-color);
      background: rgba(16, 185, 129, 0.12);
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-weight: 600;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--agent-color);
      box-shadow: 0 0 8px var(--agent-color);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }

    /* Main Studio Workspace Layout */
    #studio-layout {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }

    /* Left Panel: Obsidian Vault File Explorer */
    #vault-sidebar {
      width: 290px;
      background: rgba(11, 15, 24, 0.94);
      backdrop-filter: blur(20px);
      border-right: 1px solid var(--panel-border);
      display: flex;
      flex-direction: column;
      z-index: 20;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
    }
    #vault-sidebar.collapsed {
      transform: translateX(-100%);
      width: 0;
      padding: 0;
      overflow: hidden;
      border-right: none;
    }

    .sidebar-header-box {
      padding: 12px 14px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sidebar-heading {
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-dim);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .vault-search-box {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .vault-search-input {
      width: 100%;
      background: rgba(18, 24, 38, 0.9);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.78rem;
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
    }
    .vault-search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 10px var(--accent-glow);
    }

    .vault-tree {
      flex: 1;
      overflow-y: auto;
      padding: 8px 6px;
      user-select: none;
    }
    .vault-tree::-webkit-scrollbar {
      width: 4px;
    }
    .vault-tree::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .tree-folder {
      margin-bottom: 4px;
    }
    .tree-folder-title {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .tree-folder-title:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
    }
    .tree-folder-arrow {
      font-size: 0.65rem;
      transition: transform 0.18s;
      width: 12px;
      text-align: center;
    }
    .tree-folder.open > .tree-folder-title > .tree-folder-arrow {
      transform: rotate(90deg);
    }
    .tree-folder-content {
      display: none;
      padding-left: 14px;
      margin-top: 2px;
    }
    .tree-folder.open > .tree-folder-content {
      display: block;
    }

    .tree-file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 0.76rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
      margin-bottom: 1px;
    }
    .tree-file-item:hover {
      background: var(--bg-hover);
      color: #fff;
    }
    .tree-file-item.active {
      background: rgba(99, 102, 241, 0.22);
      border: 1px solid var(--panel-border-bright);
      color: #fff;
      font-weight: 600;
    }
    .tree-file-name {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tree-badge {
      font-size: 0.65rem;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    /* Center: 3D WebGL Canvas Container */
    #center-viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at center, #0c101c 0%, #07090e 100%);
    }
    #webgl-canvas-box {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    /* HUD Overlay Controls */
    .hud-controls {
      position: absolute;
      top: 14px;
      left: 16px;
      display: flex;
      gap: 8px;
      z-index: 10;
    }
    .hud-stats-card {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(11, 15, 25, 0.85);
      border: 1px solid var(--panel-border);
      backdrop-filter: blur(14px);
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.72rem;
      display: flex;
      gap: 16px;
      color: var(--text-muted);
      z-index: 10;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .hud-stats-card strong {
      color: #fff;
    }

    .hud-perspective-badge {
      position: absolute;
      top: 14px;
      right: 16px;
      background: rgba(15, 21, 35, 0.88);
      border: 1px solid var(--panel-border-bright);
      backdrop-filter: blur(14px);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.74rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 10;
      box-shadow: 0 0 16px var(--accent-glow);
    }

    /* Hover Tooltip */
    #hover-tooltip {
      position: absolute;
      display: none;
      pointer-events: none;
      z-index: 1000;
      background: rgba(13, 17, 28, 0.95);
      border: 1px solid var(--panel-border-bright);
      backdrop-filter: blur(14px);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.7);
      white-space: nowrap;
      transform: translate(14px, -50%);
    }

    /* Right Panel: Obsidian Markdown Document Studio */
    #doc-sidebar {
      width: 420px;
      background: rgba(12, 16, 26, 0.96);
      backdrop-filter: blur(24px);
      border-left: 1px solid var(--panel-border);
      display: flex;
      flex-direction: column;
      z-index: 20;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
    }
    #doc-sidebar.collapsed {
      transform: translateX(100%);
      width: 0;
      padding: 0;
      overflow: hidden;
      border-left: none;
    }

    .doc-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .doc-title-box {
      flex: 1;
      overflow: hidden;
    }
    .doc-breadcrumbs {
      font-size: 0.7rem;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    .doc-badge-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .doc-type-badge {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .doc-origin-badge {
      font-size: 0.68rem;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 600;
    }

    .doc-content-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px;
      font-size: 0.85rem;
      line-height: 1.6;
      color: #cbd5e1;
      user-select: text;
    }
    .doc-content-body::-webkit-scrollbar {
      width: 6px;
    }
    .doc-content-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    /* Markdown Rich Styling */
    .doc-content-body h1, .doc-content-body h2, .doc-content-body h3 {
      color: #fff;
      margin-top: 18px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .doc-content-body h1 { font-size: 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 6px; }
    .doc-content-body h2 { font-size: 1.05rem; }
    .doc-content-body h3 { font-size: 0.92rem; }
    .doc-content-body p { margin-bottom: 12px; }
    .doc-content-body ul, .doc-content-body ol { margin-left: 20px; margin-bottom: 12px; }
    .doc-content-body li { margin-bottom: 4px; }
    .doc-content-body blockquote {
      border-left: 3px solid var(--accent);
      background: rgba(99, 102, 241, 0.08);
      padding: 8px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
      color: #e2e8f0;
    }
    .doc-content-body code {
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.82rem;
      color: #38bdf8;
    }
    .doc-content-body pre {
      background: #06080d;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px 14px;
      overflow-x: auto;
      margin-bottom: 14px;
    }
    .doc-content-body pre code {
      background: transparent;
      padding: 0;
      color: #f1f5f9;
      font-size: 0.8rem;
    }
    .meta-card {
      background: rgba(18, 24, 38, 0.7);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.78rem;
    }
    .meta-row {
      display: flex;
      margin-bottom: 4px;
      gap: 8px;
    }
    .meta-key {
      color: var(--text-dim);
      font-weight: 600;
      min-width: 80px;
    }
    .meta-val {
      color: #fff;
    }

    .connected-nodes-box {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .connected-title {
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      margin-bottom: 8px;
    }
    .node-pill-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .node-pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.74rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .node-pill:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 10px var(--accent-glow);
    }

    /* Cosmic Loading Overlay */
    #loader-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, #0f172a 0%, #07090e 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .loader-spinner {
      width: 52px;
      height: 52px;
      border: 3px solid rgba(99, 102, 241, 0.18);
      border-top-color: var(--accent);
      border-right-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      box-shadow: 0 0 24px var(--accent-glow);
    }
    .loader-title {
      margin-top: 18px;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .loader-sub {
      margin-top: 6px;
      font-size: 0.8rem;
      color: var(--text-dim);
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="loader-overlay">
    <div class="loader-spinner"></div>
    <div class="loader-title">🌌 Syncytium Obsidian Studio</div>
    <div class="loader-sub">Loading Universal Brain & 3D Knowledge Cosmos...</div>
  </div>

  <div id="hover-tooltip"></div>

  <!-- Studio Header -->
  <header>
    <div class="header-left">
      <div class="brand-logo">
        <span class="brand-icon">🧬</span>
        <span>SyncytiumMD</span>
      </div>
      <span class="version-tag">${projectName} 0.1.8</span>
    </div>

    <!-- Multi-Tool Perspective Selector -->
    <nav class="perspective-nav">
      <button class="perspective-btn active" data-perspective="all" title="View entire multi-agent brain cosmos">
        🌌 Universal Brain
      </button>
      <button class="perspective-btn" data-perspective="ide" title="Isolate Cursor, Windsurf, Trae IDE adapters">
        🖥️ IDEs
      </button>
      <button class="perspective-btn" data-perspective="cli" title="Isolate Claude Code, Antigravity, OpenCode CLIs">
        ⌨️ CLIs
      </button>
      <button class="perspective-btn" data-perspective="extension" title="Isolate GitHub Copilot & Cline / Roo Code extensions">
        🧩 VSCode Extensions
      </button>
      <button class="perspective-btn" data-perspective="brain" title="Focus exclusively on canonical .syncytium/ source of truth">
        📜 Core Vault (.syncytium)
      </button>
    </nav>

    <div class="header-right">
      <button class="tool-btn active" id="toggle-vault-btn" title="Toggle Obsidian File Explorer">📂 Vault</button>
      <button class="tool-btn" id="compact-btn" title="Toggle Compact Mode">⚡ Compact</button>
      <button class="tool-btn" id="reset-cam-btn" title="Reset View">🎯 Center</button>
      <button class="tool-btn" id="auto-rotate-btn" title="Toggle Auto-Orbit">🔄 Orbit</button>
      <button class="tool-btn active" id="toggle-doc-btn" title="Toggle Document Studio">📄 Inspector</button>

      <div class="status-live">
        <div class="pulse-dot"></div>
        <span>Live SSE</span>
      </div>
    </div>
  </header>

  <!-- Studio Layout -->
  <div id="studio-layout">
    <!-- Left Panel: Obsidian Vault File Explorer -->
    <aside id="vault-sidebar">
      <div class="sidebar-header-box">
        <span class="sidebar-heading">📁 OBSIDIAN VAULT EXPLORER</span>
        <span id="vault-file-count" style="font-size: 0.7rem; color: var(--text-dim);">0 files</span>
      </div>
      <div class="vault-search-box">
        <input type="text" id="vault-search" class="vault-search-input" placeholder="Filter files in vault (rules, ADRs, bridges)..." />
      </div>
      <div class="vault-tree" id="vault-tree-root">
        <!-- Built dynamically from graphData -->
      </div>
    </aside>

    <!-- Center Viewport: 3D Three.js Canvas -->
    <main id="center-viewport">
      <div id="webgl-canvas-box"></div>

      <div class="hud-perspective-badge" id="hud-perspective-badge">
        <span>🌌 Perspective: Universal Brain</span>
      </div>

      <div class="hud-stats-card">
        <div>Nodes: <strong id="stat-nodes">0</strong></div>
        <div>Connections: <strong id="stat-edges">0</strong></div>
        <div>Rules: <strong id="stat-rules">0</strong></div>
        <div>ADRs: <strong id="stat-adrs">0</strong></div>
      </div>
    </main>

    <!-- Right Panel: Obsidian Markdown Document Studio -->
    <aside id="doc-sidebar">
      <div class="doc-header">
        <div class="doc-title-box">
          <div class="doc-breadcrumbs" id="doc-breadcrumbs">
            <span>.syncytium</span> <span>/</span> <span>architecture.md</span>
          </div>
          <div class="doc-title" id="doc-title">Select a node or file</div>
          <div class="doc-badge-row">
            <span class="doc-type-badge" id="doc-type-badge" style="background: var(--accent); color: #fff;">BRAIN</span>
            <span class="doc-origin-badge" id="doc-origin-badge">Canonical Source of Truth</span>
          </div>
        </div>
      </div>
      <div class="doc-content-body" id="doc-content-body">
        <p style="color: var(--text-muted); font-style: italic;">
          Click any file in the left Obsidian Vault Explorer or click any node in the 3D Knowledge Galaxy to view its full Markdown guidelines, ADR context, and transpiled bridge links.
        </p>
      </div>
    </aside>
  </div>

  <script>
    const initialConfig = ${JSON.stringify(initialConfig || {})};

    // Color Palette
    const COLOR_HEX = {
      root: 0x6366f1,
      rule: 0x22d3ee,
      tag: 0xfbbf24,
      decision: 0xe879f9,
      agent: 0x34d399,
      adapter: 0xf43f5e,
      file: 0x4ade80,
      ide: 0x38bdf8,
      cli: 0xfb923c,
      extension: 0xa855f7
    };

    const RADIUS_MAP = {
      root: 15,
      rule: 8,
      decision: 8,
      agent: 9,
      adapter: 8,
      tag: 5,
      file: 5
    };

    let graphData = { nodes: [], edges: [] };
    let currentPerspective = initialConfig.category || 'all';
    let compactMode = Boolean(initialConfig.compact);
    let activeFilters = new Set(['root', 'rule', 'decision', 'agent', 'adapter']);
    if (!compactMode && !initialConfig.excludeFiles) activeFilters.add('file');
    if (!compactMode && !initialConfig.excludeTags) activeFilters.add('tag');

    let selectedNode = null;
    let autoRotate = true;

    // Physics Simulation Alpha
    let simulationAlpha = 1.0;
    const MIN_ALPHA = 0.0035;
    let isPhysicsSleeping = false;

    function wakePhysics(alpha = 0.4) {
      simulationAlpha = Math.max(simulationAlpha, alpha);
      isPhysicsSleeping = false;
    }

    // Geometry and Material Pooling
    const sharedSphereGeo = new THREE.SphereGeometry(1, 16, 16);
    const materialCache = new Map();

    function getNodeMaterial(node) {
      let key = node.type;
      if (node.type === 'adapter' && node.metadata?.category) {
        key = node.metadata.category;
      }
      let mat = materialCache.get(key);
      if (!mat) {
        const color = COLOR_HEX[key] || COLOR_HEX[node.type] || 0x6366f1;
        mat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: node.type === 'root' ? 0.65 : 0.28,
          roughness: 0.35,
          metalness: 0.35
        });
        materialCache.set(key, mat);
      }
      return mat;
    }

    // Three.js Engine Variables
    let scene, camera, renderer;
    let nodeMeshMap = new Map();
    let edgeLineSegments;
    let starfieldMesh;
    let raycaster, mouse;
    let hoveredMesh = null;
    let lastClientX = 0, lastClientY = 0;

    // 3D Spherical Orbit Camera
    let camRadius = 380;
    let camTheta = 0.5;
    let camPhi = 1.2;
    let targetLookAt = new THREE.Vector3(0, 0, 0);
    let currentLookAt = new THREE.Vector3(0, 0, 0);

    // Mouse Interaction
    let isMouseDown = false;
    let mouseButton = 0;
    let prevMouseX = 0, prevMouseY = 0;

    // Smooth camera fly
    let isFlying = false;
    let flyTargetPos = new THREE.Vector3();
    let flyTargetLook = new THREE.Vector3();

    function initThree() {
      const container = document.getElementById('webgl-canvas-box');
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || (window.innerHeight - 56);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07090e, 0.0012);

      camera = new THREE.PerspectiveCamera(55, width / height, 1, 3000);
      updateCameraPos();

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x07090e, 1);
      container.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0x6366f1, 0.85);
      dirLight1.position.set(200, 300, 200);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
      dirLight2.position.set(-200, -200, -200);
      scene.add(dirLight2);

      createStarfield();

      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      window.addEventListener('resize', onWindowResize);
      setupControls(renderer.domElement);
    }

    function createStarfield() {
      const starCount = 1200;
      const starGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 2400;
        positions[i + 1] = (Math.random() - 0.5) * 2400;
        positions[i + 2] = (Math.random() - 0.5) * 2400;
      }

      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 2,
        transparent: true,
        opacity: 0.6
      });
      starfieldMesh = new THREE.Points(starGeo, starMat);
      scene.add(starfieldMesh);
    }

    function updateCameraPos() {
      if (isFlying) return;
      camera.position.x = currentLookAt.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
      camera.position.y = currentLookAt.y + camRadius * Math.cos(camPhi);
      camera.position.z = currentLookAt.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
      camera.lookAt(currentLookAt);
    }

    function setupControls(dom) {
      dom.addEventListener('contextmenu', e => e.preventDefault());

      dom.addEventListener('mousedown', e => {
        isMouseDown = true;
        mouseButton = e.button;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        isFlying = false;
        wakePhysics(0.2);
      });

      window.addEventListener('mousemove', e => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        const rect = dom.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (!isMouseDown) {
          handleHover();
          return;
        }

        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        if (mouseButton === 0) {
          // Orbit
          camTheta -= deltaX * 0.007;
          camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi - deltaY * 0.007));
        } else if (mouseButton === 2) {
          // Pan
          const panSpeed = 0.4;
          const forward = new THREE.Vector3().subVectors(targetLookAt, camera.position).normalize();
          const side = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
          const up = new THREE.Vector3().crossVectors(side, forward).normalize();
          targetLookAt.addScaledVector(side, -deltaX * panSpeed);
          targetLookAt.addScaledVector(up, deltaY * panSpeed);
        }
      });

      window.addEventListener('mouseup', () => {
        isMouseDown = false;
      });

      dom.addEventListener('wheel', e => {
        e.preventDefault();
        camRadius *= (e.deltaY > 0 ? 1.08 : 0.92);
        camRadius = Math.max(60, Math.min(1200, camRadius));
        isFlying = false;
      }, { passive: false });

      dom.addEventListener('click', e => {
        raycaster.setFromCamera(mouse, camera);
        const meshes = Array.from(nodeMeshMap.values())
          .filter(entry => entry.group.visible)
          .map(entry => entry.sphereMesh);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
          const clickedMesh = intersects[0].object;
          const node = clickedMesh.userData.node;
          if (node) {
            selectNode(node);
          }
        }
      });
    }

    function handleHover() {
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(nodeMeshMap.values())
        .filter(entry => entry.group.visible)
        .map(entry => entry.sphereMesh);
      const intersects = raycaster.intersectObjects(meshes);
      const tooltip = document.getElementById('hover-tooltip');

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const node = hit.userData.node;

        if (hoveredMesh !== hit) {
          if (hoveredMesh && (!selectedNode || hoveredMesh.userData.node?.id !== selectedNode.id)) {
            const baseRad = hoveredMesh.userData.radius || 6;
            hoveredMesh.scale.setScalar(baseRad);
          }
          hoveredMesh = hit;
          const rad = hit.userData.radius || 6;
          hoveredMesh.scale.setScalar(rad * 1.35);
          document.body.style.cursor = 'pointer';
        }

        if (tooltip && node) {
          const colorHex = '#' + (COLOR_HEX[node.type] || 0x6366f1).toString(16).padStart(6, '0');
          const connCount = graphData.edges.filter(e => e.source === node.id || e.target === node.id).length;
          tooltip.innerHTML = '<span>' + escapeHtml(node.label) + '</span><span style="background:' + colorHex + '; color:#000; font-size:0.65rem; padding:2px 5px; border-radius:4px; margin-left:6px; font-weight:700;">' + node.type.toUpperCase() + ' (' + connCount + ')</span>';
          tooltip.style.left = lastClientX + 'px';
          tooltip.style.top = lastClientY + 'px';
          tooltip.style.display = 'block';
        }
      } else {
        if (hoveredMesh && (!selectedNode || hoveredMesh.userData.node?.id !== selectedNode.id)) {
          const baseRad = hoveredMesh.userData.radius || 6;
          hoveredMesh.scale.setScalar(baseRad);
        }
        hoveredMesh = null;
        document.body.style.cursor = 'default';
        if (tooltip) tooltip.style.display = 'none';
      }
    }

    function onWindowResize() {
      const container = document.getElementById('webgl-canvas-box');
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    // Force-Directed Physics Simulation
    function initPhysicsPositions() {
      const n = graphData.nodes.length;
      graphData.nodes.forEach((node, i) => {
        if (node.x === undefined) {
          if (node.type === 'root') {
            node.x = 0; node.y = 0; node.z = 0;
          } else {
            const phi = Math.acos(-1 + (2 * i) / n);
            const theta = Math.sqrt(n * Math.PI) * phi;
            const rad = 70 + Math.random() * 100;
            node.x = rad * Math.cos(theta) * Math.sin(phi);
            node.y = rad * Math.sin(theta) * Math.sin(phi);
            node.z = rad * Math.cos(phi);
          }
          node.vx = 0; node.vy = 0; node.vz = 0;
        }
      });
      wakePhysics(1.0);
    }

    function step3DPhysics() {
      if (simulationAlpha < MIN_ALPHA) {
        isPhysicsSleeping = true;
        return false;
      }

      const nodes = graphData.nodes.filter(n => activeFilters.has(n.type));
      const edges = graphData.edges;
      const cutoff = 240;
      const cutoffSq = cutoff * cutoff;

      // Softened Repulsion with threshold cutoff
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          if (Math.abs(dx) > cutoff) continue;
          const dy = b.y - a.y;
          if (Math.abs(dy) > cutoff) continue;
          const dz = b.z - a.z;
          if (Math.abs(dz) > cutoff) continue;

          const distSq = dx * dx + dy * dy + dz * dz + 400;
          if (distSq < cutoffSq) {
            const dist = Math.sqrt(distSq);
            const repForce = ((cutoff - dist) / dist) * 0.024 * simulationAlpha;
            const fx = dx * repForce;
            const fy = dy * repForce;
            const fz = dz * repForce;

            a.vx -= fx; a.vy -= fy; a.vz -= fz;
            b.vx += fx; b.vy += fy; b.vz += fz;
          }
        }
      }

      // Spring Attraction
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const springAlpha = 0.0024 * simulationAlpha;
      edges.forEach(edge => {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const targetDist = 65;
        const springForce = (dist - targetDist) * springAlpha;

        const fx = dx * springForce;
        const fy = dy * springForce;
        const fz = dz * springForce;

        a.vx += fx; a.vy += fy; a.vz += fz;
        b.vx -= fx; b.vy -= fy; b.vz += fz;
      });

      // Damping & Center Gravity
      const maxSpeed = 1.8;
      nodes.forEach(node => {
        if (node.type === 'root') {
          node.x = 0; node.y = 0; node.z = 0;
          return;
        }

        node.vx -= node.x * 0.0012 * simulationAlpha;
        node.vy -= node.y * 0.0012 * simulationAlpha;
        node.vz -= node.z * 0.0012 * simulationAlpha;

        node.vx *= 0.88;
        node.vy *= 0.88;
        node.vz *= 0.88;

        node.vx = Math.max(-maxSpeed, Math.min(maxSpeed, node.vx));
        node.vy = Math.max(-maxSpeed, Math.min(maxSpeed, node.vy));
        node.vz = Math.max(-maxSpeed, Math.min(maxSpeed, node.vz));

        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;

        const curDist = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
        if (curDist > 300) {
          const scale = 300 / curDist;
          node.x *= scale;
          node.y *= scale;
          node.z *= scale;
        }
      });

      simulationAlpha *= 0.985;
      return true;
    }

    function build3DScene() {
      nodeMeshMap.forEach(entry => {
        scene.remove(entry.group);
      });
      nodeMeshMap.clear();

      if (edgeLineSegments) {
        scene.remove(edgeLineSegments);
        edgeLineSegments.geometry.dispose();
      }

      initPhysicsPositions();
      const totalNodes = graphData.nodes.length;

      graphData.nodes.forEach(node => {
        const radius = RADIUS_MAP[node.type] || 6;
        const color = COLOR_HEX[node.type] || 0xffffff;

        const group = new THREE.Group();

        // Unit Sphere Mesh
        const sphereMesh = new THREE.Mesh(sharedSphereGeo, getNodeMaterial(node));
        sphereMesh.scale.setScalar(radius);
        sphereMesh.userData = { node, radius };
        group.add(sphereMesh);

        // Core Pulse Ring
        if (node.type === 'root') {
          const ringGeo = new THREE.TorusGeometry(radius * 1.6, 0.8, 12, 48);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2.5;
          group.add(ringMesh);
          group.userData.ring = ringMesh;
        }

        // LOD Sprite Labels
        let labelSprite = null;
        const isCoreNode = (node.type === 'root' || node.type === 'rule' || node.type === 'decision' || node.type === 'agent' || node.type === 'adapter');
        if (isCoreNode || totalNodes < 35) {
          labelSprite = createTextSprite(node.label, color);
          labelSprite.position.set(0, radius + 7, 0);
          group.add(labelSprite);
        }

        group.position.set(node.x, node.y, node.z);
        scene.add(group);

        nodeMeshMap.set(node.id, { group, sphereMesh, labelSprite, node });
      });

      rebuildEdgeLines();
    }

    function createTextSprite(text, colorHex) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
      ctx.roundRect ? ctx.roundRect(4, 4, 248, 56, 12) : ctx.rect(4, 4, 248, 56);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.length > 20 ? text.substring(0, 19) + '…' : text, 128, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(30, 7.5, 1);
      return sprite;
    }

    function rebuildEdgeLines() {
      if (edgeLineSegments) {
        scene.remove(edgeLineSegments);
      }

      const visibleNodeIds = new Set(graphData.nodes.filter(n => activeFilters.has(n.type)).map(n => n.id));
      const validEdges = graphData.edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
      const positions = new Float32Array(validEdges.length * 6);
      const colors = new Float32Array(validEdges.length * 6);

      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      edgeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const edgeMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });

      edgeLineSegments = new THREE.LineSegments(edgeGeo, edgeMat);
      scene.add(edgeLineSegments);
    }

    function updateEdgeLines() {
      if (!edgeLineSegments) return;
      const visibleNodeIds = new Set(graphData.nodes.filter(n => activeFilters.has(n.type)).map(n => n.id));
      const validEdges = graphData.edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

      const posAttr = edgeLineSegments.geometry.attributes.position;
      const colAttr = edgeLineSegments.geometry.attributes.color;
      if (!posAttr || posAttr.count !== validEdges.length * 2) {
        rebuildEdgeLines();
        return;
      }

      const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
      let idx = 0;

      validEdges.forEach(edge => {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return;

        posAttr.setXYZ(idx, a.x, a.y, a.z);
        posAttr.setXYZ(idx + 1, b.x, b.y, b.z);

        const isHighlight = selectedNode && (selectedNode.id === a.id || selectedNode.id === b.id);
        const col = isHighlight ? 0.95 : 0.25;
        colAttr.setXYZ(idx, col, col * 0.8, 1);
        colAttr.setXYZ(idx + 1, col, col * 0.8, 1);

        idx += 2;
      });

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    function animate() {
      requestAnimationFrame(animate);

      const physicsActive = step3DPhysics();
      if (physicsActive) {
        nodeMeshMap.forEach(entry => {
          const node = entry.node;
          const visible = activeFilters.has(node.type);
          entry.group.visible = visible;
          if (visible) {
            entry.group.position.set(node.x, node.y, node.z);
          }
        });
        updateEdgeLines();
      }

      const rootEntry = nodeMeshMap.get('project-root');
      if (rootEntry && rootEntry.group.userData.ring) {
        rootEntry.group.userData.ring.rotation.z += 0.015;
      }

      if (starfieldMesh) {
        starfieldMesh.rotation.y += 0.0003;
      }

      if (autoRotate && !isMouseDown && !isFlying) {
        camTheta += 0.0015;
      }

      if (isFlying) {
        camera.position.lerp(flyTargetPos, 0.06);
        currentLookAt.lerp(flyTargetLook, 0.06);
        camera.lookAt(currentLookAt);

        if (camera.position.distanceTo(flyTargetPos) < 2) {
          isFlying = false;
          const offset = new THREE.Vector3().subVectors(camera.position, currentLookAt);
          camRadius = offset.length();
          camPhi = Math.acos(Math.max(-1, Math.min(1, offset.y / camRadius)));
          camTheta = Math.atan2(offset.x, offset.z);
        }
      } else {
        currentLookAt.lerp(targetLookAt, 0.08);
        updateCameraPos();
      }

      renderer.render(scene, camera);
    }

    // Node & Document Selection
    async function selectNode(node) {
      selectedNode = node;
      wakePhysics(0.35);

      // Focus camera in 3D
      flyTargetLook.set(node.x, node.y, node.z);
      const normal = new THREE.Vector3(node.x, node.y, node.z).normalize();
      if (normal.lengthSq() < 0.1) normal.set(0, 0.4, 1).normalize();
      flyTargetPos.copy(flyTargetLook).addScaledVector(normal, 120);
      isFlying = true;

      // Update Obsidian File Explorer active state
      document.querySelectorAll('.tree-file-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-id') === node.id);
      });

      // Render in Obsidian Markdown Document Studio
      await openDocumentStudio(node);
    }

    async function openDocumentStudio(node) {
      const docBreadcrumbs = document.getElementById('doc-breadcrumbs');
      const docTitle = document.getElementById('doc-title');
      const docTypeBadge = document.getElementById('doc-type-badge');
      const docOriginBadge = document.getElementById('doc-origin-badge');
      const docBody = document.getElementById('doc-content-body');

      // Expand right sidebar if collapsed
      const sidebar = document.getElementById('doc-sidebar');
      if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        document.getElementById('toggle-doc-btn').classList.add('active');
        onWindowResize();
      }

      const filePath = node.metadata?.path || node.label;
      docBreadcrumbs.innerHTML = escapeHtml(filePath).split('/').join(' <span style="color: var(--text-dim)">/</span> ');
      docTitle.textContent = node.label;

      const typeColor = COLOR_HEX[node.type] || 0x6366f1;
      docTypeBadge.textContent = node.type.toUpperCase();
      docTypeBadge.style.background = '#' + typeColor.toString(16).padStart(6, '0');
      docTypeBadge.style.color = '#000';

      const isBrainMaster = node.metadata?.category === 'brain' || node.metadata?.category === 'rule' || node.metadata?.category === 'decision' || node.metadata?.category === 'architecture' || node.metadata?.category === 'agent';
      docOriginBadge.textContent = isBrainMaster ? '🧠 Canonical Source of Truth (.syncytium)' : ('⚡ Transpiled from .syncytium/ (' + (node.metadata?.category || 'Bridge') + ')');
      docOriginBadge.style.color = isBrainMaster ? '#a5b4fc' : '#4ade80';

      let html = '';

      // Metadata card
      if (node.metadata) {
        html += '<div class="meta-card">';
        if (node.metadata.category) html += '<div class="meta-row"><span class="meta-key">Category:</span><span class="meta-val">' + escapeHtml(node.metadata.category.toUpperCase()) + '</span></div>';
        if (node.metadata.path) html += '<div class="meta-row"><span class="meta-key">Path:</span><code style="color: #38bdf8;">' + escapeHtml(node.metadata.path) + '</code></div>';
        if (node.metadata.globs) html += '<div class="meta-row"><span class="meta-key">Target Globs:</span><span class="meta-val">' + escapeHtml(node.metadata.globs.join(', ')) + '</span></div>';
        if (node.metadata.tags) html += '<div class="meta-row"><span class="meta-key">Tags:</span><span class="meta-val">' + escapeHtml(node.metadata.tags.map(t => '#' + t).join(' ')) + '</span></div>';
        if (node.metadata.status) html += '<div class="meta-row"><span class="meta-key">Status:</span><span class="meta-val">[' + escapeHtml(node.metadata.status.toUpperCase()) + ']</span></div>';
        html += '</div>';
      }

      // Content preview: direct from metadata or fetch via /api/file
      let content = node.metadata?.content;
      if (!content && node.metadata?.path) {
        try {
          const res = await fetch('/api/file?path=' + encodeURIComponent(node.metadata.path));
          if (res.ok) {
            const data = await res.json();
            content = data.content;
          }
        } catch {}
      }

      if (content) {
        html += '<div>' + renderMarkdownToHtml(content) + '</div>';
      } else if (node.description) {
        html += '<p>' + escapeHtml(node.description) + '</p>';
      }

      // Connected Nodes section
      const connections = graphData.edges.filter(e => e.source === node.id || e.target === node.id);
      if (connections.length > 0) {
        html += '<div class="connected-nodes-box"><div class="connected-title">Connected Brain Nodes (' + connections.length + ')</div><div class="node-pill-list">';
        const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
        connections.forEach(edge => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          const other = nodeMap.get(otherId);
          if (other) {
            html += '<div class="node-pill" onclick="selectNodeById(\\'' + other.id + '\\')"><span>' + escapeHtml(other.label) + '</span><span style="color: var(--text-dim); font-size: 0.65rem;">' + other.type + '</span></div>';
          }
        });
        html += '</div></div>';
      }

      docBody.innerHTML = html;
    }

    window.selectNodeById = function(id) {
      const node = graphData.nodes.find(n => n.id === id);
      if (node) {
        selectNode(node);
      }
    };

    // Obsidian Vault Tree Generator
    function buildVaultTree() {
      const container = document.getElementById('vault-tree-root');
      let html = '';

      // 1. Central Brain (.syncytium/)
      const brainRules = graphData.nodes.filter(n => n.type === 'rule');
      const brainDecisions = graphData.nodes.filter(n => n.type === 'decision');

      html += '<div class="tree-folder open">';
      html += '  <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🧠 .syncytium (Ortak Beyin)</span></div>';
      html += '  <div class="tree-folder-content">';

      // Rules folder
      html += '    <div class="tree-folder open">';
      html += '      <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>📁 rules/ (' + brainRules.length + ')</span></div>';
      html += '      <div class="tree-folder-content">';
      brainRules.forEach(rule => {
        html += '        <div class="tree-file-item" data-id="' + rule.id + '" onclick="selectNodeById(\\'' + rule.id + '\\')">';
        html += '          <span class="tree-file-name">📄 ' + escapeHtml(rule.label) + '</span>';
        html += '          <span class="tree-badge" style="background: rgba(34, 211, 238, 0.2); color: #22d3ee;">RULE</span>';
        html += '        </div>';
      });
      html += '      </div>';
      html += '    </div>';

      // Memory folder
      html += '    <div class="tree-folder open">';
      html += '      <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>📁 memory/ (ADRs & Lock)</span></div>';
      html += '      <div class="tree-folder-content">';
      brainDecisions.forEach(dec => {
        html += '        <div class="tree-file-item" data-id="' + dec.id + '" onclick="selectNodeById(\\'' + dec.id + '\\')">';
        html += '          <span class="tree-file-name">⚖️ ' + escapeHtml(dec.label) + '</span>';
        html += '          <span class="tree-badge" style="background: rgba(232, 121, 249, 0.2); color: #e879f9;">ADR</span>';
        html += '        </div>';
      });
      html += '      </div>';
      html += '    </div>';

      // System files
      const archNode = graphData.nodes.find(n => n.id === 'doc:architecture');
      if (archNode) {
        html += '    <div class="tree-file-item" data-id="' + archNode.id + '" onclick="selectNodeById(\\'' + archNode.id + '\\')">';
        html += '      <span class="tree-file-name">🏛️ architecture.md</span><span class="tree-badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">DOC</span>';
        html += '    </div>';
      }

      const agentNode = graphData.nodes.find(n => n.type === 'agent');
      if (agentNode) {
        html += '    <div class="tree-file-item" data-id="' + agentNode.id + '" onclick="selectNodeById(\\'' + agentNode.id + '\\')">';
        html += '      <span class="tree-file-name">🤝 HANDOFF.md</span><span class="tree-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">HANDOFF</span>';
        html += '    </div>';
      }

      html += '  </div>';
      html += '</div>';

      // 2. IDEs Folder
      const ideAdapters = graphData.nodes.filter(n => n.type === 'adapter' && n.metadata?.category === 'ide');
      if (ideAdapters.length > 0) {
        html += '<div class="tree-folder open">';
        html += '  <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🖥️ IDEs Context (' + ideAdapters.length + ')</span></div>';
        html += '  <div class="tree-folder-content">';
        ideAdapters.forEach(adp => {
          const bridgeFiles = graphData.edges.filter(e => e.source === adp.id && e.type === 'generates').map(e => e.target);
          html += '    <div class="tree-folder open">';
          html += '      <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🔹 ' + escapeHtml(adp.label) + '</span></div>';
          html += '      <div class="tree-folder-content">';
          bridgeFiles.forEach(fileId => {
            const fNode = graphData.nodes.find(n => n.id === fileId);
            if (fNode) {
              html += '        <div class="tree-file-item" data-id="' + fNode.id + '" onclick="selectNodeById(\\'' + fNode.id + '\\')">';
              html += '          <span class="tree-file-name">⚡ ' + escapeHtml(fNode.label) + '</span><span class="tree-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">IDE</span>';
              html += '        </div>';
            }
          });
          html += '      </div>';
          html += '    </div>';
        });
        html += '  </div>';
        html += '</div>';
      }

      // 3. CLIs Folder
      const cliAdapters = graphData.nodes.filter(n => n.type === 'adapter' && (n.metadata?.category === 'cli' || n.metadata?.category === 'agent'));
      if (cliAdapters.length > 0) {
        html += '<div class="tree-folder open">';
        html += '  <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>⌨️ CLIs Context (' + cliAdapters.length + ')</span></div>';
        html += '  <div class="tree-folder-content">';
        cliAdapters.forEach(adp => {
          const bridgeFiles = graphData.edges.filter(e => e.source === adp.id && e.type === 'generates').map(e => e.target);
          html += '    <div class="tree-folder open">';
          html += '      <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🔸 ' + escapeHtml(adp.label) + '</span></div>';
          html += '      <div class="tree-folder-content">';
          bridgeFiles.forEach(fileId => {
            const fNode = graphData.nodes.find(n => n.id === fileId);
            if (fNode) {
              html += '        <div class="tree-file-item" data-id="' + fNode.id + '" onclick="selectNodeById(\\'' + fNode.id + '\\')">';
              html += '          <span class="tree-file-name">⚡ ' + escapeHtml(fNode.label) + '</span><span class="tree-badge" style="background: rgba(251, 146, 60, 0.2); color: #fb923c;">CLI</span>';
              html += '        </div>';
            }
          });
          html += '      </div>';
          html += '    </div>';
        });
        html += '  </div>';
        html += '</div>';
      }

      // 4. VSCode Extensions Folder
      const extAdapters = graphData.nodes.filter(n => n.type === 'adapter' && n.metadata?.category === 'extension');
      if (extAdapters.length > 0) {
        html += '<div class="tree-folder open">';
        html += '  <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🧩 VSCode Extensions (' + extAdapters.length + ')</span></div>';
        html += '  <div class="tree-folder-content">';
        extAdapters.forEach(adp => {
          const bridgeFiles = graphData.edges.filter(e => e.source === adp.id && e.type === 'generates').map(e => e.target);
          html += '    <div class="tree-folder open">';
          html += '      <div class="tree-folder-title" onclick="toggleFolder(this)"><span class="tree-folder-arrow">▶</span><span>🟣 ' + escapeHtml(adp.label) + '</span></div>';
          html += '      <div class="tree-folder-content">';
          bridgeFiles.forEach(fileId => {
            const fNode = graphData.nodes.find(n => n.id === fileId);
            if (fNode) {
              html += '        <div class="tree-file-item" data-id="' + fNode.id + '" onclick="selectNodeById(\\'' + fNode.id + '\\')">';
              html += '          <span class="tree-file-name">⚡ ' + escapeHtml(fNode.label) + '</span><span class="tree-badge" style="background: rgba(168, 85, 247, 0.2); color: #a855f7;">EXT</span>';
              html += '        </div>';
            }
          });
          html += '      </div>';
          html += '    </div>';
        });
        html += '  </div>';
        html += '</div>';
      }

      container.innerHTML = html;
      document.getElementById('vault-file-count').textContent = graphData.nodes.length + ' nodes';
    }

    window.toggleFolder = function(el) {
      el.parentElement.classList.toggle('open');
    };

    // Filter tree via search
    document.getElementById('vault-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.tree-file-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
      });
    });

    // Perspective Filter Switcher
    document.querySelectorAll('.perspective-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.perspective-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentPerspective = btn.getAttribute('data-perspective');
        const badge = document.getElementById('hud-perspective-badge');
        const titles = {
          all: '🌌 Perspective: Universal Brain (All)',
          ide: '🖥️ Perspective: IDEs Cosmos',
          cli: '⌨️ Perspective: CLIs Cosmos',
          extension: '🧩 Perspective: VSCode Extensions',
          brain: '📜 Perspective: Central Brain Vault (.syncytium)'
        };
        badge.innerHTML = '<span>' + (titles[currentPerspective] || currentPerspective) + '</span>';

        await fetchGraph();
      });
    });

    // Toggle Sidebars
    document.getElementById('toggle-vault-btn').addEventListener('click', (e) => {
      const sidebar = document.getElementById('vault-sidebar');
      sidebar.classList.toggle('collapsed');
      e.target.classList.toggle('active', !sidebar.classList.contains('collapsed'));
      setTimeout(onWindowResize, 300);
    });

    document.getElementById('toggle-doc-btn').addEventListener('click', (e) => {
      const sidebar = document.getElementById('doc-sidebar');
      sidebar.classList.toggle('collapsed');
      e.target.classList.toggle('active', !sidebar.classList.contains('collapsed'));
      setTimeout(onWindowResize, 300);
    });

    document.getElementById('compact-btn').addEventListener('click', (e) => {
      compactMode = !compactMode;
      e.target.classList.toggle('active', compactMode);
      if (compactMode) {
        activeFilters.delete('file');
        activeFilters.delete('tag');
      } else {
        activeFilters.add('file');
        activeFilters.add('tag');
      }
      nodeMeshMap.forEach(entry => {
        entry.group.visible = activeFilters.has(entry.node.type);
      });
      rebuildEdgeLines();
      wakePhysics(0.5);
    });

    document.getElementById('reset-cam-btn').addEventListener('click', () => {
      targetLookAt.set(0, 0, 0);
      camRadius = 380;
      camTheta = 0.5;
      camPhi = 1.2;
      isFlying = false;
      wakePhysics(0.3);
    });

    document.getElementById('auto-rotate-btn').addEventListener('click', (e) => {
      autoRotate = !autoRotate;
      e.target.classList.toggle('active', autoRotate);
    });

    // Simple, robust Markdown parser
    function renderMarkdownToHtml(md) {
      if (!md) return '';
      let escaped = escapeHtml(md);

      // Fenced code blocks
      escaped = escaped.replace(new RegExp('\\x60\\x60\\x60([^\\n]*)\\n([\\s\\S]*?)\\x60\\x60\\x60', 'g'), '<pre><code>$2</code></pre>');

      // Inline code
      escaped = escaped.replace(new RegExp('\\x60([^\\x60]+)\\x60', 'g'), '<code>$1</code>');

      // Headers
      escaped = escaped.replace(/^### (.*$)/gm, '<h3>$1</h3>');
      escaped = escaped.replace(/^## (.*$)/gm, '<h2>$1</h2>');
      escaped = escaped.replace(/^# (.*$)/gm, '<h1>$1</h1>');

      // Blockquotes
      escaped = escaped.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

      // Unordered lists
      escaped = escaped.replace(/^[ \t]*-[ \t]+(.*$)/gm, '<li>$1</li>');

      // Bold & Italic
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      // Horizontal rules
      escaped = escaped.replace(/^---$/gm, '<hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:16px 0;" />');

      // Line breaks
      escaped = escaped.split('\n\n').join('<br><br>');

      return escaped;
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Data Fetching
    async function fetchGraph() {
      try {
        let url = '/api/graph?category=' + encodeURIComponent(currentPerspective);
        if (compactMode) url += '&compact=true';

        const res = await fetch(url);
        const newData = await res.json();

        // Preserve coordinates
        const oldPosMap = new Map(graphData.nodes.map(n => [n.id, { x: n.x, y: n.y, z: n.z, vx: n.vx, vy: n.vy, vz: n.vz }]));
        newData.nodes.forEach(n => {
          const old = oldPosMap.get(n.id);
          if (old) {
            n.x = old.x; n.y = old.y; n.z = old.z;
            n.vx = old.vx; n.vy = old.vy; n.vz = old.vz;
          }
        });

        graphData = newData;
        build3DScene();
        buildVaultTree();
        updateHud();

        const loader = document.getElementById('loader-overlay');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 400);
        }
      } catch (e) {
        console.error('Failed to load graph', e);
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.remove();
      }
    }

    function updateHud() {
      document.getElementById('stat-nodes').textContent = graphData.nodes.length;
      document.getElementById('stat-edges').textContent = graphData.edges.length;
      document.getElementById('stat-rules').textContent = graphData.stats?.rulesCount || 0;
      document.getElementById('stat-adrs').textContent = graphData.stats?.decisionsCount || 0;
    }

    function setupSse() {
      const es = new EventSource('/api/events');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'reload') {
            fetchGraph();
          }
        } catch {}
      };
      es.onerror = () => {
        setTimeout(setupSse, 3000);
      };
    }

    // Bootstrap
    if (window.THREE) {
      initThree();
      fetchGraph().then(() => {
        animate();
        setupSse();
      });
    }
  </script>
</body>
</html>`;
}
