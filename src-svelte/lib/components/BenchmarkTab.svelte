<script lang="ts">
  import { onDestroy } from "svelte";
  import { animateCounter } from "../utils/animate.ts";
  import { BENCHMARK_DATA } from "../data/modelDetailData.ts";

  export let visible: boolean = false;

  const benchmarkData = BENCHMARK_DATA;
  const featureMax = Math.max(...benchmarkData.featureImportance.map(f => f.value));
  const balAccRange = { min: 0.91, max: 0.98 };

  // Pareto toggle
  let selectedModel: 'best' | 'safest' = 'best';
  $: activeModel = selectedModel === 'best' ? benchmarkData.best : benchmarkData.safest;
  $: deltaBalAcc = activeModel.balAcc - benchmarkData.baseline.balAcc;
  $: deltaFpPct = ((activeModel.fp - benchmarkData.baseline.fp) / benchmarkData.baseline.fp * 100);
  $: deltaFnPct = ((activeModel.fn - benchmarkData.baseline.fn) / benchmarkData.baseline.fn * 100);

  // Count-up animation
  let benchmarkVisible = false;
  let animatedBalAcc = 0;
  let animatedFp = 0;
  let animatedFn = 0;
  let destroyed = false;
  let benchmarkTimeout: ReturnType<typeof setTimeout> | null = null;

  const isDestroyed = () => destroyed;

  function startBenchmarkAnimation() {
    if (benchmarkVisible) return;
    benchmarkVisible = true;
    animateCounter(0, activeModel.balAcc, 1200, v => animatedBalAcc = v, isDestroyed);
    animateCounter(0, activeModel.fp, 800, v => animatedFp = Math.round(v), isDestroyed);
    animateCounter(0, activeModel.fn, 800, v => animatedFn = Math.round(v), isDestroyed);
  }

  $: if (visible) {
    benchmarkVisible = false;
    if (benchmarkTimeout) clearTimeout(benchmarkTimeout);
    benchmarkTimeout = setTimeout(() => startBenchmarkAnimation(), 100);
  }

  onDestroy(() => {
    destroyed = true;
    if (benchmarkTimeout) clearTimeout(benchmarkTimeout);
  });
</script>

<!-- 1. Hero Section: Best vs Baseline -->
<div class="bm-section">
  <div class="bm-toggle">
    <button class="bm-toggle-btn" class:active={selectedModel === 'best'} on:click={() => selectedModel = 'best'}>
      Option A — Best Accuracy
    </button>
    <button class="bm-toggle-btn" class:active={selectedModel === 'safest'} on:click={() => selectedModel = 'safest'}>
      Option B — Safest (FN=1)
    </button>
  </div>

  <div class="bm-hero-grid">
    <div class="bm-hero-card">
      <span class="bm-hero-label">Balanced Accuracy</span>
      <div class="bm-hero-values">
        <span class="bm-hero-before">{benchmarkData.baseline.balAcc.toFixed(4)}</span>
        <span class="bm-hero-arrow">→</span>
        <span class="bm-hero-after">{animatedBalAcc.toFixed(4)}</span>
      </div>
      <div class="bm-hero-bar-track">
        <div class="bm-hero-bar baseline" style="width: {((benchmarkData.baseline.balAcc - balAccRange.min) / (balAccRange.max - balAccRange.min)) * 100}%"></div>
        <div class="bm-hero-bar best" style="width: {((activeModel.balAcc - balAccRange.min) / (balAccRange.max - balAccRange.min)) * 100}%"></div>
      </div>
      <span class="bm-hero-delta positive">+{deltaBalAcc.toFixed(4)} vs baseline</span>
    </div>

    <div class="bm-hero-card">
      <span class="bm-hero-label">False Positives</span>
      <div class="bm-hero-values">
        <span class="bm-hero-before">{benchmarkData.baseline.fp}</span>
        <span class="bm-hero-arrow">→</span>
        <span class="bm-hero-after">{animatedFp}</span>
      </div>
      <div class="bm-hero-bar-track">
        <div class="bm-hero-bar fp-base" style="width: {(benchmarkData.baseline.fp / 40) * 100}%"></div>
        <div class="bm-hero-bar fp-best" style="width: {(activeModel.fp / 40) * 100}%"></div>
      </div>
      <span class="bm-hero-delta" class:positive={deltaFpPct <= 0} class:negative={deltaFpPct > 0}>
        {deltaFpPct > 0 ? '+' : ''}{deltaFpPct.toFixed(0)}% vs baseline
      </span>
    </div>

    <div class="bm-hero-card">
      <span class="bm-hero-label">False Negatives</span>
      <div class="bm-hero-values">
        <span class="bm-hero-before">{benchmarkData.baseline.fn}</span>
        <span class="bm-hero-arrow">→</span>
        <span class="bm-hero-after">{animatedFn}</span>
      </div>
      <div class="bm-hero-bar-track">
        <div class="bm-hero-bar fn-base" style="width: {(benchmarkData.baseline.fn / 12) * 100}%"></div>
        <div class="bm-hero-bar fn-best" style="width: {(activeModel.fn / 12) * 100}%"></div>
      </div>
      <span class="bm-hero-delta" class:positive={deltaFnPct <= 0} class:negative={deltaFnPct > 0}>
        {deltaFnPct > 0 ? '+' : ''}{deltaFnPct.toFixed(0)}% vs baseline
      </span>
    </div>
  </div>
