<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import {
    jobStore,
    completedCount, keepCount, discardCount, crashCount,
    trainingCount as trainingCountStore,
    activeNodeCount as activeNodeCountStore,
    metricHistory, latestFinding,
    eventLog, trainingExperiment,
    scatterData, heatmapData, experimentTree,
    branchSummary,
    improvementDelta, bestBranch, isPaused,
    verificationCounts,
  } from '../stores/jobStore.ts';
  import { CATEGORY_COLORS } from '../data/modifications.ts';
  import type { ModCategory } from '../data/modifications.ts';
  import { fmtTime } from '../utils/format.ts';
  import { findBestIndex } from '../utils/chart.ts';
  import { AI_THOUGHTS } from '../data/modifications.ts';
  import PixelOwl from './PixelOwl.svelte';
  import MetricChart from './MetricChart.svelte';
  import ParamScatterChart from './ParamScatterChart.svelte';
  import ModificationHeatmap from './ModificationHeatmap.svelte';
  import ExperimentTree from './ExperimentTree.svelte';
  import DistributedView from './DistributedView.svelte';
  import ResearchTerminal from './ResearchTerminal.svelte';

  const dispatch = createEventDispatcher<{ stop: void }>();

  $: job = $jobStore;
  $: completed = $completedCount;
  $: keeps = $keepCount;
  $: discards = $discardCount;
  $: crashes = $crashCount;
  $: totalTarget = job.totalExperiments;
  $: history = $metricHistory;
  $: chartBestIdx = findBestIndex(history);
  $: hitRate = completed > 0 ? Math.round((keeps / completed) * 100) : 0;
  $: progress = totalTarget > 0 ? Math.round((completed / totalTarget) * 100) : 0;
  $: paused = $isPaused;
  $: runtimeReadonly = job.sourceMode === 'runtime' && !job.controlsAvailable;

  $: etaDisplay = (() => {
    if (completed === 0 || job.elapsedSeconds === 0) return '--';
    const rate = completed / job.elapsedSeconds;
    const remaining = totalTarget - completed;
    const etaSecs = Math.round(remaining / rate);
    const m = Math.floor(etaSecs / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  })();

  export let owlMood: 'idle' | 'research' | 'build' | 'celebrate' | 'sleep' = 'research';

  let aiThoughtIdx = 0;
  let aiThought = AI_THOUGHTS[0];
  let aiThoughtInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    aiThoughtInterval = setInterval(() => {
      aiThoughtIdx = (aiThoughtIdx + 1) % AI_THOUGHTS.length;
      aiThought = AI_THOUGHTS[aiThoughtIdx];
    }, 3200);
  });

  onDestroy(() => {
    clearInterval(aiThoughtInterval);
  });

  let terminalCollapsed = true;
</script>

