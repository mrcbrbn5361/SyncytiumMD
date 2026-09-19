export function renderGraphHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 SyncytiumMD Knowledge Graph - ${projectName}</title>
  <style>
    :root {
      --bg: #0f111a;
      --panel-bg: rgba(22, 25, 38, 0.85);
      --panel-border: #2a2e45;
      --text-main: #f1f5f9;
      --text-dim: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --rule-color: #38bdf8;
      --tag-color: #fbbf24;
      --decision-color: #c084fc;
      --agent-color: #34d399;
      --adapter-color: #f43f5e;
      --file-color: #a3e635;
      --root-color: #6366f1;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      user-select: none;
    }

    /* Top Navbar */
    header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: var(--panel-bg);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .brand-badge {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .search-box {
      position: relative;
    }
    .search-input {
      background: #181b2a;
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      color: #fff;
      padding: 6px 12px 6px 30px;
      font-size: 0.85rem;
      outline: none;
      width: 220px;
      transition: all 0.2s;
    }
    .search-input:focus {
      border-color: var(--accent);
      width: 280px;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
    }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    .filter-pills {
      display: flex;
      gap: 6px;
    }
    .pill {
      background: #181b2a;
      border: 1px solid var(--panel-border);
      color: var(--text-dim);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }
    .pill.active {
      color: #fff;
      border-color: currentColor;
    }
    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--agent-color);
      background: rgba(52, 211, 153, 0.1);
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid rgba(52, 211, 153, 0.2);
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--agent-color);
      box-shadow: 0 0 8px var(--agent-color);
    }

    /* Main Graph Canvas */
    #graph-canvas {
      width: 100vw;
      height: 100vh;
      display: block;
      cursor: grab;
    }
    #graph-canvas:active {
      cursor: grabbing;
    }

    /* Sidebar Details Drawer */
    .sidebar {
      position: absolute;
      top: 68px;
      right: 16px;
      bottom: 16px;
      width: 380px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      transform: translateX(410px);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 20;
      user-select: text;
    }
    .sidebar.open {
      transform: translateX(0);
    }

    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .sidebar-title {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1.3;
    }
    .sidebar-type {
      display: inline-block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 4px;
      font-weight: 600;
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .close-btn:hover {
      background: #2a2e45;
      color: #fff;
    }

    .sidebar-content {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .sidebar-content pre {
      background: #141724;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8rem;
      color: #cbd5e1;
      margin-top: 8px;
      border: 1px solid var(--panel-border);
    }
    .sidebar-section {
      margin-bottom: 16px;
    }
    .sidebar-section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-dim);
      letter-spacing: 0.05em;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .conn-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .conn-item {
      padding: 6px 10px;
      background: #181b2a;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      transition: all 0.2s;
    }
    .conn-item:hover {
      border-color: var(--accent);
      background: #202438;
    }

    /* Bottom Info overlay */
    .hud-stats {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: var(--panel-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--panel-border);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.8rem;
      display: flex;
      gap: 16px;
      color: var(--text-dim);
      pointer-events: none;
      z-index: 5;
    }
    .hud-stats strong {
      color: var(--text-main);
    }

    .legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: var(--panel-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--panel-border);
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 5;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🧬 SyncytiumMD</span>
      <span class="brand-badge">${projectName}</span>
    </div>

    <div class="controls">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-input" class="search-input" placeholder="Search rules, tags, ADRs..." />
      </div>

      <div class="filter-pills">
        <div class="pill active" data-type="rule">
          <span class="pill-dot" style="background: var(--rule-color)"></span> Rules
        </div>
        <div class="pill active" data-type="tag">
          <span class="pill-dot" style="background: var(--tag-color)"></span> Tags
        </div>
        <div class="pill active" data-type="decision">
          <span class="pill-dot" style="background: var(--decision-color)"></span> ADRs
        </div>
        <div class="pill active" data-type="agent">
          <span class="pill-dot" style="background: var(--agent-color)"></span> Agents
        </div>
        <div class="pill active" data-type="adapter">
          <span class="pill-dot" style="background: var(--adapter-color)"></span> Adapters
        </div>
        <div class="pill active" data-type="file">
          <span class="pill-dot" style="background: var(--file-color)"></span> Files
        </div>
      </div>

      <div class="status-indicator">
        <div class="pulse-dot"></div>
        <span>Live Sync Active</span>
      </div>
    </div>
  </header>

  <canvas id="graph-canvas"></canvas>

  <div class="hud-stats" id="hud-stats">
    <div>Nodes: <strong id="stat-nodes">0</strong></div>
    <div>Edges: <strong id="stat-edges">0</strong></div>
    <div>Rules: <strong id="stat-rules">0</strong></div>
    <div>ADRs: <strong id="stat-adrs">0</strong></div>
  </div>

  <div class="legend">
    <div class="legend-item"><span class="legend-dot" style="background: var(--root-color)"></span> Project Root</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--rule-color)"></span> Canonical Rule</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--tag-color)"></span> Tag</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--decision-color)"></span> ADR Decision</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--agent-color)"></span> AI Agent / Session</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--adapter-color)"></span> Adapter Bridge</div>
    <div class="legend-item"><span class="legend-dot" style="background: var(--file-color)"></span> Bridge File</div>
  </div>

  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div>
        <div class="sidebar-title" id="side-title">Node Title</div>
        <div class="sidebar-type" id="side-type">TYPE</div>
      </div>
      <button class="close-btn" id="close-side-btn">✕</button>
    </div>
    <div class="sidebar-content" id="side-content">
      <!-- Dynamic details rendered here -->
    </div>
  </aside>

  <script>
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    const sidebar = document.getElementById('sidebar');
    const sideTitle = document.getElementById('side-title');
    const sideType = document.getElementById('side-type');
    const sideContent = document.getElementById('side-content');
    const closeSideBtn = document.getElementById('close-side-btn');
    const searchInput = document.getElementById('search-input');

    const COLOR_MAP = {
      root: '#6366f1',
      rule: '#38bdf8',
      tag: '#fbbf24',
      decision: '#c084fc',
      agent: '#34d399',
      adapter: '#f43f5e',
      file: '#a3e635'
    };

    const RADIUS_MAP = {
      root: 18,
      rule: 12,
      decision: 11,
      agent: 13,
      adapter: 10,
      tag: 8,
      file: 7
    };

    let graphData = { nodes: [], edges: [] };
    let activeFilters = new Set(['root', 'rule', 'tag', 'decision', 'agent', 'adapter', 'file']);
    let searchQuery = '';
    let selectedNode = null;

    // Viewport Transform (Pan & Zoom)
    let zoom = 1;
    let panX = window.innerWidth / 2;
    let panY = window.innerHeight / 2;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let draggedNode = null;

    function resize() {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    window.addEventListener('resize', resize);
    resize();

    // Fetch initial graph data
    async function fetchGraph() {
      try {
        const res = await fetch('/api/graph');
        graphData = await res.json();
        initPhysics();
        updateHud();
      } catch (e) {
        console.error('Failed to load graph data', e);
      }
    }

    function updateHud() {
      document.getElementById('stat-nodes').textContent = graphData.nodes.length;
      document.getElementById('stat-edges').textContent = graphData.edges.length;
      document.getElementById('stat-rules').textContent = graphData.stats?.rulesCount || 0;
      document.getElementById('stat-adrs').textContent = graphData.stats?.decisionsCount || 0;
    }

    // Initialize node positions with radial distribution
    function initPhysics() {
      const n = graphData.nodes.length;
      graphData.nodes.forEach((node, i) => {
        if (node.x === undefined) {
          const angle = (i / n) * Math.PI * 2;
          const radius = node.type === 'root' ? 0 : 80 + Math.random() * 250;
          node.x = Math.cos(angle) * radius;
          node.y = Math.sin(angle) * radius;
          node.vx = 0;
          node.vy = 0;
        }
      });
    }

    // Force-directed simulation step
    function stepPhysics() {
      const nodes = graphData.nodes.filter(n => activeFilters.has(n.type));
      const edges = graphData.edges;

      // 1. Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = (RADIUS_MAP[a.type] || 10) + (RADIUS_MAP[b.type] || 10) + 40;

          if (dist < 350) {
            const force = (350 - dist) / dist * 0.08;
            const fx = dx * force;
            const fy = dy * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // 2. Spring attraction along edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      edges.forEach(edge => {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 70;
        const force = (dist - targetDist) * 0.005;

        const fx = dx * force;
        const fy = dy * force;
        a.vx += fx;
        a.vy += fy;
        b.vx += fx;
        b.vy += fy;
      });

      // 3. Center gravity
      nodes.forEach(node => {
        node.vx -= node.x * 0.001;
        node.vy -= node.y * 0.001;

        // Apply friction
        node.vx *= 0.88;
        node.vy *= 0.88;

        if (node !== draggedNode) {
          node.x += node.vx;
          node.y += node.vy;
        }
      });
    }

    // Render loop
    function render() {
      stepPhysics();

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const visibleNodes = new Set(graphData.nodes.filter(n => activeFilters.has(n.type)).map(n => n.id));
      const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

      // Draw Edges
      graphData.edges.forEach(edge => {
        if (!visibleNodes.has(edge.source) || !visibleNodes.has(edge.target)) return;
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        const isHighlight = selectedNode && (selectedNode.id === src.id || selectedNode.id === tgt.id);
        ctx.strokeStyle = isHighlight ? 'rgba(99, 102, 241, 0.7)' : 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = isHighlight ? 2 : 1;
        ctx.stroke();
      });

      // Draw Nodes
      graphData.nodes.forEach(node => {
        if (!activeFilters.has(node.type)) return;

        const r = RADIUS_MAP[node.type] || 10;
        const color = COLOR_MAP[node.type] || '#fff';
        const matchesSearch = searchQuery && node.label.toLowerCase().includes(searchQuery);
        const isSelected = selectedNode && selectedNode.id === node.id;

        // Glow on hover/selection
        if (isSelected || matchesSearch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(251, 191, 36, 0.3)';
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Outline
        ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // Label
        if (zoom > 0.6 || isSelected || matchesSearch || node.type === 'root') {
          ctx.fillStyle = isSelected ? '#fff' : '#cbd5e1';
          ctx.font = isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y + r + 13);
        }
      });

      ctx.restore();
      requestAnimationFrame(render);
    }

    // Interaction handlers
    function getNodeAt(x, y) {
      const worldX = (x - panX) / zoom;
      const worldY = (y - panY) / zoom;

      for (let i = graphData.nodes.length - 1; i >= 0; i--) {
        const node = graphData.nodes[i];
        if (!activeFilters.has(node.type)) continue;
        const r = RADIUS_MAP[node.type] || 10;
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        if (dx * dx + dy * dy <= (r + 4) * (r + 4)) {
          return node;
        }
      }
      return null;
    }

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = getNodeAt(mouseX, mouseY);
      if (hit) {
        draggedNode = hit;
        selectedNode = hit;
        openSidebar(hit);
      } else {
        isDragging = true;
        dragStartX = mouseX - panX;
        dragStartY = mouseY - panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (draggedNode) {
        draggedNode.x = (mouseX - panX) / zoom;
        draggedNode.y = (mouseY - panY) / zoom;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      } else if (isDragging) {
        panX = mouseX - dragStartX;
        panY = mouseY - dragStartY;
      }
    });

    window.addEventListener('mouseup', () => {
      draggedNode = null;
      isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      panX = mouseX - (mouseX - panX) * zoomFactor;
      panY = mouseY - (mouseY - panY) * zoomFactor;
      zoom *= zoomFactor;
      zoom = Math.max(0.2, Math.min(zoom, 4));
    });

    // Sidebar rendering
    function openSidebar(node) {
      sideTitle.textContent = node.label;
      sideType.textContent = node.type;
      sideType.style.background = COLOR_MAP[node.type];
      sideType.style.color = '#000';

      let html = '';

      if (node.description) {
        html += '<div class="sidebar-section"><div class="sidebar-section-title">Description</div><p>' + escapeHtml(node.description) + '</p></div>';
      }

      if (node.metadata) {
        html += '<div class="sidebar-section"><div class="sidebar-section-title">Metadata</div>';
        for (const [k, v] of Object.entries(node.metadata)) {
          if (k === 'content') continue;
          const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
          html += '<div><strong>' + k + ':</strong> ' + escapeHtml(val) + '</div>';
        }
        html += '</div>';

        if (node.metadata.content) {
          html += '<div class="sidebar-section"><div class="sidebar-section-title">Content / Markdown</div><pre>' + escapeHtml(node.metadata.content) + '</pre></div>';
        }
      }

      // Connected nodes
      const connections = graphData.edges.filter(e => e.source === node.id || e.target === node.id);
      if (connections.length > 0) {
        html += '<div class="sidebar-section"><div class="sidebar-section-title">Connections (' + connections.length + ')</div><ul class="conn-list">';
        const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
        connections.forEach(edge => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          const other = nodeMap.get(otherId);
          if (other) {
            html += '<li class="conn-item" onclick="focusNode(\\'' + other.id + '\\')"><span>' + escapeHtml(other.label) + '</span><span style="color: var(--text-dim)">' + other.type + '</span></li>';
          }
        });
        html += '</ul></div>';
      }

      sideContent.innerHTML = html;
      sidebar.classList.add('open');
    }

    window.focusNode = function(id) {
      const node = graphData.nodes.find(n => n.id === id);
      if (node) {
        selectedNode = node;
        openSidebar(node);
        panX = window.innerWidth / 2 - node.x * zoom;
        panY = window.innerHeight / 2 - node.y * zoom;
      }
    };

    closeSideBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      selectedNode = null;
    });

    // Filter pills toggle
    document.querySelectorAll('.filter-pills .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const type = pill.getAttribute('data-type');
        if (activeFilters.has(type)) {
          activeFilters.delete(type);
          pill.classList.remove('active');
        } else {
          activeFilters.add(type);
          pill.classList.add('active');
        }
      });
    });

    // Search filter
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
    });

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // SSE Live Reload listener
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
    fetchGraph().then(() => {
      requestAnimationFrame(render);
      setupSse();
    });
  </script>
</body>
</html>`;
}