</div>

<!-- 2. Architecture Diagram -->
<div class="bm-section">
  <h2 class="mc-heading">Architecture</h2>
  <div class="bm-arch">
    <div class="bm-arch-row">
      <div class="bm-arch-node input">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5"/></svg>
        Video Input
      </div>
      <div class="bm-arch-connector">→</div>
      <div class="bm-arch-node model">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5"/></svg>
        CLIP ViT-L/14
      </div>
      <div class="bm-arch-connector">→</div>
      <div class="bm-arch-branch">
        <div class="bm-arch-node sub">Safety Head</div>
        <div class="bm-arch-node sub">UCF Violence</div>
        <div class="bm-arch-node sub">Context CLF</div>
      </div>
    </div>
    <div class="bm-arch-row bm-arch-row-bottom">
      <div class="bm-arch-connector-vert">↓ 55 Features</div>
      <div class="bm-arch-node decision">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5"/></svg>
        Decision Head
      </div>
      <div class="bm-arch-connector">→</div>
      <div class="bm-arch-node output safe">SAFE</div>
      <span class="bm-arch-slash">/</span>
      <div class="bm-arch-node output unsafe">UNSAFE</div>
    </div>
    <div class="bm-arch-insight">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" stroke="currentColor" stroke-width="1.5"/><path d="M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Key insight: <code>pipeline_pred_label</code> as meta-feature — the pipeline's own prediction becomes an input to the decision head
    </div>
  </div>
</div>