<div class="running">

  <!-- ═══ COMMAND BAR ═══ -->
  <header class="cmd-bar" class:paused>
    <div class="cmd-left">
      <div class="cmd-owl"><PixelOwl size={0.4} mood={owlMood} /></div>
      <div class="cmd-info">
        <div class="cmd-topic-row">
          <span class="status-dot" class:paused></span>
          <span class="cmd-topic">{job.topic}</span>
        </div>
        <p class="cmd-thought">
          {#if runtimeReadonly}
            Runtime mirror mode — commands stay disabled until control plane unification lands
          {:else if paused}
            Paused — waiting for resume...
          {:else}
            {aiThought}
          {/if}
        </p>
      </div>
    </div>

    <div class="cmd-stats">
      <div class="cmd-stat">
        <span class="stat-num">{completed}<span class="stat-dim">/{totalTarget}</span></span>
        <span class="stat-lbl">Experiments</span>
      </div>
      <div class="cmd-divider"></div>
      <div class="cmd-stat">
        <span class="stat-num green">{keeps}</span>
        <span class="stat-lbl">Kept</span>
      </div>
      <div class="cmd-divider"></div>
      <div class="cmd-stat">
        <span class="stat-num">{fmtTime(job.elapsedSeconds)}</span>
        <span class="stat-lbl">Elapsed</span>
      </div>
    </div>

    <div class="cmd-actions">
      <button
        class="btn-cmd btn-cmd-pause"
        class:active={paused}
        disabled={runtimeReadonly}
        title={runtimeReadonly ? 'Runtime mesh is currently read-only' : paused ? 'Resume research' : 'Pause research'}
        on:click={() => jobStore.togglePause()}
      >
        {#if paused}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
          Resume
        {:else}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="15" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
          Pause
        {/if}
      </button>
      <button
        class="btn-cmd btn-cmd-stop"
        disabled={runtimeReadonly}
        title={runtimeReadonly ? 'Runtime mesh is currently read-only' : 'Stop research'}
        on:click={() => dispatch('stop')}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>
        Stop
      </button>
    </div>
  </header>

  <!-- Progress -->
  <div class="progress-strip">
    <div class="progress-track">
      <div class="progress-fill" class:paused style="width: {progress}%"></div>
    </div>
    <div class="progress-meta">
      <span>{progress}%{paused ? ' · PAUSED' : ''}</span>
      <span>ETA {etaDisplay}</span>
      <span>Hit rate {hitRate}%</span>
    </div>
  </div>

  <!-- ═══ HERO BAND — number + inline sparkline + stats ═══ -->
  <div class="hero-band">
    <div class="hero-left">
      <div class="hero-number" class:improving={$improvementDelta !== null && $improvementDelta.percent > 0}>
        {job.bestMetric === Infinity ? '—' : job.bestMetric.toFixed(3)}
      </div>
      <div class="hero-meta">
        <span class="hero-label">BEST VAL_BPB</span>
        {#if $improvementDelta}
          <span class="delta-badge">▼ {$improvementDelta.percent}%</span>
          <span class="delta-from">from {$improvementDelta.baseline.toFixed(3)}</span>
        {/if}
      </div>
    </div>

    {#if $bestBranch}
      <div class="hero-attribution">
        <span class="hero-attr-dot" style="background: {$bestBranch.color}"></span>
        <span class="hero-attr-name">{$bestBranch.label}</span>
      </div>
    {/if}

    <!-- Inline sparkline — Apple Stocks style -->
    <div class="hero-sparkline">
      <MetricChart data={history} bestIndex={chartBestIdx} width={320} height={36} showMovingAvg={true} />
    </div>

    <div class="hero-counts">
      <span class="hc"><span class="hc-val green">{keeps}</span><span class="hc-lbl">keep</span></span>
      <span class="hc"><span class="hc-val">{discards}</span><span class="hc-lbl">disc</span></span>
      <span class="hc"><span class="hc-val red">{crashes}</span><span class="hc-lbl">err</span></span>
      <span class="hc"><span class="hc-val">{$activeNodeCountStore}</span><span class="hc-lbl">nodes</span></span>
    </div>
  </div>

  <!-- ═══ VERIFICATION PIPELINE ═══ -->
  <div class="verify-strip">
    <span class="vs-label">COMMIT-REVEAL</span>
    <div class="vs-pipe">
      <div class="vs-stage">
        <span class="vs-dot pending"></span>
        <span class="vs-count">{$verificationCounts.pending}</span>
        <span class="vs-name">Pending</span>
      </div>
      <div class="vs-connector" style="animation-delay: 0s"></div>
      <div class="vs-stage">
        <span class="vs-dot committed"></span>
        <span class="vs-count">{$verificationCounts.committed}</span>
        <span class="vs-name">Committed</span>
      </div>
      <div class="vs-connector" style="animation-delay: 0.4s"></div>
      <div class="vs-stage">
        <span class="vs-dot revealed"></span>
        <span class="vs-count">{$verificationCounts.revealed}</span>
        <span class="vs-name">Revealed</span>
      </div>
      <div class="vs-connector" style="animation-delay: 0.8s"></div>
      <div class="vs-stage">
        <span class="vs-dot verified"></span>
        <span class="vs-count">{$verificationCounts.verified}</span>
        <span class="vs-name">Verified</span>
      </div>
      <div class="vs-connector spot" style="animation-delay: 1.2s"></div>
      <div class="vs-stage">
        <span class="vs-dot spot-checked"></span>
        <span class="vs-count">{$verificationCounts.spotChecked}</span>
        <span class="vs-name">Spot-check</span>
      </div>
    </div>
    <span class="vs-total">{$verificationCounts.verified + $verificationCounts.spotChecked}/{completed} finalized</span>
  </div>

  <!-- ═══ MAIN CONTENT: Branch Ranking + Analysis Panel ═══ -->
  <div class="main-content">

    <!-- LEFT: Branch Ranking Panel -->
    <div class="branch-panel">
      <div class="panel-head">
        <span class="panel-title">Strategy Ranking</span>
        <span class="panel-meta">{$branchSummary.filter(b => !b.paused).length}/{$branchSummary.length} active</span>
      </div>
      <div class="branch-list">
        {#each $branchSummary as branch, i}
          <div
            class="branch-row"
            class:boosted={branch.boosted}
            class:row-paused={branch.paused}
          >
            <div class="br-rank">
              <span class="br-rank-num" style="color: {CATEGORY_COLORS[branch.category]}">{i + 1}</span>
            </div>
            <div class="br-info">
              <div class="br-top">
                <span class="br-color" style="background: {CATEGORY_COLORS[branch.category]}"></span>
                <span class="br-name">{branch.label}</span>
                {#if branch.active}
                  <span class="br-live">LIVE</span>
                {/if}
                {#if branch.bestMetric < Infinity}
                  <span class="br-best">{branch.bestMetric.toFixed(3)}</span>
                {:else}
                  <span class="br-best muted">—</span>
                {/if}
              </div>
              <div class="br-bar-row">
                <div class="br-bar-track">
                  <div
                    class="br-bar-fill"
                    style="width: {branch.hitRate}%; background: {CATEGORY_COLORS[branch.category]}"
                  ></div>
                </div>
                <span class="br-rate">{branch.hitRate}%</span>
                <span class="br-count">{branch.keeps}/{branch.total}</span>
              </div>
            </div>
            <div class="br-actions">
              <button
                class="br-btn"
                class:br-btn-active={branch.boosted}
                disabled={runtimeReadonly}
                title={branch.boosted ? 'Boosted' : 'Boost'}
                on:click={() => jobStore.toggleCategoryBoost(branch.category)}
              >
                <svg width="9" height="9" viewBox="0 0 16 16" shape-rendering="crispEdges"><polygon points="8,1 10,6 15,6 11,9 12,14 8,11 4,14 5,9 1,6 6,6" fill="currentColor"/></svg>
              </button>
              <button
                class="br-btn"
                class:br-btn-paused={branch.paused}
                disabled={runtimeReadonly}
                title={branch.paused ? 'Resume' : 'Pause'}
                on:click={() => jobStore.toggleCategoryPause(branch.category)}
              >
                {#if branch.paused}
                  <svg width="8" height="8" viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>
                {:else}
                  <svg width="8" height="8" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="3" height="12" rx="0.5" fill="currentColor"/><rect x="10" y="2" width="3" height="12" rx="0.5" fill="currentColor"/></svg>
                {/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- RIGHT: Analysis Panel -->
    <!-- RIGHT: Analysis 2×2 Grid — all charts visible -->
    <div class="analysis-grid">
      <div class="a-card">
        <div class="a-head">
          <span class="a-title">Scatter</span>
          <span class="a-badge">{$scatterData.length} pts</span>
        </div>
        <div class="a-body">
          <ParamScatterChart data={$scatterData} width={320} height={160} />
        </div>
      </div>
      <div class="a-card">
        <div class="a-head">
          <span class="a-title">Effect</span>
          <span class="a-badge">keep rate</span>
        </div>
        <div class="a-body">
          <ModificationHeatmap data={$heatmapData} width={320} height={160} />
        </div>
      </div>
      <div class="a-card">
        <div class="a-head">
          <span class="a-title">Lineage</span>
          <span class="a-badge">{$experimentTree.length}</span>
        </div>
        <div class="a-body">
          <ExperimentTree data={$experimentTree} width={320} bestMetric={job.bestMetric} />
        </div>
      </div>
      <div class="a-card">
        <div class="a-head">
          <span class="a-title">Mesh</span>
          <span class="a-badge">{$activeNodeCountStore} nodes</span>
        </div>
        <div class="a-body">
          <DistributedView experiments={job.experiments} bestMetric={job.bestMetric} width={320} />
        </div>
      </div>
    </div>

  </div>

  <!-- ═══ TERMINAL ═══ -->
  <button class="term-toggle" on:click={() => terminalCollapsed = !terminalCollapsed}>
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" shape-rendering="crispEdges">
      <rect x="1" y="1" width="14" height="3" fill="currentColor" opacity="0.8"/>
      <rect x="1" y="5.5" width="9" height="1.5" fill="currentColor" opacity="0.4"/>
      <rect x="1" y="8.5" width="12" height="1.5" fill="currentColor" opacity="0.25"/>
    </svg>
    <span>{terminalCollapsed ? 'Show' : 'Hide'} Terminal</span>
    {#if $eventLog.length > 0}
      <span class="term-count">{$eventLog.length}</span>
    {/if}
    <span class="term-chevron" class:open={!terminalCollapsed}>&#9662;</span>
  </button>

  {#if !terminalCollapsed}
    <div class="term-wrap">
      <ResearchTerminal eventLog={$eventLog} trainingExp={$trainingExperiment} collapsed={false} />
    </div>
  {/if}
</div>

<style>
  /* ─── Foundation — Ultra-High Density ─── */
  .running {
    max-width: 1400px; margin: 0 auto;
    padding: 4px 10px 2px;
    height: calc(100vh - 50px);
    display: flex; flex-direction: column; gap: 2px;
    overflow: hidden;
    animation: fadeUp 0.3s ease-out;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ─── COMMAND BAR — Tier 2 Shadow ─── */
  .cmd-bar {
    display: flex; align-items: center; gap: 12px;
    padding: 5px 12px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    flex-shrink: 0;
    transition: border-color 300ms ease, box-shadow 300ms ease;
  }
  .cmd-bar.paused { border-color: rgba(212,160,23,0.35); }

  .cmd-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .cmd-owl { flex-shrink: 0; }
  .cmd-info { flex: 1; min-width: 0; }
  .cmd-topic-row { display: flex; align-items: center; gap: 6px; }
  .status-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: var(--green, #27864a);
    box-shadow: 0 0 8px rgba(39,134,74,0.5);
    animation: pulse 2s ease-in-out infinite;
  }
  .status-dot.paused {
    background: var(--gold, #d4a017);
    box-shadow: 0 0 8px rgba(212,160,23,0.45);
    animation: none;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  .cmd-topic {
    font: 700 0.7rem/1.2 var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    text-transform: uppercase; letter-spacing: 0.04em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cmd-thought {
    margin: 1px 0 0; padding: 0;
    font: italic 0.52rem/1.2 var(--font-body, 'Inter', sans-serif);
    color: var(--text-muted, #9a9590);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .cmd-stats { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .cmd-stat { display: flex; flex-direction: column; align-items: center; gap: 0; }
  .stat-num {
    font: 700 0.78rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D); font-variant-numeric: tabular-nums;
    line-height: 1.15; letter-spacing: -0.02em;
  }
  .stat-num.green { color: var(--green, #27864a); }
  .stat-dim { font-weight: 400; color: var(--text-muted, #9a9590); font-size: 0.6rem; }
  .stat-lbl {
    font: 600 0.44rem var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted, #9a9590);
  }
  .cmd-divider { width: 1px; height: 22px; background: var(--border, #E5E0DA); }

  .cmd-actions { display: flex; gap: 5px; flex-shrink: 0; }
  .btn-cmd {
    appearance: none; border: 1px solid; border-radius: 6px;
    font: 700 0.56rem var(--font-mono, 'JetBrains Mono', monospace);
    padding: 5px 10px; cursor: pointer;
    display: flex; align-items: center; gap: 4px;
    transition: all 200ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .btn-cmd:hover:not(:disabled) { transform: scale(1.04) translateY(-1px); }
  .btn-cmd:active:not(:disabled) { transform: scale(0.97); transition-duration: 80ms; }
  .btn-cmd:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn-cmd-pause {
    border-color: rgba(183,134,14,0.3); background: rgba(183,134,14,0.04);
    color: var(--gold, #b7860e);
  }
  .btn-cmd-pause:hover:not(:disabled) { background: rgba(183,134,14,0.1); box-shadow: 0 0 8px rgba(183,134,14,0.3); }
  .btn-cmd-pause.active {
    border-color: rgba(39,134,74,0.35); background: rgba(39,134,74,0.06);
    color: var(--green, #27864a);
  }
  .btn-cmd-stop {
    border-color: rgba(192,57,43,0.2); background: rgba(192,57,43,0.03);
    color: var(--red, #c0392b);
  }
  .btn-cmd-stop:hover:not(:disabled) { background: rgba(192,57,43,0.08); box-shadow: 0 0 8px rgba(192,57,43,0.3); }

  /* ─── PROGRESS — Shimmer + Leading Glow ─── */
  .progress-strip { flex-shrink: 0; }
  .progress-track {
    height: 4px; background: var(--border-subtle, #EDEAE5);
    border-radius: 3px; overflow: hidden; position: relative;
  }
  .progress-fill {
    height: 100%; border-radius: 3px; position: relative;
    background: linear-gradient(90deg, var(--accent, #D97757), #E8956E);
    transition: width 600ms ease;
  }
  .progress-fill::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%);
    background-size: 200% 100%;
    animation: shimmer 2.5s linear infinite;
  }
  .progress-fill::before {
    content: ''; position: absolute; right: -3px; top: 50%; transform: translateY(-50%);
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent, #D97757);
    box-shadow: 0 0 8px rgba(217,119,87,0.5), 0 0 3px rgba(217,119,87,0.3);
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .progress-fill.paused {
    background: linear-gradient(90deg, var(--gold, #d4a017), #e8c44e);
  }
  .progress-fill.paused::after { animation: none; }
  .progress-fill.paused::before { background: var(--gold, #d4a017); box-shadow: 0 0 8px rgba(212,160,23,0.5); }
  .progress-meta {
    display: flex; justify-content: space-between; margin-top: 1px;
    font: 500 0.46rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590); letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  /* ─── HERO BAND — Tier 3 Shadow + Neon Glow ─── */
  .hero-band {
    display: flex; align-items: center; gap: 10px;
    padding: 5px 14px;
    background: var(--surface, #fff);
    border: 1px solid rgba(217,119,87,0.12);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    flex-shrink: 0;
  }

  .hero-left { flex-shrink: 0; }
  .hero-number {
    font: 800 2.2rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    line-height: 1; letter-spacing: -0.04em;
    transition: color 400ms ease, text-shadow 400ms ease;
  }
  .hero-number.improving {
    color: var(--green, #27864a);
    text-shadow: 0 0 24px rgba(39,134,74,0.2), 0 0 6px rgba(39,134,74,0.1);
    animation: heroGlow 2.5s ease-in-out infinite;
  }
  @keyframes heroGlow {
    0%, 100% { text-shadow: 0 0 24px rgba(39,134,74,0.2), 0 0 6px rgba(39,134,74,0.1); }
    50%      { text-shadow: 0 0 36px rgba(39,134,74,0.3), 0 0 10px rgba(39,134,74,0.15); }
  }

  .hero-meta {
    display: flex; align-items: center; gap: 6px; margin-top: 1px;
  }
  .hero-label {
    font: 700 0.46rem var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--text-muted, #9a9590);
  }
  .delta-badge {
    font: 700 0.56rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--green, #27864a);
    background: rgba(39,134,74,0.08);
    padding: 1px 6px; border-radius: 5px;
    box-shadow: 0 0 6px rgba(39,134,74,0.2);
  }
  .delta-from {
    font: 500 0.46rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
  }

  .hero-attribution {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 6px;
    background: rgba(0,0,0,0.025);
    flex-shrink: 0;
  }
  .hero-attr-dot { width: 8px; height: 8px; border-radius: 50%; }
  .hero-attr-name {
    font: 600 0.52rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-secondary, #6b6560);
  }

  /* Inline sparkline — fills remaining space */
  .hero-sparkline {
    flex: 1; min-width: 80px;
    display: flex; align-items: center; justify-content: flex-end;
    overflow: hidden;
  }
  .hero-sparkline :global(svg) { width: 100%; height: 36px; }

  .hero-counts {
    display: flex; gap: 8px; flex-shrink: 0;
    padding-left: 10px;
    border-left: 1px solid var(--border-subtle, #EDEAE5);
  }
  .hc { display: flex; flex-direction: column; align-items: center; gap: 0; }
  .hc-val {
    font: 700 0.7rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D); font-variant-numeric: tabular-nums;
    line-height: 1.1; letter-spacing: -0.02em;
  }
  .hc-val.green { color: var(--green, #27864a); }
  .hc-val.red { color: var(--red, #c0392b); }
  .hc-lbl {
    font: 500 0.4rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590); text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ─── MAIN CONTENT GRID ─── */
  .main-content {
    flex: 1; min-height: 0;
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 4px;
  }

  /* ─── BRANCH RANKING PANEL (left) ─── */
  .branch-panel {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .panel-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 5px 10px 3px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    flex-shrink: 0;
  }
  .panel-title {
    font: 800 0.54rem var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-secondary, #6b6560);
  }
  .panel-meta {
    font: 500 0.46rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
  }
  .branch-list {
    flex: 1; overflow-y: auto; padding: 2px 0;
    scrollbar-width: none;
  }
  .branch-list::-webkit-scrollbar { display: none; }

  .branch-row {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border-bottom: 1px solid rgba(0,0,0,0.03);
    transition: all 200ms ease;
  }
  .branch-row:last-child { border-bottom: none; }
  .branch-row:hover { background: rgba(217,119,87,0.03); transform: translateX(2px); }
  .branch-row.boosted { background: rgba(183,134,14,0.03); box-shadow: inset 3px 0 0 var(--gold, #d4a017); }
  .branch-row.row-paused { opacity: 0.4; }

  .br-rank { width: 16px; flex-shrink: 0; text-align: center; }
  .br-rank-num {
    font: 800 0.7rem var(--font-mono, 'JetBrains Mono', monospace);
    line-height: 1;
  }
  .br-info { flex: 1; min-width: 0; }
  .br-top {
    display: flex; align-items: center; gap: 4px; margin-bottom: 2px;
  }
  .br-color { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .br-name {
    font: 600 0.54rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .br-live {
    font: 700 0.36rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--green, #27864a); background: rgba(39,134,74,0.1);
    padding: 0 3px; border-radius: 2px;
    animation: pulse 2s ease-in-out infinite;
    position: relative;
  }
  .br-live::after {
    content: ''; position: absolute; inset: -2px;
    border-radius: 4px; border: 1px solid var(--green, #27864a);
    animation: liveRing 2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes liveRing {
    0% { opacity: 0.6; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.5); }
  }
  .br-best {
    font: 700 0.52rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    margin-left: auto; flex-shrink: 0;
    letter-spacing: -0.02em;
  }
  .br-best.muted { color: var(--text-muted, #9a9590); }

  .br-bar-row {
    display: flex; align-items: center; gap: 5px;
  }
  .br-bar-track {
    flex: 1; height: 4px;
    background: rgba(0,0,0,0.05);
    border-radius: 2px; overflow: hidden;
  }
  .br-bar-fill {
    height: 100%; border-radius: 2px;
    transition: width 400ms ease;
    min-width: 1px; position: relative; overflow: hidden;
  }
  .br-bar-fill::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25));
    border-radius: 2px;
  }
  .br-rate {
    font: 700 0.46rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-secondary, #6b6560);
    width: 24px; text-align: right; flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .br-count {
    font: 500 0.42rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    width: 22px; flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .br-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .br-btn {
    appearance: none; border: 1px solid transparent;
    background: transparent; border-radius: 4px;
    padding: 3px 4px; cursor: pointer;
    color: var(--text-muted, #9a9590);
    transition: all 150ms ease;
    display: flex; align-items: center;
  }
  .br-btn:hover:not(:disabled) { background: rgba(0,0,0,0.04); transform: scale(1.15); }
  .br-btn:active:not(:disabled) { transform: scale(0.9); }
  .br-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .br-btn:disabled:hover { background: transparent; }
  .br-btn-active {
    color: var(--gold, #b7860e);
    background: rgba(183,134,14,0.08);
    border-color: rgba(183,134,14,0.2);
  }
  .br-btn-paused {
    color: var(--green, #27864a);
    background: rgba(39,134,74,0.06);
    border-color: rgba(39,134,74,0.15);
  }

  /* ─── ANALYSIS 2×2 GRID (right) ─── */
  .analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 3px;
    min-height: 0;
    overflow: hidden;
  }

  .a-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px; overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    min-height: 0; flex: 1 1 0;
    display: flex; flex-direction: column;
    transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
  }
  .a-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(217,119,87,0.15);
    border-color: rgba(217,119,87,0.15);
  }
  .a-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    flex-shrink: 0;
  }
  .a-head-right { display: flex; align-items: center; gap: 6px; }
  .a-title {
    font: 800 0.5rem var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-secondary, #6b6560);
  }
  .a-badge {
    font: 600 0.42rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    background: rgba(0,0,0,0.03); padding: 1px 5px; border-radius: 100px;
  }
  .a-body {
    padding: 2px 5px 1px;
    display: flex; justify-content: center; align-items: flex-start;
    flex: 1 1 0; min-height: 0; overflow: hidden;
    max-height: 100%;
  }
  .a-body :global(svg) {
    width: 100%; height: auto; max-height: 100%; display: block;
    object-fit: contain;
  }

  /* ─── LEGEND ─── */
  .lg {
    display: inline-flex; align-items: center; gap: 2px;
    font: 500 0.42rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
  }
  .lg-dot { width: 5px; height: 5px; border-radius: 50%; }

  /* ─── VERIFICATION PIPELINE — Animated Connectors ─── */
  .verify-strip {
    display: flex; align-items: center; gap: 10px;
    padding: 3px 14px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    flex-shrink: 0;
    position: relative; overflow: hidden;
  }
  .verify-strip::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(217,119,87,0.02), rgba(39,134,74,0.02), transparent);
    background-size: 300% 100%;
    animation: vsShimmer 8s linear infinite;
  }
  @keyframes vsShimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -200% 0; }
  }
  .vs-label {
    font: 800 0.42rem var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted, #9a9590);
    flex-shrink: 0; position: relative; z-index: 1;
  }
  .vs-pipe {
    display: flex; align-items: center; gap: 4px;
    flex: 1; justify-content: center; position: relative; z-index: 1;
  }
  .vs-stage {
    display: flex; align-items: center; gap: 3px;
  }
  .vs-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }
  .vs-dot.pending { background: var(--text-muted, #9a9590); }
  .vs-dot.committed { background: #e67e22; box-shadow: 0 0 6px rgba(230,126,34,0.3); }
  .vs-dot.revealed { background: #2980b9; box-shadow: 0 0 6px rgba(41,128,185,0.3); }
  .vs-dot.verified { background: var(--green, #27864a); box-shadow: 0 0 6px rgba(39,134,74,0.3); }
  .vs-dot.spot-checked { background: #8b5cf6; box-shadow: 0 0 6px rgba(139,92,246,0.3); }
  .vs-count {
    font: 700 0.56rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    min-width: 12px; text-align: center;
    letter-spacing: -0.02em;
  }
  .vs-name {
    font: 500 0.42rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
  }
  .vs-connector {
    width: 24px; height: 2px; position: relative;
    background: var(--border-subtle, #EDEAE5); border-radius: 1px;
    overflow: hidden; flex-shrink: 0;
  }
  .vs-connector::after {
    content: ''; position: absolute; top: -1px;
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--accent, #D97757);
    box-shadow: 0 0 6px rgba(217,119,87,0.4);
    animation: particleFlow 1.8s ease-in-out infinite;
    animation-delay: inherit;
  }
  .vs-connector.spot::after {
    background: #8b5cf6;
    box-shadow: 0 0 6px rgba(139,92,246,0.4);
  }
  @keyframes particleFlow {
    0% { left: -4px; opacity: 0; }
    15% { opacity: 1; }
    85% { opacity: 1; }
    100% { left: calc(100% + 4px); opacity: 0; }
  }
  .vs-total {
    font: 600 0.44rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    flex-shrink: 0;
    margin-left: auto; position: relative; z-index: 1;
  }

  /* ─── TERMINAL ─── */
  .term-toggle {
    appearance: none; width: 100%;
    border: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.012); border-radius: 6px;
    font: 600 0.48rem var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    padding: 2px 10px; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 150ms ease;
    flex-shrink: 0;
  }
  .term-toggle:hover { background: rgba(0,0,0,0.03); }
  .term-count {
    background: var(--accent, #D97757); color: #fff;
    font-size: 0.42rem; font-weight: 700;
    padding: 0 5px; border-radius: 100px;
  }
  .term-chevron {
    margin-left: auto; font-size: 0.55rem;
    transition: transform 200ms ease;
  }
  .term-chevron.open { transform: rotate(180deg); }
  .term-wrap {
    border-radius: 8px; overflow: hidden;
    max-height: 200px; flex-shrink: 0;
  }

  /* ─── Hide footer when running ─── */
  :global(.app-shell:has(.running) > footer) { display: none !important; }
  :global(.app-shell:has(.running) .autoresearch) { min-height: 0; }

  /* ─── Responsive ─── */
  @media (max-width: 900px) {
    .running { height: auto; overflow: auto; padding: 10px 12px 32px; gap: 4px; }
    .cmd-bar { flex-wrap: wrap; gap: 8px; }
    .cmd-stats { order: 3; width: 100%; justify-content: space-around; }
    .hero-band { flex-wrap: wrap; }
    .hero-sparkline { min-width: 100%; order: 5; }
    .hero-counts { border-left: none; padding-left: 0; }
    .main-content { grid-template-columns: 1fr; }
    .branch-panel { max-height: 200px; }
  }
  @media (max-width: 600px) {
    .running { padding: 8px 8px 24px; gap: 3px; }
    .cmd-actions { width: 100%; justify-content: stretch; }
    .cmd-actions .btn-cmd { flex: 1; justify-content: center; }
    .hero-number { font-size: 1.5rem; }
    .main-content { gap: 3px; }
  }
</style>
