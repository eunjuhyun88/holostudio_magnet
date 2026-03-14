<script lang="ts">
  import { onMount } from "svelte";

  import MeshCanvas from "../components/MeshCanvas.svelte";
  import HeroSection from "../components/HeroSection.svelte";
  import DashboardGrid from "../components/DashboardGrid.svelte";
  import StatusPanel from "../components/StatusPanel.svelte";
  import InfoBar from "../components/InfoBar.svelte";
  import WidgetContainer from "../components/WidgetContainer.svelte";
  import AppDock from "../components/AppDock.svelte";
  import JobsListWidget from "../components/widgets/JobsListWidget.svelte";
  import FindingsWidget from "../components/widgets/FindingsWidget.svelte";
  import EventLogWidget from "../components/widgets/EventLogWidget.svelte";
  import ModelsWidget from "../components/widgets/ModelsWidget.svelte";
  import BondsWidget from "../components/widgets/BondsWidget.svelte";
  import NetworkWidget from "../components/widgets/NetworkWidget.svelte";
  import EcosystemWidget from "../components/widgets/EcosystemWidget.svelte";
  import { visibleWidgets } from "../stores/widgetStore.ts";
  import { wallet, WALLET_OPTIONS } from "../stores/walletStore.ts";
  import { dashboardStore } from "../stores/dashboardStore.ts";
  import { router, type AppView } from "../stores/router.ts";
  import type { WidgetId } from "../data/widgetDefaults.ts";

  /** Map widget → detail page */
  const WIDGET_NAV: Partial<Record<WidgetId, AppView>> = {
    "status-panel": "research",
    "jobs-list": "research",
    "findings": "research",
    "event-log": "research",
    "my-models": "models",
    "my-bonds": "protocol",
    "network-status": "network",
    "ecosystem": "protocol",
  };

  let searchQuery = "";

  function handleSearch(e: CustomEvent<string>) {
    dashboardStore.startResearch(e.detail);
  }

  function handleTopic(e: CustomEvent<string>) {
    dashboardStore.startResearch(e.detail);
  }

  onMount(() => {
    dashboardStore.init();
    return () => dashboardStore.destroy();
  });
</script>

