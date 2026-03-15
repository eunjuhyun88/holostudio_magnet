<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from '../stores/router.ts';
  import {
    jobStore, keepCount, crashCount, completedCount, activeNodeCount,
    experimentTree, scatterData, heatmapData,
    branchSummary, improvementDelta, bestBranch, isPaused,
    avgDuration, totalGpuTime, bestFrontier, sparkPoints,
  } from '../stores/jobStore.ts';
  import { selectedExperimentId } from '../stores/selectionStore.ts';
  import { CATEGORY_COLORS, type ModCategory } from '../data/modifications.ts';
  import { readRuntimeConfig } from '../api/client.ts';
  import { isConnected } from '../stores/connectionStore.ts';

  // Components
  import PromptBar from '../components/PromptBar.svelte';
  import ConvergenceChart from '../components/ConvergenceChart.svelte';
  import ActivityStream from '../components/ActivityStream.svelte';
  import ResearchStats from '../components/ResearchStats.svelte';
  import ContextPanel from '../components/ContextPanel.svelte';
  import ResearchFocusModal from '../components/ResearchFocusModal.svelte';

  import ExperimentTreemap from '../components/ExperimentTreemap.svelte';
  import ExperimentTree from '../components/ExperimentTree.svelte';
  import DistributedView from '../components/DistributedView.svelte';
  import ParamScatterChart from '../components/ParamScatterChart.svelte';
  import ModificationHeatmap from '../components/ModificationHeatmap.svelte';
  import PixelOwl from '../components/PixelOwl.svelte';

  // Reactive state
  $: job = $jobStore;
  $: phase = job.phase;
  $: delta = $improvementDelta;
  $: bestBr = $bestBranch;
  $: paused = $isPaused;
  $: runtimeReadonly = job.sourceMode === 'runtime' && !job.controlsAvailable;

  type FocusView = 'convergence' | 'activity' | 'treemap' | 'context' | 'lineage' | 'mesh' | 'scatter' | 'effect';

  const FOCUS_TABS: { id: FocusView; label: string }[] = [
    { id: 'convergence', label: 'Convergence' },
    { id: 'activity', label: 'Activity' },
    { id: 'treemap', label: 'Map' },
    { id: 'scatter', label: 'Scatter' },
    { id: 'effect', label: 'Effect' },
    { id: 'lineage', label: 'Lineage' },
    { id: 'mesh', label: 'Mesh' },
    { id: 'context', label: 'Detail' },
  ];

  const FOCUS_META: Record<FocusView, { title: string; hint: string }> = {
    convergence: {
      title: 'Convergence Timeline',
      hint: 'Track metric movement with a larger canvas so inflection points and outliers stay readable.',
    },
    activity: {
      title: 'Activity Feed',
      hint: 'Review the live experiment stream with more breathing room and faster scanning.',
    },
    treemap: {
      title: 'Experiment Map',
      hint: 'Drill into research categories and compare experiment clusters at a readable scale.',
    },
    context: {
      title: 'Research Detail Panel',
      hint: 'Expand the selected experiment or run summary without squeezing the rest of the dashboard.',
    },
    lineage: {
      title: 'Lineage Tree',
      hint: 'Inspect ancestry, promotions, and verification states in a wider branch graph.',
    },
    mesh: {
      title: 'Mesh Network',
      hint: 'View node activity and swarm convergence together in a full analysis canvas.',
    },
    scatter: {
      title: 'Scatter Plot',
      hint: 'Compare val_bpb across experiment categories — spot outliers and trends.',
    },
    effect: {
      title: 'Effect (Keep Rate)',
      hint: 'See which modification strategies have the highest success rate.',
    },
  };

  let focusView: FocusView | null = null;
  let innerWidth = 1440;
  let innerHeight = 900;

  $: focusMeta = focusView ? FOCUS_META[focusView] : null;
  $: focusChartWidth = Math.max(760, Math.min(1320, innerWidth - 160));
  $: focusChartHeight = Math.max(320, Math.min(720, innerHeight - 260));
  $: focusPanelHeight = Math.max(460, Math.min(860, innerHeight - 220));

  // Mobile tab switching (only applies ≤600px)
  type MobileTab = 'activity' | 'charts' | 'network';
  const MOBILE_TABS: MobileTab[] = ['activity', 'charts', 'network'];
  let mobileTab: MobileTab = 'activity';
  $: mobileTabIndex = MOBILE_TABS.indexOf(mobileTab);

  // Owl mood for hero
  $: heroOwlMood = (() => {
    if (phase === 'running') return 'research' as const;
    if (phase === 'setup') return 'build' as const;
    if (phase === 'complete') return 'celebrate' as const;
    return 'idle' as const;
  })();

  // Progress + ETA (cached — only recalculated when inputs change)
  $: totalExp = job.totalExperiments || 60;
  $: completed = $completedCount;
  $: progress = totalExp > 0 ? Math.round((completed / totalExp) * 100) : 0;

  let _etaCache = { completed: -1, elapsed: -1, total: -1, result: '—' };
  $: eta = (() => {
    const c = _etaCache;
    if (c.completed === completed && c.elapsed === job.elapsedSeconds && c.total === totalExp) return c.result;
    if (completed === 0 || job.elapsedSeconds === 0) { c.result = '—'; }
    else if (completed >= totalExp) { c.result = '0s'; }
    else {
      const secs = Math.round((totalExp - completed) / (completed / job.elapsedSeconds));
      c.result = secs >= 3600 ? `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`
               : secs >= 60 ? `${Math.floor(secs / 60)}m`
               : `${secs}s`;
    }
    c.completed = completed; c.elapsed = job.elapsedSeconds; c.total = totalExp;
    return c.result;
  })();

  // Footer + sparkline + chart data: now from store-derived values
  // avgDuration, totalGpuTime, bestFrontier, sparkPoints, scatterData, heatmapData
  // all imported from jobStore.ts

  // Handlers
  function handleLaunch(e: CustomEvent<string>) {
    if ($isConnected) {
      const rc = readRuntimeConfig();
      void jobStore.connectRuntime(rc);
      return;
    }
    jobStore.startJob(e.detail);
  }
  function handleStop() { jobStore.stopJob(); }
  function handleNewResearch() { jobStore.reset(); }
  function handlePause() { jobStore.togglePause(); }
  function openFocus(view: FocusView) { focusView = view; }
  function closeFocus() { focusView = null; }
  function handleDeploy(e: CustomEvent<{ target: string }>) {
    console.log('Deploy requested:', e.detail.target);
    alert(`Deploy to ${e.detail.target} — coming soon!`);
  }
  function handleRetrain(e: CustomEvent<{ code: string; parentId: number | null }>) {
    console.log('Retrain requested with edited code:', e.detail);
    jobStore.reset();
    jobStore.startJob(job.topic || 'Custom retrain');
  }
  function handleImprove(e: CustomEvent<{ instruction: string }>) {
    console.log('Improve requested:', e.detail.instruction);
    const prevTopic = job.topic || 'Research';
    jobStore.reset();
    jobStore.startJob(`${prevTopic} (improved: ${e.detail.instruction})`);
  }

  // Auto-connect on mount when in connected mode (no auto-start — user must click)
  onMount(() => {
    if ($isConnected) {
      const rc = readRuntimeConfig();
      void jobStore.connectRuntime(rc);
    }
  });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="research-page" class:idle={phase === 'idle'} class:running={phase === 'running' || phase === 'setup'}>

  <!-- ═══ PROMPT BAR ═══ -->
  <div class="tile prompt-tile" style="grid-area: prompt">
    <PromptBar
      {phase}
      topic={job.topic}
      {progress} {eta} {paused}
      setupMessage={job.setupMessage}
      {runtimeReadonly}
      on:stop={handleStop}
      on:pause={handlePause}
      on:newresearch={handleNewResearch}
    />
  </div>

  <!-- ═══ HERO BAND ═══ -->
  <div class="tile hero-tile" style="grid-area: hero">
    <div class="hero-owl">
      <PixelOwl size={0.35} mood={heroOwlMood} />
    </div>
    <div class="hero-data">
      {#if job.bestMetric < Infinity}
        <div class="hero-top">
          <div class="hero-metric">{job.bestMetric.toFixed(2)}</div>
          <div class="hero-sublabel">val_bpb</div>
        </div>
        <div class="hero-compare">
          {#if delta}
            <div class="hero-delta">▼ {delta.percent}%</div>
          {/if}
          {#if job.baselineMetric < Infinity}
            <div class="hero-from">from {job.baselineMetric.toFixed(2)}</div>
          {/if}
        </div>
        {#if bestBr}
          <div class="hero-branch" style="color: {bestBr.color}">{bestBr.label}</div>
        {/if}
        {#if $bestFrontier.length > 1}
          <svg class="hero-spark" viewBox="0 0 120 20" preserveAspectRatio="none">
            <polyline points={$sparkPoints} fill="none" stroke="#D97757" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        {/if}
      {:else}
        <div class="hero-metric dim">—</div>
        <div class="hero-sublabel">val_bpb</div>
      {/if}
    </div>
  </div>

  <!-- ═══ CONVERGENCE CHART ═══ -->
  <div class="tile titled-tile converge-tile" style="grid-area: converge">
    <div class="tile-header">
      <span class="tile-title">Convergence</span>
      <span class="tile-hint">val_bpb over experiments</span>
      <button
        class="tile-focus-btn"
        type="button"
        aria-label="Expand convergence chart"
        title="Expand convergence chart"
        on:click={() => openFocus('convergence')}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" />
        </svg>
      </button>
    </div>
    {#if job.experiments.length > 0}
      <ConvergenceChart experiments={job.experiments} bestMetric={job.bestMetric} baselineMetric={job.baselineMetric} width={960} height={120} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ STATS ═══ -->
  <div class="tile" style="grid-area: stats">
    <ResearchStats
      nodes={$activeNodeCount}
      keeps={$keepCount}
      crashes={$crashCount}
      completed={$completedCount}
      total={totalExp}
      hitRate={completed > 0 ? Math.round(($keepCount / completed) * 100) : 0}
    />
  </div>

  <!-- ═══ MOBILE TAB CONTROL (iOS segment control) ═══ -->
  <div class="mobile-tabs" role="tablist" aria-label="Mobile content sections">
    <div class="mtab-track">
      <div class="mtab-indicator" style="transform: translateX({mobileTabIndex * 100}%)"></div>
      {#each MOBILE_TABS as tab}
        <button
          class="mtab-btn"
          class:mtab-active={mobileTab === tab}
          role="tab"
          aria-selected={mobileTab === tab}
          on:click={() => mobileTab = tab}
        >{tab === 'activity' ? 'Activity' : tab === 'charts' ? 'Charts' : 'Mesh'}</button>
      {/each}
    </div>
  </div>

  <!-- ═══ BRANCHES ═══ -->
  <div class="tile branches-tile mtab-activity" class:mtab-hidden={mobileTab !== 'activity'} style="grid-area: branches">
    <div class="section-head">Branches</div>
    {#if $branchSummary.length > 0}
      <div class="branch-list">
        {#each $branchSummary as branch, i}
          <div
            class="branch-row"
            class:active-training={branch.active}
            class:boosted={branch.boosted}
            role="button"
            tabindex="0"
            on:click={() => {
              const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric);
              if (bestExp) selectedExperimentId.set(bestExp.id);
            }}
            on:keydown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric);
                if (bestExp) selectedExperimentId.set(bestExp.id);
              }
            }}
          >
            <span class="br-rank" style="background: {CATEGORY_COLORS[branch.category]}15; color: {CATEGORY_COLORS[branch.category]}">{i + 1}</span>
            <div class="br-info">
              <span class="br-name">{branch.label}</span>
              {#if branch.active}<span class="br-live">⚡</span>{/if}
              <span class="br-metric">{branch.bestMetric < Infinity ? branch.bestMetric.toFixed(3) : '—'}</span>
            </div>
            <span class="br-hit">{branch.hitRate}%</span>
            <div class="br-actions">
              <button
                type="button"
                class="br-btn"
                class:br-btn-active={branch.boosted}
                disabled={runtimeReadonly}
                aria-label={`Boost ${branch.label}`}
                title="Boost"
                on:click|stopPropagation={() => jobStore.toggleCategoryBoost(branch.category)}
              >★</button>
              <button
                type="button"
                class="br-btn"
                class:br-btn-paused={branch.paused}
                disabled={runtimeReadonly}
                aria-label={branch.paused ? `Resume ${branch.label}` : `Pause ${branch.label}`}
                title={branch.paused ? 'Resume' : 'Pause'}
                on:click|stopPropagation={() => jobStore.toggleCategoryPause(branch.category)}
              >{branch.paused ? '▶' : '⏸'}</button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-tile"><span class="empty-hint">No branches yet</span></div>
    {/if}
  </div>

  <!-- ═══ ACTIVITY STREAM ═══ -->
  <div class="tile mtab-activity" class:mtab-hidden={mobileTab !== 'activity'} style="grid-area: stream">
    <ActivityStream
      experiments={$jobStore.experiments}
      bestMetric={job.bestMetric}
      expandable
      on:expand={() => openFocus('activity')}
    />
  </div>

  <!-- ═══ SCATTER (val_bpb by category) ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: scatter">
    <div class="tile-header">
      <span class="tile-title">Scatter</span>
      <span class="tile-hint">{$scatterData.length} pts</span>
      <button class="tile-focus-btn" type="button" aria-label="Expand scatter" title="Expand scatter" on:click={() => openFocus('scatter')}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg>
      </button>
    </div>
    {#if $scatterData.length > 0}
      <ParamScatterChart data={$scatterData} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ EFFECT (keep rate by category) ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: effect">
    <div class="tile-header">
      <span class="tile-title">Effect</span>
      <span class="tile-hint">keep rate</span>
      <button class="tile-focus-btn" type="button" aria-label="Expand effect" title="Expand effect" on:click={() => openFocus('effect')}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg>
      </button>
    </div>
    {#if Object.keys($heatmapData).length > 0}
      <ModificationHeatmap data={$heatmapData} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ TREEMAP (drill-down experiment explorer) ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: treemap">
    <div class="tile-header">
      <span class="tile-title">Experiment Map</span>
      <span class="tile-hint">drill down by category</span>
      <button class="tile-focus-btn" type="button" aria-label="Expand experiment map" title="Expand experiment map" on:click={() => openFocus('treemap')}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg>
      </button>
    </div>
    {#if job.experiments.length > 0}
      <ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ CONTEXT PANEL (terminal) ═══ -->
  <div class="tile context-tile" style="grid-area: context">
    <ContextPanel
      bestMetric={job.bestMetric}
      {phase}
      topic={job.topic}
      {progress}
      sessionId={job.experiments.length > 0 ? job.experiments[0].nodeId.slice(-6) : ''}
      branches={$branchSummary}
      experiments={$jobStore.experiments}
      totalExperiments={totalExp}
      expandable
      on:launch={handleLaunch}
      on:newresearch={handleNewResearch}
      on:deploy={handleDeploy}
      on:retrain={handleRetrain}
      on:improve={handleImprove}
      on:expand={() => openFocus('context')}
    />
  </div>

  <!-- ═══ LINEAGE TREE ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: lineage">
    <div class="tile-header">
      <span class="tile-title">Lineage</span>
      <span class="tile-hint">experiment tree &amp; ancestry</span>
      <button
        class="tile-focus-btn"
        type="button"
        aria-label="Expand lineage tree"
        title="Expand lineage tree"
        on:click={() => openFocus('lineage')}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" />
        </svg>
      </button>
    </div>
    {#if $experimentTree.length > 0}
      <ExperimentTree data={$experimentTree} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ MESH VIEW ═══ -->
  <div class="tile titled-tile mtab-network" class:mtab-hidden={mobileTab !== 'network'} style="grid-area: mesh">
    <div class="tile-header">
      <span class="tile-title">Mesh Network</span>
      <span class="tile-hint">distributed GPU nodes</span>
      <button
        class="tile-focus-btn"
        type="button"
        aria-label="Expand mesh network"
        title="Expand mesh network"
        on:click={() => openFocus('mesh')}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" />
        </svg>
      </button>
    </div>
    {#if job.experiments.length > 0}
      <DistributedView experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><span class="empty-hint">Waiting for data…</span></div>
    {/if}
  </div>

  <!-- ═══ FOOTER: DISTRIBUTED STATUS ═══ -->
  <div class="tile footer-tile" style="grid-area: footer">
    <div class="footer-dist">
      <div class="fd-item">
        <span class="fd-val">{$activeNodeCount}</span>
        <span class="fd-lbl">Active Nodes</span>
      </div>
      <div class="fd-sep"></div>
      <div class="fd-item">
        <span class="fd-val">{$completedCount}<span class="fd-dim">/{totalExp}</span></span>
        <span class="fd-lbl">Experiments</span>
      </div>
      <div class="fd-sep"></div>
      <div class="fd-item">
        <span class="fd-val">{$avgDuration}s</span>
        <span class="fd-lbl">Avg Duration</span>
      </div>
      <div class="fd-sep"></div>
      <div class="fd-item">
        <span class="fd-val">{$totalGpuTime}</span>
        <span class="fd-lbl">GPU Time</span>
      </div>
    </div>
    <div class="fd-progress">
      <div
        class="fd-bar"
        class:fd-bar--active={phase === 'running' || phase === 'setup'}
        class:fd-bar--complete={progress >= 100}
        style="width: {progress}%"
      ></div>
    </div>
  </div>
</div>

{#if focusMeta}
  <ResearchFocusModal
    open={true}
    title={focusMeta.title}
    hint={focusMeta.hint}
    tabs={FOCUS_TABS}
    activeTab={focusView ?? ''}
    on:close={closeFocus}
    on:tabchange={(e) => { focusView = e.detail as FocusView; }}
  >
    {#key focusView}
      {#if focusView === 'convergence'}
        <div class="focus-stage focus-stage--chart">
          <ConvergenceChart
            experiments={job.experiments}
            bestMetric={job.bestMetric}
            baselineMetric={job.baselineMetric}
            width={focusChartWidth}
            height={focusChartHeight}
          />
        </div>
      {:else if focusView === 'activity'}
        <div class="focus-stage focus-stage--panel" style={`height:${focusPanelHeight}px`}>
          <ActivityStream experiments={$jobStore.experiments} bestMetric={job.bestMetric} expanded />
        </div>
      {:else if focusView === 'treemap'}
        <div class="focus-stage focus-stage--fill" style={`height:${focusPanelHeight}px`}>
          <ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} />
        </div>
      {:else if focusView === 'context'}
        <div class="focus-stage focus-stage--panel focus-stage--detail" style={`height:${focusPanelHeight}px`}>
          <ContextPanel
            bestMetric={job.bestMetric}
            {phase}
            topic={job.topic}
            {progress}
            sessionId={job.experiments.length > 0 ? job.experiments[0].nodeId.slice(-6) : ''}
            branches={$branchSummary}
            experiments={$jobStore.experiments}
            totalExperiments={totalExp}
            expanded
            on:launch={handleLaunch}
            on:newresearch={handleNewResearch}
            on:deploy={handleDeploy}
            on:retrain={handleRetrain}
            on:improve={handleImprove}
          />
        </div>
      {:else if focusView === 'scatter'}
        <div class="focus-stage focus-stage--chart">
          <ParamScatterChart data={$scatterData} width={focusChartWidth} height={focusChartHeight} />
        </div>
      {:else if focusView === 'effect'}
        <div class="focus-stage focus-stage--fill" style={`height:${focusPanelHeight}px`}>
          <ModificationHeatmap data={$heatmapData} width={focusChartWidth} height={focusPanelHeight} />
        </div>
      {:else if focusView === 'lineage'}
        <div class="focus-stage focus-stage--scroll">
          <ExperimentTree data={$experimentTree} bestMetric={job.bestMetric} width={focusChartWidth} />
        </div>
      {:else if focusView === 'mesh'}
        <div class="focus-stage focus-stage--scroll">
          <DistributedView experiments={job.experiments} bestMetric={job.bestMetric} width={focusChartWidth} />
        </div>
      {/if}
    {/key}
  </ResearchFocusModal>
{/if}

<style>
  /* ═══ GRID LAYOUT ═══ */
  .research-page {
    height: calc(100vh - 48px);
    display: grid;
    grid-template-columns: 150px minmax(100px, 1fr) 1fr 1fr 260px;
    grid-template-rows: auto 56px minmax(80px, 1fr) 1fr 36px;
    grid-template-areas:
      "prompt    prompt    prompt    prompt    prompt"
      "hero      converge  converge  converge  stats"
      "branches  stream    scatter   effect    context"
      "branches  treemap   lineage   mesh      context"
      "footer    footer    footer    footer    footer";
    gap: 4px;
    overflow: hidden;
    background: var(--page-bg, #FAF9F7);
  }

  .tile {
    background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 10px;
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.04));
    overflow: hidden;
    min-height: 0;
  }

  .prompt-tile {
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
    box-shadow: none;
  }
  .context-tile {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
  }
  .converge-tile :global(svg.convergence-chart) {
    width: 100%;
    height: auto;
    display: block;
  }

  /* ═══ HERO ═══ */
  .hero-tile {
    display: flex; flex-direction: row;
    align-items: center; justify-content: center;
    padding: 8px 12px; gap: 8px;
  }
  .hero-owl {
    flex-shrink: 0;
    display: flex; align-items: center;
  }
  .hero-data {
    display: flex; flex-direction: column;
    align-items: center; gap: 2px;
  }
  .hero-top {
    display: flex; align-items: baseline; gap: 4px;
  }
  .hero-metric {
    font: 900 2rem/1 'Inter', -apple-system, sans-serif;
    color: #1a1a1a;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .hero-metric.dim { color: #ddd; font-size: 2rem; }
  .hero-compare {
    display: flex; align-items: center; gap: 4px;
  }
  .hero-delta {
    font: 700 10px/1 'Inter', -apple-system, sans-serif;
    color: #27864a;
    background: rgba(39, 134, 74, 0.06);
    padding: 2px 6px; border-radius: 4px;
  }
  .hero-from {
    font: 400 9px/1 'Inter', -apple-system, sans-serif;
    color: #bbb;
  }
  .hero-branch {
    font: 600 8px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .hero-sublabel {
    font: 500 8px/1 'Inter', -apple-system, sans-serif;
    color: #ccc; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .hero-spark {
    width: 80px; height: 16px; margin-top: 2px;
  }

  /* ═══ BRANCHES ═══ */
  .branches-tile {
    display: flex; flex-direction: column;
    padding: 8px 0;
  }
  .section-head {
    font: 600 10px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.06em; color: #bbb;
    text-transform: uppercase;
    padding: 4px 12px 8px; flex-shrink: 0;
  }
  .branch-list {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column; gap: 2px;
    padding: 0 4px;
  }
  .branch-list::-webkit-scrollbar { width: 3px; }
  .branch-list::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 2px; }

  .branch-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px; cursor: pointer;
    border-radius: 10px;
    transition: background 150ms, transform 150ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    transform-origin: left center;
  }
  .branch-row:hover {
    background: rgba(217, 119, 87, 0.04);
    transform: scale(1.01);
  }
  .branch-row.active-training { animation: branchPulse 2s ease-in-out infinite; }
  @keyframes branchPulse {
    0%, 100% { background: transparent; }
    50% { background: rgba(217, 119, 87, 0.03); }
  }
  .branch-row.boosted { box-shadow: inset 2px 0 0 #d4a017; }

  .br-rank {
    font: 700 9px/1 'Inter', -apple-system, sans-serif;
    width: 18px; height: 18px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 5px; flex-shrink: 0;
  }
  .br-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
  .br-name {
    font: 600 11px/1 'Inter', -apple-system, sans-serif;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: #444;
  }
  .br-live { font-size: 10px; }
  .br-metric {
    font: 700 11px/1 'Inter', -apple-system, sans-serif;
    color: #999;
    margin-left: auto; flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .br-hit {
    font: 500 10px/1 'Inter', -apple-system, sans-serif;
    color: #ccc;
    flex-shrink: 0; width: 24px; text-align: right;
  }
  .br-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .br-btn {
    width: 20px; height: 20px; border: none; border-radius: 5px;
    background: transparent; color: #ccc;
    font-size: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 150ms;
  }
  .br-btn:hover:not(:disabled) { background: #f5f5f5; color: #666; }
  .br-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .br-btn-active { color: #d4a017; }
  .br-btn-paused { color: #D97757; }

  /* ═══ TILE HEADERS ═══ */
  .titled-tile {
    display: flex; flex-direction: column;
  }
  .tile-header {
    display: flex; align-items: baseline; gap: 6px;
    padding: 8px 12px 4px; flex-shrink: 0;
  }
  .tile-title {
    font: 600 9px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.06em; color: #999;
    text-transform: uppercase;
  }
  .tile-hint {
    font: 400 8px/1 'Inter', -apple-system, sans-serif;
    color: #ccc;
  }
  .tile-focus-btn {
    position: relative;
    margin-left: auto;
    width: 24px; height: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid rgba(82,67,51,0.1);
    border-radius: 7px;
    background: rgba(255,255,255,0.9);
    color: #8d7f70;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, color 150ms ease;
  }
  .tile-focus-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(217,119,87,0.24);
    color: #D97757;
  }
  .tile-focus-btn::after {
    content: attr(title);
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(30,25,20,0.88);
    color: #f5ede8;
    font: 500 10px/1.2 'Inter', -apple-system, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 150ms, transform 150ms;
  }
  .tile-focus-btn:hover::after {
    opacity: 1;
    transform: translateY(0);
  }
  .tile-focus-btn svg {
    width: 13px; height: 13px;
    fill: none; stroke: currentColor; stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
  }

  /* ═══ FOCUS STAGE ═══ */
  .focus-stage {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.82), rgba(249,245,240,0.86));
    border: 1px solid rgba(82,67,51,0.08);
    border-radius: 22px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
  }
  .focus-stage--chart {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 360px;
    padding: 20px;
  }
  .focus-stage--fill {
    overflow: hidden;
  }
  .focus-stage--panel {
    max-width: 1080px;
    margin: 0 auto;
    overflow: hidden;
  }
  .focus-stage--detail {
    max-width: 980px;
  }
  .focus-stage--scroll {
    overflow: auto;
    padding: 20px;
  }

  /* ═══ EMPTY TILES ═══ */
  .empty-tile {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100%; padding: 16px;
  }
  .empty-inner {
    flex: 1; display: flex; align-items: center; justify-content: center;
  }
  .empty-hint {
    font: 400 10px/1 'Inter', -apple-system, sans-serif;
    color: #ddd;
  }

  /* ═══ FOOTER ═══ */
  .footer-tile {
    display: flex; flex-direction: column;
    justify-content: center;
    padding: 4px 16px; gap: 3px;
  }
  .footer-dist {
    display: flex; align-items: center; gap: 12px;
  }
  .fd-item {
    display: flex; align-items: baseline; gap: 4px;
  }
  .fd-val {
    font: 700 10px/1 'Inter', -apple-system, sans-serif;
    color: #444;
    font-variant-numeric: tabular-nums;
  }
  .fd-dim { color: #bbb; font-weight: 400; }
  .fd-lbl {
    font: 400 8px/1 'Inter', -apple-system, sans-serif;
    color: #bbb;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .fd-sep {
    width: 1px; height: 10px; background: #eee;
  }
  .fd-progress {
    width: 100%; height: 2px;
    background: #f0f0f0; border-radius: 2px;
    overflow: hidden;
  }
  .fd-bar {
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 2px;
    transition: width 300ms ease, background 500ms ease;
  }
  .fd-bar--active {
    background: linear-gradient(
      90deg,
      var(--accent, #D97757) 0%,
      #e89a7e 50%,
      var(--accent, #D97757) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
  }
  .fd-bar--complete {
    background: var(--green, #27864a);
  }

  /* ═══ MOBILE TABS (iOS segment control) ═══ */
  .mobile-tabs {
    display: none;
    grid-area: mtabs;
  }
  .mtab-track {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    padding: 3px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .mtab-indicator {
    position: absolute;
    top: 3px; bottom: 3px; left: 3px;
    width: calc((100% - 6px) / 3);
    background: #fff;
    border-radius: 9px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04);
    transition: transform 280ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    z-index: 0;
  }
  .mtab-btn {
    position: relative; z-index: 1;
    font: 600 11px/1 'Inter', -apple-system, sans-serif;
    padding: 7px 0;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: #999;
    cursor: pointer;
    transition: color 200ms;
    text-align: center;
  }
  .mtab-btn.mtab-active {
    color: var(--accent, #D97757);
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 1024px) {
    .research-page {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto auto auto auto auto auto auto;
      grid-template-areas:
        "prompt    prompt"
        "hero      stats"
        "converge  converge"
        "branches  stream"
        "scatter   effect"
        "treemap   lineage"
        "mesh      context"
        "footer    footer";
      height: auto; overflow-y: auto;
      gap: 6px;
      padding: 0 4px 4px;
    }
  }

  @media (max-width: 600px) {
    .research-page {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto auto auto auto auto auto auto auto auto auto auto auto;
      grid-template-areas:
        "prompt"
        "context"
        "hero"
        "stats"
        "mtabs"
        "converge"
        "branches"
        "stream"
        "scatter"
        "effect"
        "treemap"
        "lineage"
        "mesh"
        "footer";
      gap: 8px;
      padding: 0 6px 14px;
    }
    .hero-owl { display: none; }
    .hero-tile {
      justify-content: flex-start;
      padding: 10px 12px;
    }
    .hero-data {
      align-items: flex-start;
    }
    .hero-compare {
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .branch-list { max-height: 200px; }
    .br-actions { display: none; }
    .mobile-tabs {
      display: flex;
      gap: 4px;
      padding: 0 2px;
      justify-content: center;
      position: sticky;
      top: 0;
      z-index: var(--z-widget, 3);
      background: linear-gradient(180deg, rgba(250, 249, 247, 0.96), rgba(250, 249, 247, 0.88));
      backdrop-filter: blur(10px);
      border-radius: 12px;
    }
    .context-tile {
      min-height: 0;
      overflow: hidden;
    }
    .tile {
      border-radius: 14px;
    }
    .footer-tile {
      padding: 8px 12px;
    }
    .fd-progress {
      margin-top: 2px;
    }
    .mtab-hidden { display: none !important; }
  }
</style>
