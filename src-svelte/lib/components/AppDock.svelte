<script lang="ts">
  import { router } from "../stores/router.ts";
  import { widgetStore, allWidgets } from "../stores/widgetStore.ts";
  import { CATEGORY_COLORS, type WidgetId } from "../data/widgetDefaults.ts";
  import PixelIcon from "./PixelIcon.svelte";
  import type {
    ResearchSummary,
    NetworkSummary,
    ProtocolSummary,
    ModelsSummary,
    PortfolioSummary,
  } from "../services/types.ts";
  import type { AppView } from "../stores/router.ts";

  export let loggedIn = false;
  export let research: ResearchSummary;
  export let network: NetworkSummary;
  export let protocol: ProtocolSummary;
  export let models: ModelsSummary;
  export let portfolio: PortfolioSummary;

  // ── Widget group mappings ──
  const RESEARCH_WIDGETS: WidgetId[] = ["status-panel", "jobs-list", "findings", "event-log"];
  const NETWORK_WIDGETS: WidgetId[] = ["network-status"];
  const PROTOCOL_WIDGETS: WidgetId[] = ["ecosystem"];
  const PORTFOLIO_WIDGETS: WidgetId[] = ["my-models", "my-bonds"];

  let widgetMenuOpen = false;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  /** Toggle a group of widgets on/off */
  function toggleWidgetGroup(ids: WidgetId[]) {
    const currentState = $widgetStore;
    const anyVisible = ids.some((id) => currentState.widgets[id]?.visible);
    for (const id of ids) {
      const w = currentState.widgets[id];
      if (w && w.visible !== !anyVisible) {
        widgetStore.toggleVisible(id);
      }
    }
  }

  /** Single click = toggle widgets, double click = navigate to page */
  function handleDockClick(group: WidgetId[], pageView: AppView) {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      router.navigate(pageView);
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
      toggleWidgetGroup(group);
    }, 250);
  }

  function handleResearchClick() {
    handleDockClick(RESEARCH_WIDGETS, "research");
  }

  function handleModelsClick() {
    handleDockClick(["my-models"], "models");
  }

  function handleNetworkClick() {
    handleDockClick(NETWORK_WIDGETS, "network");
  }

  function handleProtocolClick() {
    handleDockClick(PROTOCOL_WIDGETS, "protocol");
  }

  function handlePortfolioClick() {
    if (loggedIn) {
      handleDockClick(PORTFOLIO_WIDGETS, "protocol");
    }
  }

  function toggleWidget(id: WidgetId) {
    widgetStore.toggleVisible(id);
  }

  function resetAll() {
    widgetStore.resetLayout(loggedIn);
    widgetMenuOpen = false;
  }

  function toggleWidgetMenu() {
    widgetMenuOpen = !widgetMenuOpen;
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.dock')) {
      widgetMenuOpen = false;
    }
  }

  $: currentView = $router.view;

  // Check if widgets are showing
  $: researchActive = RESEARCH_WIDGETS.some((id) => $widgetStore.widgets[id]?.visible);
  $: networkActive = NETWORK_WIDGETS.some((id) => $widgetStore.widgets[id]?.visible);
  $: protocolActive = PROTOCOL_WIDGETS.some((id) => $widgetStore.widgets[id]?.visible);
  $: portfolioActive = PORTFOLIO_WIDGETS.some((id) => $widgetStore.widgets[id]?.visible);
  $: modelsActive = $widgetStore.widgets["my-models"]?.visible ?? false;
</script>

<svelte:window on:click={handleWindowClick} />

