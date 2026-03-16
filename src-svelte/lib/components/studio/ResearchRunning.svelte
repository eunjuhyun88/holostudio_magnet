<script lang="ts">
  /**
   * ResearchRunning — Full 5-column research dashboard (Studio RUNNING state).
   *
   * Brings back the original AutoresearchPage grid layout with all chart components,
   * adapted for embedding in MagnetStudioPage's state machine.
   *
   * Grid (desktop):
   *   ┌────────────────────────────────────────────────────────────┐
   *   │ PromptBar (header + controls)                              │
   *   ├──────┬───────────────────────────────────────────┬────────┤
   *   │ Hero │ Convergence Chart                         │ Stats  │
   *   ├──────┼────────────┬────────────┬────────────┬────┴────────┤
   *   │ Brs  │ Activity   │ Scatter    │ Effect     │ Context     │
   *   │      ├────────────┼────────────┼────────────┤ Terminal    │
   *   │      │ Treemap    │ Lineage    │ Mesh       │             │
   *   ├──────┴────────────┴────────────┴────────────┴─────────────┤
   *   │ Footer (stats bar + progress)                              │
   *   └───────────────────────────────────────────────────────────┘
   *
   * Events:
   *   stop: void
   *   submit: { text: string; parentId: number | null }
   *   zoomIn: void
   */
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import {
    jobStore,
    keepCount, crashCount, completedCount, activeNodeCount,
    experimentTree, scatterData, heatmapData,
    branchSummary, improvementDelta, bestBranch, isPaused,
    avgDuration, totalGpuTime, bestFrontier, sparkPoints,
    eventLog, trainingExperiment,
  } from '../../stores/jobStore.ts';
  import type { BranchInfo, Experiment } from '../../stores/jobStore.ts';
  import { selectedExperimentId } from '../../stores/selectionStore.ts';
  import { CATEGORY_COLORS, CATEGORY_LABELS, resolveExperimentCategory } from '../../data/modifications.ts';
  import { humanizeModification } from '../../stores/jobTypes.ts';

  // Chart components
  import PromptBar from '../PromptBar.svelte';
  import ConvergenceChart from '../ConvergenceChart.svelte';
  import ActivityStream from '../ActivityStream.svelte';
  import ResearchStats from '../ResearchStats.svelte';
  import ContextPanel from '../ContextPanel.svelte';
  import ResearchFocusModal from '../ResearchFocusModal.svelte';
  import ExperimentTreemap from '../ExperimentTreemap.svelte';
  import ExperimentTree from '../ExperimentTree.svelte';
  import DistributedView from '../DistributedView.svelte';
  import ParamScatterChart from '../ParamScatterChart.svelte';
  import ModificationHeatmap from '../ModificationHeatmap.svelte';
  import ResearchTerminal from '../ResearchTerminal.svelte';

  export let topic: string = '';
  export let progress: number = 0;
  export let sessionId: string = '';
  export let branches: BranchInfo[] = [];
  export let totalExperiments: number = 0;
  export let bestMetric: number = Infinity;
  export let experiments: { status: string }[] = [];

  const dispatch = createEventDispatcher<{
    stop: void;
    submit: { text: string; parentId: number | null };
    zoomIn: void;
    viewResults: void;
  }>();

  // Forced cancellation state (ResearchJobCancelledByProtocol AUTO)
  let forceCancelled = false;
  let forceCancelReason = '';
  let forceCancelRefund = '0';

  // Detect unexpected cancellation by protocol
  $: if ($jobStore.phase === 'complete' && !forceCancelled) {
    // Will be handled by parent, but if still mounted → show banner
  }

  /** Called by parent to trigger force cancel banner */
  export function showForceCancelBanner(reason: string, refund: string) {
    forceCancelled = true;
    forceCancelReason = reason;
    forceCancelRefund = refund;
  }

  // Reactive state from store
  $: job = $jobStore;
  $: phase = job.phase;
  $: delta = $improvementDelta;
  $: bestBr = $bestBranch;
  $: paused = $isPaused;
  $: runtimeReadonly = job.sourceMode === 'runtime' && !job.controlsAvailable;
  $: trainingExps = job.experiments.filter(e => e.status === 'training');
  $: totalExp = job.totalExperiments || 60;
  $: completed = $completedCount;

  // Focus modal
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
    convergence: { title: 'Convergence Timeline', hint: 'Track metric movement with a larger canvas.' },
    activity: { title: 'Activity Feed', hint: 'Review the live experiment stream.' },
    treemap: { title: 'Experiment Map', hint: 'Drill into research categories.' },
    context: { title: 'Research Detail Panel', hint: 'Expand the selected experiment.' },
    lineage: { title: 'Lineage Tree', hint: 'Inspect ancestry and verification states.' },
    mesh: { title: 'Mesh Network', hint: 'View node activity and swarm convergence.' },
    scatter: { title: 'Scatter Plot', hint: 'Compare val_bpb across experiment categories.' },
    effect: { title: 'Effect (Keep Rate)', hint: 'See which strategies have the highest success rate.' },
  };

  let focusView: FocusView | null = null;
  let innerWidth = 1440;
  let innerHeight = 900;

  $: focusMeta = focusView ? FOCUS_META[focusView] : null;
  $: focusChartWidth = Math.max(760, Math.min(1320, innerWidth - 160));
  $: focusChartHeight = Math.max(320, Math.min(720, innerHeight - 260));
  $: focusPanelHeight = Math.max(460, Math.min(860, innerHeight - 220));

  // Mobile tabs
  type MobileTab = 'activity' | 'charts' | 'network';
  const MOBILE_TABS: MobileTab[] = ['activity', 'charts', 'network'];
  let mobileTab: MobileTab = 'activity';
  $: mobileTabIndex = MOBILE_TABS.indexOf(mobileTab);

  function openFocus(view: FocusView) { focusView = view; }
  function closeFocus() { focusView = null; }

  function handleStop() { dispatch('stop'); }
  function handlePause() { jobStore.togglePause(); }
  function handleZoomIn() { dispatch('zoomIn'); }

  function handleSubmitFromPrompt(e: CustomEvent<string>) {
    dispatch('submit', { text: e.detail, parentId: null });
  }
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="research-page running">
  {#if forceCancelled}
    <div class="cancel-banner" transition:fly={{ y: -12, duration: 250 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#f38ba8"/></svg>
      <div class="cancel-banner-body">
        <span class="cancel-banner-title">⚠ Research was auto-cancelled</span>
        {#if forceCancelReason}
          <span class="cancel-banner-reason">Reason: {forceCancelReason}</span>
        {/if}
        {#if forceCancelRefund && forceCancelRefund !== '0'}
          <span class="cancel-banner-refund">Unused budget {forceCancelRefund} HOOT to be refunded</span>
        {/if}
      </div>
      <button class="cancel-banner-btn" on:click={() => { forceCancelled = false; dispatch('viewResults'); }}>OK</button>
    </div>
  {/if}
  <!-- ═══ PROMPT BAR ═══ -->
  <div class="tile prompt-tile" style="grid-area: prompt">
    <PromptBar
      {phase}
      topic={job.topic}
      {progress}
      eta={'—'}
      {paused}
      setupMessage={job.setupMessage}
      {runtimeReadonly}
      bestMetric={job.bestMetric}
      deltaPercent={delta?.percent ?? null}
      completed={$completedCount}
      total={totalExp}
      keeps={$keepCount}
      crashes={$crashCount}
      hitRate={completed > 0 ? Math.round(($keepCount / completed) * 100) : 0}
      on:stop={handleStop}
      on:pause={handlePause}
    />
  </div>

  <!-- ═══ ACTIVE OPS / HERO ═══ -->
  <div class="tile hero-tile" style="grid-area: hero">
    {#if trainingExps.length > 0}
      <div class="ops-list">
        {#each trainingExps as t (t.id)}
          <div class="ops-row" on:click={() => selectedExperimentId.set(t.id)}>
            <span class="ops-id">#{t.id}</span>
            <span class="ops-cat" style="color: {CATEGORY_COLORS[resolveExperimentCategory(t.modification)]}">{CATEGORY_LABELS[resolveExperimentCategory(t.modification)] ?? '?'}</span>
            <span class="ops-mod">{humanizeModification(t.modification)}</span>
            <span class="ops-node">{t.nodeId.slice(-8)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="ops-fallback">
        {#if job.bestMetric < Infinity}
          <span class="ops-best">{job.bestMetric.toFixed(3)}</span>
          {#if delta}<span class="ops-delta">▼{delta.percent}%</span>{/if}
          {#if bestBr}<span class="ops-branch" style="color: {bestBr.color}">{bestBr.label}</span>{/if}
          {#if $bestFrontier.length > 1}
            <svg class="ops-spark" viewBox="0 0 120 20" preserveAspectRatio="none">
              <polyline points={$sparkPoints} fill="none" stroke="#D97757" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          {/if}
        {:else}
          <span class="ops-idle">Waiting...</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ═══ CONVERGENCE CHART ═══ -->
  <div class="tile titled-tile converge-tile" style="grid-area: converge">
    <div class="tile-header">
      <span class="tile-title">Convergence</span>
      <span class="tile-hint">val_bpb over experiments</span>
      <button class="tile-focus-btn" type="button" title="Expand" data-hint={FOCUS_META.convergence.hint} on:click={() => openFocus('convergence')}>
        <svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg>
      </button>
    </div>
    {#if job.experiments.length > 0}
      <ConvergenceChart experiments={job.experiments} bestMetric={job.bestMetric} baselineMetric={job.baselineMetric} width={960} height={120} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
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

  <!-- ═══ MOBILE TABS ═══ -->
  <div class="mobile-tabs" role="tablist">
    <div class="mtab-track">
      <div class="mtab-indicator" style="transform: translateX({mobileTabIndex * 100}%)"></div>
      {#each MOBILE_TABS as tab}
        <button class="mtab-btn" class:mtab-active={mobileTab === tab} role="tab" aria-selected={mobileTab === tab} on:click={() => mobileTab = tab}>
          {tab === 'activity' ? 'Activity' : tab === 'charts' ? 'Charts' : 'Mesh'}
        </button>
      {/each}
    </div>
  </div>

  <!-- ═══ BRANCHES ═══ -->
  <div class="tile branches-tile mtab-activity" class:mtab-hidden={mobileTab !== 'activity'} style="grid-area: branches">
    <div class="section-head">Branches</div>
    {#if $branchSummary.length > 0}
      <div class="branch-list">
        {#each $branchSummary as branch, i}
          <div class="branch-row" class:active-training={branch.active} class:boosted={branch.boosted} role="button" tabindex="0"
            on:click={() => { const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric); if (bestExp) selectedExperimentId.set(bestExp.id); }}
            on:keydown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric); if (bestExp) selectedExperimentId.set(bestExp.id); } }}
          >
            <span class="br-rank" style="background: {CATEGORY_COLORS[branch.category]}15; color: {CATEGORY_COLORS[branch.category]}">{i + 1}</span>
            <div class="br-info">
              <span class="br-name">{branch.label}</span>
              {#if branch.active}<span class="br-live"><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z"/></svg></span>{/if}
              <span class="br-metric">{branch.bestMetric < Infinity ? branch.bestMetric.toFixed(3) : '—'}</span>
            </div>
            <span class="br-kdc">{branch.keeps}/{branch.total - branch.keeps - branch.crashes}/{branch.crashes}</span>
            <span class="br-hit">{branch.hitRate}%</span>
            <div class="br-actions">
              <button type="button" class="br-btn" class:br-btn-active={branch.boosted} disabled={runtimeReadonly} title="Boost" on:click|stopPropagation={() => jobStore.toggleCategoryBoost(branch.category)}><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2.2 4.5 5 .7-3.6 3.5.8 5L8 12.4 3.6 14.7l.8-5L.8 6.2l5-.7z"/></svg></button>
              <button type="button" class="br-btn" class:br-btn-paused={branch.paused} disabled={runtimeReadonly} title={branch.paused ? 'Resume' : 'Pause'} on:click|stopPropagation={() => jobStore.toggleCategoryPause(branch.category)}>{#if branch.paused}<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg>{:else}<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="4" height="14" rx="1"/><rect x="10" y="1" width="4" height="14" rx="1"/></svg>{/if}</button>
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
    <ActivityStream experiments={$jobStore.experiments} bestMetric={job.bestMetric} expandable on:expand={() => openFocus('activity')} />
  </div>

  <!-- ═══ SCATTER ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: scatter">
    <div class="tile-header">
      <span class="tile-title">Scatter</span>
      <span class="tile-hint">{$scatterData.length} pts</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.scatter.hint} on:click={() => openFocus('scatter')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if $scatterData.length > 0}
      <ParamScatterChart data={$scatterData} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
    {/if}
  </div>

  <!-- ═══ EFFECT (heatmap) ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: effect">
    <div class="tile-header">
      <span class="tile-title">Effect</span>
      <span class="tile-hint">keep rate</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.effect.hint} on:click={() => openFocus('effect')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if Object.keys($heatmapData).length > 0}
      <ModificationHeatmap data={$heatmapData} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
    {/if}
  </div>

  <!-- ═══ TREEMAP ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: treemap">
    <div class="tile-header">
      <span class="tile-title">Experiment Map</span>
      <span class="tile-hint">drill down by category</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.treemap.hint} on:click={() => openFocus('treemap')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if job.experiments.length > 0}
      <ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
    {/if}
  </div>

  <!-- ═══ CONTEXT PANEL ═══ -->
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
      on:expand={() => openFocus('context')}
    />
  </div>

  <!-- ═══ TERMINAL ═══ -->
  <div class="tile terminal-tile" style="grid-area: terminal">
    <ResearchTerminal eventLog={$eventLog} trainingExp={$trainingExperiment} />
  </div>

  <!-- ═══ LINEAGE ═══ -->
  <div class="tile titled-tile mtab-charts" class:mtab-hidden={mobileTab !== 'charts'} style="grid-area: lineage">
    <div class="tile-header">
      <span class="tile-title">Lineage</span>
      <span class="tile-hint">experiment tree</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.lineage.hint} on:click={() => openFocus('lineage')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if $experimentTree.length > 0}
      <ExperimentTree data={$experimentTree} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
    {/if}
  </div>

  <!-- ═══ MESH ═══ -->
  <div class="tile titled-tile mtab-network" class:mtab-hidden={mobileTab !== 'network'} style="grid-area: mesh">
    <div class="tile-header">
      <span class="tile-title">Mesh Network</span>
      <span class="tile-hint">distributed GPU nodes</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.mesh.hint} on:click={() => openFocus('mesh')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if job.experiments.length > 0}
      <DistributedView experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div><div class="skeleton-bar" style="width: 40%"></div></div>
    {/if}
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="tile footer-tile" style="grid-area: footer">
    <div class="footer-dist">
      <div class="fd-item"><span class="fd-val">{$activeNodeCount}</span><span class="fd-lbl">Active Nodes</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$completedCount}<span class="fd-dim">/{totalExp}</span></span><span class="fd-lbl">Experiments</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$avgDuration}s</span><span class="fd-lbl">Avg Duration</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$totalGpuTime}</span><span class="fd-lbl">GPU Time</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item">
        <button class="fd-zoom-btn" on:click={handleZoomIn} title="Open Research Lab">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Semantic Zoom
        </button>
      </div>
    </div>
    <div class="fd-progress">
      <div class="fd-bar fd-bar--active" class:fd-bar--complete={progress >= 100} style="width: {progress}%"></div>
    </div>
  </div>
</div>

<!-- ═══ FOCUS MODAL ═══ -->
{#if focusMeta}
  <ResearchFocusModal
    open={true}
    title={focusMeta.title}
    hint={focusMeta.hint}
    tabs={FOCUS_TABS}
    activeTab={focusView ?? ''}
    on:close={closeFocus}
    on:tabchange={(e) => { focusView = e.detail; }}
  >
    {#key focusView}
      {#if focusView === 'convergence'}
        <div class="focus-stage focus-stage--chart">
          <ConvergenceChart experiments={job.experiments} bestMetric={job.bestMetric} baselineMetric={job.baselineMetric} width={focusChartWidth} height={focusChartHeight} />
        </div>
      {:else if focusView === 'activity'}
        <div class="focus-stage focus-stage--panel" style="height:{focusPanelHeight}px">
          <ActivityStream experiments={$jobStore.experiments} bestMetric={job.bestMetric} expanded />
        </div>
      {:else if focusView === 'treemap'}
        <div class="focus-stage focus-stage--fill" style="height:{focusPanelHeight}px">
          <ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} />
        </div>
      {:else if focusView === 'context'}
        <div class="focus-stage focus-stage--panel focus-stage--detail" style="height:{focusPanelHeight}px">
          <ContextPanel bestMetric={job.bestMetric} {phase} topic={job.topic} {progress} sessionId={job.experiments.length > 0 ? job.experiments[0].nodeId.slice(-6) : ''} branches={$branchSummary} experiments={$jobStore.experiments} totalExperiments={totalExp} expanded />
        </div>
      {:else if focusView === 'scatter'}
        <div class="focus-stage focus-stage--chart">
          <ParamScatterChart data={$scatterData} width={focusChartWidth} height={focusChartHeight} />
        </div>
      {:else if focusView === 'effect'}
        <div class="focus-stage focus-stage--fill" style="height:{focusPanelHeight}px">
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
  /* ═══ CANCEL BANNER ═══ */
  .cancel-banner {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: rgba(243, 139, 168, 0.08);
    border: 1px solid rgba(243, 139, 168, 0.2);
    border-radius: 8px;
    margin: 8px 8px 0;
    font-size: 0.82rem;
    color: #f38ba8;
    font-weight: 500;
  }
  .cancel-banner-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cancel-banner-title {
    font-weight: 700;
    font-size: 0.82rem;
  }
  .cancel-banner-reason {
    font-size: 0.7rem;
    color: var(--text-secondary, #6b6560);
    font-weight: 500;
  }
  .cancel-banner-refund {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-weight: 600;
  }
  .cancel-banner-btn {
    appearance: none;
    border: 1px solid rgba(243, 139, 168, 0.3);
    background: rgba(243, 139, 168, 0.1);
    color: #f38ba8;
    font-weight: 600;
    font-size: 0.78rem;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms;
  }
  .cancel-banner-btn:hover {
    background: rgba(243, 139, 168, 0.2);
    border-color: #f38ba8;
  }

  /* ═══ GRID LAYOUT ═══ */
  .research-page {
    height: calc(100vh - 48px);
    display: grid;
    grid-template-columns: minmax(160px, 200px) minmax(100px, 1fr) 1fr 1fr 280px;
    grid-template-rows: auto 80px minmax(80px, 1fr) 1fr 36px;
    grid-template-areas:
      "prompt    prompt    prompt    prompt    prompt"
      "hero      converge  converge  converge  stats"
      "branches  stream    scatter   effect    context"
      "branches  treemap   lineage   mesh      terminal"
      "footer    footer    footer    footer    footer";
    gap: 6px;
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
    border-radius: 0; border-left: none; border-right: none; border-top: none; box-shadow: none;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--glass-bg, rgba(255, 255, 255, 0.92));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .context-tile { background: transparent; border: none; box-shadow: none; padding: 0; }
  .terminal-tile { background: transparent; border: none; box-shadow: none; padding: 0; }
  .converge-tile :global(svg.convergence-chart) { width: 100%; height: auto; display: block; }

  /* ═══ ACTIVE OPS ═══ */
  .hero-tile { display: flex; flex-direction: column; padding: 6px 8px; gap: 0; overflow-y: auto; }
  .ops-list { display: flex; flex-direction: column; gap: 2px; }
  .ops-row {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 4px; border-radius: 4px; cursor: pointer;
    font: 500 10px/1.3 'Inter', -apple-system, sans-serif;
    color: #555; transition: background 120ms;
  }
  .ops-row:hover { background: rgba(217,119,87,0.06); }
  .ops-id { font: 700 9px/1 'SF Mono', 'Fira Code', monospace; color: #999; flex-shrink: 0; min-width: 24px; font-variant-numeric: tabular-nums; }
  .ops-cat { font: 700 8px/1 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
  .ops-mod { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: #666; }
  .ops-node { font: 400 9px/1 'SF Mono', monospace; color: #bbb; flex-shrink: 0; }
  .ops-fallback { display: flex; align-items: center; justify-content: center; gap: 6px; height: 100%; }
  .ops-best { font: 900 1.4rem/1 'Inter', sans-serif; color: #1a1a1a; font-variant-numeric: tabular-nums; }
  .ops-delta { font: 700 10px/1 'Inter', sans-serif; color: #27864a; background: rgba(39,134,74,0.06); padding: 2px 5px; border-radius: 4px; }
  .ops-branch { font: 600 9px/1 'Inter', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
  .ops-spark { width: 60px; height: 14px; }
  .ops-idle { font: 500 10px/1 'Inter', sans-serif; color: #ccc; }

  /* ═══ BRANCHES ═══ */
  .branches-tile { display: flex; flex-direction: column; padding: 8px 0; }
  .section-head { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 0.06em; color: #bbb; text-transform: uppercase; padding: 4px 12px 8px; flex-shrink: 0; }
  .branch-list { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 2px; padding: 0 4px; }
  .branch-list::-webkit-scrollbar { width: 3px; }
  .branch-list::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 2px; }
  .branch-row {
    display: flex; align-items: center; gap: 4px;
    padding: 5px 8px; cursor: pointer; border-radius: 6px;
    transition: background 150ms, transform 150ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    transform-origin: left center;
  }
  .branch-row:hover { background: rgba(217,119,87,0.04); transform: scale(1.01); }
  .branch-row.active-training { animation: branchPulse 2s ease-in-out infinite; }
  @keyframes branchPulse { 0%, 100% { background: transparent; } 50% { background: rgba(217,119,87,0.03); } }
  .branch-row.boosted { box-shadow: inset 2px 0 0 #d4a017; }
  .br-rank { font: 700 9px/1 'Inter', sans-serif; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 5px; flex-shrink: 0; }
  .br-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
  .br-name { font: 600 11px/1.2 'Inter', sans-serif; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; color: #444; }
  .br-live { font-size: 10px; }
  .br-metric { font: 700 11px/1 'Inter', sans-serif; color: #999; margin-left: auto; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .br-kdc { font: 500 9px/1 'SF Mono', monospace; color: #bbb; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .br-hit { font: 500 10px/1 'Inter', sans-serif; color: #ccc; flex-shrink: 0; width: 24px; text-align: right; }
  .br-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .br-btn { width: 20px; height: 20px; border: none; border-radius: 5px; background: transparent; color: #ccc; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 150ms; }
  .br-btn:hover:not(:disabled) { background: #f5f5f5; color: #666; }
  .br-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .br-btn-active { color: #d4a017; }
  .br-btn-paused { color: #D97757; }

  /* ═══ TILE HEADERS ═══ */
  .titled-tile { display: flex; flex-direction: column; }
  .tile-header { display: flex; align-items: baseline; gap: 6px; padding: 8px 12px 4px; flex-shrink: 0; }
  .tile-title { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 0.06em; color: #999; text-transform: uppercase; }
  .tile-hint { font: 400 9px/1 'Inter', sans-serif; color: #ccc; }
  .tile-focus-btn {
    position: relative; margin-left: auto;
    width: 24px; height: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid rgba(82,67,51,0.1); border-radius: 7px;
    background: rgba(255,255,255,0.9); color: #8d7f70;
    cursor: pointer; transition: transform 150ms ease, border-color 150ms ease, color 150ms ease;
  }
  .tile-focus-btn:hover { transform: translateY(-1px); border-color: rgba(217,119,87,0.24); color: #D97757; }
  .tile-focus-btn::after {
    content: attr(data-hint);
    position: absolute; bottom: calc(100% + 8px); right: 0;
    width: max-content; max-width: 220px;
    padding: 8px 10px; border-radius: 10px;
    background: rgba(30,25,20,0.92); color: #f5ede8;
    font: 500 10.5px/1.4 'Inter', sans-serif;
    white-space: normal; pointer-events: none;
    opacity: 0; transform: translateY(4px);
    transition: opacity 150ms, transform 150ms;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .tile-focus-btn:hover::after { opacity: 1; transform: translateY(0); }
  .tile-focus-btn svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  /* ═══ FOCUS MODAL STAGES ═══ */
  .focus-stage {
    background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(249,245,240,0.86));
    border: 1px solid rgba(82,67,51,0.08); border-radius: 22px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
  }
  .focus-stage--chart { display: flex; align-items: center; justify-content: center; min-height: 360px; padding: 20px; }
  .focus-stage--fill { overflow: hidden; }
  .focus-stage--panel { max-width: 1080px; margin: 0 auto; overflow: hidden; }
  .focus-stage--detail { max-width: 980px; }
  .focus-stage--scroll { overflow: auto; padding: 20px; }

  /* ═══ EMPTY STATES ═══ */
  .empty-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 16px; }
  .empty-inner { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .empty-hint { font: 400 10px/1 'Inter', sans-serif; color: #ddd; }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  :global(.skeleton-bar) { height: 8px; border-radius: 4px; background: linear-gradient(90deg, #f0eeeb 25%, #e8e5e1 50%, #f0eeeb 75%); background-size: 200% 100%; animation: shimmer 1.8s ease-in-out infinite; }

  /* ═══ FOOTER ═══ */
  .footer-tile { display: flex; flex-direction: column; justify-content: center; padding: 4px 16px; gap: 3px; }
  .footer-dist { display: flex; align-items: center; gap: 12px; }
  .fd-item { display: flex; align-items: baseline; gap: 4px; }
  .fd-val { font: 700 10px/1 'Inter', sans-serif; color: #444; font-variant-numeric: tabular-nums; }
  .fd-dim { color: #bbb; font-weight: 400; }
  .fd-lbl { font: 400 9px/1 'Inter', sans-serif; color: #bbb; text-transform: uppercase; letter-spacing: 0.04em; }
  .fd-sep { width: 1px; height: 10px; background: #eee; }
  .fd-progress { width: 100%; height: 2px; background: #f0f0f0; border-radius: 2px; overflow: hidden; }
  .fd-bar { height: 100%; background: var(--accent, #D97757); border-radius: 2px; transition: width 300ms ease, background 500ms ease; }
  .fd-bar--active { background: linear-gradient(90deg, var(--accent, #D97757) 0%, #e89a7e 50%, var(--accent, #D97757) 100%); background-size: 200% 100%; animation: shimmer 1.8s ease-in-out infinite; }
  .fd-bar--complete { background: var(--green, #27864a); }
  .fd-zoom-btn {
    display: flex; align-items: center; gap: 4px;
    font: 600 9px/1 'Inter', sans-serif;
    color: var(--accent, #D97757);
    background: none; border: 1px solid rgba(217,119,87,0.2);
    border-radius: 5px; padding: 3px 8px;
    cursor: pointer; transition: all 150ms;
  }
  .fd-zoom-btn:hover { background: rgba(217,119,87,0.05); border-color: var(--accent, #D97757); }

  /* ═══ MOBILE TABS ═══ */
  .mobile-tabs { display: none; grid-area: mtabs; }
  .mtab-track {
    position: relative; display: grid; grid-template-columns: repeat(3, 1fr);
    width: 100%; padding: 3px; border-radius: 12px;
    background: rgba(0,0,0,0.04); border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .mtab-indicator {
    position: absolute; top: 3px; bottom: 3px; left: 3px;
    width: calc((100% - 6px) / 3);
    background: #fff; border-radius: 9px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    transition: transform 280ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    z-index: 0;
  }
  .mtab-btn {
    position: relative; z-index: 1;
    font: 600 11px/1 'Inter', sans-serif;
    padding: 7px 0; border: none; border-radius: 9px;
    background: transparent; color: #999;
    cursor: pointer; transition: color 200ms; text-align: center;
  }
  .mtab-btn.mtab-active { color: var(--accent, #D97757); }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 1024px) {
    .research-page {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto auto auto auto auto auto auto auto;
      grid-template-areas:
        "prompt    prompt"
        "hero      stats"
        "converge  converge"
        "branches  stream"
        "scatter   effect"
        "treemap   lineage"
        "mesh      mesh"
        "context   context"
        "terminal  terminal"
        "footer    footer";
      height: auto; overflow-y: auto; gap: 6px; padding: 0 4px 4px;
    }
    .terminal-tile { min-height: 200px; }
  }

  @media (max-width: 600px) {
    .research-page {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(14, auto);
      grid-template-areas:
        "prompt" "context" "hero" "stats" "mtabs"
        "converge" "branches" "stream" "scatter" "effect"
        "treemap" "lineage" "mesh" "footer";
      gap: 8px; padding: 0 6px 14px;
    }
    .branch-list { max-height: 200px; }
    .br-actions { display: none; }
    .mobile-tabs {
      display: flex; gap: 4px; padding: 0 2px; justify-content: center;
      position: sticky; top: 0; z-index: 3;
      background: linear-gradient(180deg, rgba(250,249,247,0.96), rgba(250,249,247,0.88));
      backdrop-filter: blur(10px); border-radius: 12px;
    }
    .context-tile { min-height: 0; overflow: hidden; }
    .tile { border-radius: 14px; }
    .footer-tile { padding: 8px 12px; }
    .mtab-hidden { display: none !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .research-page { transition: none; }
    .branch-row { transition: none; }
    .branch-row.active-training { animation: none; }
    .tile-focus-btn { transition: none; }
    .tile-focus-btn::after { transition: none; }
    .fd-bar { transition: none; }
    .fd-bar--active { animation: none; }
    .mtab-indicator { transition: none; }
    :global(.skeleton-bar) { animation: none; }
  }
</style>
