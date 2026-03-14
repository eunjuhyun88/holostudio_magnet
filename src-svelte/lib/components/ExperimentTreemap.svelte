<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { selectedExperimentId } from '../stores/selectionStore.ts';
  import {
    CATEGORY_LABELS, CATEGORY_SHORT, CATEGORY_COLORS,
    resolveExperimentCategory, type ModCategory,
  } from '../data/modifications.ts';
  import type { Experiment } from '../stores/jobStore.ts';

  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;

  const dispatch = createEventDispatcher<{ select: number }>();

  // ── Drill-down state ──
  type DrillLevel = 'root' | 'category' | 'experiment';
  let drillLevel: DrillLevel = 'root';
  let drillCategory: ModCategory | null = null;
  let hoveredCell: TreemapCell | null = null;

  interface TreemapCell {
    id: string;
    label: string;
    shortLabel: string;
    value: number;
    color: string;
    x: number; y: number; w: number; h: number;
    keepRate?: number;
    total?: number;
    keeps?: number;
    avgMetric?: number;
    bestMetric?: number;
    experimentId?: number;
    status?: string;
    metric?: number;
    category?: ModCategory;
  }

  // ── Breadcrumb ──
  $: breadcrumb = (() => {
    const crumbs: { label: string; action: () => void }[] = [
      { label: 'All Experiments', action: () => { drillLevel = 'root'; drillCategory = null; } },
    ];
    if (drillCategory) {
      crumbs.push({
        label: CATEGORY_LABELS[drillCategory] ?? drillCategory,
        action: () => { drillLevel = 'category'; },
      });
    }
    return crumbs;
  })();

  // ── Build category-level data ──
  $: catData = (() => {
    const map = new Map<ModCategory, { total: number; keeps: number; metrics: number[] }>();
    for (const e of experiments) {
      if (e.status === 'training') continue;
      const cat = resolveExperimentCategory(e.modification);
      if (!map.has(cat)) map.set(cat, { total: 0, keeps: 0, metrics: [] });
      const d = map.get(cat)!;
      d.total++;
      if (e.status === 'keep') d.keeps++;
      if (e.metric > 0) d.metrics.push(e.metric);
    }
    return map;
  })();

  // ── Squarified treemap layout ──
  function squarify(items: { id: string; value: number }[], x: number, y: number, w: number, h: number): { id: string; x: number; y: number; w: number; h: number }[] {
    if (items.length === 0) return [];
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return items.map(i => ({ id: i.id, x, y, w: 0, h: 0 }));

    // Sort descending
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const result: { id: string; x: number; y: number; w: number; h: number }[] = [];
    layoutStrip(sorted, total, x, y, w, h, result);
    return result;
  }

  function layoutStrip(
    items: { id: string; value: number }[],
    total: number,
    x: number, y: number, w: number, h: number,
    result: { id: string; x: number; y: number; w: number; h: number }[]
  ) {
    if (items.length === 0) return;
    if (items.length === 1) {
      result.push({ id: items[0].id, x, y, w, h });
      return;
    }

    const horizontal = w >= h;
    let stripSum = 0;
    let bestAspect = Infinity;
    let splitIdx = 1;

    for (let i = 0; i < items.length; i++) {
      stripSum += items[i].value;
      const stripFrac = stripSum / total;
      const stripSize = horizontal ? w * stripFrac : h * stripFrac;
      const remaining = items.slice(0, i + 1);
      const worst = worstAspect(remaining, stripSum, stripSize, horizontal ? h : w);
      if (worst <= bestAspect) {
        bestAspect = worst;
        splitIdx = i + 1;
      } else {
        break;
      }
    }

    const strip = items.slice(0, splitIdx);
    const rest = items.slice(splitIdx);
    const stripTotal = strip.reduce((s, i) => s + i.value, 0);
    const stripFrac = stripTotal / total;

    if (horizontal) {
      const sw = w * stripFrac;
      let cy = y;
      for (const item of strip) {
        const sh = h * (item.value / stripTotal);
        result.push({ id: item.id, x, y: cy, w: sw, h: sh });
        cy += sh;
      }
      if (rest.length > 0) {
        layoutStrip(rest, total - stripTotal, x + sw, y, w - sw, h, result);
      }
    } else {
      const sh = h * stripFrac;
      let cx = x;
      for (const item of strip) {
        const sw = w * (item.value / stripTotal);
        result.push({ id: item.id, x: cx, y, w: sw, h: sh });
        cx += sw;
      }
      if (rest.length > 0) {
        layoutStrip(rest, total - stripTotal, x, y + sh, w, h - sh, result);
      }
    }
  }

  function worstAspect(items: { value: number }[], stripTotal: number, stripSize: number, crossSize: number): number {
    let worst = 0;
    for (const item of items) {
      const frac = item.value / stripTotal;
      const size = crossSize * frac;
      if (size === 0 || stripSize === 0) continue;
      const aspect = Math.max(stripSize / size, size / stripSize);
      worst = Math.max(worst, aspect);
    }
    return worst;
  }

  // ── Compute cells for current drill level ──
  const PAD = 2;
  let containerW = 400;
  let containerH = 260;
  let containerEl: HTMLDivElement;

  onMount(() => {
    if (containerEl) {
      const ro = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        containerW = width;
        containerH = height - 28; // subtract breadcrumb height
      });
      ro.observe(containerEl);
      return () => ro.disconnect();
    }
  });

  // Explicit deps for Svelte 4 reactivity: catData, containerW, containerH, drillLevel, drillCategory, experiments, bestMetric
  $: cells = (() => {
    // Touch reactive deps so Svelte tracks them
    const _cd = catData;
    const _w = containerW;
    const _h = containerH;
    const _e = experiments;
    const _b = bestMetric;
    if (drillLevel === 'root') return buildRootCells();
    if (drillLevel === 'category' && drillCategory) return buildCategoryCells(drillCategory);
    return [];
  })();

  function buildRootCells(): TreemapCell[] {
    const items: { id: string; value: number }[] = [];
    for (const [cat, d] of catData) {
      if (d.total > 0) items.push({ id: cat, value: d.total });
    }
    const layout = squarify(items, PAD, PAD, containerW - PAD * 2, containerH - PAD * 2);
    return layout.map(l => {
      const cat = l.id as ModCategory;
      const d = catData.get(cat)!;
      const keepRate = d.total > 0 ? d.keeps / d.total : 0;
      const avg = d.metrics.length > 0 ? d.metrics.reduce((a, b) => a + b, 0) / d.metrics.length : 0;
      const best = d.metrics.length > 0 ? Math.min(...d.metrics) : Infinity;
      return {
        id: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        shortLabel: CATEGORY_SHORT[cat] ?? cat,
        value: d.total,
        color: CATEGORY_COLORS[cat] ?? '#9a9590',
        x: l.x, y: l.y, w: l.w, h: l.h,
        keepRate, total: d.total, keeps: d.keeps,
        avgMetric: avg, bestMetric: best,
        category: cat,
      };
    });
  }

  function buildCategoryCells(cat: ModCategory): TreemapCell[] {
    const exps = experiments.filter(e => {
      if (e.status === 'training') return false;
      return resolveExperimentCategory(e.modification) === cat;
    });
    if (exps.length === 0) return [];

    const items = exps.map(e => ({
      id: String(e.id),
      value: Math.max(1, e.duration || 1),
    }));
    const layout = squarify(items, PAD, PAD, containerW - PAD * 2, containerH - PAD * 2);

    const catColor = CATEGORY_COLORS[cat] ?? '#9a9590';
    return layout.map(l => {
      const e = exps.find(ex => String(ex.id) === l.id)!;
      const isKeep = e.status === 'keep';
      const isBest = e.metric > 0 && e.metric <= bestMetric;
      return {
        id: l.id,
        label: `#${e.id} ${e.modification}`,
        shortLabel: `#${e.id}`,
        value: e.duration || 1,
        color: isBest ? '#D97757' : isKeep ? catColor : catColor + '44',
        x: l.x, y: l.y, w: l.w, h: l.h,
        experimentId: e.id,
        status: e.status,
        metric: e.metric,
        category: cat,
      };
    });
  }

  // ── Interaction ──
  function handleCellClick(cell: TreemapCell) {
    if (drillLevel === 'root' && cell.category) {
      drillCategory = cell.category;
      drillLevel = 'category';
    } else if (drillLevel === 'category' && cell.experimentId != null) {
      selectedExperimentId.set(cell.experimentId);
      dispatch('select', cell.experimentId);
    }
  }

  function handleCellKey(e: KeyboardEvent, cell: TreemapCell) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellClick(cell);
    }
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      goBack();
    }
  }

  function goBack() {
    if (drillLevel === 'category') {
      drillLevel = 'root';
      drillCategory = null;
    }
  }

  // ── Label sizing ──
  function cellFontSize(cell: TreemapCell): number {
    const area = cell.w * cell.h;
    if (area < 800) return 0; // too small to label
    if (area < 2000) return 8;
    if (area < 5000) return 9;
    return 10;
  }

  function showSubLabel(cell: TreemapCell): boolean {
    return cell.w > 50 && cell.h > 30;
  }

  // ── Tooltip position ──
  $: tooltipStyle = (() => {
    if (!hoveredCell) return 'display:none';
    const cx = hoveredCell.x + hoveredCell.w / 2;
    const cy = hoveredCell.y;
    const left = Math.min(cx, containerW - 140);
    const top = Math.max(0, cy - 64);
    return `left:${left}px;top:${top}px`;
  })();