<div class="dock" on:click|stopPropagation>
  <div class="dock-apps">
    <!-- ═══ RESEARCH ═══ -->
    <button type="button" class="dock-app" class:active={researchActive}
      on:click={handleResearchClick} title="Toggle research widgets">
      <span class="dock-icon"><PixelIcon type="research" size={18} /></span>
      <span class="dock-label">Research</span>
      <span class="dock-data" style:color="var(--accent, #D97757)">{research.runningJobs} running</span>
    </button>

    <!-- ═══ MODELS ═══ -->
    <button type="button" class="dock-app" class:active={modelsActive}
      on:click={handleModelsClick} title="Toggle models widget">
      <span class="dock-icon"><PixelIcon type="grid" size={18} /></span>
      <span class="dock-label">Models</span>
      <span class="dock-data" style:color="#2980b9">{models.count} models</span>
    </button>

    <!-- ═══ NETWORK ═══ -->
    <button type="button" class="dock-app" class:active={networkActive}
      on:click={handleNetworkClick} title="Click: toggle widget · Double: Network page">
      <span class="dock-icon"><PixelIcon type="globe" size={18} /></span>
      <span class="dock-label">Network</span>
      <span class="dock-data" style:color="var(--green, #27864a)">{network.nodes} nodes</span>
    </button>

    <!-- ═══ PROTOCOL ═══ -->
    <button type="button" class="dock-app" class:active={protocolActive}
      on:click={handleProtocolClick} title="Click: toggle widget · Double: Protocol page">
      <span class="dock-icon"><PixelIcon type="protocol" size={18} /></span>
      <span class="dock-label">Protocol</span>
      <span class="dock-data" style:color="#d4a017">{protocol.tvl}</span>
    </button>

    <!-- ═══ PORTFOLIO ═══ -->
    <button type="button" class="dock-app" class:active={portfolioActive}
      on:click={handlePortfolioClick} title="Toggle portfolio widgets">
      <span class="dock-icon"><PixelIcon type="portfolio" size={18} /></span>
      <span class="dock-label">Portfolio</span>
      {#if loggedIn}
        <span class="dock-data" style:color="#8e44ad">{portfolio.bondCount} bonds</span>
      {:else}
        <span class="dock-data muted">Connect</span>
      {/if}
    </button>

    <!-- Separator + Gear -->
    <div class="dock-sep"></div>

    <div class="dock-gear-wrap">
      <button type="button" class="dock-gear" class:dock-gear-open={widgetMenuOpen}
        on:click|stopPropagation={toggleWidgetMenu}
        title="Toggle widgets">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.2"/>
          <path d="M6.7 1.5l-.4 1.3a5 5 0 00-1.5.9L3.5 3.2l-1.3 2.3 1 1a5 5 0 000 1.7l-1 1 1.3 2.3 1.3-.5a5 5 0 001.5.9l.4 1.3h2.6l.4-1.3a5 5 0 001.5-.9l1.3.5 1.3-2.3-1-1a5 5 0 000-1.7l1-1-1.3-2.3-1.3.5a5 5 0 00-1.5-.9L9.3 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if widgetMenuOpen}
        <div class="widget-menu" role="presentation" on:click|stopPropagation>
          <div class="wm-header">
            <span class="wm-title">Widgets</span>
            <button type="button" class="wm-reset" on:click={resetAll} title="Reset layout">Reset</button>
          </div>
          <div class="wm-list">
            {#each $allWidgets as w (w.id)}
              <button type="button" class="wm-item" class:wm-item-active={w.visible}
                on:click={() => toggleWidget(w.id)}>
                <span class="wm-dot" style:background={CATEGORY_COLORS[w.category]}></span>
                <span class="wm-name">{w.label}</span>
                <span class="wm-toggle">{w.visible ? '✓' : ''}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dock {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    padding: 6px 8px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.92));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 18px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(0, 0, 0, 0.03);
    z-index: 9999;
    pointer-events: auto;
    max-width: calc(100vw - 20px);
  }

  .dock-apps {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .dock-app {
    appearance: none; border: none; background: transparent;
    border-radius: 12px; padding: 6px 12px;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    cursor: pointer; transition: all 140ms ease;
    min-width: 60px; position: relative;
  }
  .dock-app:hover {
    background: rgba(0, 0, 0, 0.04);
    transform: translateY(-1px);
  }
  .dock-app:active { transform: translateY(0) scale(0.97); }

  /* Active = widgets are showing */
  .dock-app.active {
    background: rgba(217, 119, 87, 0.08);
  }
  .dock-app.active::after {
    content: ""; position: absolute; bottom: 2px; left: 50%;
    transform: translateX(-50%); width: 4px; height: 4px;
    border-radius: 50%; background: var(--accent, #D97757);
  }

  .dock-icon {
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted, #9a9590);
    line-height: 1;
  }
  .dock-app.active .dock-icon { color: var(--accent, #D97757); }
  .dock-label {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.48rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
  }
  .dock-data {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.46rem; font-weight: 700;
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .dock-data.muted { color: var(--text-muted, #9a9590) !important; font-weight: 500; }

  .dock-sep {
    width: 1px; height: 24px;
    background: var(--border-subtle, #EDEAE5);
    margin: 0 4px; flex-shrink: 0;
  }

  /* ═══ GEAR + WIDGET MENU ═══ */
  .dock-gear-wrap { position: relative; }
  .dock-gear {
    appearance: none; border: none; background: transparent;
    border-radius: 8px; padding: 6px; cursor: pointer;
    color: var(--text-muted, #9a9590);
    transition: all 140ms ease;
    display: flex; align-items: center; justify-content: center;
  }
  .dock-gear:hover { background: rgba(0, 0, 0, 0.05); color: var(--text-primary, #2D2D2D); }
  .dock-gear-open { background: rgba(0, 0, 0, 0.06); color: var(--text-primary, #2D2D2D); }

  .widget-menu {
    position: absolute; bottom: calc(100% + 12px); right: -8px;
    min-width: 180px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.97));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 12px;
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.02);
    overflow: hidden; z-index: 10000;
    animation: panelUp 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes panelUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .wm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .wm-title {
    font-family: var(--font-mono); font-size: 0.5rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .wm-reset {
    appearance: none; border: none; background: transparent;
    font-family: var(--font-mono); font-size: 0.44rem; font-weight: 600;
    color: var(--accent, #D97757); cursor: pointer;
    padding: 2px 6px; border-radius: 4px; transition: background 100ms;
  }
  .wm-reset:hover { background: rgba(217, 119, 87, 0.08); }
  .wm-list { padding: 4px; display: flex; flex-direction: column; gap: 1px; }
  .wm-item {
    appearance: none; border: none; background: transparent;
    border-radius: 6px; padding: 6px 10px;
    display: flex; align-items: center; gap: 8px;
    cursor: pointer; transition: background 100ms;
    width: 100%; text-align: left;
  }
  .wm-item:hover { background: rgba(0, 0, 0, 0.03); }
  .wm-item-active { background: rgba(0, 0, 0, 0.02); }
  .wm-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .wm-item-active .wm-dot { box-shadow: 0 0 4px currentColor; }
  .wm-name {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 500;
    color: var(--text-secondary, #6b6560); flex: 1;
  }
  .wm-item-active .wm-name { font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .wm-toggle {
    font-size: 0.5rem; color: var(--green, #27864a);
    width: 14px; text-align: center;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .dock { padding: 3px 4px; border-radius: 12px; bottom: 6px; }
    .dock-app { min-width: 42px; padding: 4px 6px; }
    .dock-icon { font-size: 0.9rem; }
    .dock-label { font-size: 0.38rem; }
    .dock-data { font-size: 0.36rem; }
  }
  @media (max-width: 420px) {
    .dock-data { display: none; }
    .dock-app { min-width: 36px; padding: 3px 4px; }
  }
</style>
