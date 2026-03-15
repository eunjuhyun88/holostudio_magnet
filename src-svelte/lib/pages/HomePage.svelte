<script lang="ts">
  /**
   * HomePage — Viewport-filling dashboard grid
   *
   * Inspired by Velvet Capital (AI + data side-by-side)
   * and Infinite Monitor (widget grid, no scroll).
   *
   * Layout: Left panel (research context) + Right panel (data widgets)
   * Everything fits in viewport — no vertical scroll.
   * Dock handles stats + AI input at bottom.
   */
  import { router } from '../stores/router.ts';
  import { studioStore } from '../stores/studioStore.ts';
  import { dashboardStore } from '../stores/dashboardStore.ts';
  import { jobStore } from '../stores/jobStore.ts';
  import { modelPublishStore } from '../stores/modelPublishStore.ts';
  import { hasGpuNode } from '../stores/nodeStore.ts';
  import { wallet, WALLET_OPTIONS } from '../stores/walletStore.ts';
  import type { AppView } from '../stores/router.ts';
  import PixelIcon from '../components/PixelIcon.svelte';
  import GPUOnboardWizard from '../components/studio/GPUOnboardWizard.svelte';

  // ── Guest state ──
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

  // ── Derived state ──
  $: isLoggedIn = $wallet.connected;
  $: jobPhase = $jobStore.phase;
  $: jobTopic = $jobStore.topic;
  $: jobProgress = $jobStore.progress;
  $: isRunning = jobPhase === 'running' || jobPhase === 'setup';
  $: isComplete = jobPhase === 'complete';
  $: bestMetric = $jobStore.bestMetric;
  $: totalExperiments = $jobStore.totalExperiments ?? 0;
  $: completedExperiments = $jobStore.experiments?.length ?? 0;

  // ── ETA ──
  $: runEta = (() => {
    if (!isRunning) return '';
    const p = jobProgress;
    if (p >= 95) return '< 1m';
    const remaining = Math.round((100 - p) / 15);
    return `~${Math.max(remaining, 1)}m`;
  })();

  // ── Dashboard data ──
  $: gpuActive = ($dashboardStore.networkSummary?.activeWorkers ?? 0) > 0;
  $: gpuWorkers = $dashboardStore.networkSummary?.activeWorkers ?? 0;
  $: nodesCount = $dashboardStore.networkSummary?.nodes ?? 0;
  $: modelsCount = $dashboardStore.modelsSummary?.count ?? 0;
  $: earningsValue = $dashboardStore.protocolSummary?.tvl ?? '$0';

  // ── Templates ──
  const templates = [
    { id: 'crypto_market', icon: '⚡', title: 'Crypto Market Prediction', time: '~2h', diff: 'Advanced', color: '#D97757' },
    { id: 'defi_risk', icon: '≡', title: 'DeFi Risk Classification', time: '~1h', diff: 'Intermediate', color: '#d4a017' },
    { id: 'fraud_detection', icon: '🔍', title: 'Fraud Detection', time: '~1h', diff: 'Intermediate', color: '#d4a017' },
    { id: 'time_series', icon: '📈', title: 'Time Series Forecasting', time: '~30m', diff: 'Beginner', color: '#27864a' },
  ];

  function selectTemplate(t: typeof templates[0]) {
    studioStore.startCreate(t.title);
    studioStore.setPreset(t.id);
    studioStore.goToStep2(t.title);
    router.navigate('studio');
  }

  // ── GPU Wizard ──
  let showGpuWizard = false;

  // ── Models ──
  $: myModels = $modelPublishStore.slice(0, 5);
  $: hasMyModels = myModels.length > 0;

  // ── Activity ──
  $: recentEvents = ($dashboardStore.events ?? []).slice(0, 10);

  const TYPE_COLORS: Record<string, string> = {
    SYS: '#D97757', NET: '#2980b9', JOB: '#27864a', EXP: '#d4a017', WARN: '#c0392b',
  };

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Navigation ──
  function goToRunning() {
    studioStore.startRunning();
    router.navigate('studio');
  }

  function startNew() {
    studioStore.startCreate();
    router.navigate('studio');
  }
</script>

