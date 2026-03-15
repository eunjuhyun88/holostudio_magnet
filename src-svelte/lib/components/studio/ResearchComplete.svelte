<script lang="ts">
  /**
   * ResearchComplete — Full research dashboard in COMPLETE state.
   *
   * Same 5-column grid as ResearchRunning but with:
   * - ContextPanel showing CompletePanel (deploy, retrain, improve)
   * - Publish CTA in footer
   * - All charts still visible for result review
   *
   * Events:
   *   newResearch: void
   *   deploy: { target: string }
   *   retrain: { code: string; parentId: number | null }
   *   improve: { instruction: string }
   *   viewModel: { modelId: string }
   */
  import { createEventDispatcher } from 'svelte';
  import { router } from '../../stores/router.ts';
  import {
    jobStore,
    keepCount, crashCount, completedCount, activeNodeCount,
    experimentTree, scatterData, heatmapData,
    branchSummary, improvementDelta, bestBranch,
    avgDuration, totalGpuTime, bestFrontier, sparkPoints,
    eventLog,
  } from '../../stores/jobStore.ts';
  import type { BranchInfo, Experiment } from '../../stores/jobStore.ts';
  import { selectedExperimentId } from '../../stores/selectionStore.ts';
  import { CATEGORY_COLORS } from '../../data/modifications.ts';

  // Chart components
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
  import PlaygroundTab from '../PlaygroundTab.svelte';

  export let branches: BranchInfo[] = [];
  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;
  export let totalExperiments: number = 0;

  const dispatch = createEventDispatcher<{
    newResearch: void;
    deploy: { target: string };
    retrain: { code: string; parentId: number | null };
    improve: { instruction: string };
    viewModel: { modelId: string };
  }>();

  $: job = $jobStore;
  $: delta = $improvementDelta;
  $: bestBr = $bestBranch;
  $: totalExp = job.totalExperiments || totalExperiments || 60;
  $: completed = $completedCount;

  // Focus modal
  type FocusView = 'convergence' | 'activity' | 'treemap' | 'context' | 'lineage' | 'scatter' | 'effect' | 'mesh' | 'playground';

  const FOCUS_TABS: { id: FocusView; label: string }[] = [
    { id: 'playground', label: 'Test' },
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
    playground: { title: 'Model Playground', hint: 'Test your model with sample inputs before publishing.' },
    convergence: { title: 'Convergence Timeline', hint: 'Review the full metric trajectory.' },
    activity: { title: 'Activity Feed', hint: 'Review all experiments.' },
    treemap: { title: 'Experiment Map', hint: 'Drill into categories.' },
    context: { title: 'Results Detail', hint: 'Expand the results panel.' },
    lineage: { title: 'Lineage Tree', hint: 'Inspect ancestry.' },
    mesh: { title: 'Mesh Network', hint: 'Node activity summary.' },
    scatter: { title: 'Scatter Plot', hint: 'Compare val_bpb by category.' },
    effect: { title: 'Effect (Keep Rate)', hint: 'Strategy success rates.' },
  };

  let focusView: FocusView | null = null;
  let innerWidth = 1440;
  let innerHeight = 900;

  $: focusMeta = focusView ? FOCUS_META[focusView] : null;
  $: focusChartWidth = Math.max(760, Math.min(1320, innerWidth - 160));
  $: focusChartHeight = Math.max(320, Math.min(720, innerHeight - 260));
  $: focusPanelHeight = Math.max(460, Math.min(860, innerHeight - 220));

  function openFocus(view: FocusView) { focusView = view; }
  function closeFocus() { focusView = null; }

  function handleRetrain(e: CustomEvent<{ code: string; parentId: number | null }>) { dispatch('retrain', e.detail); }
  function handleImprove(e: CustomEvent<{ instruction: string }>) { dispatch('improve', e.detail); }
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="research-page complete">
  <!-- ═══ COMPLETION BANNER ═══ -->
  <div class="tile complete-banner" style="grid-area: prompt">
    <div class="cb-left">
      <span class="cb-check">✓</span>
      <div class="cb-info">
        <span class="cb-title">Research Complete</span>
        <span class="cb-topic">{job.topic}</span>
      </div>
    </div>
    <div class="cb-stats">
      {#if bestMetric < Infinity}
        <div class="cb-metric">
          <span class="cb-metric-label">Best</span>
          <span class="cb-metric-val">{bestMetric.toFixed(4)}</span>
          {#if delta}<span class="cb-delta">▼{delta.percent}%</span>{/if}
        </div>
      {/if}
      <div class="cb-counts">
        <span>{$completedCount} experiments</span>
        <span>·</span>
        <span>{$keepCount} keeps</span>
        <span>·</span>
        <span>{$crashCount} crashes</span>
      </div>
    </div>
    <div class="cb-actions">
      <button class="cb-btn test" on:click={() => openFocus('playground')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
        테스트
      </button>
      <button class="cb-btn publish" on:click={() => dispatch('deploy', { target: 'publish' })}>
        발행 →
      </button>
    </div>
  </div>

  <!-- ═══ HERO (best result) ═══ -->
  <div class="tile hero-tile" style="grid-area: hero">
    <div class="ops-fallback">
      {#if bestMetric < Infinity}
        <span class="ops-best">{bestMetric.toFixed(3)}</span>
        {#if delta}<span class="ops-delta">▼{delta.percent}%</span>{/if}
        {#if bestBr}<span class="ops-branch" style="color: {bestBr.color}">{bestBr.label}</span>{/if}
        {#if $bestFrontier.length > 1}
          <svg class="ops-spark" viewBox="0 0 120 20" preserveAspectRatio="none">
            <polyline points={$sparkPoints} fill="none" stroke="#27864a" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        {/if}
      {:else}
        <span class="ops-idle">No results</span>
      {/if}
    </div>
  </div>

  <!-- ═══ CONVERGENCE ═══ -->
  <div class="tile titled-tile" style="grid-area: converge">
    <div class="tile-header">
      <span class="tile-title">Convergence</span>
      <span class="tile-hint">final trajectory</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.convergence.hint} on:click={() => openFocus('convergence')}>
        <svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg>
      </button>
    </div>
    {#if job.experiments.length > 0}
      <ConvergenceChart experiments={job.experiments} bestMetric={job.bestMetric} baselineMetric={job.baselineMetric} width={960} height={120} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
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

  <!-- ═══ BRANCHES (leaderboard) ═══ -->
  <div class="tile branches-tile" style="grid-area: branches">
    <div class="section-head">Leaderboard</div>
    {#if $branchSummary.length > 0}
      <div class="branch-list">
        {#each $branchSummary as branch, i}
          <div class="branch-row" class:best-row={i === 0 && branch.bestMetric < Infinity} role="button" tabindex="0"
            on:click={() => { const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric); if (bestExp) selectedExperimentId.set(bestExp.id); }}
            on:keydown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const bestExp = job.experiments.find(e => e.status === 'keep' && e.metric === branch.bestMetric); if (bestExp) selectedExperimentId.set(bestExp.id); } }}
          >
            <span class="br-rank" style="background: {CATEGORY_COLORS[branch.category]}15; color: {CATEGORY_COLORS[branch.category]}">{i + 1}</span>
            <div class="br-info">
              <span class="br-name">{branch.label}</span>
              <span class="br-metric">{branch.bestMetric < Infinity ? branch.bestMetric.toFixed(3) : '—'}</span>
            </div>
            <span class="br-kdc">{branch.keeps}/{branch.total - branch.keeps - branch.crashes}/{branch.crashes}</span>
            <span class="br-hit">{branch.hitRate}%</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-tile"><span class="empty-hint">No branches</span></div>
    {/if}
  </div>

  <!-- ═══ ACTIVITY ═══ -->
  <div class="tile" style="grid-area: stream">
    <ActivityStream experiments={$jobStore.experiments} bestMetric={job.bestMetric} expandable on:expand={() => openFocus('activity')} />
  </div>

  <!-- ═══ SCATTER ═══ -->
  <div class="tile titled-tile" style="grid-area: scatter">
    <div class="tile-header">
      <span class="tile-title">Scatter</span>
      <span class="tile-hint">{$scatterData.length} pts</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.scatter.hint} on:click={() => openFocus('scatter')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if $scatterData.length > 0}
      <ParamScatterChart data={$scatterData} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
    {/if}
  </div>

  <!-- ═══ EFFECT ═══ -->
  <div class="tile titled-tile" style="grid-area: effect">
    <div class="tile-header">
      <span class="tile-title">Effect</span>
      <span class="tile-hint">keep rate</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.effect.hint} on:click={() => openFocus('effect')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if Object.keys($heatmapData).length > 0}
      <ModificationHeatmap data={$heatmapData} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
    {/if}
  </div>

  <!-- ═══ TREEMAP ═══ -->
  <div class="tile titled-tile" style="grid-area: treemap">
    <div class="tile-header">
      <span class="tile-title">Experiment Map</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.treemap.hint} on:click={() => openFocus('treemap')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if job.experiments.length > 0}
      <ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
    {/if}
  </div>

  <!-- ═══ CONTEXT PANEL (COMPLETE mode) ═══ -->
  <div class="tile context-tile" style="grid-area: context">
    <ContextPanel
      bestMetric={job.bestMetric}
      phase="complete"
      topic={job.topic}
      progress={100}
      sessionId={job.experiments.length > 0 ? job.experiments[0].nodeId.slice(-6) : ''}
      branches={$branchSummary}
      experiments={$jobStore.experiments}
      totalExperiments={totalExp}
      expandable
      on:retrain={handleRetrain}
      on:improve={handleImprove}
      on:expand={() => openFocus('context')}
    />
  </div>

  <!-- ═══ LINEAGE ═══ -->
  <div class="tile titled-tile" style="grid-area: lineage">
    <div class="tile-header">
      <span class="tile-title">Lineage</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.lineage.hint} on:click={() => openFocus('lineage')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if $experimentTree.length > 0}
      <ExperimentTree data={$experimentTree} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
    {/if}
  </div>

  <!-- ═══ MESH ═══ -->
  <div class="tile titled-tile" style="grid-area: mesh">
    <div class="tile-header">
      <span class="tile-title">Mesh Network</span>
      <button class="tile-focus-btn" type="button" data-hint={FOCUS_META.mesh.hint} on:click={() => openFocus('mesh')}><svg viewBox="0 0 20 20"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M3 13v4h4" /></svg></button>
    </div>
    {#if job.experiments.length > 0}
      <DistributedView experiments={job.experiments} bestMetric={job.bestMetric} />
    {:else}
      <div class="empty-inner"><div class="skeleton-bar" style="width: 60%"></div></div>
    {/if}
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="tile footer-tile" style="grid-area: footer">
    <div class="footer-dist">
      <div class="fd-item"><span class="fd-val">{$activeNodeCount}</span><span class="fd-lbl">Nodes</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$completedCount}<span class="fd-dim">/{totalExp}</span></span><span class="fd-lbl">Experiments</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$avgDuration}s</span><span class="fd-lbl">Avg</span></div>
      <div class="fd-sep"></div>
      <div class="fd-item"><span class="fd-val">{$totalGpuTime}</span><span class="fd-lbl">GPU Time</span></div>
    </div>
    <div class="fd-progress"><div class="fd-bar fd-bar--complete" style="width: 100%"></div></div>
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
      {#if focusView === 'playground'}
        <div class="focus-stage focus-stage--panel" style="height:{focusPanelHeight}px; padding: 24px;">
          <PlaygroundTab />
        </div>
      {:else if focusView === 'convergence'}
        <div class="focus-stage focus-stage--chart"><ConvergenceChart experiments={job.experiments} bestMetric={job.bestMetric} baselineMetric={job.baselineMetric} width={focusChartWidth} height={focusChartHeight} /></div>
      {:else if focusView === 'activity'}
        <div class="focus-stage focus-stage--panel" style="height:{focusPanelHeight}px"><ActivityStream experiments={$jobStore.experiments} bestMetric={job.bestMetric} expanded /></div>
      {:else if focusView === 'treemap'}
        <div class="focus-stage focus-stage--fill" style="height:{focusPanelHeight}px"><ExperimentTreemap experiments={job.experiments} bestMetric={job.bestMetric} /></div>
      {:else if focusView === 'context'}
        <div class="focus-stage focus-stage--panel focus-stage--detail" style="height:{focusPanelHeight}px"><ContextPanel bestMetric={job.bestMetric} phase="complete" topic={job.topic} progress={100} sessionId={job.experiments.length > 0 ? job.experiments[0].nodeId.slice(-6) : ''} branches={$branchSummary} experiments={$jobStore.experiments} totalExperiments={totalExp} expanded on:retrain={handleRetrain} on:improve={handleImprove} /></div>
      {:else if focusView === 'scatter'}
        <div class="focus-stage focus-stage--chart"><ParamScatterChart data={$scatterData} width={focusChartWidth} height={focusChartHeight} /></div>
      {:else if focusView === 'effect'}
        <div class="focus-stage focus-stage--fill" style="height:{focusPanelHeight}px"><ModificationHeatmap data={$heatmapData} width={focusChartWidth} height={focusPanelHeight} /></div>
      {:else if focusView === 'lineage'}
        <div class="focus-stage focus-stage--scroll"><ExperimentTree data={$experimentTree} bestMetric={job.bestMetric} width={focusChartWidth} /></div>
      {:else if focusView === 'mesh'}
        <div class="focus-stage focus-stage--scroll"><DistributedView experiments={job.experiments} bestMetric={job.bestMetric} width={focusChartWidth} /></div>
      {/if}
    {/key}
  </ResearchFocusModal>
{/if}

<style>
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
      "branches  treemap   lineage   mesh      context"
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

  .context-tile { background: transparent; border: none; box-shadow: none; padding: 0; }

  /* ═══ COMPLETION BANNER ═══ */
  .complete-banner {
    border-radius: 0;
    border-left: none; border-right: none; border-top: none;
    box-shadow: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: linear-gradient(135deg, rgba(39, 134, 74, 0.04), rgba(166, 227, 161, 0.06));
    border-bottom: 2px solid rgba(39, 134, 74, 0.15);
    flex-wrap: wrap;
  }
  .cb-left { display: flex; align-items: center; gap: 10px; }
  .cb-check {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--green, #27864a); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; flex-shrink: 0;
  }
  .cb-info { display: flex; flex-direction: column; gap: 2px; }
  .cb-title { font: 700 12px/1 'Inter', sans-serif; color: var(--green, #27864a); text-transform: uppercase; letter-spacing: 0.06em; }
  .cb-topic { font: 600 14px/1 'Inter', sans-serif; color: var(--text-primary, #2D2D2D); }
  .cb-stats { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 160px; }
  .cb-metric { display: flex; align-items: baseline; gap: 6px; }
  .cb-metric-label { font: 600 9px/1 'Inter', sans-serif; color: #999; text-transform: uppercase; letter-spacing: 0.06em; }
  .cb-metric-val { font: 800 18px/1 'Inter', sans-serif; color: var(--text-primary, #2D2D2D); font-variant-numeric: tabular-nums; }
  .cb-delta { font: 700 10px/1 'Inter', sans-serif; color: var(--green, #27864a); background: rgba(39,134,74,0.08); padding: 2px 6px; border-radius: 4px; }
  .cb-counts { font: 500 10px/1 'Inter', sans-serif; color: #999; display: flex; gap: 4px; }
  .cb-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .cb-btn {
    font: 600 11px/1 'Inter', sans-serif;
    padding: 8px 16px; border-radius: 8px;
    cursor: pointer; transition: all 150ms; border: none;
  }
  .cb-btn.test {
    background: var(--surface, #fff); color: var(--text-primary, #2D2D2D);
    border: 1px solid var(--border, #E5E0DA);
    display: flex; align-items: center; gap: 5px;
  }
  .cb-btn.test:hover { border-color: var(--accent, #D97757); color: var(--accent, #D97757); box-shadow: 0 1px 6px rgba(217,119,87,0.12); }
  .cb-btn.test svg { transition: transform 200ms; }
  .cb-btn.test:hover svg { transform: scale(1.15); }
  .cb-btn.publish { background: var(--accent, #D97757); color: #fff; }
  .cb-btn.publish:hover { background: #C4644A; box-shadow: 0 2px 8px rgba(217,119,87,0.2); }

  /* ═══ HERO ═══ */
  .hero-tile { display: flex; flex-direction: column; padding: 6px 8px; overflow-y: auto; }
  .ops-fallback { display: flex; align-items: center; justify-content: center; gap: 6px; height: 100%; }
  .ops-best { font: 900 1.4rem/1 'Inter', sans-serif; color: #1a1a1a; font-variant-numeric: tabular-nums; }
  .ops-delta { font: 700 10px/1 'Inter', sans-serif; color: #27864a; background: rgba(39,134,74,0.06); padding: 2px 5px; border-radius: 4px; }
  .ops-branch { font: 600 9px/1 'Inter', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
  .ops-spark { width: 60px; height: 14px; }
  .ops-idle { font: 500 10px/1 'Inter', sans-serif; color: #ccc; }

  /* ═══ BRANCHES ═══ */
  .branches-tile { display: flex; flex-direction: column; padding: 8px 0; }
  .section-head { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 0.06em; color: #bbb; text-transform: uppercase; padding: 4px 12px 8px; flex-shrink: 0; }
  .branch-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 0 4px; }
  .branch-list::-webkit-scrollbar { width: 3px; }
  .branch-list::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 2px; }
  .branch-row {
    display: flex; align-items: center; gap: 4px;
    padding: 5px 8px; cursor: pointer; border-radius: 6px;
    transition: background 150ms;
  }
  .branch-row:hover { background: rgba(39,134,74,0.04); }
  .branch-row.best-row { background: rgba(39,134,74,0.06); }
  .br-rank { font: 700 9px/1 'Inter', sans-serif; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 5px; flex-shrink: 0; }
  .br-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
  .br-name { font: 600 11px/1.2 'Inter', sans-serif; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; color: #444; }
  .br-metric { font: 700 11px/1 'Inter', sans-serif; color: #999; margin-left: auto; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .br-kdc { font: 500 9px/1 'SF Mono', monospace; color: #bbb; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .br-hit { font: 500 10px/1 'Inter', sans-serif; color: #ccc; flex-shrink: 0; width: 24px; text-align: right; }

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

  /* ═══ FOCUS MODAL ═══ */
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
  .fd-bar { height: 100%; background: var(--accent, #D97757); border-radius: 2px; transition: width 300ms; }
  .fd-bar--complete { background: var(--green, #27864a); }

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
        "footer    footer";
      height: auto; overflow-y: auto; gap: 6px; padding: 0 4px 4px;
    }
  }

  @media (max-width: 600px) {
    .research-page {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(13, auto);
      grid-template-areas:
        "prompt" "context" "hero" "stats"
        "converge" "branches" "stream" "scatter" "effect"
        "treemap" "lineage" "mesh" "footer";
      gap: 8px; padding: 0 6px 14px;
    }
    .complete-banner { flex-direction: column; align-items: flex-start; gap: 10px; }
    .cb-actions { width: 100%; justify-content: stretch; }
    .cb-btn { flex: 1; text-align: center; justify-content: center; }
    .branch-list { max-height: 200px; }
    .tile { border-radius: 14px; }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.skeleton-bar) { animation: none; }
    .fd-bar { transition: none; }
  }
</style>
