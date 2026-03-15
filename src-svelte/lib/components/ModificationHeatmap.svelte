<script lang="ts">
  import { onMount } from 'svelte';
  import { zoomable } from '../actions/zoomable.ts';
  import { CATEGORY_LABELS, CATEGORY_COLORS, type ModCategory } from '../data/modifications.ts';

  export let data: Record<string, { total: number; keeps: number; avgMetric: number; metrics: number[] }> = {};
  export let width: number = 560;
  export let height: number = 280;

  const PAD = { top: 12, right: 16, bottom: 8, left: 100 };
  const categories = Object.keys(CATEGORY_LABELS) as ModCategory[];
  $: activeCats = categories.filter(c => data[c] && data[c].total > 0);
  $: rowH = activeCats.length > 0 ? Math.min(28, (height - PAD.top - PAD.bottom) / activeCats.length) : 28;
  $: actualH = PAD.top + PAD.bottom + activeCats.length * rowH;
  $: barW = width - PAD.left - PAD.right;

  $: maxTotal = Math.max(1, ...activeCats.map(c => data[c]?.total ?? 0));

  // Sort by keep rate descending
  $: sorted = [...activeCats].sort((a, b) => {
    const rateA = data[a]?.total > 0 ? data[a].keeps / data[a].total : 0;
    const rateB = data[b]?.total > 0 ? data[b].keeps / data[b].total : 0;
    return rateB - rateA;
  });

  function keepRate(cat: string): number {
    const d = data[cat];
    if (!d || d.total === 0) return 0;
    return d.keeps / d.total;
  }

  function barColor(cat: ModCategory, rate: number): string {
    const base = CATEGORY_COLORS[cat] || '#9a9590';
    const alpha = 0.3 + rate * 0.7;
    return base + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }

  let mounted = false;
  onMount(() => { mounted = true; });
</script>

<div class="heatmap-container" class:mounted use:zoomable>
  <svg {width} height={actualH} viewBox="0 0 {width} {actualH}" class="heatmap-svg">
    <defs>
      <filter id="hm-bar-glow" x="-10%" y="-30%" width="120%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(39,134,74,0.3)" />
      </filter>
    </defs>
    {#each sorted as cat, i}
      {@const d = data[cat] || { total: 0, keeps: 0, avgMetric: 0, metrics: [] }}
      {@const rate = keepRate(cat)}
      {@const bw = (d.total / maxTotal) * barW}
      {@const y = PAD.top + i * rowH}

      <!-- Category label -->
      <text
        x={PAD.left - 8}
        y={y + rowH / 2 + 3}
        text-anchor="end"
        fill={CATEGORY_COLORS[cat]}
        font-size="10"
        font-weight="700"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        letter-spacing="0.02em"
      >{CATEGORY_LABELS[cat]}</text>

      <!-- Background track -->
      <rect
        x={PAD.left}
        y={y + 2}
        width={barW}
        height={rowH - 4}
        fill="rgba(0,0,0,0.02)"
        rx="3"
      />

      <!-- Bar (width = count, opacity = keep rate) -->
      <rect
        class="hm-bar"
        x={PAD.left}
        y={y + 2}
        width={mounted ? bw : 0}
        height={rowH - 4}
        fill={barColor(cat, rate)}
        rx="3"
        filter={rate > 0.3 ? 'url(#hm-bar-glow)' : undefined}
        style="transition-delay:{i * 60}ms"
      />

      <!-- Keep rate % inside bar -->
      {#if bw > 40}
        <text
          class="hm-rate"
          x={PAD.left + Math.min(bw, barW) - 6}
          y={y + rowH / 2 + 3}
          text-anchor="end"
          fill="rgba(255,255,255,0.9)"
          font-size="9"
          font-weight="700"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        >{Math.round(rate * 100)}%</text>
      {/if}

      <!-- Count right of bar -->
      <text
        class="hm-count"
        x={PAD.left + bw + 6}
        y={y + rowH / 2 + 3}
        text-anchor="start"
        fill="var(--text-muted, #9a9590)"
        font-size="9"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
      >{d.keeps}/{d.total}</text>

      <!-- Avg metric (if available) -->
      {#if d.avgMetric > 0}
        <text
          x={width - PAD.right}
          y={y + rowH / 2 + 3}
          text-anchor="end"
          fill="var(--text-muted, #9a9590)"
          font-size="9"
          font-family="var(--font-mono, 'JetBrains Mono', monospace)"
          opacity="0.7"
        >avg {d.avgMetric.toFixed(3)}</text>
      {/if}
    {/each}
  </svg>

  {#if activeCats.length === 0}
    <div class="hm-empty"><span>Awaiting experiment results...</span></div>
  {/if}
</div>

<style>
  .heatmap-container { position: relative; width: 100%; overflow: hidden; }
  .heatmap-svg { display: block; width: 100%; height: auto; }
  .hm-empty {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }
  .hm-bar { transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
  .hm-rate, .hm-count { opacity: 0; transition: opacity 0.3s ease 0.6s; }
  .mounted .hm-rate, .mounted .hm-count { opacity: 1; }
</style>
