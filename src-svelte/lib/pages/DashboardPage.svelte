<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { router } from "../stores/router.ts";
  import { jobStore } from "../stores/jobStore.ts";
  import {
    createFixturePlayback,
    demoFixtureText,
    parseNdjson,
  } from "../utils/fixturePlayer.ts";
  import {
    buildScaledNodes,
    isWorkerActiveState,
    oscillate01,
    smoothPulse,
  } from "../utils/meshSim.ts";
  import type { VisualizerModel } from "../utils/types.ts";
  import { TOPIC_SUGGESTIONS } from "../data/topicSuggestions.ts";

  import MeshCanvas from "../components/MeshCanvas.svelte";
  import HeroSection from "../components/HeroSection.svelte";
  import StatusPanel from "../components/StatusPanel.svelte";
  import WidgetContainer from "../components/WidgetContainer.svelte";
  import EditorWidget from "../components/EditorWidget.svelte";
  import WidgetToolbar from "../components/WidgetToolbar.svelte";
  import JobsListWidget from "../components/widgets/JobsListWidget.svelte";
  import FindingsWidget from "../components/widgets/FindingsWidget.svelte";
  import EventLogWidget from "../components/widgets/EventLogWidget.svelte";
  import EcosystemWidget from "../components/widgets/EcosystemWidget.svelte";
  import ModelsWidget from "../components/widgets/ModelsWidget.svelte";
  import BondsWidget from "../components/widgets/BondsWidget.svelte";
  import NetworkWidget from "../components/widgets/NetworkWidget.svelte";
  import { widgetStore, visibleWidgets } from "../stores/widgetStore.ts";
  import { DEMO_JOBS } from "../data/dashboardFixture.ts";
  import type { DashboardJob, ResearchMetrics, SystemMetrics } from "../data/dashboardFixture.ts";
  import { keepCount, completedCount, qualityScore } from "../stores/jobStore.ts";
  import { PPAP_STAGES } from "../data/protocolData.ts";
  import { wallet, WALLET_OPTIONS } from "../stores/walletStore.ts";

  // ── Models summary (top 3) ──
  const TOP_MODELS = [
    { name: 'Crypto Market 24h', metric: '1.231 bpb', type: 'Transformer', downloads: 1243 },
    { name: 'Token Sentiment', metric: '91.2% F1', type: 'BERT-tiny', downloads: 3420 },
    { name: 'MEV Detection', metric: '96.8% AUC', type: 'LightGBM', downloads: 2180 },
  ];

  // ── Protocol summary ──
  const PROTOCOL_STATS = {
    tvl: '$12.4M',
    burned: '847K',
    activeBonds: '2,341',
    trustScore: 847,
    mau: '892 / 1,443',
  };

  let searchQuery = "";
  let mounted = false;
  let destroyed = false;

  const topicSuggestions = TOPIC_SUGGESTIONS;

  const events = parseNdjson(demoFixtureText);
  const playback = createFixturePlayback(events);
  const emptyModel: VisualizerModel = { workers: [], nodes: [], jobs: [], tape: [] };

  let frameIndex = playback.length > 0 ? 0 : -1;
  let meshSimulationTime = 0;
  let meshPopulationDisplayed = 0;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  $: fixtureModel = playback[Math.max(frameIndex, 0)] ?? emptyModel;
  $: model = fixtureModel;
  $: meshPopulationCeiling = model.nodes.length === 0 ? 0 : clamp(Math.max(3200, model.nodes.length * 660), 2200, 5600);
  $: meshPopulationTarget = (() => {
    if (model.nodes.length === 0) return 0;
    const lw = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
    const sw = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
    return Math.round(model.nodes.length + meshPopulationCeiling * clamp(0.07 + lw * 0.72 + sw * 0.12, 0.07, 0.97));
  })();
  $: renderNodes = buildScaledNodes(model.nodes, model.jobs, meshPopulationDisplayed, meshPopulationCeiling, meshSimulationTime);

  // ── Live metrics ──
  $: activeWorkers = model.workers.filter(w => isWorkerActiveState(w.state));
  $: totalNodes = model.nodes.length;

  $: liveJobs = (() => {
    const base: DashboardJob[] = [...DEMO_JOBS];
    if ($jobStore.phase !== 'idle' && $jobStore.topic) {
      const existing = base.find(j => j.topic === $jobStore.topic);
      if (!existing) {
        const completedExps = $jobStore.experiments.filter(e =>
          e.status === 'keep' || e.status === 'discard' || e.status === 'crash'
        ).length;
        const progress = $jobStore.totalExperiments > 0
          ? Math.round((completedExps / $jobStore.totalExperiments) * 100)
          : 0;
        base.unshift({
          id: 'job-active',
          topic: $jobStore.topic,
          status: $jobStore.phase === 'complete' ? 'complete' : 'running',
          progress,
          metric: $jobStore.bestMetric === Infinity ? 0 : $jobStore.bestMetric,
          metricLabel: 'bpb',
          findings: $keepCount,
          startedAt: $jobStore.startedAt,
        });
      }
    }
    return base;
  })();

  $: runningCount = liveJobs.filter(j => j.status === 'running').length;
  $: doneCount = liveJobs.filter(j => j.status === 'complete').length;

  let liveResearch: ResearchMetrics;
  $: liveResearch = {
    activeJobs: liveJobs.filter(j => j.status === 'running').length + liveJobs.filter(j => j.status === 'queued').length,
    activeAgents: activeWorkers.length || 2,
    configsTested: $jobStore.phase !== 'idle'
      ? `${$completedCount}/${$jobStore.totalExperiments}`
      : `${model.jobs.reduce((acc, j) => acc + j.workerIds.length, 0) || 12}/60`,
    findings: $keepCount || liveJobs.reduce((acc, j) => acc + j.findings, 0),
    hitRate: $qualityScore || 42,
  };

  let liveSystem: SystemMetrics;
  $: liveSystem = {
    nodes: totalNodes || 8,
    cpuCores: 32,
    cpuUsage: totalNodes > 0
      ? Math.round((activeWorkers.length / Math.max(1, model.workers.length)) * 100)
      : 85,
    memUsedGb: Math.round(Math.max(8, totalNodes * 3)),
    memTotalGb: 128,
    vramUsedGb: Math.round(Math.max(12, activeWorkers.length * 8)),
    vramTotalGb: 96,
    activeFlows: model.jobs.length || 1,
  };

  // Job helpers
  function statusIcon(s: DashboardJob['status']): string {
    switch (s) { case 'running': return '●'; case 'complete': return '✓'; case 'queued': return '◐'; }
  }
  function statusColor(s: DashboardJob['status']): string {
    switch (s) { case 'running': return 'var(--accent)'; case 'complete': return 'var(--green)'; case 'queued': return 'var(--text-muted)'; }
  }
  function elapsed(startedAt: number): string {
    const mins = Math.floor((Date.now() - startedAt) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}h${rm > 0 ? String(rm).padStart(2, '0') : ''}`;
  }

  function handleSearch(e: CustomEvent<string>) {
    const topic = e.detail;
    jobStore.startJob(topic);
    router.navigate("research", { topic });
  }
  function handleTopic(e: CustomEvent<string>) {
    searchQuery = e.detail;
    jobStore.startJob(e.detail);
    router.navigate("research", { topic: e.detail });
  }

  let editorCollapsed = true;

  // ── Viewport-proportional scaling ──
  // Widget positions are authored for REF_W × REF_H.
  // We CSS-transform the entire widget layer so text & icons scale too.
  const REF_W = 1040;
  const REF_H = 660;
  let containerW = REF_W;
  let containerH = REF_H;
  $: uniformScale = Math.min(containerW / REF_W, containerH / REF_H);

  onMount(() => {
    if (get(jobStore).phase === 'idle') {
      void jobStore.connectRuntime();
    }

    widgetStore.loadLayout($wallet.connected);

    mounted = true;
    meshPopulationDisplayed = model.nodes.length;

    let dwellCount = 0;
    const fixtureInterval = setInterval(() => {
      if (playback.length <= 1) return;
      if (frameIndex < 0) { frameIndex = 0; return; }
      if (frameIndex >= playback.length - 1) {
        dwellCount += 1;
        if (dwellCount >= 3) { dwellCount = 0; frameIndex = 0; }
        return;
      }
      frameIndex += 1;
    }, 2800);

    const tickInterval = setInterval(() => {
      meshSimulationTime += 0.5;
      const floor = model.nodes.length;
      const cur = Math.max(meshPopulationDisplayed, floor);
      if (cur !== meshPopulationTarget) {
        const step = Math.max(3, Math.ceil(Math.abs(meshPopulationTarget - cur) * 0.03));
        meshPopulationDisplayed = cur < meshPopulationTarget
          ? Math.min(meshPopulationTarget, cur + step)
          : Math.max(meshPopulationTarget, cur - step);
      }
    }, 500);

    return () => {
      destroyed = true;
      clearInterval(fixtureInterval);
      clearInterval(tickInterval);
    };
  });
</script>

<div class="home" class:mounted data-theme="light">
  <!-- ═══════ GLOBE BACKGROUND ═══════ -->
  <div class="globe-layer">
    <MeshCanvas nodes={renderNodes} jobs={model.jobs} workers={model.workers} viewerLocation={{ lat: 37.57, lng: 126.98 }} />
  </div>

  <!-- ═══════ GLOBE OVERLAY TEXT ═══════ -->
  <div class="globe-overlay">
    <span class="go-line go-title">AUTONOMOUS RESEARCH MESH</span>
    <span class="go-line go-sub">{totalNodes || 8} nodes · {activeWorkers.length || 4} active · {model.jobs.length || 1} flows</span>
  </div>

  <!-- ═══════ WIDGET LAYER ═══════ -->
  <div class="widget-layer-outer" bind:clientWidth={containerW} bind:clientHeight={containerH}>
    <div
      class="widget-layer"
      style:width="{REF_W}px"
      style:height="{REF_H}px"
      style:transform="scale({uniformScale})"
    >
    {#each $visibleWidgets as w (w.id)}
      <WidgetContainer config={w} showHeader={w.id !== 'editor'} scale={uniformScale}>
        {#if w.id === "status-panel"}
          <StatusPanel research={liveResearch} {runningCount} {doneCount} />
        {:else if w.id === "jobs-list"}
          <JobsListWidget jobs={liveJobs} />
        {:else if w.id === "findings"}
          <FindingsWidget jobs={liveJobs} />
        {:else if w.id === "event-log"}
          <EventLogWidget jobCount={liveJobs.length} />
        {:else if w.id === "editor"}
          <HeroSection
            bind:searchQuery
            {topicSuggestions}
            on:search={handleSearch}
            on:topic={handleTopic}
          />
        {:else if w.id === "network-stats"}
          <NetworkWidget system={liveSystem} />
        {:else if w.id === "worker-activity"}
          <div class="wa-mini">
            <div class="wa-stat">
              <span class="wa-val">{activeWorkers.length || 4}</span>
              <span class="wa-key">Active</span>
            </div>
            <div class="wa-stat">
              <span class="wa-val">{Math.max(0, (model.workers.length || 8) - (activeWorkers.length || 4))}</span>
              <span class="wa-key">Idle</span>
            </div>
            <div class="wa-stat">
              <span class="wa-val">{model.workers.filter(w => w.state === 'training').length || 2}</span>
              <span class="wa-key">Training</span>
            </div>
          </div>
        {:else if w.id === "my-models"}
          <ModelsWidget models={TOP_MODELS} />
        {:else if w.id === "my-bonds"}
          <BondsWidget />
        {:else if w.id === "ecosystem"}
          <EcosystemWidget
            tvl={PROTOCOL_STATS.tvl}
            burned={PROTOCOL_STATS.burned}
            bonds={PROTOCOL_STATS.activeBonds}
            trustScore={PROTOCOL_STATS.trustScore}
            mau={PROTOCOL_STATS.mau}
            mauPercent={62}
          />
        {:else if w.id === "ppap"}
          <div class="ppap-mini">
            {#each PPAP_STAGES as stage, i}
              <span class="ppap-icon" style:color={stage.color} title={stage.label}>{stage.icon}</span>
              {#if i < PPAP_STAGES.length - 1}
                <span class="ppap-arrow">→</span>
              {/if}
            {/each}
          </div>
        {:else if w.id === "mau"}
          <div class="mau-mini">
            <span class="mau-label">MAU</span>
            <span class="mau-val">{PROTOCOL_STATS.mau}</span>
            <div class="mau-bar">
              <div class="mau-fill" style:width="62%"></div>
            </div>
          </div>
        {/if}
      </WidgetContainer>
    {/each}
    </div>
  </div>

  <!-- ═══════ WIDGET TOOLBAR ═══════ -->
  <WidgetToolbar loggedIn={$wallet.connected} />

  <!-- ═══════ WALLET CTA (logged out only) ═══════ -->
  {#if !$wallet.connected}
    <div class="wallet-cta">
      <span class="wallet-cta-label">Connect wallet to unlock full dashboard</span>
      <div class="wallet-cta-btns">
        {#each WALLET_OPTIONS as w}
          <button class="wallet-btn" on:click={() => wallet.connect(w.name)}>
            <span>{w.icon}</span>
            <span>{w.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════ CONTAINER ═══════ */
  .home {
    opacity: 0; transition: opacity 600ms ease;
    -webkit-font-smoothing: antialiased;
    background: var(--page-bg, #FAF9F7);
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 0;
  }
  .home.mounted { opacity: 1; }

  /* ═══════ GLOBE BACKGROUND ═══════ */
  .globe-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    filter: saturate(0.4) sepia(0.03) opacity(0.25);
  }

  /* ═══════ GLOBE OVERLAY TEXT ═══════ */
  .globe-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
    pointer-events: none;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .go-line {
    display: block;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .go-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.06);
  }
  .go-sub {
    font-size: 0.6rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.05);
    letter-spacing: 0.08em;
  }

  /* ═══════ WIDGET LAYER ═══════ */
  .widget-layer-outer {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }
  .widget-layer {
    transform-origin: top center;
    pointer-events: none;
    position: relative;
    flex-shrink: 0;
  }

  /* ═══════ WORKER ACTIVITY MINI ═══════ */
  .wa-mini {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .wa-stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .wa-val {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    line-height: 1;
  }
  .wa-key {
    font-family: var(--font-mono);
    font-size: 0.44rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ═══════ PPAP PIPELINE MINI ═══════ */
  .ppap-mini {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .ppap-icon {
    font-size: 0.9rem;
  }
  .ppap-arrow {
    font-size: 0.5rem;
    color: var(--border, #E5E0DA);
  }

  /* ═══════ MAU MINI ═══════ */
  .mau-mini {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mau-label {
    font-family: var(--font-mono);
    font-size: 0.44rem;
    font-weight: 700;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
  }
  .mau-val {
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
  }
  .mau-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.06);
  }
  .mau-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--green, #27864a);
    transition: width 600ms ease;
  }

  /* ═══════ WALLET CTA ═══════ */
  .wallet-cta {
    position: absolute;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }
  .wallet-cta-label {
    font-family: var(--font-mono);
    font-size: 0.56rem;
    color: var(--text-muted, #9a9590);
  }
  .wallet-cta-btns {
    display: flex;
    gap: 6px;
  }
  .wallet-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--glass-bg, rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 8px;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 150ms;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .wallet-btn:hover {
    background: rgba(0, 0, 0, 0.03);
    border-color: var(--accent, #D97757);
  }

  /* ═══════ RESPONSIVE: stack layout under 1024px ═══════ */
  @media (max-width: 1024px) {
    .home {
      overflow-y: auto;
      overflow-x: hidden;
    }
    .globe-layer {
      position: fixed;
      filter: saturate(0.3) sepia(0.03) opacity(0.1);
    }
    .globe-overlay {
      display: none;
    }
    .widget-layer-outer {
      position: relative;
      inset: auto;
      overflow: visible;
    }
    .widget-layer {
      width: auto !important;
      height: auto !important;
      transform: none !important;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      pointer-events: auto;
    }
    /* Force widgets to stack — override absolute positioning */
    .widget-layer :global(.wc) {
      position: relative !important;
      left: auto !important;
      top: auto !important;
      width: 100% !important;
      height: auto !important;
      z-index: auto !important;
    }
    .widget-layer :global(.wc-header) {
      cursor: default;
    }
    .widget-layer :global(.wc-resize) {
      display: none;
    }
    .wallet-cta {
      position: relative;
      bottom: auto;
      left: auto;
      transform: none;
      padding: 16px 8px;
    }
  }

  @media (max-width: 600px) {
    .wallet-cta-btns {
      flex-direction: column;
      width: 100%;
    }
    .wallet-btn {
      justify-content: center;
    }
  }
</style>
