<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from '../stores/walletStore.ts';
  import { animateCounter } from '../utils/animate.ts';
  import { fmtDollar, fmtK, fmtInt } from '../utils/format.ts';
  import {
    EVENT_FEED, CONTRACT_MAP, MAU_TARGET,
    type ContractCall, type ProtocolEvent,
  } from '../data/protocolData.ts';

  // Sub-components
  import ContractCallModal from '../components/ContractCallModal.svelte';
  import BurnPanel from '../components/BurnPanel.svelte';
  import JobCreatorPanel from '../components/JobCreatorPanel.svelte';
  import TokenFlowPanel from '../components/TokenFlowPanel.svelte';
  import PPAPPipeline from '../components/PPAPPipeline.svelte';
  import YourJourney from '../components/YourJourney.svelte';
  import { rewardSummary } from '../stores/rewardStore.ts';
  import { router } from '../stores/router.ts';

  let visible = false;

  // ── Mobile tab switching (supports deep-link via ?tab=) ──
  const validTabs = ['operations', 'analytics', 'events'] as const;
  type MobileTab = typeof validTabs[number];
  function resolveTab(): MobileTab {
    let t: MobileTab = 'operations';
    router.params.subscribe(p => { if (p.tab && validTabs.includes(p.tab as MobileTab)) t = p.tab as MobileTab; })();
    return t;
  }
  let mobileTab: MobileTab = resolveTab();

  // ── Reward summary (for protocol-wide distribution card) ──
  $: summary = $rewardSummary;

  // ── Wallet (from shared store) ──
  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // ── Destroyed guard for RAF cleanup ──
  let destroyed = false;

  // ── Protocol Metrics (animated) ──
  let tvl = 0;
  let burned = 0;
  let treasury = 0;
  let activeBonds = 0;
  let mau = 0;
  const mauTarget = MAU_TARGET;

  onMount(() => {
    visible = true;
    const isDestroyed = () => destroyed;

    const delayMetrics = setTimeout(() => {
      animateCounter(0, 12_400_000, 1800, v => tvl = v, isDestroyed);
      animateCounter(0, 847_000, 1600, v => burned = v, isDestroyed);
      animateCounter(0, 3_200_000, 1700, v => treasury = v, isDestroyed);
      animateCounter(0, 2341, 1400, v => activeBonds = v, isDestroyed);
      animateCounter(0, 892, 1500, v => mau = v, isDestroyed);
    }, 300);

    return () => {
      destroyed = true;
      clearTimeout(delayMetrics);
      clearTimeout(confirmTimer);
    };
  });

  // ── Gauge (for metrics strip mini-arc) ──
  $: gaugeRatio = Math.round(mau) / mauTarget;

  // ── Contract Call Modal ──
  let modalOpen = false;
  let modalCall: ContractCall | null = null;
  let modalStep: 'review' | 'pending' | 'confirmed' = 'review';

  function openContractModal(call: ContractCall) {
    modalCall = call;
    modalStep = 'review';
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    modalCall = null;
    modalStep = 'review';
  }

  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  function confirmTx() {
    modalStep = 'pending';
    confirmTimer = setTimeout(() => {
      if (destroyed) return;
      modalStep = 'confirmed';
    }, 2200);
  }

  // ── Event Feed ──
  const eventFeed = EVENT_FEED;

  function openEventModal(evt: ProtocolEvent) {
    openContractModal({
      title: evt.fn + '()',
      contract: CONTRACT_MAP[evt.fn] ?? '0x0000...0000',
      fn: evt.fn,
      params: [{ name: 'txHash', type: 'bytes32', value: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6) }],
      fee: '---',
      gas: '---',
      note: evt.text,
      accentColor: evt.color,
    });
  }
</script>

