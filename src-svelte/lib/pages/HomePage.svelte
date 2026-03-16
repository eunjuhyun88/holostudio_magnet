<script lang="ts">
  /**
   * HomePage — HOOT Protocol ecosystem entry point
   *
   * Spec: HOOT_PlatformUX_Detail §2 + wizardly-ptolemy layout
   *
   * 1. PixelOwl + HOOT Protocol branding
   * 2. Ecosystem tagline
   * 3. Live network pulse (nodes/GPUs/models/TVL)
   * 4. LIVE banner (when research running) — §2-2
   * 5. Three portal cards with dynamic state — §2-1
   * 6. Flywheel (ecosystem loop)
   * 7. Clickable recent activity — §2-2
   */
  import { router } from '../stores/router.ts';
  import { studioStore } from '../stores/studioStore.ts';
  import { dashboardStore } from '../stores/dashboardStore.ts';
  import { jobStore, completedCount, jobProgress as jobProgressStore } from '../stores/jobStore.ts';
  import { modelPublishStore } from '../stores/modelPublishStore.ts';
  import { nodeStore, hasGpuNode } from '../stores/nodeStore.ts';
  import { wallet, WALLET_OPTIONS } from '../stores/walletStore.ts';
  import PixelOwl from '../components/PixelOwl.svelte';
  import PixelIcon from '../components/PixelIcon.svelte';
  import GPUOnboardWizard from '../components/studio/GPUOnboardWizard.svelte';

  // ── Guest ──
  let guestSearchTopic = '';
  const wallets = WALLET_OPTIONS;
  function handleGuestSearch() {
    if (!guestSearchTopic.trim()) return;
    studioStore.startCreate(guestSearchTopic.trim());
    router.navigate('studio');
  }
  function handleGuestKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleGuestSearch();
  }

  // ── Job state ──
  $: isLoggedIn = $wallet.connected;
  $: jobPhase = $jobStore.phase;
  $: jobTopic = $jobStore.topic;
  $: jobProgress = $jobProgressStore;
  $: isRunning = jobPhase === 'running' || jobPhase === 'setup';
  $: isComplete = jobPhase === 'complete';
  $: bestMetric = $jobStore.bestMetric;
  $: totalExperiments = $jobStore.totalExperiments ?? 0;
  $: completedExp = $jobStore.experiments?.length ?? 0;

  // ── Owl mood ──
  $: owlMood = (() => {
    if (isRunning) return 'research' as const;
    if (jobPhase === 'setup') return 'build' as const;
    if (isComplete) return 'celebrate' as const;
    return 'idle' as const;
  })();

  // ── Dashboard data ──
  $: gpuWorkers = $dashboardStore.networkSummary?.activeWorkers ?? 0;
  $: nodesCount = $dashboardStore.networkSummary?.nodes ?? 0;
  $: modelsCount = $dashboardStore.modelsSummary?.count ?? 0;
  $: earningsValue = $dashboardStore.protocolSummary?.tvl ?? '$0';

  // ── GPU Node state ──
  $: myNode = $nodeStore;
  $: hasNode = $hasGpuNode;

  // ── Models published ──
  $: publishedModels = $modelPublishStore;
  $: publishedCount = publishedModels.length;
  $: totalModelEarnings = publishedModels.reduce((sum, m) => sum + (m.poolA?.creator ?? 0), 0);

  // ── §2-1: Magnet Studio card dynamic text ──
  $: studioCardText = (() => {
    if (isRunning) return `${jobTopic || 'Research'} running (${jobProgress}%)`;
    if (isComplete) return `${jobTopic || 'Research'} complete — ready to deploy`;
    if (publishedCount > 0) return `${publishedCount} models · ${totalModelEarnings.toFixed(1)} HOOT earned`;
    return 'Start AI autonomous research';
  })();

  $: studioCardClick = () => {
    if (isRunning) { studioStore.startRunning(); }
    router.navigate('studio');
  };

  // ── §2-1: GPU Network card dynamic text ──
  $: networkCardText = (() => {
    if (!hasNode) return 'Register GPU and start earning';
    if (myNode.online) return `${myNode.nodeId} online · ${myNode.totalEarnings.toFixed(1)} HOOT`;
    return `${myNode.nodeId} offline ⚠`;
  })();

  $: networkCardClick = () => {
    if (!hasNode) { showGpuWizard = true; return; }
    router.navigate('network');
  };

  // ── §2-1: Protocol card dynamic text ──
  $: protocolCardText = (() => {
    if (!isLoggedIn) return 'Join HOOT Protocol';
    // TODO: check pending rewards from protocolSummary
    return `${earningsValue} TVL`;
  })();

  $: protocolCardClick = () => {
    if (!isLoggedIn) { wallet.connect('MetaMask'); return; }
    router.navigate('protocol');
  };

  // ── GPU Wizard ──
  let showGpuWizard = false;

  // (Network card now navigates directly — no expand state needed)

  // ── Activity ──
  $: recentEvents = ($dashboardStore.events ?? []).slice(0, 6);
  const TYPE_COLORS: Record<string, string> = {
    SYS: '#D97757', NET: '#2980b9', JOB: '#27864a', EXP: '#d4a017', WARN: '#c0392b',
  };
  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── §2-2: Activity click → navigate ──
  function handleActivityClick(ev: { type: string; id?: string }) {
    if (ev.type === 'JOB' || ev.type === 'EXP') {
      router.navigate('studio');
    } else if (ev.type === 'NET') {
      router.navigate('network');
    }
  }
