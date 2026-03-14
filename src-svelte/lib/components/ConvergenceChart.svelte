<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { selectedExperimentId } from '../stores/selectionStore.ts';
  import { resolveExperimentCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '../data/modifications.ts';
  import type { Experiment } from '../stores/jobStore.ts';

  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;
  export let baselineMetric: number = Infinity;
  export let width: number = 400;
  export let height: number = 100;

  const dispatch = createEventDispatcher<{ select: number }>();

  const PAD = { top: 10, right: 16, bottom: 18, left: 38 };

  // Build chronological completed experiments
  $: completed = [...experiments]
    .filter(e => e.status !== 'training')
    .reverse();

  // Compute scales
  $: plotW = width - PAD.left - PAD.right;
  $: plotH = height - PAD.top - PAD.bottom;

  $: metrics = completed.map(e => e.metric).filter(m => m > 0);
  $: yMin = metrics.length > 0 ? Math.min(...metrics) * 0.997 : 0;
  $: yMax = metrics.length > 0 ? Math.max(...metrics) * 1.003 : 1;
  $: yRange = Math.max(yMax - yMin, 0.001);

  // Y-axis ticks
  $: yTicks = (() => {
    if (metrics.length === 0) return [];
    const count = 3;
    const step = yRange / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = yMin + step * i;
      return { val, y: PAD.top + ((yMax - val) / yRange) * plotH };
    });
  })();

  $: points = completed.map((e, i) => {
    const x = PAD.left + (completed.length > 1 ? (i / (completed.length - 1)) * plotW : plotW / 2);
    const y = e.metric > 0
      ? PAD.top + ((yMax - e.metric) / yRange) * plotH
      : PAD.top + plotH;
    return { x, y, exp: e };
  });

  // Best frontier line (step-wise) + fill area
  $: frontierData = (() => {
    if (completed.length === 0) return { path: '', fillPath: '' };
    let best = Infinity;
    const lineSegments: string[] = [];
    const fillPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < points.length; i++) {
      const e = completed[i];
      if (e.status === 'keep' && e.metric > 0 && e.metric < best) {
        best = e.metric;
        const y = PAD.top + ((yMax - best) / yRange) * plotH;
        if (lineSegments.length === 0) {
          lineSegments.push(`M${points[i].x},${y}`);
        } else {
          lineSegments.push(`H${points[i].x}V${y}`);
        }
        fillPoints.push({ x: points[i].x, y });
      }
    }
    if (lineSegments.length > 0 && points.length > 0) {
      const lastX = points[points.length - 1].x;
      lineSegments.push(`H${lastX}`);
      fillPoints.push({ x: lastX, y: fillPoints[fillPoints.length - 1].y });
    }

    // Fill area below frontier
    let fillPath = '';
    if (fillPoints.length > 1) {
      const bottomY = PAD.top + plotH;
      fillPath = lineSegments.join('') + `V${bottomY}H${fillPoints[0].x}Z`;
    }

    return { path: lineSegments.join(''), fillPath };
  })();

  // Baseline Y position
  $: baselineY = baselineMetric < Infinity && baselineMetric > 0
    ? PAD.top + ((yMax - baselineMetric) / yRange) * plotH
    : -1;

  // Hover state
  let hoveredPoint: { x: number; y: number; exp: Experiment } | null = null;

  function dotColor(e: Experiment): string {
    if (e.status === 'crash') return '#c0392b';
    const cat = resolveExperimentCategory(e.modification);
    if (e.status === 'keep') return CATEGORY_COLORS[cat] ?? '#27864a';
    const base = CATEGORY_COLORS[cat] ?? '#b5b0ab';
    return base + '55';
  }

  function dotRadius(e: Experiment): number {
    if (e.metric === bestMetric && e.status === 'keep') return 4.5;
    if (e.status === 'keep') return 3;
    if (e.status === 'crash') return 2;
    return 1.8;
  }

  function handleClick(id: number) {
    selectedExperimentId.set(id);
    dispatch('select', id);
  }

  function handleKeydown(event: KeyboardEvent, id: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleClick(id);
  }
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" class="convergence-chart"
  on:mouseleave={() => { hoveredPoint = null; }}>
  <defs>
    <filter id="cv-best-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(217,119,87,0.5)" />
    </filter>
    <linearGradient id="cv-frontier-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D97757" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#D97757" stop-opacity="0.01" />
    </linearGradient>
  </defs>

  <!-- Y-axis ticks -->
  {#each yTicks as tick}
    <line x1={PAD.left} y1={tick.y} x2={PAD.left + plotW} y2={tick.y}
      class="grid-line" stroke-dasharray={tick === yTicks[0] || tick === yTicks[yTicks.length - 1] ? 'none' : '3,3'} />
    <text x={PAD.left - 4} y={tick.y + 3} class="axis-label" text-anchor="end">{tick.val.toFixed(2)}</text>
  {/each}

  <!-- Baseline reference line -->
  {#if baselineY >= PAD.top && baselineY <= PAD.top + plotH}
    <line x1={PAD.left} y1={baselineY} x2={PAD.left + plotW} y2={baselineY}
      stroke="#bbb" stroke-width="1" stroke-dasharray="4,3" opacity="0.6" />
    <text x={PAD.left + plotW + 2} y={baselineY + 3}
      class="baseline-label" text-anchor="start">baseline</text>
  {/if}

  <!-- Frontier fill area -->
  {#if frontierData.fillPath}
    <path d={frontierData.fillPath} fill="url(#cv-frontier-fill)" />
  {/if}

  <!-- Best frontier line -->
  {#if frontierData.path}
    <path d={frontierData.path} class="frontier-line" />
  {/if}

  <!-- Data points -->
  {#each points as p (p.exp.id)}
    <circle
      cx={p.x} cy={p.y} r={dotRadius(p.exp)}
      fill={dotColor(p.exp)}
      class="data-point"
      class:selected={$selectedExperimentId === p.exp.id}
      class:is-best={p.exp.metric === bestMetric && p.exp.status === 'keep'}
      filter={p.exp.metric === bestMetric && p.exp.status === 'keep' ? 'url(#cv-best-glow)' : undefined}
      on:click={() => handleClick(p.exp.id)}
      on:keydown={(event) => handleKeydown(event, p.exp.id)}
      on:mouseenter={() => { hoveredPoint = p; }}
      on:mouseleave={() => { hoveredPoint = null; }}
      role="button"
      tabindex="0"
      aria-label={`${p.exp.modification}: ${p.exp.metric.toFixed(4)}`}
    />
  {/each}

  <!-- Hover tooltip -->
  {#if hoveredPoint}
    {@const hp = hoveredPoint}
    {@const cat = resolveExperimentCategory(hp.exp.modification)}
    {@const tipX = hp.x < width / 2 ? hp.x + 8 : hp.x - 8}
    {@const tipAnchor = hp.x < width / 2 ? 'start' : 'end'}
    <rect x={tipAnchor === 'start' ? tipX : tipX - 100} y={Math.max(2, hp.y - 22)}
      width="100" height="20" rx="4" fill="rgba(30,30,30,0.88)" />
    <text x={tipAnchor === 'start' ? tipX + 5 : tipX - 95} y={Math.max(2, hp.y - 22) + 14}
      fill="#fff" font-size="9" font-family="'Inter', sans-serif" font-weight="600">
      {CATEGORY_LABELS[cat] ?? cat} {hp.exp.metric.toFixed(4)}
    </text>
  {/if}

  <!-- X axis label -->
  <text x={PAD.left + plotW / 2} y={height - 3} class="axis-label" text-anchor="middle">experiments →</text>
</svg>

<style>
  .convergence-chart { display: block; width: 100%; height: auto; }
  .axis-label {
    font: 500 9px/1 'JetBrains Mono', 'SF Mono', monospace;
    fill: #9a9590;
  }
  .baseline-label {
    font: 500 9px/1 'Inter', sans-serif;
    fill: #9a9590;
  }
  .grid-line {
    stroke: #eee; stroke-width: 0.5;
  }
  .frontier-line {
    fill: none;
    stroke: #D97757;
    stroke-width: 1.5;
    stroke-opacity: 0.8;
  }
  .data-point {
    cursor: pointer;
    transition: r 150ms ease;
  }
  .data-point:hover { r: 5; }
  .data-point.selected {
    r: 5;
    stroke: #D97757;
    stroke-width: 2;
  }
  .data-point.is-best {
    animation: bestRing 2s ease-out infinite;
  }
  @keyframes bestRing {
    0% { stroke: rgba(217,119,87,0.6); stroke-width: 2; }
    50% { stroke: rgba(217,119,87,0.2); stroke-width: 4; }
    100% { stroke: rgba(217,119,87,0.6); stroke-width: 2; }
  }
</style>