<!-- 3. Model Comparison Table -->
<div class="bm-section">
  <h2 class="mc-heading">Model Comparison</h2>
  <div class="bm-table-wrap">
    <table class="bm-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>bal_acc</th>
          <th class="bm-bar-col"></th>
          <th>FP</th>
          <th>FN</th>
          <th>Params</th>
          <th>Train Time</th>
        </tr>
      </thead>
      <tbody>
        {#each benchmarkData.models as row}
          <tr class:bm-best-row={row.isBest} class:bm-baseline-row={row.isBaseline}>
            <td class="bm-model-name">
              {row.name}
              {#if row.isBest}<span class="bm-best-badge">BEST</span>{/if}
              {#if row.isBaseline}<span class="bm-baseline-badge">BASE</span>{/if}
            </td>
            <td class="bm-mono">{row.balAcc.toFixed(4)}</td>
            <td class="bm-bar-col">
              <div class="bm-inline-bar-track">
                <div class="bm-inline-bar" class:best={row.isBest} style="width: {((row.balAcc - balAccRange.min) / (balAccRange.max - balAccRange.min)) * 100}%"></div>
              </div>
            </td>
            <td class="bm-mono">{row.fp !== null ? row.fp : '—'}</td>
            <td class="bm-mono">{row.fn !== null ? row.fn : '—'}</td>
            <td class="bm-mono bm-dim">{row.params}</td>
            <td class="bm-mono bm-dim">{row.time}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- 4. Feature Importance -->
<div class="bm-section">
  <h2 class="mc-heading">Feature Importance (Top 10)</h2>
  <div class="bm-features">
    {#each benchmarkData.featureImportance as feat, i}
      <div class="bm-feat-row" style="animation-delay: {i * 60}ms">
        <span class="bm-feat-name">{feat.name}</span>
        <div class="bm-feat-bar-track">
          <div class="bm-feat-bar" style="width: {(feat.value / featureMax) * 100}%"></div>
        </div>
        <span class="bm-feat-val">{feat.value.toFixed(3)}</span>
      </div>
    {/each}
  </div>
</div>

<!-- 5. Context Performance -->
<div class="bm-section">
  <h2 class="mc-heading">Context Performance</h2>
  <div class="bm-table-wrap">
    <table class="bm-table bm-context-table">
      <thead>
        <tr>
          <th>Context</th>
          <th>N</th>
          <th>Pipeline Acc</th>
          <th>DH Acc</th>
          <th>Diff</th>
          <th>Pipeline FP/FN</th>
          <th>DH FP/FN</th>
        </tr>
      </thead>
      <tbody>
        {#each benchmarkData.contextPerformance as ctx}
          {@const diff = ctx.dhAcc - ctx.pipeAcc}
          {@const fnImprovement = ctx.pipeFn - ctx.dhFn}
          <tr class:bm-highlight-row={fnImprovement >= 5}>
            <td class="bm-context-name">{ctx.context.replace(/_/g, ' ')}</td>
            <td class="bm-mono">{ctx.n}</td>
            <td class="bm-mono">{ctx.pipeAcc.toFixed(3)}</td>
            <td class="bm-mono">{ctx.dhAcc.toFixed(3)}</td>
            <td class="bm-mono" class:positive={diff > 0} class:negative={diff < 0}>
              {diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
            </td>
            <td class="bm-mono">{ctx.pipeFp}/{ctx.pipeFn}</td>
            <td class="bm-mono">
              {ctx.dhFp}/{ctx.dhFn}
              {#if fnImprovement >= 5}
                <span class="bm-fn-badge">FN {ctx.pipeFn}→{ctx.dhFn}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- 6. Experiment Timeline -->
<div class="bm-section">
  <h2 class="mc-heading">Research Timeline</h2>
  <div class="bm-timeline">
    {#each benchmarkData.timeline as evt, i}
      <div class="bm-tl-item {evt.type}" style="animation-delay: {i * 150}ms">
        <div class="bm-tl-dot"></div>
        <div class="bm-tl-card">
          <span class="bm-tl-date">{evt.date}</span>
          <span class="bm-tl-label">{evt.label}</span>
          <span class="bm-tl-detail">{evt.detail}</span>
        </div>
      </div>
    {/each}
    <div class="bm-tl-line"></div>
  </div>
</div>

<style>
  .mc-heading {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 var(--space-3, 12px);
    padding-bottom: var(--space-2, 8px);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .bm-section {
    margin-bottom: var(--space-8, 32px);
    animation: fade-up 500ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Toggle */
  .bm-toggle {
    display: flex;
    gap: 4px;
    margin-bottom: var(--space-5, 20px);
    background: var(--border-subtle, #EDEAE5);
    border-radius: var(--radius-sm, 6px);
    padding: 3px;
    width: fit-content;
  }
  .bm-toggle-btn {
    appearance: none;
    border: none;
    background: transparent;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    transition: all 200ms ease;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-toggle-btn.active {
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
  }

  /* Hero Grid */
  .bm-hero-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4, 16px);
  }
  .bm-hero-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    padding: var(--space-5, 20px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 200ms, box-shadow 200ms, transform 200ms;
  }
  .bm-hero-card:hover {
    border-color: rgba(217, 119, 87, 0.3);
    box-shadow: 0 0 16px rgba(217, 119, 87, 0.06);
    transform: translateY(-2px);
  }
  .bm-hero-label {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-hero-values {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .bm-hero-before {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-decoration: line-through;
    text-decoration-color: rgba(192, 57, 43, 0.4);
  }
  .bm-hero-arrow {
    font-size: 0.88rem;
    color: var(--text-muted, #9a9590);
  }
  .bm-hero-after {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent, #D97757);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-shadow: 0 0 8px rgba(217, 119, 87, 0.2);
  }
  .bm-hero-bar-track {
    height: 6px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: 3px;
    position: relative;
    overflow: hidden;
  }
  .bm-hero-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 3px;
    transition: width 800ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }
  .bm-hero-bar.baseline {
    background: var(--border, #E5E0DA);
    z-index: 1;
  }
  .bm-hero-bar.best {
    background: linear-gradient(90deg, var(--accent, #D97757), #e8a87c);
    z-index: 2;
    box-shadow: 0 0 8px rgba(217, 119, 87, 0.3);
  }
  .bm-hero-bar.fp-base, .bm-hero-bar.fn-base {
    background: var(--border, #E5E0DA);
    z-index: 1;
  }
  .bm-hero-bar.fp-best, .bm-hero-bar.fn-best {
    background: linear-gradient(90deg, var(--green, #27864a), #4caf6e);
    z-index: 2;
  }
  .bm-hero-delta {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-hero-delta.positive { color: var(--green, #27864a); }
  .bm-hero-delta.negative { color: var(--red, #c0392b); }

  /* Architecture Diagram */
  .bm-arch {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    padding: var(--space-6, 24px);
  }
  .bm-arch-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: var(--space-4, 16px);
  }
  .bm-arch-row-bottom {
    margin-bottom: var(--space-4, 16px);
  }
  .bm-arch-node {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
    font-size: 0.76rem;
    font-weight: 600;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    white-space: nowrap;
  }
  .bm-arch-node.input {
    background: rgba(45, 108, 162, 0.06);
    border-color: rgba(45, 108, 162, 0.2);
    color: var(--blue, #2d6ca2);
  }
  .bm-arch-node.model {
    background: rgba(142, 68, 173, 0.06);
    border-color: rgba(142, 68, 173, 0.2);
    color: #8e44ad;
  }
  .bm-arch-node.sub {
    font-size: 0.7rem;
    padding: 6px 10px;
    background: rgba(217, 119, 87, 0.04);
    border-color: rgba(217, 119, 87, 0.15);
  }
  .bm-arch-node.decision {
    background: rgba(217, 119, 87, 0.08);
    border-color: rgba(217, 119, 87, 0.3);
    color: var(--accent, #D97757);
    font-weight: 700;
    box-shadow: var(--glow-accent-sm, 0 0 6px rgba(217, 119, 87, 0.25));
  }
  .bm-arch-node.output {
    font-weight: 700;
    font-size: 0.72rem;
  }
  .bm-arch-node.output.safe {
    background: rgba(39, 134, 74, 0.08);
    border-color: rgba(39, 134, 74, 0.3);
    color: var(--green, #27864a);
  }
  .bm-arch-node.output.unsafe {
    background: rgba(192, 57, 43, 0.08);
    border-color: rgba(192, 57, 43, 0.3);
    color: var(--red, #c0392b);
  }
  .bm-arch-connector {
    font-size: 1.1rem;
    color: var(--text-muted, #9a9590);
    font-weight: 300;
  }
  .bm-arch-connector-vert {
    font-size: 0.72rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    text-align: center;
    padding: 4px 12px;
  }
  .bm-arch-slash {
    font-size: 1.1rem;
    color: var(--text-muted, #9a9590);
    font-weight: 300;
  }
  .bm-arch-branch {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bm-arch-insight {
    margin-top: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: rgba(217, 119, 87, 0.04);
    border: 1px solid rgba(217, 119, 87, 0.12);
    border-radius: var(--radius-sm, 6px);
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
  }
  .bm-arch-insight svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--accent, #D97757);
  }
  .bm-arch-insight code {
    background: rgba(217, 119, 87, 0.1);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.74rem;
    color: var(--accent, #D97757);
  }

  /* Model Comparison Table */
  .bm-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
  }
  .bm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .bm-table th {
    padding: 10px 14px;
    background: var(--border-subtle, #EDEAE5);
    font-size: 0.66rem;
    font-weight: 700;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    white-space: nowrap;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-table td {
    padding: 10px 14px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    color: var(--text-primary, #2D2D2D);
  }
  .bm-table tbody tr {
    transition: background 100ms;
  }
  .bm-table tbody tr:hover {
    background: rgba(217, 119, 87, 0.02);
  }
  .bm-best-row {
    background: rgba(39, 134, 74, 0.04) !important;
  }
  .bm-best-row:hover {
    background: rgba(39, 134, 74, 0.06) !important;
  }
  .bm-baseline-row {
    background: rgba(45, 108, 162, 0.03) !important;
  }
  .bm-model-name {
    font-weight: 600;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bm-best-badge {
    font-size: 0.56rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(39, 134, 74, 0.1);
    color: var(--green, #27864a);
    letter-spacing: 0.04em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-baseline-badge {
    font-size: 0.56rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(45, 108, 162, 0.1);
    color: var(--blue, #2d6ca2);
    letter-spacing: 0.04em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bm-mono {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
  }
  .bm-dim {
    color: var(--text-muted, #9a9590);
  }
  .bm-bar-col {
    width: 100px;
    padding: 10px 8px !important;
  }
  .bm-inline-bar-track {
    height: 4px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: 2px;
    overflow: hidden;
  }
  .bm-inline-bar {
    height: 100%;
    background: var(--accent-light, #E8D5C4);
    border-radius: 2px;
    transition: width 600ms var(--ease-out-expo);
  }
  .bm-inline-bar.best {
    background: linear-gradient(90deg, var(--accent, #D97757), #e8a87c);
    box-shadow: 0 0 4px rgba(217, 119, 87, 0.3);
  }

  /* Feature Importance */
  .bm-features {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bm-feat-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: 6px 0;
    animation: fade-up 400ms var(--ease-out-expo) both;
  }
  .bm-feat-name {
    width: 180px;
    flex-shrink: 0;
    font-size: 0.72rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-secondary, #6b6560);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bm-feat-bar-track {
    flex: 1;
    height: 10px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: 5px;
    overflow: hidden;
  }
  .bm-feat-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent, #D97757), #e8a87c);
    border-radius: 5px;
    transition: width 800ms var(--ease-out-expo);
    box-shadow: 0 0 4px rgba(217, 119, 87, 0.15);
  }
  .bm-feat-val {
    width: 50px;
    font-size: 0.72rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    font-weight: 600;
  }

  /* Context Performance */
  .bm-context-table td, .bm-context-table th {
    text-align: center;
  }
  .bm-context-table td:first-child, .bm-context-table th:first-child {
    text-align: left;
  }
  .bm-context-name {
    text-transform: capitalize;
    font-weight: 500;
    white-space: nowrap;
  }
  .bm-highlight-row {
    background: rgba(39, 134, 74, 0.04) !important;
  }
  .bm-highlight-row:hover {
    background: rgba(39, 134, 74, 0.06) !important;
  }
  .positive { color: var(--green, #27864a); }
  .negative { color: var(--red, #c0392b); }
  .bm-fn-badge {
    display: inline-block;
    font-size: 0.56rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(39, 134, 74, 0.12);
    color: var(--green, #27864a);
    margin-left: 4px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Timeline */
  .bm-timeline {
    display: flex;
    gap: 0;
    position: relative;
    padding: var(--space-5, 20px) 0;
    justify-content: space-between;
  }
  .bm-tl-line {
    position: absolute;
    top: 50%;
    left: 24px;
    right: 24px;
    height: 2px;
    background: var(--border, #E5E0DA);
    z-index: 0;
  }
  .bm-tl-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 1;
    flex: 1;
    animation: fade-up 400ms var(--ease-out-expo) both;
  }
  .bm-tl-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    transition: all 200ms;
  }
  .bm-tl-item.fail .bm-tl-dot {
    border-color: var(--red, #c0392b);
    background: rgba(192, 57, 43, 0.1);
  }
  .bm-tl-item.pivot .bm-tl-dot {
    border-color: var(--gold, #b7860e);
    background: rgba(183, 134, 14, 0.1);
  }
  .bm-tl-item.progress .bm-tl-dot {
    border-color: var(--blue, #2d6ca2);
    background: rgba(45, 108, 162, 0.1);
  }
  .bm-tl-item.success .bm-tl-dot {
    border-color: var(--green, #27864a);
    background: rgba(39, 134, 74, 0.15);
    box-shadow: var(--glow-green-sm, 0 0 6px rgba(39, 134, 74, 0.3));
  }
  .bm-tl-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
  }
  .bm-tl-date {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bm-tl-label {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .bm-tl-detail {
    font-size: 0.66rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Responsive */
  @media (max-width: 600px) {
    .bm-toggle { width: 100%; }
    .bm-toggle-btn { flex: 1; padding: 8px 8px; font-size: 0.68rem; }
    .bm-hero-grid { grid-template-columns: 1fr; }
    .bm-hero-after { font-size: 1.3rem; }
    .bm-arch-row { flex-direction: column; gap: 8px; }
    .bm-arch-branch { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 4px; }
    .bm-feat-name { width: 120px; font-size: 0.66rem; }
    .bm-timeline { flex-direction: column; gap: var(--space-3, 12px); padding: var(--space-3, 12px) 0; }
    .bm-tl-line { display: none; }
    .bm-tl-item { flex-direction: row; gap: var(--space-3, 12px); }
    .bm-tl-card { align-items: flex-start; text-align: left; }
  }
</style>