</script>

<div class="home-page">
  {#if isLoggedIn}
  <!-- ═══ MEMBER VIEW ═══ -->
  <div class="home-center">

    <!-- ── Branding ── -->
    <div class="brand">
      <PixelOwl size={1.2} mood={owlMood} />
      <h1 class="brand-title">HOOT Protocol</h1>
      <p class="brand-sub">Decentralized AI Research Infrastructure</p>
    </div>

    <!-- ── Ecosystem Tagline ── -->
    <p class="tagline">
      AI Research Design · Distributed GPU Training · Model Deployment · Data Provenance<br/>
      <span class="tagline-chain">Every step recorded on HOOT L1 chain</span>
    </p>

    <!-- ── Live Network Pulse ── -->
    <div class="pulse-bar">
      <div class="pulse-item">
        <span class="pulse-val">{nodesCount}</span>
        <span class="pulse-lbl">Nodes</span>
      </div>
      <span class="pulse-sep"></span>
      <div class="pulse-item">
        <span class="pulse-val">{gpuWorkers}</span>
        <span class="pulse-lbl">GPUs</span>
      </div>
      <span class="pulse-sep"></span>
      <div class="pulse-item">
        <span class="pulse-val">{modelsCount}</span>
        <span class="pulse-lbl">Models</span>
      </div>
      <span class="pulse-sep"></span>
      <div class="pulse-item">
        <span class="pulse-val">{earningsValue}</span>
        <span class="pulse-lbl">TVL</span>
      </div>
    </div>

    <!-- ── §2-2: LIVE Banner (when research running) ── -->
    {#if isRunning}
      <button class="live-banner" on:click={studioCardClick}>
        <span class="lb-dot pulse"></span>
        <span class="lb-badge">LIVE</span>
        <div class="lb-body">
          <span class="lb-topic">{jobTopic || 'Research'}</span>
          <div class="lb-pbar"><div class="lb-pfill" style="width:{jobProgress}%"></div></div>
          <span class="lb-meta">{jobProgress}% · {completedExp}/{totalExperiments} exp</span>
        </div>
        <span class="lb-cta">Resume →</span>
      </button>
    {/if}

    <!-- ═══ §2-1: Portal Cards ═══ -->

    <!-- 🔬 Magnet Studio -->
    <button class="portal-card" on:click={studioCardClick}>
      <span class="pc-icon pc-icon-studio">
        <PixelIcon type="research" size={18} />
      </span>
      <div class="pc-body">
        <span class="pc-name">Magnet Studio</span>
        <span class="pc-state" class:pc-state-running={isRunning} class:pc-state-done={isComplete}>
          {studioCardText}
        </span>
        <span class="pc-detail">Research Design → Distributed GPU Training → ModelNFT Minting</span>
      </div>
      <span class="pc-arrow">→</span>
    </button>

    <!-- ⚡ GPU Network -->
    <button class="portal-card" on:click={networkCardClick}>
      <span class="pc-icon pc-icon-network">
        <PixelIcon type="globe" size={18} />
      </span>
      <div class="pc-body">
        <span class="pc-name">GPU Network</span>
        <span class="pc-state" class:pc-state-warn={hasNode && !myNode.online}>
          {networkCardText}
        </span>
        <span class="pc-detail">Training Nodes · Inference Nodes · PoAW Block Contribution</span>
      </div>
      <span class="pc-arrow">→</span>
    </button>

    <!-- 📊 Protocol -->
    <button class="portal-card" on:click={protocolCardClick}>
      <span class="pc-icon pc-icon-protocol">
        <PixelIcon type="protocol" size={18} />
      </span>
      <div class="pc-body">
        <span class="pc-name">Protocol</span>
        <span class="pc-state">{protocolCardText}</span>
        <span class="pc-detail">HOOT Bonding · Staking · Data Provenance (PPAP) · x402 Settlement</span>
      </div>
      <span class="pc-arrow">→</span>
    </button>

    <!-- ── Flywheel ── -->
    <div class="flywheel">
      <span class="fw-label">ECOSYSTEM</span>
      <div class="fw-flow">
        <span class="fw-step">Data Contribution</span>
        <span class="fw-arr">→</span>
        <span class="fw-step">GPU Training</span>
        <span class="fw-arr">→</span>
        <span class="fw-step">Model Deployment</span>
        <span class="fw-arr">→</span>
        <span class="fw-step">Usage Settlement</span>
        <span class="fw-arr">→</span>
        <span class="fw-step fw-reward">Rewards</span>
      </div>
      <span class="fw-roles">Contributor · Compute Node · Builder · Buyer — Pool auto-distribution</span>
    </div>

    <!-- ── §2-2: Recent Activity ── -->
    {#if recentEvents.length > 0}
      <div class="activity">
        <span class="activity-label">Recent Activity</span>
        <div class="activity-list">
          {#each recentEvents as ev (ev.id)}
            <button class="ev-row" on:click={() => handleActivityClick(ev)}>
              <span class="ev-time">{fmtTime(ev.timestamp)}</span>
              <span class="ev-type" style:color={TYPE_COLORS[ev.type] || '#999'}
                    style:background="color-mix(in srgb, {TYPE_COLORS[ev.type] || 'gray'} 8%, transparent)">
                {ev.type}
              </span>
              <span class="ev-msg">{ev.message}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

  </div>

  {:else}
  <!-- ═══ GUEST VIEW ═══ -->
  <div class="home-center guest">

    <div class="brand">
      <PixelOwl size={1.4} mood="idle" />
      <h1 class="brand-title">HOOT Protocol</h1>
      <p class="brand-sub">Decentralized AI Research Infrastructure</p>
    </div>

    <p class="tagline">
      AI Research Design · Distributed GPU Training · Model Deployment · Data Provenance<br/>
      <span class="tagline-chain">Every step recorded on HOOT L1 chain</span>
    </p>

    <div class="guest-search">
      <input class="gs-input" type="text"
        placeholder="e.g. Crypto market prediction..."
        bind:value={guestSearchTopic} on:keydown={handleGuestKeydown}
      />
      <button class="gs-btn" on:click={handleGuestSearch}>→</button>
    </div>

    <!-- Guest: Actor Roles -->
    <div class="roles-grid">
      {#each [
        { pixelIcon: 'research', role: 'Builder', desc: 'Research Design → Model Training → ModelNFT Minting', color: 'var(--accent)' },
        { pixelIcon: 'globe', role: 'Compute Node', desc: 'Connect GPU → Training/Inference → PoAW Rewards', color: 'var(--green)' },
        { pixelIcon: 'chart', role: 'Contributor', desc: 'Data Contribution → Provenance (PPAP) → Pool Distribution', color: '#2980b9' },
        { pixelIcon: 'protocol', role: 'Buyer', desc: 'Model/Agent Calls → x402 Auto Settlement', color: '#d4a017' },
      ] as r}
        <div class="role-card">
          <span class="role-icon" style:color={r.color}><PixelIcon type={r.pixelIcon} size={18} /></span>
          <div class="role-text">
            <span class="role-name" style:color={r.color}>{r.role}</span>
            <span class="role-desc">{r.desc}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="guest-wallet">
      <span class="gw-label">Connect wallet to start</span>
      <div class="gw-btns">
        {#each wallets as w}
          <button class="gw-btn" on:click={() => wallet.connect(w.name)}>
            <span class="gw-icon">{w.icon}</span>
            <span>{w.name}</span>
          </button>
        {/each}
      </div>
    </div>

  </div>
  {/if}
</div>

{#if showGpuWizard}
  <GPUOnboardWizard
    on:close={() => { showGpuWizard = false; }}
    on:complete={() => { showGpuWizard = false; router.navigate('network'); }}
  />
{/if}

<style>
  /* ═══ PAGE ═══ */
  .home-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ═══ CENTERED COLUMN ═══ */
  .home-center {
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: 28px 20px 100px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .home-center.guest {
    align-items: center;
    gap: 24px;
    padding-top: 40px;
  }

  /* ═══ BRANDING ═══ */
  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-bottom: 4px;
  }
  .brand-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    color: var(--text-muted, #9a9590);
    margin: 0;
    letter-spacing: 0.04em;
  }

  /* ═══ TAGLINE ═══ */
  .tagline {
    text-align: center;
    font-size: 0.68rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.6;
    margin: 0;
  }
  .tagline-chain {
    font-family: var(--font-mono);
    font-size: 0.54rem;
    font-weight: 600;
    color: var(--accent, #D97757);
  }

  /* ═══ LIVE NETWORK PULSE ═══ */
  .pulse-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 10px 20px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--surface, #fff);
  }
  .pulse-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .pulse-val {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
  .pulse-lbl {
    font-family: var(--font-mono);
    font-size: 0.4rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pulse-sep { width: 1px; height: 24px; background: var(--border-subtle); }

  /* ═══ §2-2: LIVE BANNER ═══ */
  .live-banner {
    appearance: none;
    border: 1.5px solid var(--accent, #D97757);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(217,119,87,0.03), rgba(217,119,87,0.07));
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    cursor: pointer;
    text-align: left;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .live-banner:hover { box-shadow: 0 6px 24px rgba(217,119,87,0.12); transform: translateY(-1px); }

  .lb-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
  }
  .lb-dot.pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .lb-badge {
    font-family: var(--font-mono);
    font-size: 0.44rem; font-weight: 700;
    color: #fff; background: var(--accent);
    padding: 2px 6px; border-radius: 4px;
    letter-spacing: 0.08em; flex-shrink: 0;
  }
  .lb-body { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .lb-topic {
    font-size: 0.82rem; font-weight: 600;
    color: var(--text-primary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .lb-pbar { height: 3px; border-radius: 2px; background: rgba(217,119,87,0.12); overflow: hidden; }
  .lb-pfill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 300ms ease; }
  .lb-meta {
    font-family: var(--font-mono);
    font-size: 0.52rem; color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .lb-cta {
    font-family: var(--font-mono);
    font-size: 0.6rem; font-weight: 600;
    color: var(--accent); white-space: nowrap; flex-shrink: 0;
  }

  /* ═══ PORTAL CARDS ═══ */
  .portal-card {
    appearance: none;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 14px;
    background: var(--surface, #fff);
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 18px;
    cursor: pointer;
    text-align: left;
    transition: border-color 200ms, box-shadow 200ms, transform 120ms;
  }
  .portal-card:hover {
    border-color: rgba(0,0,0,0.08);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    transform: translateY(-1px);
  }
  .portal-card:active { transform: scale(0.995); }

  /* Icon circles */
  .pc-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .pc-icon-studio { background: color-mix(in srgb, var(--accent, #D97757) 10%, transparent); color: var(--accent); }
  .pc-icon-network { background: color-mix(in srgb, var(--green, #27864a) 10%, transparent); color: var(--green); }
  .pc-icon-protocol { background: color-mix(in srgb, #2980b9 10%, transparent); color: #2980b9; }

  .pc-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .pc-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .pc-state {
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pc-state-running { color: var(--accent, #D97757); }
  .pc-state-done { color: var(--green, #27864a); }
  .pc-state-warn { color: var(--warn, #c0392b); }

  .pc-detail {
    font-size: 0.52rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono);
    line-height: 1.4;
  }
  .pc-arrow {
    font-size: 1rem; color: var(--text-muted); flex-shrink: 0;
    margin-top: 8px; transition: color 140ms;
  }
  .portal-card:hover .pc-arrow { color: var(--accent); }

  /* ═══ FLYWHEEL ═══ */
  .flywheel {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 16px 20px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--bg-warm, #FAF9F7);
  }
  .fw-label {
    font-family: var(--font-mono);
    font-size: 0.42rem; font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .fw-flow {
    display: flex; align-items: center; gap: 6px;
    flex-wrap: wrap; justify-content: center;
  }
  .fw-step {
    font-size: 0.6rem; font-weight: 600;
    color: var(--text-primary);
    padding: 4px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface, #fff);
    white-space: nowrap;
  }
  .fw-reward {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, white);
  }
  .fw-arr { font-family: var(--font-mono); font-size: 0.6rem; color: var(--text-muted); }
  .fw-roles {
    font-family: var(--font-mono);
    font-size: 0.46rem; color: var(--text-muted);
    text-align: center; line-height: 1.5;
  }

  /* ═══ ACTIVITY ═══ */
  .activity {
    margin-top: 4px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .activity-label {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.08em;
    padding-left: 2px;
  }
  .activity-list {
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 10px; overflow: hidden;
    background: var(--surface, #fff);
  }
  .ev-row {
    appearance: none; border: none; background: transparent;
    display: flex; align-items: center; gap: 8px;
    padding: 7px 14px; width: 100%; text-align: left;
    cursor: pointer;
    border-bottom: 1px solid var(--border-subtle);
    transition: background 100ms;
  }
  .ev-row:last-child { border-bottom: none; }
  .ev-row:hover { background: rgba(0,0,0,0.01); }
  .ev-time { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
  .ev-type { font-family: var(--font-mono); font-size: 0.42rem; font-weight: 700; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; min-width: 26px; text-align: center; }
  .ev-msg { font-family: var(--font-mono); font-size: 0.54rem; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ═══ GUEST ═══ */
  .guest-search {
    display: flex; width: 100%; max-width: 420px;
    border: 1.5px solid var(--border);
    border-radius: 12px; overflow: hidden;
    transition: border-color 200ms, box-shadow 200ms;
  }
  .guest-search:focus-within { border-color: var(--accent); box-shadow: 0 4px 20px rgba(217,119,87,0.1); }
  .gs-input { flex: 1; appearance: none; border: none; outline: none; padding: 13px 16px; font-size: 0.85rem; background: var(--surface, #fff); color: var(--text-primary); font-family: inherit; }
  .gs-input::placeholder { color: var(--text-muted); }
  .gs-btn { appearance: none; border: none; background: var(--accent); color: #fff; font-size: 1rem; font-weight: 700; padding: 13px 22px; cursor: pointer; transition: background 150ms; }
  .gs-btn:hover { background: color-mix(in srgb, var(--accent) 85%, black); }

  /* Guest roles */
  .roles-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%; max-width: 440px;
  }
  .role-card {
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    background: var(--surface, #fff);
    padding: 12px 14px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .role-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
  .role-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .role-name { font-size: 0.7rem; font-weight: 700; }
  .role-desc { font-size: 0.52rem; color: var(--text-muted); line-height: 1.5; }

  .guest-wallet { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .gw-label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }
  .gw-btns { display: flex; gap: 8px; }
  .gw-btn { appearance: none; border: 1px solid var(--border); background: var(--surface, #fff); border-radius: 10px; padding: 10px 20px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.74rem; font-weight: 600; color: var(--text-primary); transition: all 160ms; }
  .gw-btn:hover { border-color: var(--accent); box-shadow: 0 2px 10px rgba(217,119,87,0.1); transform: translateY(-1px); }
  .gw-icon { font-size: 1.1rem; }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 600px) {
    .home-center { padding: 20px 14px 100px; gap: 12px; }
    .home-center.guest { padding-top: 28px; gap: 18px; }
    .brand-title { font-size: 1.4rem; }
    .portal-card { padding: 14px 14px; gap: 12px; }
    .pc-icon { width: 32px; height: 32px; border-radius: 8px; }
    .pulse-bar { gap: 10px; padding: 8px 14px; }
    .pulse-val { font-size: 0.76rem; }
    .live-banner { padding: 12px 14px; gap: 8px; }
    .fw-flow { gap: 4px; }
    .fw-step { font-size: 0.52rem; padding: 3px 8px; }
    .roles-grid { grid-template-columns: 1fr; }
    .gw-btns { flex-direction: column; width: 100%; max-width: 260px; }
    .gw-btn { justify-content: center; }
  }
</style>