<div class="econ" data-theme="light" class:visible>

  <!-- 0. PAGE HEADER -->
  <div class="page-header">
    <div class="page-header-inner">
      <div class="page-header-text">
        <h1 class="page-title">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" class="px-icon title-icon" shape-rendering="crispEdges">
            <rect x="3" y="1" width="4" height="2" fill="var(--accent)"/>
            <rect x="1" y="3" width="2" height="4" fill="var(--accent)"/>
            <rect x="7" y="3" width="2" height="2" fill="var(--accent)"/>
            <rect x="3" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="5" y="5" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="7" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="9" y="9" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="11" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="9" y="5" width="4" height="2" fill="var(--accent)"/>
            <rect x="13" y="7" width="2" height="4" fill="var(--accent)"/>
            <rect x="9" y="11" width="4" height="2" fill="var(--accent)"/>
            <rect x="7" y="11" width="2" height="2" fill="var(--accent)"/>
            <rect x="1" y="5" width="2" height="2" fill="var(--accent)"/>
            <rect x="3" y="5" width="2" height="2" fill="var(--accent)"/>
          </svg>
          HOOT Protocol
        </h1>
        <p class="page-subtitle">On-chain operations, token flows & protocol mechanics</p>
      </div>
      <div class="page-header-meta">
        <span class="header-tag">L1 PROOF</span>
        <span class="header-tag">L2 MODEL</span>
        <span class="header-tag">L3 AGENT</span>
      </div>
    </div>
  </div>

  <!-- 1. PROTOCOL METRICS STRIP -->
  <div class="metrics-strip">
    <div class="metrics-inner">
      <div class="metric-item" style="--delay: 0">
        <span class="metric-value">{fmtDollar(tvl)}</span>
        <span class="metric-label">TVL</span>
        <span class="metric-delta positive">+4.2%</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 1">
        <span class="metric-value">{fmtK(burned)}</span>
        <span class="metric-label">Burned HOOT</span>
        <span class="metric-delta negative">↑ deflationary</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 2">
        <span class="metric-value">{fmtDollar(treasury)}</span>
        <span class="metric-label">Treasury</span>
        <span class="metric-delta positive">+1.8%</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 3">
        <span class="metric-value">{fmtInt(activeBonds)}</span>
        <span class="metric-label">Active Bonds</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 4">
        <span class="metric-value">{fmtInt(mau)}<span class="metric-of">/{fmtInt(mauTarget)}</span></span>
        <span class="metric-label">MAU → Deflation</span>
        <div class="mau-arc">
          <svg viewBox="0 0 36 18" class="mau-arc-svg">
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
              stroke-dasharray="{44 * gaugeRatio} 44"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- 2. MOBILE SEGMENT CONTROL -->
  <div class="mobile-tabs">
    <button class="mtab-btn" class:mtab-active={mobileTab === 'operations'} on:click={() => mobileTab = 'operations'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Operations
    </button>
    <button class="mtab-btn" class:mtab-active={mobileTab === 'analytics'} on:click={() => mobileTab = 'analytics'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Analytics
    </button>
    <button class="mtab-btn" class:mtab-active={mobileTab === 'events'} on:click={() => mobileTab = 'events'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Events
    </button>
  </div>

  <!-- 3. MAIN DASHBOARD GRID -->
  <div class="dash-content">
    <div class="dash-grid">

      <!-- LEFT COLUMN: Operations -->
      <div class="left-col" class:mtab-hidden={mobileTab !== 'operations'}>
        <div class="section-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          On-chain Operations
        </div>
        <BurnPanel simulatedBalance={12450} on:openModal={e => openContractModal(e.detail)} />
        <JobCreatorPanel on:openModal={e => openContractModal(e.detail)} />
      </div>

      <!-- RIGHT COLUMN: Analytics + Events -->
      <div class="right-col">
        <div class:mtab-hidden={mobileTab !== 'analytics'} class="mobile-group">
          <div class="section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Analytics & Flow
          </div>
          <TokenFlowPanel />
          <PPAPPipeline />
          <!-- Protocol Reward Distribution (aggregate) -->
          <div class="panel" style="--panel-delay: 2">
            <div class="panel-header">
              <h2>Reward Distribution</h2>
            </div>
            <div class="proto-reward-grid">
              <div class="pr-item">
                <span class="pr-val accent">{summary.poolB.toFixed(2)}</span>
                <span class="pr-label">Pool B (GPU)</span>
              </div>
              <div class="pr-item">
                <span class="pr-val green">{summary.poolA.toFixed(2)}</span>
                <span class="pr-label">Pool A (Creator)</span>
              </div>
              <div class="pr-item">
                <span class="pr-val">{summary.total.toFixed(2)}</span>
                <span class="pr-label">Total Distributed</span>
              </div>
            </div>
          </div>
        </div>

        <div class:mtab-hidden={mobileTab !== 'events'} class="mobile-group">
          <!-- Panel E: Recent Protocol Events -->
          <div class="panel feed-panel" style="--panel-delay: 1">
            <div class="panel-header">
              <h2>Protocol Events</h2>
              <span class="live-dot-wrapper"><span class="live-dot"></span> Live</span>
            </div>
            <div class="feed-list">
              {#each eventFeed as evt, i}
                <button class="feed-item" style="--feed-delay: {i}" on:click={() => openEventModal(evt)}>
                  <span class="feed-dot" style="background: {evt.color}"></span>
                  <span class="feed-text">{evt.text}</span>
                  <span class="feed-time">{evt.time}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- YOUR JOURNEY -->
  <YourJourney />

  <!-- CONTRACT CALL MODAL -->
  <ContractCallModal
    {modalCall}
    {modalOpen}
    {modalStep}
    {walletConnected}
    {walletAddress}
    on:close={closeModal}
    on:confirm={confirmTx}
    on:connectWallet={() => { wallet.connect('Phantom'); }}
  />
</div>

<style>
  /* ====== BASE ====== */
  .econ {
    width: 100%;
    min-height: 100vh;
    background: var(--page-bg, #FAF9F7);
    color: var(--text-primary, #2D2D2D);
    font-family: var(--font-body, 'Inter', sans-serif);
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  .econ.visible { opacity: 1; }

  h2 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  /* ====== PAGE HEADER ====== */
  .page-header {
    padding: 36px 24px 24px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }

  .page-header-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }

  .page-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-icon {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .page-subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary, #6b6560);
    margin: 4px 0 0;
    font-weight: 500;
  }

  .page-header-meta {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .header-tag {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 10px;
    border-radius: var(--radius-pill, 100px);
    border: 1px solid var(--border, #E5E0DA);
    color: var(--text-muted, #9a9590);
    background: var(--surface, #fff);
  }

  /* ====== METRICS STRIP ====== */
  .metrics-strip {
    position: sticky;
    top: var(--header-height, 52px);
    z-index: 20;
    background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: var(--group-radius, 16px);
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.04));
    margin: 0 24px;
    padding: 0 24px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .metrics-strip::-webkit-scrollbar { height: 0; display: none; }

  .metrics-inner {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 14px 0;
    min-width: max-content;
    max-width: 1400px;
    margin: 0 auto;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px;
    gap: 2px;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--delay, 0) * 80ms) both;
  }

  .metric-value {
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .metric-of {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .metric-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 600;
  }

  .metric-delta {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
  }
  .metric-delta.positive { color: var(--green); }
  .metric-delta.negative { color: var(--red); }

  .metric-divider {
    width: 1px;
    height: 32px;
    background: var(--border-subtle);
    flex-shrink: 0;
  }

  .mau-arc {
    width: 36px;
    height: 18px;
    margin-top: 2px;
  }
  .mau-arc-svg { width: 100%; height: 100%; }

  /* ====== DASHBOARD GRID ====== */
  .dash-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 28px;
    align-items: start;
  }

  .left-col, .right-col {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* ====== EVENT FEED (kept inline) ====== */
  .panel {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    transition: box-shadow 300ms ease, transform 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--panel-delay, 0) * 120ms + 200ms) both;
  }
  .panel:hover { box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08)); }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .feed-panel { max-height: none; }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 380px;
    overflow-y: auto;
  }
  .feed-list::-webkit-scrollbar { width: 4px; }
  .feed-list::-webkit-scrollbar-track { background: transparent; }
  .feed-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .feed-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    background: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 150ms;
    text-align: left;
    animation: fadeInUp 400ms var(--ease-out-expo) calc(var(--feed-delay, 0) * 60ms) both;
    width: 100%;
  }
  .feed-item:hover { background: var(--page-bg); }

  .feed-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }

  .feed-text {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
    flex: 1;
  }

  .feed-time {
    font-size: 0.65rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .live-dot-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--green);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    animation: breathe 2s infinite;
  }

  /* ====== SECTION LABELS ====== */
  .section-label {
    display: none;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted, #9a9590);
    padding: 0 4px;
  }

  /* ====== MOBILE TABS ====== */
  .mobile-tabs {
    display: none;
  }

  .mtab-btn {
    appearance: none;
    border: none;
    background: none;
    padding: 7px 14px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    border-radius: 8px;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    justify-content: center;
    white-space: nowrap;
  }

  .mtab-btn:hover {
    color: var(--text-secondary, #6b6560);
  }

  .mtab-active {
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .mobile-group {
    display: contents;
  }

  /* ====== PROTOCOL REWARD DISTRIBUTION ====== */
  .proto-reward-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  .pr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
  }
  .pr-val {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
  .pr-val.accent { color: var(--accent, #D97757); }
  .pr-val.green { color: var(--green, #27864a); }
  .pr-label {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
  }

  /* ====== RESPONSIVE ====== */
  @media (max-width: 860px) {
    .dash-grid { grid-template-columns: 1fr; }
    .metrics-inner { gap: 0; }
    .metric-item { padding: 0 14px; }
    .page-header-inner { flex-direction: column; align-items: flex-start; }
  }

  @media (max-width: 600px) {
    .dash-content { padding: 8px; }
    .dash-grid { gap: 12px; }
    .left-col, .right-col { gap: 12px; }
    .panel { padding: 16px; border-radius: var(--radius-md, 10px); }
    h2 { font-size: 1.05rem; }
    .metric-item { padding: 0 10px; }
    .metric-value { font-size: 0.95rem; }
    .metrics-strip {
      margin: 0 8px;
      border-radius: var(--radius-md, 10px);
      padding: 0 8px;
    }
    .page-header { padding: 16px 12px 12px; }
    .page-title { font-size: 1.3rem; }
    .page-title .title-icon { width: 20px; height: 20px; }
    .page-subtitle { font-size: 0.78rem; }
    .page-header-meta { flex-wrap: wrap; }

    /* Mobile tabs visible */
    .mobile-tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      margin: 8px 8px 0;
      background: var(--border-subtle, #EDEAE5);
      border-radius: 10px;
      position: sticky;
      top: calc(var(--header-height, 52px) + 0px);
      z-index: 19;
    }

    /* Section labels visible */
    .section-label { display: flex; }

    /* Mobile group becomes flex column */
    .mobile-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Hide inactive tab content */
    .mtab-hidden { display: none !important; }

    /* Feed improvements */
    .feed-list { max-height: 60vh; }
    .feed-item { padding: 10px 8px; }
    .feed-text { font-size: 0.7rem; }
  }

  @media (max-width: 380px) {
    .mtab-btn { padding: 6px 8px; font-size: 0.68rem; }
    .mtab-btn svg { display: none; }
    .metric-label { font-size: 0.58rem; }
    .metric-value { font-size: 0.85rem; }
    .metric-divider { height: 24px; }
  }
</style>