</script>

<div class="treemap-wrap" bind:this={containerEl}>
  <!-- Breadcrumb -->
  <div class="tm-breadcrumb">
    {#each breadcrumb as crumb, i}
      {#if i > 0}<span class="tm-sep">›</span>{/if}
      <button
        class="tm-crumb"
        class:tm-crumb-active={i === breadcrumb.length - 1}
        on:click={crumb.action}
      >{crumb.label}</button>
    {/each}
    {#if drillLevel !== 'root'}
      <button class="tm-back" on:click={goBack} title="Back">←</button>
    {/if}
  </div>

  <!-- Treemap SVG -->
  <svg
    width={containerW}
    height={containerH}
    viewBox="0 0 {containerW} {containerH}"
    class="tm-svg"
    on:mouseleave={() => { hoveredCell = null; }}
  >
    {#each cells as cell (cell.id)}
      {@const fs = cellFontSize(cell)}
      {@const isSelected = cell.experimentId != null && $selectedExperimentId === cell.experimentId}
      <g
        class="tm-cell"
        on:click={() => handleCellClick(cell)}
        on:keydown={(e) => handleCellKey(e, cell)}
        on:mouseenter={() => { hoveredCell = cell; }}
        on:mouseleave={() => { hoveredCell = null; }}
        role="button"
        tabindex="0"
        aria-label={cell.label}
      >
        <rect
          x={cell.x + 1} y={cell.y + 1}
          width={Math.max(0, cell.w - 2)}
          height={Math.max(0, cell.h - 2)}
          rx="4"
          fill={cell.color}
          stroke={isSelected ? '#D97757' : hoveredCell?.id === cell.id ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
          stroke-width={isSelected ? 2.5 : hoveredCell?.id === cell.id ? 2 : 1}
          class:tm-cell-hover={hoveredCell?.id === cell.id}
        />
        {#if fs > 0}
          <!-- Main label -->
          <text
            x={cell.x + cell.w / 2}
            y={cell.y + cell.h / 2 + (showSubLabel(cell) ? -3 : 3)}
            text-anchor="middle"
            fill="rgba(255,255,255,0.95)"
            font-size={fs}
            font-weight="700"
            font-family="'Inter', -apple-system, sans-serif"
          >{cell.w > 60 ? cell.label.slice(0, Math.floor(cell.w / (fs * 0.6))) : cell.shortLabel}</text>

          <!-- Sub-label -->
          {#if showSubLabel(cell)}
            <text
              x={cell.x + cell.w / 2}
              y={cell.y + cell.h / 2 + 10}
              text-anchor="middle"
              fill="rgba(255,255,255,0.7)"
              font-size={Math.max(7, fs - 2)}
              font-weight="500"
              font-family="'Inter', -apple-system, sans-serif"
            >
              {#if drillLevel === 'root' && cell.total}
                {cell.keeps}/{cell.total} keep · {Math.round((cell.keepRate ?? 0) * 100)}%
              {:else if cell.metric != null && cell.metric > 0}
                {cell.metric.toFixed(4)} · {cell.status}
              {/if}
            </text>
          {/if}
        {/if}
      </g>
    {/each}

    <!-- Empty state -->
    {#if cells.length === 0}
      <text x={containerW / 2} y={containerH / 2} text-anchor="middle"
        fill="var(--text-muted, #9a9590)" font-size="11"
        font-family="'Inter', -apple-system, sans-serif"
      >Awaiting experiment data…</text>
    {/if}
  </svg>

  <!-- Tooltip -->
  {#if hoveredCell}
    <div class="tm-tooltip" style={tooltipStyle}>
      <div class="tm-tip-title">{hoveredCell.label}</div>
      {#if drillLevel === 'root'}
        <div class="tm-tip-row"><span>Experiments</span><strong>{hoveredCell.total}</strong></div>
        <div class="tm-tip-row"><span>Keep Rate</span><strong>{Math.round((hoveredCell.keepRate ?? 0) * 100)}%</strong></div>
        {#if hoveredCell.bestMetric != null && hoveredCell.bestMetric < Infinity}
          <div class="tm-tip-row"><span>Best</span><strong>{hoveredCell.bestMetric.toFixed(4)}</strong></div>
        {/if}
        {#if hoveredCell.avgMetric != null && hoveredCell.avgMetric > 0}
          <div class="tm-tip-row"><span>Avg</span><strong>{hoveredCell.avgMetric.toFixed(4)}</strong></div>
        {/if}
        <div class="tm-tip-hint">Click to drill down →</div>
      {:else}
        {#if hoveredCell.metric != null && hoveredCell.metric > 0}
          <div class="tm-tip-row"><span>Metric</span><strong>{hoveredCell.metric.toFixed(4)}</strong></div>
        {/if}
        <div class="tm-tip-row"><span>Status</span><strong>{hoveredCell.status}</strong></div>
        <div class="tm-tip-hint">Click to select</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .treemap-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Breadcrumb ── */
  .tm-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px 4px;
    flex-shrink: 0;
    min-height: 24px;
  }
  .tm-crumb {
    font: 500 9px/1 'Inter', -apple-system, sans-serif;
    color: var(--text-muted, #9a9590);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    transition: all 150ms;
    letter-spacing: 0.02em;
  }
  .tm-crumb:hover { background: rgba(0,0,0,0.04); color: #555; }
  .tm-crumb-active { color: #444; font-weight: 600; cursor: default; }
  .tm-crumb-active:hover { background: none; }
  .tm-sep {
    font-size: 9px;
    color: #ccc;
  }
  .tm-back {
    margin-left: auto;
    font-size: 11px;
    width: 20px; height: 20px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 5px;
    background: var(--surface, #fff);
    color: #999;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 150ms;
  }
  .tm-back:hover { background: #f5f5f5; color: #555; }

  /* ── SVG ── */
  .tm-svg {
    display: block;
    flex: 1;
    width: 100%;
  }

  .tm-cell {
    cursor: pointer;
    outline: none;
  }
  .tm-cell:focus-visible rect {
    stroke: #D97757;
    stroke-width: 2.5;
  }
  .tm-cell-hover {
    filter: brightness(1.08);
  }

  /* ── Tooltip ── */
  .tm-tooltip {
    position: absolute;
    z-index: 20;
    background: rgba(24, 24, 24, 0.92);
    border-radius: 8px;
    padding: 8px 10px;
    min-width: 120px;
    max-width: 200px;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
  .tm-tip-title {
    font: 600 10px/1.3 'Inter', -apple-system, sans-serif;
    color: #fff;
    margin-bottom: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-tip-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font: 400 9px/1.6 'Inter', -apple-system, sans-serif;
    color: rgba(255,255,255,0.7);
  }
  .tm-tip-row strong {
    color: #fff;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .tm-tip-hint {
    font: 400 8px/1 'Inter', -apple-system, sans-serif;
    color: rgba(255,255,255,0.4);
    margin-top: 4px;
    text-align: right;
  }
</style>
