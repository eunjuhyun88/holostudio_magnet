<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Experiment } from '../stores/jobStore.ts';

  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;
  export let width: number = 560;

  // ─── Node Mesh (Top) ───
  const MESH_H = 170;
  const MESH_CX = width / 2;
  const MESH_CY = MESH_H / 2 + 8;
  const MESH_R = 62;
  const NODE_R = 16;

  // Collect unique nodes (max 8 for layout)
  $: allNodes = (() => {
    const map = new Map<string, { id: string; active: boolean; expId: number | null; tier: number; progress: number }>();
    for (const e of experiments) {
      const existing = map.get(e.nodeId);
      if (!existing || e.status === 'training') {
        map.set(e.nodeId, {
          id: e.nodeId,
          active: e.status === 'training',
          expId: e.status === 'training' ? e.id : (existing?.expId ?? null),
          tier: e.tier,
          progress: e.status === 'training' ? e.progress : (existing?.progress ?? 100),
        });
      }
    }
    return [...map.values()].slice(0, 8);
  })();

  $: activeCount = allNodes.filter(n => n.active).length;

  // Position nodes in circle
  $: nodePositions = allNodes.map((n, i) => {
    const angle = (i / Math.max(allNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      x: MESH_CX + Math.cos(angle) * MESH_R,
      y: MESH_CY + Math.sin(angle) * MESH_R,
    };
  });

  // Edges between adjacent nodes
  $: meshEdges = nodePositions.map((n, i) => {
    const next = nodePositions[(i + 1) % nodePositions.length];
    if (!next) return null;
    return { x1: n.x, y1: n.y, x2: next.x, y2: next.y, active: n.active || next.active };
  }).filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; active: boolean }[];

  // Cross edges (every other node)
  $: crossEdges = nodePositions.length >= 4 ? nodePositions
    .filter((_, i) => i % 2 === 0)
    .map((n, i, arr) => {
      const next = arr[(i + 1) % arr.length];
      if (!next) return null;
      return { x1: n.x, y1: n.y, x2: next.x, y2: next.y, active: n.active && next.active };
    }).filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; active: boolean }[] : [];

  // ─── Swarm Convergence (Bottom) ───
  const SWARM_TOP = MESH_H + 16;
  const SWARM_H = 180;
  const SWARM_PAD = { top: 12, right: 16, bottom: 24, left: 44 };

  $: swarmPlotW = width - SWARM_PAD.left - SWARM_PAD.right;
  $: swarmPlotH = SWARM_H - SWARM_PAD.top - SWARM_PAD.bottom;

  // Filter completed + training experiments for swarm
  $: swarmPoints = experiments
    .filter(e => e.status !== 'evaluating')
    .map((e, i) => ({ ...e, order: i }))
    .reverse();

  $: swarmYVals = swarmPoints.filter(p => p.metric > 0).map(p => p.metric);
  $: swarmYMin = swarmYVals.length ? Math.min(...swarmYVals) - 0.02 : 0;
  $: swarmYMax = swarmYVals.length ? Math.max(...swarmYVals) + 0.02 : 2;
  $: swarmYRange = swarmYMax - swarmYMin || 1;

  $: swarmXMax = Math.max(1, swarmPoints.length);

  function swarmSx(idx: number): number {
    return SWARM_PAD.left + (idx / swarmXMax) * swarmPlotW;
  }
  function swarmSy(metric: number): number {
    return SWARM_TOP + SWARM_PAD.top + swarmPlotH - ((metric - swarmYMin) / swarmYRange) * swarmPlotH;
  }

  // Y ticks
  $: swarmYTicks = (() => {
    if (!swarmYVals.length) return [];
    const count = 3;
    const step = swarmYRange / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = swarmYMin + step * i;
      return { val, y: swarmSy(val) };
    });
  })();

  // Estimated metric for training experiments (animated position)
  function estimatedMetric(e: Experiment): number {
    if (e.metric > 0) return e.metric;
    // Estimate based on progress: start high, trend toward current best
    const base = bestMetric === Infinity ? 1.5 : bestMetric + 0.05;
    const target = bestMetric === Infinity ? 1.4 : bestMetric - 0.01;
    return base - (base - target) * (e.progress / 100);
  }

  // Hover state for node ↔ experiment linking
  let hoveredNode: string | null = null;

  function isHighlighted(e: Experiment): boolean {
    if (!hoveredNode) return false;
    return e.nodeId === hoveredNode;
  }

  // Animation tick for training particles
  let tick = 0;
  let animFrame: number;

  function animate() {
    tick++;
    animFrame = requestAnimationFrame(animate);
  }

  let mounted = false;
  onMount(() => {
    mounted = true;
    animate();
  });

  onDestroy(() => {
    if (animFrame) cancelAnimationFrame(animFrame);
  });

  $: totalH = SWARM_TOP + SWARM_H;
