<script lang="ts">
  import { onMount } from 'svelte';
  import { CATEGORY_LABELS, CATEGORY_SHORT, CATEGORY_COLORS, type ModCategory } from '../data/modifications.ts';

  export let data: { id: number; category: ModCategory; metric: number; status: string; branchId: number }[] = [];
  export let width: number = 560;
  export let height: number = 220;

  const PAD = { top: 16, right: 16, bottom: 48, left: 44 };
  $: plotW = width - PAD.left - PAD.right;
  $: plotH = height - PAD.top - PAD.bottom;

  const categories = Object.keys(CATEGORY_LABELS) as ModCategory[];
  $: colW = plotW / categories.length;

  $: yVals = data.map(d => d.metric).filter(m => m > 0);
  $: yMin = yVals.length ? Math.min(...yVals) - 0.01 : 0;
  $: yMax = yVals.length ? Math.max(...yVals) + 0.01 : 1;
  $: yRange = yMax - yMin || 1;

  function sy(y: number): number { return PAD.top + plotH - ((y - yMin) / yRange) * plotH; }
  function cx(catIdx: number, jitter: number): number { return PAD.left + colW * catIdx + colW / 2 + jitter; }

  // Seeded jitter per experiment
  function jitterFor(id: number): number {
    const x = Math.sin(id * 9973) * 10000;
    return ((x - Math.floor(x)) - 0.5) * colW * 0.6;
  }

  $: yTicks = (() => {
    if (!yVals.length) return [];
    const count = 4;
    const step = yRange / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = yMin + step * i;
      return { val, y: sy(val) };
    });
  })();

  let mounted = false;
  onMount(() => { mounted = true; });
</script>

<div class="scatter-container" class:mounted>
  <svg {width} {height} viewBox="0 0 {width} {height}" class="scatter-svg">
    <defs>
      <filter id="scatter-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="rgba(217,119,87,0.55)" />
      </filter>
      <filter id="scatter-keep-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(217,119,87,0.3)" />
      </filter>
    </defs>

    <!-- Column backgrounds -->
    {#each categories as cat, i}
      {#if i % 2 === 0}
        <rect
          x={PAD.left + colW * i} y={PAD.top}
          width={colW} height={plotH}
          fill="rgba(0,0,0,0.015)" rx="2"
        />
      {/if}
    {/each}

    <!-- Y grid lines -->
    {#each yTicks as tick}
      <line x1={PAD.left} y1={tick.y} x2={width - PAD.right} y2={tick.y}
        stroke="var(--border-subtle, #EDEAE5)" stroke-width="0.5" stroke-dasharray="3,3" />
      <text x={PAD.left - 6} y={tick.y + 3} text-anchor="end"
        fill="var(--text-muted, #9a9590)" font-size="9"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      >{tick.val.toFixed(3)}</text>
    {/each}

    <!-- Data points -->
    {#each data as d, idx}
      {@const catIdx = categories.indexOf(d.category)}
      {#if catIdx >= 0 && d.metric > 0}
        <circle
          class="scatter-point"
          cx={cx(catIdx, jitterFor(d.id))}
          cy={sy(d.metric)}
          r={d.status === 'keep' ? 4.5 : 3}
          fill={d.status === 'keep' ? CATEGORY_COLORS[d.category] : 'rgba(154,149,144,0.35)'}
          stroke={d.status === 'keep' ? 'rgba(255,255,255,0.6)' : 'none'}
          stroke-width={d.status === 'keep' ? 0.8 : 0}
          filter={d.status === 'keep' ? 'url(#scatter-keep-glow)' : undefined}
          style="transition-delay:{mounted ? (40 + idx * 25) : 0}ms"
        >
          <title>#{d.id} {d.category} → {d.metric.toFixed(3)} ({d.status})</title>
        </circle>
      {/if}
    {/each}

    <!-- Category labels -->
    {#each categories as cat, i}
      <text
        x={PAD.left + colW * i + colW / 2}
        y={height - 6}
        text-anchor="middle"
        fill={CATEGORY_COLORS[cat]}
        font-size="9"
        font-weight="700"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        letter-spacing="0.02em"
      >{CATEGORY_SHORT[cat]}</text>
    {/each}

    <!-- Y-axis label -->
    <text x={4} y={PAD.top - 4} text-anchor="start"
      fill="var(--text-muted, #9a9590)" font-size="9"
      font-family="var(--font-mono, 'JetBrains Mono', monospace)" letter-spacing="0.06em"
    >VAL_BPB</text>
  </svg>

  {#if data.length === 0}
    <div class="scatter-empty"><span>Awaiting experiment results...</span></div>
  {/if}
</div>

<style>
  .scatter-container { position: relative; width: 100%; overflow: hidden; }
  .scatter-svg { display: block; width: 100%; height: auto; }
  .scatter-empty {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }
  .scatter-point { opacity: 0; transition: opacity 0.3s ease; }
  .mounted .scatter-point { opacity: 1; }
</style>