<div class="home" class:mounted={$dashboardStore.mounted} class:logged-in={$dashboardStore.isLoggedIn} data-theme="light">
  <!-- ═══════ INFO BAR (always visible) ═══════ -->
  <InfoBar
    system={$dashboardStore.liveSystem}
    activeWorkers={$dashboardStore.networkSummary.activeWorkers}
    idleWorkers={$dashboardStore.networkSummary.idleWorkers}
    tvl={$dashboardStore.protocolSummary.tvl}
    burned={$dashboardStore.protocolSummary.burned}
    bonds={$dashboardStore.protocolSummary.bonds}
    trustScore={$dashboardStore.protocolSummary.trustScore}
    mauPercent={$dashboardStore.protocolSummary.mauPercent}
  />

  <!-- ═══════ MAIN CONTENT ═══════ -->
  <div class="main-area">
    <!-- Globe background -->
    <div class="globe-layer">
      <MeshCanvas
        nodes={$dashboardStore.renderNodes}
        jobs={$dashboardStore.model.jobs}
        workers={$dashboardStore.model.workers}
        viewerLocation={{ lat: 37.57, lng: 126.98 }}
      />
    </div>

    <!-- Globe overlay text -->
    <div class="globe-overlay">
      <span class="go-line go-title">AUTONOMOUS RESEARCH MESH</span>
      <span class="go-line go-sub">
        {$dashboardStore.totalNodes || 8} nodes · {$dashboardStore.activeWorkers.length || 4} active · {$dashboardStore.model.jobs.length || 1} flows
      </span>
    </div>

    <!-- ═══════ HERO SECTION (center, always visible) ═══════ -->
    <div class="hero-area">
      <HeroSection
        bind:searchQuery
        topicSuggestions={$dashboardStore.topicSuggestions}
        onlineResearchers={$dashboardStore.networkSummary.activeWorkers}
        modelsTrained={$dashboardStore.modelsTrained}
        on:search={handleSearch}
        on:topic={handleTopic}
      />

      <!-- Download CTA (below editor) -->
      <div class="download-cta">
        <button class="download-btn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="dl-icon">
            <path d="M8 1v10M4 8l4 4 4-4M2 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download for macOS
        </button>
        <span class="download-sub">Also available for <u>Windows</u> and <u>Linux</u></span>
      </div>

      <!-- Wallet CTA (logged out only) -->
      {#if !$dashboardStore.isLoggedIn}
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

    <!-- ═══════ DASHBOARD GRID (inline, always visible) ═══════ -->
    <div class="grid-area">
      <DashboardGrid
        jobs={$dashboardStore.liveJobs}
        models={$dashboardStore.modelsSummary.models}
        nodes={$dashboardStore.liveSystem.nodes}
        activeWorkers={$dashboardStore.networkSummary.activeWorkers}
        gpuCount={Math.ceil($dashboardStore.liveSystem.nodes / 2)}
        tvl={$dashboardStore.protocolSummary.tvl}
        trustScore={$dashboardStore.protocolSummary.trustScore}
        burned={$dashboardStore.protocolSummary.burned}
      />
    </div>

    <!-- ═══════ WIDGET LAYER (left & right on desktop, below hero on mobile) ═══════ -->
    <div class="widget-layer">
      {#each $visibleWidgets as w (w.id)}
        <WidgetContainer config={w} detailView={WIDGET_NAV[w.id]}>
          {#if w.id === "status-panel"}
            <StatusPanel
              research={$dashboardStore.liveResearch}
              runningCount={$dashboardStore.runningCount}
              doneCount={$dashboardStore.doneCount}
            />
          {:else if w.id === "jobs-list"}
            <JobsListWidget jobs={$dashboardStore.liveJobs} />
          {:else if w.id === "findings"}
            <FindingsWidget jobs={$dashboardStore.liveJobs} />
          {:else if w.id === "event-log"}
            <EventLogWidget events={$dashboardStore.events} />
          {:else if w.id === "my-models"}
            <ModelsWidget models={$dashboardStore.modelsSummary.models} />
          {:else if w.id === "my-bonds"}
            <BondsWidget bonds={$dashboardStore.portfolioSummary.bonds} />
          {:else if w.id === "network-status"}
            <NetworkWidget system={$dashboardStore.liveSystem} />
          {:else if w.id === "ecosystem"}
            <EcosystemWidget
              tvl={$dashboardStore.protocolSummary.tvl}
              burned={$dashboardStore.protocolSummary.burned}
              bonds={$dashboardStore.protocolSummary.bonds}
              trustScore={$dashboardStore.protocolSummary.trustScore}
              mauPercent={$dashboardStore.protocolSummary.mauPercent}
            />
          {/if}
        </WidgetContainer>
      {/each}
    </div>
  </div>

  <!-- ═══════ APP DOCK (widget toggles + navigation) ═══════ -->
  <AppDock
    loggedIn={$dashboardStore.isLoggedIn}
    research={$dashboardStore.researchSummary}
    network={$dashboardStore.networkSummary}
    protocol={$dashboardStore.protocolSummary}
    models={$dashboardStore.modelsSummary}
    portfolio={$dashboardStore.portfolioSummary}
  />
</div>

<style>
  /* ═══════ CONTAINER ═══════ */
  .home {
    opacity: 0; transition: opacity 600ms ease;
    -webkit-font-smoothing: antialiased;
    background: var(--page-bg, #FAF9F7);
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .home.mounted { opacity: 1; }

  /* ═══════ MAIN AREA ═══════ */
  .main-area {
    flex: 1;
    position: relative;
    overflow-y: auto;
    min-height: 0;
  }

  /* ═══════ GLOBE BACKGROUND ═══════ */
  .globe-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    filter: saturate(0.4) sepia(0.03) opacity(0.2);
    pointer-events: none;
  }

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
  .go-title { font-size: 1.4rem; font-weight: 700; color: rgba(0, 0, 0, 0.05); }
  .go-sub { font-size: 0.6rem; font-weight: 500; color: rgba(0, 0, 0, 0.04); letter-spacing: 0.08em; }

  /* ═══════ WIDGET LAYER (floating on desktop, flow on mobile) ═══════ */
  .widget-layer {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .widget-layer :global(.wc) {
    pointer-events: auto;
  }

  /* ═══════ DASHBOARD GRID AREA ═══════ */
  .grid-area {
    position: relative;
    z-index: 2;
    pointer-events: auto;
    padding-top: 8px;
  }

  /* ≤ 900px: widgets become flow layout below hero */
  @media (max-width: 900px) {
    .widget-layer {
      position: relative;
      inset: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 12px 80px;
      pointer-events: auto;
    }
    .widget-layer :global(.wc) {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      z-index: auto !important;
    }
    .widget-layer :global(.wc-resize) {
      display: none;
    }
    .widget-layer :global(.wc-header) {
      cursor: default;
    }
  }

  /* ═══════ HERO AREA (center, z-index 2) ═══════ */
  .hero-area {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px 20px;
    pointer-events: auto;
    max-width: 720px;
    margin: 0 auto;
  }

  /* Logged-in: shrink hero to make room for widgets */
  .logged-in .hero-area {
    padding-top: 8px;
  }
  .logged-in .hero-area :global(.ws-headline) {
    font-size: 1.6rem;
    margin-bottom: 6px;
  }
  .logged-in .hero-area :global(.ws-sub) {
    font-size: 0.7rem;
    margin-bottom: 12px;
  }

  /* ═══════ DOWNLOAD CTA (below editor) ═══════ */
  .download-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
  }
  .download-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 14px 32px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.3);
    transition: background 150ms, transform 100ms, box-shadow 150ms;
  }
  .download-btn:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 6px 24px rgba(217, 119, 87, 0.4);
    transform: translateY(-1px);
  }
  .download-btn:active { transform: scale(0.97); }
  .dl-icon { flex-shrink: 0; }
  .download-sub {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    color: var(--text-muted, #9a9590);
  }
  .download-sub u {
    text-decoration: underline;
    cursor: pointer;
    color: var(--text-secondary, #6b6560);
  }

  /* ═══════ WALLET CTA (iOS grouped card) ═══════ */
  .wallet-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: var(--group-radius, 16px);
    padding: 16px 20px;
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.04));
  }
  .wallet-cta-label {
    font-family: var(--font-mono);
    font-size: 0.56rem;
    color: var(--text-muted, #9a9590);
  }
  .wallet-cta-btns { display: flex; gap: 8px; }
  .wallet-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--glass-bg, rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, transform 100ms;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .wallet-btn:hover {
    background: rgba(0, 0, 0, 0.03);
    border-color: var(--accent, #D97757);
    transform: translateY(-1px);
  }

  /* ═══════ RESPONSIVE ═══════ */
  @media (max-width: 900px) {
    .globe-overlay { display: none; }
  }

  @media (max-width: 600px) {
    .hero-area { padding: 12px 8px; }
    .wallet-cta-btns { flex-direction: column; width: 100%; }
    .wallet-btn { justify-content: center; }
  }
</style>