</script>

<div class="distributed-container" class:mounted>
  <svg {width} height={totalH} viewBox="0 0 {width} {totalH}" class="distributed-svg">
    <defs>
      <filter id="dv-active-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="rgba(39,134,74,0.5)" />
      </filter>
      <filter id="dv-training-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="rgba(183,134,14,0.6)" />
      </filter>
      <filter id="dv-best-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="rgba(39,134,74,0.55)" />
      </filter>
      <filter id="dv-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="rgba(39,134,74,0.3)" />
      </filter>

      <!-- Particle gradient -->
      <radialGradient id="dv-particle-grad">
        <stop offset="0%" stop-color="#4ade80" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- ═══ Section Label: Mesh ═══ -->
    <text x={12} y={12} fill="var(--text-muted, #9a9590)" font-size="7"
      font-weight="700" font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      letter-spacing="0.1em">GPU MESH</text>
    <text x={width - 12} y={12} text-anchor="end"
      fill={activeCount > 0 ? '#27864a' : 'var(--text-muted, #9a9590)'}
      font-size="7" font-weight="700"
      font-family="var(--font-mono, 'JetBrains Mono', monospace)">
      {activeCount}/{allNodes.length} ACTIVE
    </text>

    <!-- ═══ MESH EDGES ═══ -->
    {#each [...meshEdges, ...crossEdges] as edge, i}
      <line
        x1={edge.x1} y1={edge.y1}
        x2={edge.x2} y2={edge.y2}
        stroke={edge.active ? 'rgba(39,134,74,0.3)' : 'rgba(154,149,144,0.12)'}
        stroke-width={edge.active ? 1.2 : 0.5}
        filter={edge.active ? 'url(#dv-edge-glow)' : undefined}
        class="mesh-edge"
      />
      <!-- Animated particle on active edges -->
      {#if edge.active}
        <circle r="2.5" fill="url(#dv-particle-grad)" class="mesh-particle">
          <animateMotion
            dur="{1.2 + (i % 3) * 0.4}s"
            repeatCount="indefinite"
            path="M{edge.x1},{edge.y1} L{edge.x2},{edge.y2}"
          />
        </circle>
        <circle r="2" fill="url(#dv-particle-grad)" class="mesh-particle" opacity="0.5">
          <animateMotion
            dur="{1.2 + (i % 3) * 0.4}s"
            repeatCount="indefinite"
            begin="{0.6 + (i % 2) * 0.3}s"
            path="M{edge.x2},{edge.y2} L{edge.x1},{edge.y1}"
          />
        </circle>
      {/if}
    {/each}

    <!-- ═══ MESH NODES ═══ -->
    {#each nodePositions as node, i}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <g
        class="mesh-node"
        class:active={node.active}
        on:mouseenter={() => hoveredNode = node.id}
        on:mouseleave={() => hoveredNode = null}
        style="cursor: pointer"
      >
        <!-- Pulse ring for active -->
        {#if node.active}
          <circle cx={node.x} cy={node.y} r={NODE_R + 4}
            fill="none" stroke="#27864a" stroke-width="1" class="node-pulse" />
        {/if}

        <!-- Node circle -->
        <circle
          cx={node.x} cy={node.y} r={NODE_R}
          fill={node.active ? 'rgba(39,134,74,0.12)' : 'rgba(154,149,144,0.04)'}
          stroke={node.active ? '#27864a' : 'rgba(154,149,144,0.2)'}
          stroke-width={node.active ? 1.5 : 0.8}
          filter={node.active ? 'url(#dv-active-glow)' : undefined}
        />

        <!-- Node ID -->
        <text x={node.x} y={node.y - 2} text-anchor="middle"
          fill={node.active ? '#27864a' : 'var(--text-muted, #9a9590)'}
          font-size="6" font-weight="700"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        >{node.id.slice(5, 9)}</text>

        <!-- Status / Exp ID -->
        <text x={node.x} y={node.y + 8} text-anchor="middle"
          fill={node.active ? '#fbbf24' : 'rgba(154,149,144,0.4)'}
          font-size="5.5" font-weight="600"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        >{node.active ? `#${node.expId} ${Math.round(node.progress)}%` : 'idle'}</text>

        <!-- Progress arc for active nodes -->
        {#if node.active && node.progress > 0}
          {@const radius = NODE_R - 2}
          {@const circumference = 2 * Math.PI * radius}
          {@const dashOffset = circumference * (1 - node.progress / 100)}
          <circle
            cx={node.x} cy={node.y} r={radius}
            fill="none" stroke="#27864a" stroke-width="2"
            stroke-dasharray={circumference}
            stroke-dashoffset={dashOffset}
            stroke-linecap="round"
            transform="rotate(-90 {node.x} {node.y})"
            opacity="0.5"
          />
        {/if}
      </g>
    {/each}

    <!-- Center hub label -->
    {#if allNodes.length > 0}
      <text x={MESH_CX} y={MESH_CY - 4} text-anchor="middle"
        fill="var(--text-muted, #9a9590)" font-size="7" font-weight="700"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        letter-spacing="0.06em" opacity="0.4">MESH</text>
      <text x={MESH_CX} y={MESH_CY + 6} text-anchor="middle"
        fill="var(--text-muted, #9a9590)" font-size="6"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        opacity="0.3">HUB</text>
    {/if}

    <!-- ═══ Divider ═══ -->
    <line x1={SWARM_PAD.left} y1={SWARM_TOP - 4}
      x2={width - SWARM_PAD.right} y2={SWARM_TOP - 4}
      stroke="var(--border-subtle, #EDEAE5)" stroke-width="0.5" stroke-dasharray="4,4" />

    <!-- ═══ Section Label: Swarm ═══ -->
    <text x={12} y={SWARM_TOP + 6} fill="var(--text-muted, #9a9590)" font-size="7"
      font-weight="700" font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      letter-spacing="0.1em">CONVERGENCE</text>

    <!-- ═══ SWARM Y-axis ═══ -->
    {#each swarmYTicks as t}
      <line x1={SWARM_PAD.left} y1={t.y}
        x2={width - SWARM_PAD.right} y2={t.y}
        stroke="var(--border-subtle, #EDEAE5)" stroke-width="0.3" stroke-dasharray="2,3" />
      <text x={SWARM_PAD.left - 5} y={t.y + 3} text-anchor="end"
        fill="var(--text-muted, #9a9590)" font-size="7"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      >{t.val.toFixed(3)}</text>
    {/each}

    <!-- Best metric line -->
    {#if bestMetric < Infinity}
      <line
        x1={SWARM_PAD.left} y1={swarmSy(bestMetric)}
        x2={width - SWARM_PAD.right} y2={swarmSy(bestMetric)}
        stroke="#27864a" stroke-width="0.8" stroke-dasharray="6,3" opacity="0.4"
      />
      <text x={width - SWARM_PAD.right + 2} y={swarmSy(bestMetric) + 3}
        fill="#27864a" font-size="6" font-weight="700"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      >{bestMetric.toFixed(3)}</text>
    {/if}

    <!-- ═══ SWARM POINTS ═══ -->
    {#each swarmPoints as pt, idx}
      {@const metric = estimatedMetric(pt)}
      {@const sx = swarmSx(idx)}
      {@const sy = swarmSy(metric)}
      {@const isTraining = pt.status === 'training'}
      {@const isBest = pt.metric > 0 && pt.metric <= bestMetric && pt.status === 'keep'}
      {@const highlighted = isHighlighted(pt)}

      {#if isTraining}
        <!-- Training: animated pulsing dot -->
        <circle class="swarm-training-pulse" cx={sx} cy={sy} r="10"
          fill="none" stroke="#fbbf24" stroke-width="1" />
        <circle
          class="swarm-point training"
          cx={sx} cy={sy}
          r="5"
          fill="#fbbf24"
          stroke="rgba(255,255,255,0.6)"
          stroke-width="1"
          filter="url(#dv-training-glow)"
          opacity="0.9"
        >
          <title>#{pt.id} training {Math.round(pt.progress)}% ({pt.nodeId})</title>
        </circle>
        <!-- Connection line to node mesh -->
        {@const nodePos = nodePositions.find(n => n.id === pt.nodeId)}
        {#if nodePos}
          <line
            x1={nodePos.x} y1={nodePos.y + NODE_R + 2}
            x2={sx} y2={sy - 6}
            stroke="#fbbf24" stroke-width="0.6" stroke-dasharray="2,3" opacity="0.3"
          />
        {/if}
      {:else if isBest}
        <!-- Best: glowing green -->
        <circle class="swarm-best-pulse" cx={sx} cy={sy} r="8"
          fill="none" stroke="#27864a" stroke-width="1" />
        <circle
          class="swarm-point best"
          cx={sx} cy={sy} r="5"
          fill="#27864a" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"
          filter="url(#dv-best-glow)"
        >
          <title>#{pt.id} BEST {pt.metric.toFixed(3)}</title>
        </circle>
      {:else}
        <!-- Completed points -->
        <circle
          class="swarm-point"
          class:highlighted
          cx={sx} cy={sy}
          r={pt.status === 'keep' ? 3.5 : pt.status === 'crash' ? 2.5 : 2}
          fill={pt.status === 'keep' ? '#27864a' : pt.status === 'crash' ? '#c0392b' : 'rgba(154,149,144,0.3)'}
          stroke={highlighted ? '#fbbf24' : pt.status === 'keep' ? 'rgba(39,134,74,0.25)' : 'none'}
          stroke-width={highlighted ? 2 : pt.status === 'keep' ? 0.6 : 0}
          opacity={highlighted ? 1 : pt.status === 'keep' ? 0.8 : 0.45}
          style="transition-delay:{mounted ? (20 + idx * 15) : 0}ms"
        >
          <title>#{pt.id} {pt.status} {pt.metric > 0 ? pt.metric.toFixed(3) : '--'} ({pt.nodeId})</title>
        </circle>
      {/if}
    {/each}

    <!-- X-axis label -->
    <text x={width / 2} y={SWARM_TOP + SWARM_H - 4} text-anchor="middle"
      fill="var(--text-muted, #9a9590)" font-size="7"
      font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      letter-spacing="0.06em">EXPERIMENT #</text>

    <!-- Y-axis label -->
    <text x={4} y={SWARM_TOP + SWARM_PAD.top - 2} text-anchor="start"
      fill="var(--text-muted, #9a9590)" font-size="7"
      font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      letter-spacing="0.06em">VAL_BPB</text>
  </svg>

  {#if experiments.length === 0}
    <div class="dv-empty"><span>Waiting for distributed experiments...</span></div>
  {/if}
</div>

<style>
  .distributed-container { position: relative; width: 100%; overflow: hidden; }
  .distributed-svg { display: block; width: 100%; height: auto; }
  .dv-empty {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }

  /* ─── Mesh ─── */
  .mesh-edge { transition: stroke 0.3s ease; }
  .mesh-particle { opacity: 0; }
  .mounted .mesh-particle { opacity: 1; }

  .mesh-node { transition: opacity 0.3s ease; }

  .node-pulse {
    opacity: 0;
    transform-origin: center;
    transform-box: fill-box;
  }
  .mounted .node-pulse {
    animation: node-ring 2s ease-in-out infinite;
  }
  @keyframes node-ring {
    0% { opacity: 0.6; r: 16; }
    70% { opacity: 0; r: 28; }
    100% { opacity: 0; r: 28; }
  }

  /* ─── Swarm ─── */
  .swarm-point {
    opacity: 0;
    transition: opacity 0.3s ease, stroke 0.15s ease, r 0.15s ease;
  }
  .mounted .swarm-point { opacity: 1; }
  .swarm-point.highlighted { opacity: 1 !important; }

  .swarm-point.training {
    opacity: 0;
    transform-origin: center;
    transform-box: fill-box;
  }
  .mounted .swarm-point.training {
    opacity: 0.9;
    animation: training-bob 1.5s ease-in-out infinite;
  }
  @keyframes training-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .swarm-training-pulse {
    opacity: 0;
    transform-origin: center;
    transform-box: fill-box;
  }
  .mounted .swarm-training-pulse {
    animation: swarm-pulse 1.8s ease-in-out infinite;
  }
  @keyframes swarm-pulse {
    0% { opacity: 0.5; r: 5; }
    70% { opacity: 0; r: 16; }
    100% { opacity: 0; r: 16; }
  }

  .swarm-best-pulse {
    opacity: 0;
    transform-origin: center;
    transform-box: fill-box;
  }
  .mounted .swarm-best-pulse {
    animation: best-ring 2.5s ease-in-out 0.5s infinite;
  }
  @keyframes best-ring {
    0% { opacity: 0.6; r: 5; }
    50% { opacity: 0; r: 14; }
    100% { opacity: 0; r: 14; }
  }

  .swarm-point.best {
    transform-origin: center;
    transform-box: fill-box;
  }
  .mounted .swarm-point.best {
    animation: best-glow 2.5s ease-in-out 0.5s infinite;
  }
  @keyframes best-glow {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
</style>
