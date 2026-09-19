export function renderGraphHtml(projectName: string, initialConfig?: { compact?: boolean; excludeFiles?: boolean; excludeTags?: boolean }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 SyncytiumMD Knowledge Graph 3D - ${projectName}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    :root {
      --bg: #07090e;
      --panel-bg: rgba(13, 16, 26, 0.82);
      --panel-border: rgba(99, 102, 241, 0.2);
      --text-main: #f8fafc;
      --text-dim: #94a3b8;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.4);
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

    /* 3D WebGL Canvas Container */
    #webgl-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1;
    }

    /* Top Futuristic Navbar */
    header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 10;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }
    .brand-icon {
      font-size: 1.3rem;
      filter: drop-shadow(0 0 8px var(--accent));
    }
    .brand-badge {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .search-box {
      position: relative;
    }
    .search-input {
      background: rgba(18, 22, 38, 0.9);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      color: #fff;
      padding: 7px 14px 7px 34px;
      font-size: 0.85rem;
      outline: none;
      width: 220px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .search-input:focus {
      border-color: var(--accent);
      width: 280px;
      box-shadow: 0 0 16px var(--accent-glow);
    }
    .search-icon {
      position: absolute;
      left: 12px;
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
      background: rgba(20, 25, 45, 0.7);
      border: 1px solid var(--panel-border);
      color: var(--text-dim);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .pill:hover {
      background: rgba(35, 42, 70, 0.9);
      color: #fff;
    }
    .pill.active {
      color: #fff;
      border-color: currentColor;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
    }
    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .action-btn {
      background: rgba(30, 35, 60, 0.8);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 12px var(--accent-glow);
    }
    .action-btn.active {
      background: var(--accent);
      border-color: #818cf8;
      color: #fff;
      box-shadow: 0 0 14px var(--accent-glow);
    }

    /* Floating Hover Tooltip */
    #hover-tooltip {
      position: absolute;
      display: none;
      pointer-events: none;
      z-index: 1000;
      background: rgba(13, 17, 28, 0.94);
      border: 1px solid var(--panel-border);
      backdrop-filter: blur(12px);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      white-space: nowrap;
      transform: translate(14px, -50%);
    }
    .tooltip-tag {
      font-size: 0.68rem;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--agent-color);
      background: rgba(16, 185, 129, 0.12);
      padding: 5px 12px;
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

    /* Floating HUD Instructions */
    .hud-help {
      position: absolute;
      top: 76px;
      left: 24px;
      background: var(--panel-bg);
      backdrop-filter: blur(14px);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 0.72rem;
      color: var(--text-dim);
      z-index: 5;
      display: flex;
      gap: 14px;
      pointer-events: none;
    }
    .hud-help span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .hud-help strong {
      color: var(--text-main);
    }

    /* Bottom Stats & Legend */
    .hud-stats {
      position: absolute;
      bottom: 24px;
      left: 24px;
      background: var(--panel-bg);
      backdrop-filter: blur(14px);
      border: 1px solid var(--panel-border);
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 0.8rem;
      display: flex;
      gap: 18px;
      color: var(--text-dim);
      pointer-events: none;
      z-index: 5;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    .hud-stats strong {
      color: var(--text-main);
      font-size: 0.9rem;
    }

    .legend {
      position: absolute;
      bottom: 24px;
      right: 24px;
      background: var(--panel-bg);
      backdrop-filter: blur(14px);
      border: 1px solid var(--panel-border);
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 7px;
      z-index: 5;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
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
      box-shadow: 0 0 6px currentColor;
    }

    /* Sidebar Glassmorphism Drawer */
    .sidebar {
      position: absolute;
      top: 76px;
      right: 24px;
      bottom: 24px;
      width: 400px;
      background: rgba(13, 16, 28, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      transform: translateX(440px);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 20;
      user-select: text;
    }
    .sidebar.open {
      transform: translateX(0);
    }

    .sidebar-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .sidebar-title {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.35;
    }
    .sidebar-type {
      display: inline-block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border-radius: 4px;
      margin-top: 6px;
      font-weight: 700;
    }
    .close-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      color: var(--text-dim);
      font-size: 1.2rem;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .close-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #fff;
    }

    .sidebar-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .sidebar-content::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar-content::-webkit-scrollbar-thumb {
      background: var(--panel-border);
      border-radius: 3px;
    }
    .sidebar-section {
      margin-bottom: 20px;
    }
    .sidebar-section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--accent);
      letter-spacing: 0.08em;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .sidebar-content pre {
      background: rgba(7, 9, 16, 0.9);
      padding: 14px;
      border-radius: 10px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8rem;
      color: #e2e8f0;
      margin-top: 8px;
      border: 1px solid var(--panel-border);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .conn-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .conn-item {
      padding: 8px 12px;
      background: rgba(20, 24, 42, 0.7);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      font-size: 0.82rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }
    .conn-item:hover {
      border-color: var(--accent);
      background: rgba(35, 42, 75, 0.9);
      transform: translateX(4px);
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

    /* Fallback notice */
    #fallback-msg {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--panel-bg);
      border: 1px solid #ef4444;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div id="loader-overlay">
    <div class="loader-spinner"></div>
    <div class="loader-title">🌌 Syncytium Cosmos</div>
    <div class="loader-sub">Preparing 3D Knowledge Graph...</div>
  </div>

  <div id="hover-tooltip"></div>

  <header>
    <div class="brand">
      <span class="brand-icon">🧬</span>
      <span>SyncytiumMD</span>
      <span class="brand-badge">${projectName} 3D</span>
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

      <button class="action-btn" id="compact-btn" title="Toggle Compact View (Hides File & Tag clutter)">⚡ Compact View</button>
      <button class="action-btn" id="reset-cam-btn">🎯 Center</button>
      <button class="action-btn" id="auto-rotate-btn">🔄 Orbit</button>

      <div class="status-indicator">
        <div class="pulse-dot"></div>
        <span>Live 3D Sync</span>
      </div>
    </div>
  </header>

  <div class="hud-help">
    <span>🖱️ <strong>Left Click + Drag:</strong> Rotate 3D</span>
    <span>🖱️ <strong>Right Click + Drag:</strong> Pan</span>
    <span>📜 <strong>Scroll:</strong> Zoom</span>
    <span>👆 <strong>Click Node:</strong> Focus & Inspect</span>
  </div>

  <div id="webgl-container"></div>

  <div class="hud-stats">
    <div>Nodes: <strong id="stat-nodes">0</strong></div>
    <div>Connections: <strong id="stat-edges">0</strong></div>
    <div>Rules: <strong id="stat-rules">0</strong></div>
    <div>ADRs: <strong id="stat-adrs">0</strong></div>
  </div>

  <div class="legend">
    <div class="legend-item"><span class="legend-dot" style="color: var(--root-color); background: var(--root-color)"></span> Project Brain Core</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--rule-color); background: var(--rule-color)"></span> Canonical Rule</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--tag-color); background: var(--tag-color)"></span> Tag Cluster</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--decision-color); background: var(--decision-color)"></span> ADR Decision</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--agent-color); background: var(--agent-color)"></span> Active AI Agent</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--adapter-color); background: var(--adapter-color)"></span> Adapter Bridge</div>
    <div class="legend-item"><span class="legend-dot" style="color: var(--file-color); background: var(--file-color)"></span> Bridge File</div>
  </div>

  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div>
        <div class="sidebar-title" id="side-title">Node Title</div>
        <div class="sidebar-type" id="side-type">TYPE</div>
      </div>
      <button class="close-btn" id="close-side-btn">✕</button>
    </div>
    <div class="sidebar-content" id="side-content"></div>
  </aside>

  <div id="fallback-msg">WebGL could not be initialized in this browser.</div>

  <script>
    const initialConfig = ${JSON.stringify(initialConfig || {})};

    // Configuration & Color Palette
    const COLOR_HEX = {
      root: 0x6366f1,
      rule: 0x38bdf8,
      tag: 0xfbbf24,
      decision: 0xc084fc,
      agent: 0x34d399,
      adapter: 0xf43f5e,
      file: 0xa3e635
    };

    const RADIUS_MAP = {
      root: 14,
      rule: 8,
      decision: 8,
      agent: 9,
      adapter: 7,
      tag: 5,
      file: 5
    };

    let graphData = { nodes: [], edges: [] };
    let compactMode = Boolean(initialConfig.compact);
    let activeFilters = new Set(['root', 'rule', 'decision', 'agent', 'adapter']);
    if (!compactMode && !initialConfig.excludeFiles) activeFilters.add('file');
    if (!compactMode && !initialConfig.excludeTags) activeFilters.add('tag');

    let searchQuery = '';
    let selectedNode = null;
    let autoRotate = true;

    // Physics Simulation Alpha (Decay & Sleep mode)
    let simulationAlpha = 1.0;
    const MIN_ALPHA = 0.0035;
    let isPhysicsSleeping = false;

    function wakePhysics(alpha = 0.4) {
      simulationAlpha = Math.max(simulationAlpha, alpha);
      isPhysicsSleeping = false;
    }

    // Geometry and Material Pooling (drastically reduces allocations)
    const sharedSphereGeo = new THREE.SphereGeometry(1, 16, 16);
    const materialCache = new Map();

    function getNodeMaterial(type) {
      let mat = materialCache.get(type);
      if (!mat) {
        const color = COLOR_HEX[type] || 0x6366f1;
        mat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: type === 'root' ? 0.65 : 0.28,
          roughness: 0.35,
          metalness: 0.35
        });
        materialCache.set(type, mat);
      }
      return mat;
    }

    // Three.js 3D Engine Variables
    let scene, camera, renderer;
    let nodeMeshMap = new Map();
    let edgeLineSegments;
    let starfieldMesh;
    let raycaster, mouse;
    let hoveredMesh = null;
    let lastClientX = 0;
    let lastClientY = 0;

    // 3D Camera Spherical Coordinates
    let camRadius = 380;
    let camTheta = 0.5;
    let camPhi = 1.2;
    let targetLookAt = new THREE.Vector3(0, 0, 0);
    let currentLookAt = new THREE.Vector3(0, 0, 0);

    // Mouse Interaction
    let isMouseDown = false;
    let mouseButton = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;

    // Camera fly-to target
    let isFlying = false;
    let flyTargetPos = new THREE.Vector3();
    let flyTargetLook = new THREE.Vector3();

    function initThree() {
      const container = document.getElementById('webgl-container');
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 1. Scene
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07090e, 0.0012);

      // 2. Camera
      camera = new THREE.PerspectiveCamera(55, width / height, 1, 3000);
      updateCameraPos();

      // 3. Renderer with powerPreference: high-performance
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x07090e, 1);
      container.appendChild(renderer.domElement);

      // 4. Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0x6366f1, 0.85);
      dirLight1.position.set(200, 300, 200);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
      dirLight2.position.set(-200, -200, -200);
      scene.add(dirLight2);

      // 5. Starfield Background
      createStarfield();

      // 6. Raycasting
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      // 7. Event Listeners
      window.addEventListener('resize', onWindowResize);
      setupControls(renderer.domElement);

      // Setup Compact button state
      syncCompactButtonState();
    }

    function syncCompactButtonState() {
      const btn = document.getElementById('compact-btn');
      if (btn) {
        btn.classList.toggle('active', compactMode);
      }
      document.querySelectorAll('.filter-pills .pill').forEach(pill => {
        const type = pill.getAttribute('data-type');
        pill.classList.toggle('active', activeFilters.has(type));
      });
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
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        if (!isMouseDown) {
          handleHover();
          return;
        }

        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        if (mouseButton === 0) {
          // Left click: Orbit
          camTheta -= deltaX * 0.007;
          camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi - deltaY * 0.007));
        } else if (mouseButton === 2) {
          // Right click: Pan
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
        const meshes = Array.from(nodeMeshMap.values()).map(entry => entry.sphereMesh);
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
          tooltip.innerHTML = '<span>' + escapeHtml(node.label) + '</span><span class="tooltip-tag" style="background:' + colorHex + '; color:#000;">' + node.type + ' (' + connCount + ')</span>';
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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Stable 3D Force-Directed Simulation
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

    // Step physics with strict bounds, alpha decay and sleeping
    function step3DPhysics() {
      if (simulationAlpha < MIN_ALPHA) {
        isPhysicsSleeping = true;
        return false;
      }

      const nodes = graphData.nodes.filter(n => activeFilters.has(n.type));
      const edges = graphData.edges;
      const cutoff = 240;
      const cutoffSq = cutoff * cutoff;

      // 1. Softened Repulsion with distance threshold cutoff
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

      // 2. Spring Attraction along Edges
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
        b.vx -= fx; b.vy -= fy; b.vz -= fz;
      });

      // 3. Center Gravity & Velocity Clamping
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

        // Bounding sphere
        const curDist = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
        if (curDist > 300) {
          const scale = 300 / curDist;
          node.x *= scale;
          node.y *= scale;
          node.z *= scale;
        }
      });

      // Cool simulation down gradually
      simulationAlpha *= 0.985;
      return true;
    }

    // Build 3D Meshes from graphData with geometry/material pooling
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

      // Create Meshes using shared unit geometry & cached materials
      graphData.nodes.forEach(node => {
        const radius = RADIUS_MAP[node.type] || 6;
        const color = COLOR_HEX[node.type] || 0xffffff;

        const group = new THREE.Group();

        // 1. Pooled 3D Sphere Mesh
        const sphereMesh = new THREE.Mesh(sharedSphereGeo, getNodeMaterial(node.type));
        sphereMesh.scale.setScalar(radius);
        sphereMesh.userData = { node, radius };
        group.add(sphereMesh);

        // 2. Extra Pulsing Ring for Root Core
        if (node.type === 'root') {
          const ringGeo = new THREE.TorusGeometry(radius * 1.6, 0.8, 12, 48);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2.5;
          group.add(ringMesh);
          group.userData.ring = ringMesh;
        }

        // 3. LOD Text Billboard Sprite Label
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

      ctx.fillStyle = 'rgba(10, 14, 26, 0.78)';
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
        const col = isHighlight ? 0.9 : 0.25;
        colAttr.setXYZ(idx, col, col * 0.8, 1);
        colAttr.setXYZ(idx + 1, col, col * 0.8, 1);

        idx += 2;
      });

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Animation Render Loop with Physics sleeping
    function animate() {
      requestAnimationFrame(animate);

      // 1. Run Physics Step (only updates when active)
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

      // 2. Pulse root ring (minimal overhead)
      const rootEntry = nodeMeshMap.get('syncytium:root');
      if (rootEntry && rootEntry.group.userData.ring) {
        rootEntry.group.userData.ring.rotation.z += 0.015;
      }

      // 3. Starfield slow cosmic rotation
      if (starfieldMesh) {
        starfieldMesh.rotation.y += 0.0003;
      }

      // 4. Auto-orbit camera if enabled
      if (autoRotate && !isMouseDown && !isFlying) {
        camTheta += 0.0015;
      }

      // 5. Smooth camera interpolation
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

    // Selection & Sidebar
    function selectNode(node) {
      selectedNode = node;
      openSidebar(node);
      wakePhysics(0.3);

      flyTargetLook.set(node.x, node.y, node.z);
      const normal = new THREE.Vector3(node.x, node.y, node.z).normalize();
      if (normal.lengthSq() < 0.1) normal.set(0, 0.4, 1).normalize();
      flyTargetPos.copy(flyTargetLook).addScaledVector(normal, 120);
      isFlying = true;
    }

    function openSidebar(node) {
      const sidebar = document.getElementById('sidebar');
      const sideTitle = document.getElementById('side-title');
      const sideType = document.getElementById('side-type');
      const sideContent = document.getElementById('side-content');

      sideTitle.textContent = node.label;
      sideType.textContent = node.type;
      sideType.style.background = '#' + (COLOR_HEX[node.type] || 0x6366f1).toString(16).padStart(6, '0');
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

      // Connections
      const connections = graphData.edges.filter(e => e.source === node.id || e.target === node.id);
      if (connections.length > 0) {
        html += '<div class="sidebar-section"><div class="sidebar-section-title">Connected Nodes (' + connections.length + ')</div><ul class="conn-list">';
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
        selectNode(node);
      }
    };

    document.getElementById('close-side-btn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      selectedNode = null;
    });

    document.getElementById('reset-cam-btn').addEventListener('click', () => {
      targetLookAt.set(0, 0, 0);
      camRadius = 380;
      camTheta = 0.5;
      camPhi = 1.2;
      isFlying = false;
      wakePhysics(0.25);
    });

    document.getElementById('auto-rotate-btn').addEventListener('click', (e) => {
      autoRotate = !autoRotate;
      e.target.style.background = autoRotate ? 'var(--accent)' : 'rgba(30, 35, 60, 0.8)';
    });

    // Compact Mode Toggle Button
    document.getElementById('compact-btn').addEventListener('click', () => {
      compactMode = !compactMode;
      if (compactMode) {
        activeFilters.delete('file');
        activeFilters.delete('tag');
      } else {
        activeFilters.add('file');
        activeFilters.add('tag');
      }
      syncCompactButtonState();
      nodeMeshMap.forEach(entry => {
        entry.group.visible = activeFilters.has(entry.node.type);
      });
      rebuildEdgeLines();
      wakePhysics(0.5);
    });

    // Filter pills
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
        nodeMeshMap.forEach(entry => {
          entry.group.visible = activeFilters.has(entry.node.type);
        });
        rebuildEdgeLines();
        wakePhysics(0.4);
      });
    });

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      if (searchQuery) {
        const match = graphData.nodes.find(n => activeFilters.has(n.type) && n.label.toLowerCase().includes(searchQuery));
        if (match) {
          flyTargetLook.set(match.x, match.y, match.z);
          flyTargetPos.set(match.x, match.y, match.z + 140);
          isFlying = true;
          wakePhysics(0.3);
        }
      }
    });

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Data Fetching & SSE
    async function fetchGraph() {
      try {
        const res = await fetch('/api/graph');
        const newData = await res.json();

        // Preserve physics coordinates for existing nodes
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
        updateHud();

        // Smoothly dismiss loader overlay
        const loader = document.getElementById('loader-overlay');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 400);
        }
      } catch (e) {
        console.error('Failed to load 3D graph data', e);
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
    } else {
      document.getElementById('fallback-msg').style.display = 'block';
    }
  </script>
</body>
</html>`;
}
