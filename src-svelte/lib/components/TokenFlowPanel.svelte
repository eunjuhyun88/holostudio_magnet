<script lang="ts">
  import { FLOW_NODES } from '../data/protocolData.ts';

  let hoveredNode: string | null = null;

  const flowNodes = FLOW_NODES;
</script>

<div class="panel flow-panel" style="--panel-delay: 0.5">
  <div class="panel-header">
    <h2>Token Flow</h2>
    <span class="panel-badge live">Live</span>
  </div>

  <div class="flow-viz">
    <svg class="flow-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </radialGradient>

        <!-- Paths for particle animation -->
        <path id="path-poolA" d="M200,200 Q120,120 70,80" fill="none"/>
        <path id="path-poolB" d="M200,200 Q280,120 330,80" fill="none"/>
        <path id="path-burn" d="M200,200 Q280,280 330,320" fill="none"/>
        <path id="path-treasury" d="M200,200 Q120,280 70,320" fill="none"/>
      </defs>

      <!-- Glow behind center -->
      <circle cx="200" cy="200" r="80" fill="url(#center-glow)"/>

      <!-- Orbital lines -->
      <line x1="200" y1="200" x2="70" y2="80" class="flow-line" style="stroke: var(--accent); opacity: 0.15"/>
      <line x1="200" y1="200" x2="330" y2="80" class="flow-line" style="stroke: var(--green); opacity: 0.15"/>
      <line x1="200" y1="200" x2="330" y2="320" class="flow-line" style="stroke: var(--red); opacity: 0.15"/>
      <line x1="200" y1="200" x2="70" y2="320" class="flow-line" style="stroke: var(--gold); opacity: 0.15"/>

      <!-- Animated particles along each path -->
      <!-- Pool A particles -->
      <circle r="4" fill="var(--accent)" opacity="0.9">
        <animateMotion dur="2.5s" repeatCount="indefinite">
          <mpath href="#path-poolA"/>
        </animateMotion>
      </circle>
      <circle r="3" fill="var(--accent)" opacity="0.6">
        <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.8s">
          <mpath href="#path-poolA"/>
        </animateMotion>
      </circle>
      <circle r="2" fill="var(--accent)" opacity="0.4">
        <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.6s">
          <mpath href="#path-poolA"/>
        </animateMotion>
      </circle>

      <!-- Pool B particles -->
      <circle r="4" fill="var(--green)" opacity="0.9">
        <animateMotion dur="3s" repeatCount="indefinite">
          <mpath href="#path-poolB"/>
        </animateMotion>
      </circle>
      <circle r="3" fill="var(--green)" opacity="0.6">
        <animateMotion dur="3s" repeatCount="indefinite" begin="1s">
          <mpath href="#path-poolB"/>
        </animateMotion>
      </circle>
      <circle r="2" fill="var(--green)" opacity="0.4">
        <animateMotion dur="3s" repeatCount="indefinite" begin="2s">
          <mpath href="#path-poolB"/>
        </animateMotion>
      </circle>

      <!-- Burn particles -->
      <circle r="4" fill="var(--red)" opacity="0.9">
        <animateMotion dur="3.5s" repeatCount="indefinite">
          <mpath href="#path-burn"/>
        </animateMotion>
      </circle>
      <circle r="3" fill="var(--red)" opacity="0.6">
        <animateMotion dur="3.5s" repeatCount="indefinite" begin="1.2s">
          <mpath href="#path-burn"/>
        </animateMotion>
      </circle>

      <!-- Treasury particles -->
      <circle r="4" fill="var(--gold)" opacity="0.9">
        <animateMotion dur="4s" repeatCount="indefinite">
          <mpath href="#path-treasury"/>
        </animateMotion>
      </circle>
      <circle r="3" fill="var(--gold)" opacity="0.6">
        <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s">
          <mpath href="#path-treasury"/>
        </animateMotion>
      </circle>

      <!-- Center hub -->
      <circle cx="200" cy="200" r="36" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
      <text x="200" y="197" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-display)" font-size="14" font-weight="700">HOOT</text>
      <text x="200" y="212" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="8">TOKEN</text>

      <!-- Destination: Pool A (top-left) -->
      <g class="dest-group"
        on:mouseenter={() => hoveredNode = 'poolA'}
        on:mouseleave={() => hoveredNode = null}
        role="img"
      >
        <circle cx="70" cy="80" r="30" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.5" class="dest-circle"/>
        <text x="70" y="77" text-anchor="middle" fill="var(--accent)" font-family="var(--font-body)" font-size="10" font-weight="700">Pool A</text>
        <text x="70" y="90" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">42%</text>
      </g>

      <!-- Destination: Pool B (top-right) -->
      <g class="dest-group"
        on:mouseenter={() => hoveredNode = 'poolB'}
        on:mouseleave={() => hoveredNode = null}
        role="img"
      >
        <circle cx="330" cy="80" r="30" fill="var(--surface)" stroke="var(--green)" stroke-width="1.5" class="dest-circle"/>
        <text x="330" y="77" text-anchor="middle" fill="var(--green)" font-family="var(--font-body)" font-size="10" font-weight="700">Pool B</text>
        <text x="330" y="90" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">38%</text>
      </g>

      <!-- Destination: Burn (bottom-right) -->
      <g class="dest-group"
        on:mouseenter={() => hoveredNode = 'burn'}
        on:mouseleave={() => hoveredNode = null}
        role="img"
      >
        <circle cx="330" cy="320" r="30" fill="var(--surface)" stroke="var(--red)" stroke-width="1.5" class="dest-circle"/>
        <text x="330" y="317" text-anchor="middle" fill="var(--red)" font-family="var(--font-body)" font-size="10" font-weight="700">Burn</text>
        <text x="330" y="330" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">12%</text>
      </g>

      <!-- Destination: Treasury (bottom-left) -->
      <g class="dest-group"
        on:mouseenter={() => hoveredNode = 'treasury'}
        on:mouseleave={() => hoveredNode = null}
        role="img"
      >
        <circle cx="70" cy="320" r="30" fill="var(--surface)" stroke="var(--gold)" stroke-width="1.5" class="dest-circle"/>
        <text x="70" y="317" text-anchor="middle" fill="var(--gold)" font-family="var(--font-body)" font-size="10" font-weight="700">Treasury</text>
        <text x="70" y="330" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">8%</text>
      </g>
    </svg>

    <!-- Hover tooltip -->
    {#if hoveredNode}
      <div class="flow-tooltip" class:show={hoveredNode}>
        {#each flowNodes.filter(n => n.id === hoveredNode) as node}
          <strong>{node.label}</strong>
          <span>{node.breakdown}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Panel base */
  .panel {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    transition: box-shadow 300ms ease, transform 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--panel-delay, 0) * 120ms + 200ms) both;
  }
  .panel:hover { box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08)); }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  h2 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .panel-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    border-radius: var(--radius-pill, 100px);
    background: var(--accent-subtle);
    color: var(--accent);
  }
  .panel-badge.live {
    background: rgba(39,134,74,0.1);
    color: var(--green);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .panel-badge.live::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--green);
    animation: breathe 2s infinite;
  }

  /* Flow viz */
  .flow-panel { position: relative; }

  .flow-viz {
    position: relative;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .flow-svg {
    width: 100%;
    height: auto;
  }

  .flow-line {
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .dest-group { cursor: pointer; }
  .dest-circle { transition: all 200ms; }
  .dest-group:hover .dest-circle {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px currentColor);
  }

  .flow-tooltip {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
    white-space: nowrap;
    animation: fadeIn 150ms ease;
    pointer-events: none;
    z-index: 5;
  }

  .flow-tooltip strong { color: var(--text-primary); }
  .flow-tooltip span { color: var(--text-secondary); }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .flow-viz { max-width: 300px; }
  }
</style>
