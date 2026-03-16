<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fly, fade } from 'svelte/transition';
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
  import MyActivityPanel from '../components/protocol/MyActivityPanel.svelte';
  import PPAPContributePanel from '../components/protocol/PPAPContributePanel.svelte';
  import ChallengePanel from '../components/protocol/ChallengePanel.svelte';
  import { rewardSummary } from '../stores/rewardStore.ts';
  import { router } from '../stores/router.ts';
  let visible = false;
  let isMobile = false;

  // ── Mobile tab switching (supports deep-link via ?tab=) ──
  const validTabs = ['operations', 'analytics', 'events'] as const;
  type MobileTab = typeof validTabs[number];
  function resolveTab(): MobileTab {
    const p = get(router.params);
    if (p.tab && validTabs.includes(p.tab as MobileTab)) return p.tab as MobileTab;
    return 'operations';
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

    // UX-E5: Track mobile state for tab slide transitions
    const mq = window.matchMedia('(max-width: 600px)');
    isMobile = mq.matches;
    const handleMq = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mq.addEventListener('change', handleMq);

    // Stagger counter starts to reduce initial RAF contention (5 simultaneous → waterfall)
    const delays = [300, 420, 540, 660, 780];
    const timers = delays.map((delay, i) => setTimeout(() => {
      if (destroyed) return;
      const targets: [number, number, (v: number) => void][] = [
        [12_400_000, 1800, v => tvl = v],
        [847_000, 1600, v => burned = v],
        [3_200_000, 1700, v => treasury = v],
        [2341, 1400, v => activeBonds = v],
        [892, 1500, v => mau = v],
      ];
      const [target, dur, setter] = targets[i];
      animateCounter(0, target, dur, setter, isDestroyed);
    }, delay));

    return () => {
      destroyed = true;
      timers.forEach(t => clearTimeout(t));
      clearTimeout(confirmTimer);
      mq.removeEventListener('change', handleMq);
    };
  });

  // ── Gauge (for metrics strip mini-arc) ──
  $: gaugeRatio = Math.round(mau) / mauTarget;
  $: mauPulse = gaugeRatio >= 0.85;

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

  // ── Bundle Registration State ──
  let showBundleModal = false;
  let bundlePpapIds = '';
  let bundleDomain = '';
  let bundlePrice = '';

  function openBundleModal() {
    bundlePpapIds = '';
    bundleDomain = '';
    bundlePrice = '';
    showBundleModal = true;
  }

  function closeBundleModal() {
    showBundleModal = false;
  }

  function submitBundleRegistration() {
    if (!bundlePpapIds.trim() || !bundleDomain.trim() || !bundlePrice.trim()) return;
    showBundleModal = false;
    openContractModal({
      title: 'Bundle Registration',
      contract: '0x5E1f...8C2d  HootBundle.sol',
      fn: 'listBundleAsset',
      params: [
        { name: 'ppapIds', type: 'uint256[]', value: bundlePpapIds.trim() },
        { name: 'domain', type: 'string', value: bundleDomain.trim() },
        { name: 'price', type: 'uint256', value: `${bundlePrice.trim()} HOOT` },
      ],
      fee: '0 HOOT',
      gas: '~200,000',
      note: 'Bundle will be listed on the marketplace. PPAP data must be verified.',
      accentColor: 'var(--accent)',
    });
  }

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