<div class="home-page">
  {#if isLoggedIn}
  <!-- ═══ MEMBER: Viewport-filling grid ═══ -->
  <div class="home-grid">

    <!-- ═══ LEFT PANEL: Research Context ═══ -->
    <div class="panel-left">
      <!-- State Hero -->
      {#if isRunning}
        <button class="hero-card hero-running" on:click={goToRunning}>
          <div class="hero-row">
            <span class="hero-dot pulse"></span>
            <span class="hero-badge">LIVE</span>
            <span class="hero-topic">{jobTopic || 'Research'}</span>
          </div>
          <div class="hero-pbar"><div class="hero-pfill" style="width:{jobProgress}%"></div></div>
          <div class="hero-meta">
            <span>{jobProgress}%</span>
            <span class="meta-dot">·</span>
            <span>ETA {runEta}</span>
            <span class="meta-dot">·</span>
            <span>{completedExperiments}/{totalExperiments}</span>
            <span class="hero-open">열기 →</span>
          </div>
        </button>
      {:else if isComplete}
        <div class="hero-card hero-complete">
          <div class="hero-row">
            <span class="hc-check">✓</span>
            <div class="hc-info">
              <span class="hc-label">Complete</span>
              <span class="hc-topic">{jobTopic}</span>
            </div>
            {#if bestMetric < Infinity}
              <span class="hc-metric">{bestMetric.toFixed(4)}</span>
            {/if}
          </div>
          <div class="hc-actions">
            <button class="hc-btn" on:click={() => router.navigate('studio')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21" fill="currentColor"/></svg>
              결과
            </button>
            <button class="hc-btn hc-primary" on:click={() => { studioStore.goToPublish(); router.navigate('studio'); }}>
              발행 →
            </button>
          </div>
        </div>
      {:else}
        <button class="hero-card hero-idle" on:click={startNew}>
          <span class="hi-icon"><PixelIcon type="sparkle" size={20} /></span>
          <div class="hi-text">
            <span class="hi-title">Start Research</span>
            <span class="hi-sub">AI가 자동으로 데이터 수집, 모델 학습, 최적화를 수행합니다</span>
          </div>
          <span class="hi-arrow">→</span>
        </button>
      {/if}

      <!-- Templates -->
      <div class="panel-section">
        <div class="ps-header">
          <span class="ps-title">TEMPLATES</span>
          <button class="ps-link" on:click={() => { studioStore.goToSetup(); router.navigate('studio'); }}>Custom</button>
        </div>
        <div class="template-list">
          {#each templates as t (t.id)}
            <button class="tpl-row" on:click={() => selectTemplate(t)}>
              <span class="tpl-icon">{t.icon}</span>
              <span class="tpl-name">{t.title}</span>
              <span class="tpl-time">{t.time}</span>
              <span class="tpl-diff" style:color={t.color}>
                <span class="tpl-dot" style:background={t.color}></span>
                {t.diff}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="qa-btn" on:click={startNew}>
          <span class="qa-icon">🔬</span>
          <span class="qa-label">새 연구</span>
        </button>
        <button class="qa-btn" on:click={() => { if ($hasGpuNode) router.navigate('network'); else showGpuWizard = true; }}>
          <span class="qa-icon">⚡</span>
          <span class="qa-label">GPU</span>
        </button>
        <button class="qa-btn" on:click={() => router.navigate('models')}>
          <span class="qa-icon">📦</span>
          <span class="qa-label">모델</span>
        </button>
        <button class="qa-btn" on:click={() => router.navigate('protocol')}>
          <span class="qa-icon">📊</span>
          <span class="qa-label">프로토콜</span>
        </button>
      </div>
    </div>

    <!-- ═══ RIGHT PANEL: Data Widgets ═══ -->
    <div class="panel-right">

      <!-- Stats Row -->
      <div class="stats-row">
        <button class="stat-card" on:click={() => router.navigate('network')}>
          <span class="sc-val" style:color="var(--green, #27864a)">{nodesCount}</span>
          <span class="sc-lbl">NODES</span>
          {#if gpuActive}<span class="sc-badge">{gpuWorkers} active</span>{/if}
        </button>
        <button class="stat-card" on:click={() => router.navigate('models')}>
          <span class="sc-val" style:color="#2980b9">{modelsCount}</span>
          <span class="sc-lbl">MODELS</span>
        </button>
        <button class="stat-card" on:click={() => router.navigate('protocol')}>
          <span class="sc-val" style:color="#d4a017">{earningsValue}</span>
          <span class="sc-lbl">TVL</span>
        </button>
      </div>

      <!-- Models Widget -->
      <div class="widget">
        <div class="w-header">
          <span class="w-title">MODELS</span>
          <button class="w-link" on:click={() => router.navigate('models')}>All →</button>
        </div>
        <div class="w-body">
          {#if hasMyModels}
            {#each myModels as model (model.id)}
              <button class="model-row" on:click={() => router.navigate('models')}>
                <span class="mr-dot" class:mr-active={model.state === 'NETWORK_ACTIVE'}></span>
                <span class="mr-name">{model.name}</span>
                <span class="mr-state">{model.state === 'NETWORK_ACTIVE' ? 'ACTIVE' : model.state}</span>
                {#if model.usage && model.usage.totalCalls > 0}
                  <span class="mr-calls">{model.usage.totalCalls.toLocaleString()}</span>
                {/if}
                {#if model.poolA && model.poolA.creator > 0}
                  <span class="mr-earn">+{model.poolA.creator.toFixed(1)}H</span>
                {/if}
              </button>
            {/each}
          {:else}
            <div class="w-empty">
              <span>No models yet</span>
              <button class="w-empty-link" on:click={() => router.navigate('models')}>Browse Hub →</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Activity Widget -->
      <div class="widget widget-grow">
        <div class="w-header">
          <span class="w-title">ACTIVITY</span>
          <span class="w-count">{recentEvents.length}</span>
        </div>
        <div class="w-body w-scroll">
          {#each recentEvents as ev (ev.id)}
            <div class="ev-row">
              <span class="ev-time">{fmtTime(ev.timestamp)}</span>
              <span class="ev-type" style:color={TYPE_COLORS[ev.type] || '#999'}
                    style:background="color-mix(in srgb, {TYPE_COLORS[ev.type] || 'gray'} 10%, transparent)">
                {ev.type}
              </span>
              <span class="ev-msg">{ev.message}</span>
            </div>
          {/each}
          {#if recentEvents.length === 0}
            <div class="w-empty">
              <PixelIcon type="sparkle" size={16} />
              <span>No activity yet</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {:else}
  <!-- ═══ GUEST VIEW ═══ -->
  <div class="guest-grid">
    <div class="guest-left">
      <div class="guest-hero">
        <h1 class="guest-title">What would you<br/>like to research?</h1>
        <p class="guest-sub">AI automatically handles data collection,<br/>model training, and optimization</p>
        <div class="guest-search">
          <input
            class="gs-input"
            type="text"
            placeholder="e.g. Crypto market prediction..."
            bind:value={guestSearchTopic}
            on:keydown={handleGuestKeydown}
          />
          <button class="gs-btn" on:click={handleGuestSearch}>→</button>
        </div>
      </div>

      <div class="guest-steps">
        {#each [
          { n: '1', t: 'Enter a topic', d: 'Describe what to research' },
          { n: '2', t: 'AI explores', d: 'Distributed GPU training' },
          { n: '3', t: 'Ship a model', d: 'Deploy and earn rewards' },
        ] as step}
          <div class="gstep">
            <span class="gstep-n">{step.n}</span>
            <div class="gstep-text">
              <span class="gstep-t">{step.t}</span>
              <span class="gstep-d">{step.d}</span>
            </div>
          </div>
        {/each}
      </div>

      <div class="guest-wallet">
        <span class="gw-label">Connect to start</span>
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

    <div class="guest-right">
      <div class="panel-section">
        <div class="ps-header">
          <span class="ps-title">PUBLIC RESEARCH</span>
        </div>
        <div class="template-list">
          {#each templates as t (t.id)}
            <button class="tpl-row" on:click={() => selectTemplate(t)}>
              <span class="tpl-icon">{t.icon}</span>
              <span class="tpl-name">{t.title}</span>
              <span class="tpl-time">{t.time}</span>
              <span class="tpl-diff" style:color={t.color}>
                <span class="tpl-dot" style:background={t.color}></span>
                {t.diff}
              </span>
            </button>
          {/each}
        </div>
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
  /* ═══ PAGE SHELL ═══ */
  .home-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* ═══ MEMBER GRID — fills viewport ═══ */
  .home-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* ═══ LEFT PANEL ═══ */
  .panel-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 80px;
    border-right: 1px solid var(--border-subtle, #EDEAE5);
    overflow-y: auto;
    background: var(--surface, #fff);
  }

  /* ── Hero Cards ── */
  .hero-card {
    border-radius: 12px;
    padding: 14px 16px;
    width: 100%;
    text-align: left;
  }

  /* Running */
  .hero-running {
    appearance: none; border: 1.5px solid var(--accent, #D97757);
    background: linear-gradient(135deg, rgba(217,119,87,0.03), rgba(217,119,87,0.06));
    cursor: pointer; display: flex; flex-direction: column; gap: 8px;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hero-running:hover { box-shadow: 0 4px 16px rgba(217,119,87,0.12); transform: translateY(-1px); }
  .hero-row { display: flex; align-items: center; gap: 6px; }
  .hero-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent, #D97757); flex-shrink: 0; }
  .hero-dot.pulse { animation: p 1.5s ease-in-out infinite; }
  @keyframes p { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .hero-badge { font-family: var(--font-mono); font-size: 0.46rem; font-weight: 700; color: #fff; background: var(--accent); padding: 1px 5px; border-radius: 3px; letter-spacing: 0.08em; }
  .hero-topic { font-size: 0.82rem; font-weight: 600; color: var(--text-primary, #2D2D2D); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hero-pbar { height: 3px; border-radius: 2px; background: rgba(217,119,87,0.12); overflow: hidden; }
  .hero-pfill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 300ms ease; }
  .hero-meta { display: flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 0.56rem; color: var(--text-muted, #9a9590); font-variant-numeric: tabular-nums; }
  .meta-dot { color: var(--border, #E5E0DA); }
  .hero-open { margin-left: auto; font-weight: 600; color: var(--accent); }

  /* Complete */
  .hero-complete {
    border: 1.5px solid rgba(39,134,74,0.2);
    background: linear-gradient(135deg, rgba(39,134,74,0.02), rgba(166,227,161,0.04));
    display: flex; flex-direction: column; gap: 10px;
  }
  .hc-check { width: 22px; height: 22px; border-radius: 50%; background: var(--green, #27864a); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .hc-info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .hc-label { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: 0.06em; }
  .hc-topic { font-size: 0.78rem; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hc-metric { font-family: var(--font-mono); font-size: 1rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .hc-actions { display: flex; gap: 6px; }
  .hc-btn { appearance: none; border: 1px solid var(--border); background: var(--surface, #fff); border-radius: 8px; padding: 7px 14px; font-size: 0.68rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 140ms; color: var(--text-primary); }
  .hc-btn:hover { border-color: var(--accent); color: var(--accent); }
  .hc-primary { background: var(--accent, #D97757); color: #fff; border-color: var(--accent); }
  .hc-primary:hover { background: color-mix(in srgb, var(--accent) 88%, black); color: #fff; }

  /* Idle */
  .hero-idle {
    appearance: none; border: 1.5px dashed var(--border, #E5E0DA);
    background: var(--bg-warm, #FAF9F7);
    cursor: pointer; display: flex; align-items: center; gap: 12px;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hero-idle:hover { border-color: var(--accent); border-style: solid; box-shadow: 0 3px 12px rgba(217,119,87,0.08); }
  .hi-icon { color: var(--accent); flex-shrink: 0; display: flex; }
  .hi-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .hi-title { font-size: 0.82rem; font-weight: 700; color: var(--text-primary); }
  .hi-sub { font-size: 0.58rem; color: var(--text-muted); line-height: 1.4; }
  .hi-arrow { font-size: 1rem; color: var(--accent); font-weight: 600; flex-shrink: 0; opacity: 0; transition: opacity 140ms; }
  .hero-idle:hover .hi-arrow { opacity: 1; }

  /* ── Panel Section ── */
  .panel-section { display: flex; flex-direction: column; gap: 0; }
  .ps-header { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 6px; }
  .ps-title { font-family: var(--font-mono); font-size: 0.5rem; font-weight: 700; color: var(--text-muted, #9a9590); text-transform: uppercase; letter-spacing: 0.08em; }
  .ps-link { appearance: none; border: none; background: transparent; font-family: var(--font-mono); font-size: 0.5rem; font-weight: 600; color: var(--text-muted); cursor: pointer; padding: 2px 0; transition: color 140ms; }
  .ps-link:hover { color: var(--accent); }

  /* ── Template List ── */
  .template-list { display: flex; flex-direction: column; border: 1px solid var(--border-subtle, #EDEAE5); border-radius: 10px; overflow: hidden; background: var(--bg-warm, #FAF9F7); }
  .tpl-row { appearance: none; border: none; background: transparent; display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; transition: background 100ms; border-bottom: 1px solid var(--border-subtle); text-align: left; width: 100%; }
  .tpl-row:last-child { border-bottom: none; }
  .tpl-row:hover { background: rgba(217,119,87,0.04); }
  .tpl-icon { font-size: 0.9rem; flex-shrink: 0; width: 22px; text-align: center; }
  .tpl-name { font-size: 0.7rem; font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tpl-time { font-family: var(--font-mono); font-size: 0.5rem; color: var(--text-muted); flex-shrink: 0; }
  .tpl-diff { font-family: var(--font-mono); font-size: 0.46rem; font-weight: 600; display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .tpl-dot { width: 4px; height: 4px; border-radius: 50%; }

  /* ── Quick Actions ── */
  .quick-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: auto; padding-top: 8px; }
  .qa-btn { appearance: none; border: 1px solid var(--border-subtle); background: var(--bg-warm, #FAF9F7); border-radius: 10px; padding: 10px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: all 160ms; }
  .qa-btn:hover { border-color: var(--accent); background: var(--surface, #fff); transform: translateY(-1px); }
  .qa-icon { font-size: 1.1rem; line-height: 1; }
  .qa-label { font-size: 0.54rem; font-weight: 600; color: var(--text-secondary, #6b6560); white-space: nowrap; }

  /* ═══ RIGHT PANEL ═══ */
  .panel-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 16px 80px;
    overflow-y: auto;
    min-height: 0;
  }

  /* ── Stats Row ── */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .stat-card {
    appearance: none; border: 1px solid var(--border-subtle); background: var(--surface, #fff);
    border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
    cursor: pointer; transition: all 150ms; text-align: left;
  }
  .stat-card:hover { border-color: rgba(0,0,0,0.1); box-shadow: 0 2px 8px rgba(0,0,0,0.04); transform: translateY(-1px); }
  .sc-val { font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
  .sc-lbl { font-family: var(--font-mono); font-size: 0.44rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .sc-badge { font-family: var(--font-mono); font-size: 0.44rem; font-weight: 500; color: var(--green, #27864a); }

  /* ── Widget ── */
  .widget { display: flex; flex-direction: column; border: 1px solid var(--border-subtle, #EDEAE5); border-radius: 10px; overflow: hidden; background: var(--surface, #fff); }
  .widget-grow { flex: 1; min-height: 120px; }
  .w-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
  .w-title { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .w-link { appearance: none; border: none; background: transparent; font-family: var(--font-mono); font-size: 0.48rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: color 140ms; }
  .w-link:hover { color: var(--accent); }
  .w-count { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500; color: var(--text-muted); }
  .w-body { flex: 1; min-height: 0; }
  .w-scroll { overflow-y: auto; }
  .w-empty { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 20px; font-size: 0.62rem; color: var(--text-muted); }
  .w-empty-link { appearance: none; border: none; background: transparent; font-size: 0.6rem; font-weight: 600; color: var(--accent); cursor: pointer; }

  /* ── Model Row ── */
  .model-row {
    appearance: none; border: none; background: transparent;
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; width: 100%; text-align: left;
    cursor: pointer; transition: background 100ms;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.68rem;
  }
  .model-row:last-child { border-bottom: none; }
  .model-row:hover { background: rgba(0,0,0,0.015); }
  .mr-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
  .mr-dot.mr-active { background: var(--green); box-shadow: 0 0 4px rgba(39,134,74,0.4); }
  .mr-name { font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mr-state { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 600; color: var(--text-muted); padding: 1px 5px; border-radius: 3px; background: rgba(0,0,0,0.03); }
  .mr-calls { font-family: var(--font-mono); font-size: 0.54rem; color: var(--text-secondary); }
  .mr-earn { font-family: var(--font-mono); font-size: 0.58rem; font-weight: 600; color: var(--green); }

  /* ── Event Row ── */
  .ev-row { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-bottom: 1px solid var(--border-subtle); }
  .ev-row:last-child { border-bottom: none; }
  .ev-row:hover { background: rgba(0,0,0,0.01); }
  .ev-time { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
  .ev-type { font-family: var(--font-mono); font-size: 0.42rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; min-width: 24px; text-align: center; }
  .ev-msg { font-family: var(--font-mono); font-size: 0.52rem; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ═══ GUEST GRID ═══ */
  .guest-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 340px;
    min-height: 0;
    overflow: hidden;
  }
  .guest-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    padding: 32px 32px 88px;
    overflow-y: auto;
  }
  .guest-hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .guest-title { font-family: var(--font-display, 'Playfair Display', serif); font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3; }
  .guest-sub { font-size: 0.78rem; color: var(--text-secondary); margin: 0; }
  .guest-search { display: flex; width: 100%; max-width: 440px; border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 200ms, box-shadow 200ms; }
  .guest-search:focus-within { border-color: var(--accent); box-shadow: 0 4px 16px rgba(217,119,87,0.1); }
  .gs-input { flex: 1; appearance: none; border: none; outline: none; padding: 12px 16px; font-size: 0.82rem; background: var(--surface, #fff); color: var(--text-primary); font-family: inherit; }
  .gs-input::placeholder { color: var(--text-muted); }
  .gs-btn { appearance: none; border: none; background: var(--accent); color: #fff; font-size: 1rem; font-weight: 700; padding: 12px 20px; cursor: pointer; transition: background 150ms; }
  .gs-btn:hover { background: color-mix(in srgb, var(--accent) 88%, black); }

  .guest-steps { display: flex; gap: 20px; max-width: 440px; width: 100%; }
  .gstep { display: flex; align-items: flex-start; gap: 8px; flex: 1; }
  .gstep-n { width: 24px; height: 24px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .gstep-text { display: flex; flex-direction: column; gap: 2px; }
  .gstep-t { font-size: 0.76rem; font-weight: 700; color: var(--text-primary); }
  .gstep-d { font-size: 0.58rem; color: var(--text-muted); line-height: 1.4; }

  .guest-wallet { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .gw-label { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); }
  .gw-btns { display: flex; gap: 8px; }
  .gw-btn { appearance: none; border: 1px solid var(--border); background: var(--surface, #fff); border-radius: 10px; padding: 10px 20px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.72rem; font-weight: 600; color: var(--text-primary); transition: all 160ms; }
  .gw-btn:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(217,119,87,0.1); }
  .gw-icon { font-size: 1rem; }

  .guest-right {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 80px;
    border-left: 1px solid var(--border-subtle);
    background: var(--surface, #fff);
    overflow-y: auto;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .home-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
      overflow-y: auto;
    }
    .panel-left {
      border-right: none;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 16px;
      overflow: visible;
    }
    .quick-actions { margin-top: 0; }
    .panel-right { padding-bottom: 88px; }
    .guest-grid { grid-template-columns: 1fr; grid-template-rows: auto auto; }
    .guest-left { padding: 24px 16px 16px; }
    .guest-right { border-left: none; border-top: 1px solid var(--border-subtle); }
    .guest-steps { flex-direction: column; gap: 12px; }
    .gw-btns { flex-direction: column; width: 100%; max-width: 240px; }
    .gw-btn { justify-content: center; }
  }

  @media (max-width: 480px) {
    .panel-left { padding: 12px 12px 12px; }
    .panel-right { padding: 12px 12px 88px; }
    .stats-row { grid-template-columns: 1fr 1fr; }
    .quick-actions { grid-template-columns: repeat(2, 1fr); }
  }
</style>