<div class="econ" class:visible>
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

  <!-- 0.5. MY ACTIVITY (Member only) -->
  {#if walletConnected}
  <div class="my-activity-section">
    <div class="my-activity-inner">
      <MyActivityPanel />
    </div>
  </div>
  {/if}

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
        <div class="mau-arc" class:mau-pulse={mauPulse}>
          <svg viewBox="0 0 36 18" class="mau-arc-svg">
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
              stroke-dasharray="{44 * gaugeRatio} 44" class="mau-arc-fill"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- 2. MOBILE SEGMENT CONTROL -->
  <div class="mobile-tabs" role="tablist" aria-label="Protocol sections">
    <button class="mtab-btn" class:mtab-active={mobileTab === 'operations'} role="tab" aria-selected={mobileTab === 'operations'} on:click={() => mobileTab = 'operations'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Operations
    </button>
    <button class="mtab-btn" class:mtab-active={mobileTab === 'analytics'} role="tab" aria-selected={mobileTab === 'analytics'} on:click={() => mobileTab = 'analytics'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Analytics
    </button>
    <button class="mtab-btn" class:mtab-active={mobileTab === 'events'} role="tab" aria-selected={mobileTab === 'events'} on:click={() => mobileTab = 'events'}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Events
    </button>
  </div>

  <!-- 3. MAIN DASHBOARD GRID -->
  <div class="dash-content">
    <div class="dash-grid">

      <!-- LEFT COLUMN: Operations -->
      {#if !isMobile || mobileTab === 'operations'}
      <div class="left-col" in:fly={{ y: isMobile ? 8 : 0, duration: isMobile ? 200 : 0 }}>
        <div class="section-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="section-icon"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          On-chain Operations
        </div>
        <BurnPanel simulatedBalance={12450} on:openModal={e => openContractModal(e.detail)} />
        <JobCreatorPanel on:openModal={e => openContractModal(e.detail)} />
        {#if walletConnected}
          <PPAPContributePanel />

          <!-- Bundle Registration Panel -->
          <div class="panel bundle-panel" style="--panel-delay: 3">
            <div class="panel-header">
              <h2>Bundle Registration</h2>
              <span class="bundle-badge">BundleAssetListed</span>
            </div>
            <p class="bundle-desc">
              Package verified PPAP data into Bundles and list them on the marketplace.
              Other researchers can purchase and use them for training.
            </p>
            <button class="bundle-cta" on:click={openBundleModal}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Register Bundle
            </button>
          </div>
        {/if}
      </div>
      {/if}

      <!-- RIGHT COLUMN: Analytics + Events -->
      <div class="right-col">
        {#if !isMobile || mobileTab === 'analytics'}
        <div class="mobile-group" in:fly={{ y: isMobile ? 8 : 0, duration: isMobile ? 200 : 0 }}>
          <div class="section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="section-icon"><path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Analytics & Flow
          </div>
          <TokenFlowPanel />
          <PPAPPipeline />
          {#if walletConnected}
            <ChallengePanel on:openModal={e => openContractModal(e.detail)} />
          {/if}
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
        {/if}

        {#if !isMobile || mobileTab === 'events'}
        <div class="mobile-group" in:fly={{ y: isMobile ? 8 : 0, duration: isMobile ? 200 : 0 }}>
          <div class="section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="section-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Protocol Events
          </div>
          <!-- Panel E: Recent Protocol Events -->
          <div class="panel feed-panel" style="--panel-delay: 1">
            <div class="panel-header">
              <h2>Protocol Events</h2>
              <span class="live-dot-wrapper"><span class="live-dot"></span> Live</span>
            </div>
            <div class="feed-list">
              {#each eventFeed as evt, i}
                <button class="feed-item" style="--feed-delay: {i}; --feed-color: {evt.color}" on:click={() => openEventModal(evt)}>
                  <span class="feed-dot" style="background: {evt.color}"></span>
                  <span class="feed-text">{evt.text}</span>
                  <span class="feed-time">{evt.time}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
        {/if}
      </div>

    </div>
  </div>

  <!-- YOUR JOURNEY -->
  <YourJourney />

  <!-- BUNDLE REGISTRATION MODAL -->
  {#if showBundleModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bundle-overlay" on:click|self={closeBundleModal} transition:fade={{ duration: 150 }}>
      <div class="bundle-modal" transition:fly={{ y: 16, duration: 250 }}>
        <h3 class="bm-title">Bundle Registration</h3>
        <p class="bm-desc">Package PPAP data into a Bundle and list it on the marketplace.</p>

        <div class="bm-field">
          <label class="bm-label" for="bm-ppap">PPAP Batch IDs</label>
          <input id="bm-ppap" class="bm-input" type="text" bind:value={bundlePpapIds}
            placeholder="PPAP-0039, PPAP-0040, ..." />
          <span class="bm-hint">Comma-separated</span>
        </div>

        <div class="bm-field">
          <label class="bm-label" for="bm-domain">Domain</label>
          <input id="bm-domain" class="bm-input" type="text" bind:value={bundleDomain}
            placeholder="eth-price-feed" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="bm-price">Price (HOOT)</label>
          <input id="bm-price" class="bm-input" type="number" min="0" step="1" bind:value={bundlePrice}
            placeholder="50" />
        </div>

        <div class="bm-actions">
          <button class="bm-cancel" on:click={closeBundleModal}>Cancel</button>
          <button class="bm-submit"
            on:click={submitBundleRegistration}
            disabled={!bundlePpapIds.trim() || !bundleDomain.trim() || !bundlePrice.trim()}>
            Proceed
          </button>
        </div>
      </div>
    </div>
  {/if}

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
    z-index: var(--z-sticky, 10);
    background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: var(--group-radius, 16px);
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.04));
    margin: 16px 24px 0;
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

  /* UX-E2: Metric hover scale */
  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px;
    gap: 2px;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--delay, 0) * 80ms) both;
    transition: transform 200ms var(--ease-out-expo), background 200ms ease;
    border-radius: var(--radius-sm, 6px);
    cursor: default;
  }
  .metric-item:hover {
    transform: scale(1.06);
    background: var(--page-bg, #FAF9F7);
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

  /* UX-E3: MAU arc pulse when approaching target */
  .mau-arc-fill { transition: stroke-dasharray 300ms ease; }
  .mau-pulse .mau-arc-fill {
    animation: arcPulse 2.5s ease-in-out infinite;
  }
  @keyframes arcPulse {
    0%, 100% { filter: drop-shadow(0 0 0 transparent); opacity: 1; }
    50% { filter: drop-shadow(0 0 3px var(--accent, #D97757)); opacity: 0.85; }
  }

  /* ====== DASHBOARD GRID ====== */
  .dash-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
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

  /* UX-E4: Feed item with left border flash */
  .feed-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    background: none;
    border-left: 2px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 150ms, border-color 200ms ease;
    text-align: left;
    animation: feedSlideIn 400ms var(--ease-out-expo) calc(var(--feed-delay, 0) * 60ms) both;
    width: 100%;
  }
  .feed-item:hover {
    background: var(--page-bg);
    border-left-color: var(--feed-color, var(--accent));
  }
  @keyframes feedSlideIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }

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
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted, #9a9590);
    padding: 0 4px;
    margin-bottom: -8px;
  }

  /* UX-E6: Section icon micro-rotation on hover/visibility */
  .section-label :global(.section-icon) {
    transition: transform 300ms var(--ease-out-expo);
  }
  .section-label:hover :global(.section-icon) {
    transform: rotate(12deg) scale(1.1);
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

  /* ====== MY ACTIVITY SECTION ====== */
  .my-activity-section {
    padding: 16px 24px 0;
  }
  .my-activity-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ====== BUNDLE PANEL ====== */
  .bundle-desc {
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.5;
    margin: 0 0 16px;
  }
  .bundle-badge {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(217,119,87,0.1);
    color: var(--accent, #D97757);
  }
  .bundle-cta {
    appearance: none;
    border: 1.5px solid var(--accent, #D97757);
    background: rgba(217,119,87,0.04);
    color: var(--accent, #D97757);
    font-size: 0.82rem;
    font-weight: 700;
    padding: 12px 24px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    transition: all 150ms;
  }
  .bundle-cta:hover {
    background: var(--accent, #D97757);
    color: #fff;
    box-shadow: 0 0 20px rgba(217,119,87,0.25);
  }

  /* ====== BUNDLE MODAL ====== */
  .bundle-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 100);
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .bundle-modal {
    background: rgba(255,255,255,0.98);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 20px;
    padding: 28px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(217,119,87,0.08);
  }
  .bm-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 4px;
  }
  .bm-desc {
    font-size: 0.76rem;
    color: var(--text-secondary, #6b6560);
    margin: 0 0 20px;
    line-height: 1.4;
  }
  .bm-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }
  .bm-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
  }
  .bm-input {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.82rem;
    font-family: inherit;
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    outline: none;
    transition: border-color 150ms;
  }
  .bm-input:focus {
    border-color: var(--accent, #D97757);
  }
  .bm-hint {
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
  }
  .bm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 20px;
  }
  .bm-cancel {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    color: var(--text-secondary);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 10px 20px;
    border-radius: 100px;
    cursor: pointer;
    transition: all 150ms;
  }
  .bm-cancel:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .bm-submit {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 10px 24px;
    border-radius: 100px;
    cursor: pointer;
    transition: all 150ms;
  }
  .bm-submit:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 16px rgba(217,119,87,0.25);
  }
  .bm-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ====== RESPONSIVE ====== */
  @media (max-width: 860px) {
    .dash-grid { grid-template-columns: 1fr; }
    .metrics-inner { gap: 0; }
    .metric-item { padding: 0 14px; }
    .page-header-inner { flex-direction: column; align-items: flex-start; }
  }

  @media (max-width: 600px) {
    .dash-content {
      padding: 6px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
    .dash-grid { gap: 10px; }
    .left-col, .right-col { gap: 12px; }
    .panel { padding: 14px; border-radius: var(--radius-md, 10px); }
    h2 { font-size: 1.05rem; }
    .metric-item { padding: 0 8px; }
    .metric-value { font-size: 0.95rem; }
    .metrics-strip {
      margin: 8px 6px 0;
      border-radius: var(--radius-md, 10px);
      padding: 0 6px;
    }
    .my-activity-section {
      padding: 10px 6px 0;
    }
    .section-label {
      margin-bottom: -4px;
    }
    .page-header { padding: 12px 10px 10px; }
    .page-title { font-size: 1.18rem; }
    .page-title .title-icon { width: 20px; height: 20px; }
    .page-subtitle {
      font-size: 0.74rem;
      line-height: 1.4;
    }
    .page-header-meta {
      flex-wrap: wrap;
      gap: 4px;
    }
    .header-tag {
      font-size: 0.52rem;
      padding: 6px 10px;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
    }

    /* Mobile tabs visible */
    .mobile-tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      margin: 6px 6px 0;
      background: var(--border-subtle, #EDEAE5);
      border-radius: 10px;
      position: sticky;
      top: calc(var(--header-height, 52px) + 0px);
      z-index: calc(var(--z-sticky, 10) - 1);
    }

    /* Mobile group becomes flex column */
    .mobile-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Feed improvements */
    .feed-list { max-height: 60vh; }
    .feed-item { padding: 10px 8px; min-height: 44px; }
    .feed-text { font-size: 0.7rem; }
    .mtab-btn {
      padding: 10px 12px;
      font-size: 0.74rem;
      min-height: 40px;
      -webkit-tap-highlight-color: transparent;
    }
  }

  @media (max-width: 380px) {
    .mtab-btn { padding: 8px 8px; font-size: 0.68rem; }
    .mtab-btn svg { display: none; }
    .metric-label { font-size: 0.58rem; }
    .metric-value { font-size: 0.85rem; }
    .metric-divider { height: 24px; }
  }

  /* C-1: prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .metric-item, .panel, .feed-item { animation: none !important; }
    .mau-pulse .mau-arc-fill { animation: none !important; }
    .metric-item { transition: none; }
    .econ { transition: none; }
  }
</style>
