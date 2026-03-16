<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { router } from "../stores/router.ts";
  import { fly, fade } from 'svelte/transition';
  import { DEMO_MODEL, EXPERIMENT_LOG, SPARK_DATA } from "../data/modelDetailData.ts";
  import { loadModel } from "../services/modelService.ts";
  import { modelPublishStore } from "../stores/modelPublishStore.ts";
  import { studioStore } from "../stores/studioStore.ts";
  import { wallet } from "../stores/walletStore.ts";
  import ModelCardTab from "../components/ModelCardTab.svelte";
  import ExperimentsTab from "../components/ExperimentsTab.svelte";
  import BenchmarkTab from "../components/BenchmarkTab.svelte";
  import ApiTab from "../components/ApiTab.svelte";
  import ModelSidebar from "../components/ModelSidebar.svelte";
  import ContractCallModal from "../components/ContractCallModal.svelte";
  import type { ModelRecord } from '../../../packages/contracts/src/index.ts';
  import type { ContractCall } from '../../../packages/contracts/src/protocol.ts';

  let activeTab: 'card' | 'api' | 'experiments' | 'benchmark' | 'usage' = 'card';
  let loading = true;
  let dynamicModel: ModelRecord | null = null;

  // UX-MD4: "Use this model" dropdown
  let dropdownOpen = false;
  function toggleDropdown() { dropdownOpen = !dropdownOpen; }
  function closeDropdown() { dropdownOpen = false; }

  // ── Inline Try state (hero-level, always visible) ──
  let tryExpanded = false;
  let tryInput = '{\n  "symbol": "ETH",\n  "timeframe": "24h"\n}';
  let tryResult = '';
  let tryLoading = false;
  let tryTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Load model by ID from URL param ──
  let modelId: string = '';
  router.params.subscribe(p => { modelId = p.modelId ?? ''; })();

  onMount(async () => {
    if (modelId) {
      const published = $modelPublishStore.find(pm => pm.id === modelId);
      if (published) {
        dynamicModel = published;
      } else {
        dynamicModel = await loadModel(modelId);
      }
    }
    loading = false;
  });

  onDestroy(() => {
    if (tryTimeout) clearTimeout(tryTimeout);
  });

  // Merged model: dynamic data overlaid on DEMO_MODEL
  $: m = dynamicModel
    ? {
        ...DEMO_MODEL,
        id: dynamicModel.id,
        name: dynamicModel.name,
        slug: dynamicModel.slug,
        metricValue: dynamicModel.metrics?.best ?? DEMO_MODEL.metricValue,
        totalExperiments: dynamicModel.metrics?.experiments ?? DEMO_MODEL.totalExperiments,
        kept: dynamicModel.metrics?.kept ?? DEMO_MODEL.kept,
        date: dynamicModel.createdAt ? new Date(dynamicModel.createdAt).toISOString().slice(0, 10) : DEMO_MODEL.date,
        updated: dynamicModel.updatedAt ? timeAgo(dynamicModel.updatedAt) : DEMO_MODEL.updated,
      }
    : DEMO_MODEL;

  $: experimentLog = EXPERIMENT_LOG;
  $: hasUsage = dynamicModel?.usage && dynamicModel.usage.totalCalls > 0;
  $: usage = dynamicModel?.usage ?? { totalCalls: 0, totalRevenue: 0, dailyCalls: [] };
  $: poolA = dynamicModel?.poolA ?? { creator: 0, notary: 0, treasury: 0, burn: 0 };
  $: modelState = dynamicModel?.state ?? 'DRAFT';

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  // Sparkline
  $: sparkData = (dynamicModel?.usage?.dailyCalls?.length ?? 0) > 0
    ? dynamicModel!.usage!.dailyCalls
    : SPARK_DATA;
  $: sparkMax = Math.max(...sparkData, 1);
  $: sparkPath = sparkData.map((v: number, i: number) => {
    const x = (i / Math.max(sparkData.length - 1, 1)) * 120;
    const y = 28 - (v / sparkMax) * 24;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  $: sparkArea = sparkPath + ` L120,28 L0,28 Z`;

  function handleSwitchTab(e: CustomEvent<string>) {
    activeTab = e.detail as typeof activeTab;
  }

  // ── CTA actions ──
  function handleDeploy() {
    closeDropdown();
    router.navigate('protocol', { tab: 'operations' });
  }

  function handleDownload() {
    closeDropdown();
    alert(`Checkpoint download: ${m.slug}.ckpt (demo)`);
  }

  function handleFork() {
    closeDropdown();
    studioStore.startCreate(dynamicModel?.name ?? m.name);
    studioStore.setForkSource(dynamicModel?.id ?? m.id);
    router.navigate('studio');
  }

  // Model state badge
  const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    NETWORK_ACTIVE: { bg: 'rgba(39,134,74,0.1)', text: 'var(--green, #27864a)', label: 'ACTIVE' },
    PRIVATE_ACTIVE: { bg: 'rgba(41,128,185,0.1)', text: '#2980b9', label: 'PRIVATE' },
    DRAFT: { bg: 'rgba(154,149,144,0.1)', text: 'var(--text-muted, #9a9590)', label: 'DRAFT' },
    MINTED: { bg: 'rgba(217,119,87,0.1)', text: 'var(--accent, #D97757)', label: 'MINTED' },
    DEPRECATED: { bg: 'rgba(192,57,43,0.1)', text: '#c0392b', label: 'DEPRECATED' },
  };
  $: stateBadge = STATE_COLORS[modelState] ?? STATE_COLORS.DRAFT;

  // VTR quarantine detection
  $: vtrGrade = dynamicModel?.vtr?.grade ?? null;
  $: isQuarantined = vtrGrade === 'QUARANTINED' || vtrGrade === 'FAILED';
  $: isPendingVTR = vtrGrade === 'PENDING';

  // ── ContractCallModal state ──
  let modalOpen = false;
  let modalCall: ContractCall | null = null;
  let modalStep: 'review' | 'pending' | 'confirmed' | 'error' = 'review';
  let pendingAction: 'inference' | 'apikey' | 'vtr-resubmit' | null = null;

  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // Component refs
  let apiTabRef: ApiTab;

  // ── ContractCallModal handlers ──
  function handleOpenModal(e: CustomEvent<ContractCall>, action: 'inference' | 'apikey' | 'vtr-resubmit') {
    modalCall = e.detail;
    modalStep = 'review';
    modalOpen = true;
    pendingAction = action;
  }

  function handleModalConfirm() {
    modalStep = 'pending';
    setTimeout(() => {
      modalStep = 'confirmed';
      setTimeout(() => {
        if (pendingAction === 'inference') {
          executeTryInference();
        } else if (pendingAction === 'apikey') {
          apiTabRef?.onApiKeyIssued();
        } else if (pendingAction === 'vtr-resubmit') {
          if (dynamicModel && dynamicModel.vtr) {
            dynamicModel.vtr.grade = 'PENDING' as any;
            dynamicModel = dynamicModel;
          }
        }
        handleModalClose();
      }, 800);
    }, 2200);
  }

  function handleModalClose() {
    modalOpen = false;
    modalCall = null;
    modalStep = 'review';
    pendingAction = null;
  }

  // ── VTR Resubmission ──
  function handleVTRResubmit() {
    const fakeCall: ContractCall = {
      title: 'VTR Resubmission',
      contract: '0x3A8b...9D2c  HootVTR.sol',
      fn: 'resubmitVTR',
      params: [
        { name: 'modelId', type: 'string', value: m.id },
        { name: 'updatedHash', type: 'bytes32', value: '0x' + Math.random().toString(16).slice(2, 18) + '...' },
      ],
      fee: '0 HOOT',
      gas: '~180,000',
      note: 'VTR re-verification will begin. Verification takes 2-5 min on average.',
      accentColor: 'var(--accent)',
    };
    modalCall = fakeCall;
    modalStep = 'review';
    modalOpen = true;
    pendingAction = 'vtr-resubmit';
  }

  // ── Inline Try (hero-level) ──
  const COST_PER_CALL = 0.001;

  function toggleTry() {
    tryExpanded = !tryExpanded;
    if (tryExpanded) {
      tryResult = '';
      tryLoading = false;
    }
  }

  function runHeroInference() {
    // Direct execution without modal for frictionless experience
    tryLoading = true;
    tryResult = '';
    if (tryTimeout) clearTimeout(tryTimeout);
    tryTimeout = setTimeout(() => {
      tryLoading = false;
      tryResult = JSON.stringify({
        prediction: 0.73,
        confidence: 0.89,
        direction: "up",
        model: m.id,
        latency_ms: 42,
      }, null, 2);
    }, 1200);
  }

  function executeTryInference() {
    tryLoading = true;
    tryResult = '';
    if (tryTimeout) clearTimeout(tryTimeout);
    tryTimeout = setTimeout(() => {
      tryLoading = false;
      tryResult = JSON.stringify({
        prediction: 0.73,
        confidence: 0.89,
        direction: "up",
        model: m.id,
        latency_ms: 42,
      }, null, 2);
    }, 1200);
  }

  function runHeroInferenceWithModal() {
    const call: ContractCall = {
      title: 'Run Model Inference',
      contract: '0x7B2e...A1f8  HootInference.sol',
      fn: 'executeInference',
      params: [
        { name: 'modelId', type: 'string', value: m.id },
        { name: 'input', type: 'bytes', value: tryInput.slice(0, 60) + '...' },
      ],
      fee: `${COST_PER_CALL} HOOT`,
      gas: '~45,000',
      note: 'x402 payment — 0.001 HOOT deducted per call.',
      accentColor: 'var(--accent)',
      paymentEnabled: true,
      hootAmount: String(COST_PER_CALL),
      usdcAmount: String(Math.round(COST_PER_CALL * 1.25 * 10000) / 10000),
    };
    modalCall = call;
    modalStep = 'review';
    modalOpen = true;
    pendingAction = 'inference';
  }
</script>

<div class="detail">
  <!-- VTR Quarantine / Pending Banners -->
  {#if isQuarantined}
    <div class="vtr-banner quarantined">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="currentColor"/></svg>
      <span>This model failed VTR verification and is quarantined.</span>
      <button class="vtr-resubmit-btn" on:click={handleVTRResubmit}>Resubmit</button>
    </div>
  {:else if isPendingVTR}
    <div class="vtr-banner pending">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>
      <span>VTR verification in progress. Some features are restricted.</span>
    </div>
  {/if}

  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <button class="bc-link" on:click={() => router.navigate('models')}>Models</button>
    <span class="bc-sep">/</span>
    <span class="bc-current">{m.slug}</span>
  </nav>

  {#if loading}
    <div class="loading-state">
      <span class="loading-spinner"></span>
      <span>Loading model...</span>
    </div>
  {:else}

  <!-- ═══ Hero Section: Model Identity + Try It ═══ -->
  <div class="hero-section">
    <div class="hero-info">
      <div class="hero-identity">
        <div class="hero-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="hero-text">
          <div class="name-row">
            <h1 class="model-name">{m.name}</h1>
            <span class="state-badge" style:background={stateBadge.bg} style:color={stateBadge.text}>
              {stateBadge.label}
            </span>
          </div>
          <span class="model-slug">{m.slug}</span>
        </div>
      </div>

      <!-- Quick Stats Strip -->
      <div class="quick-stats">
        <div class="qs-item">
          <span class="qs-val green">{m.metricValue?.toFixed(3) ?? '—'}</span>
          <span class="qs-lbl">Accuracy</span>
        </div>
        <div class="qs-sep"></div>
        <div class="qs-item">
          <span class="qs-val">{usage.totalCalls.toLocaleString()}</span>
          <span class="qs-lbl">Calls</span>
        </div>
        <div class="qs-sep"></div>
        <div class="qs-item">
          <span class="qs-val">{m.totalExperiments}</span>
          <span class="qs-lbl">Experiments</span>
        </div>
        <div class="qs-sep"></div>
        <div class="qs-item">
          <svg viewBox="0 0 120 28" class="qs-spark" preserveAspectRatio="none">
            <path d={sparkArea} fill="rgba(217, 119, 87, 0.1)"/>
            <path d={sparkPath} fill="none" stroke="var(--accent, #D97757)" stroke-width="1.5"/>
          </svg>
          <span class="qs-lbl">7d trend</span>
        </div>
      </div>

      <!-- Tags -->
      <div class="hero-tags">
        <span class="htag task">Prediction</span>
        <span class="htag framework">{m.framework}</span>
        <span class="htag framework">{m.type}</span>
        <span class="htag license">{m.license}</span>
        {#each m.tags as tag}
          <span class="htag">{tag}</span>
        {/each}
      </div>
    </div>

    <!-- Hero Actions: Try it + More -->
    <div class="hero-actions">
      <button class="btn-try-hero" class:active={tryExpanded} on:click={toggleTry}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
        </svg>
        {tryExpanded ? 'Close Playground' : 'Try this model'}
      </button>

      <div class="action-group">
        <button class="like-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          {m.likes}
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="action-dropdown" on:mouseleave={closeDropdown}>
          <button class="action-btn-secondary" on:click={toggleDropdown} aria-haspopup="true" aria-expanded={dropdownOpen}>
            Use
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="chevron" class:chevron-open={dropdownOpen}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          {#if dropdownOpen}
          <div class="dropdown-menu" transition:fly={{ y: -8, duration: 150 }}>
            <button class="dropdown-item" on:click={handleDeploy} disabled={isQuarantined}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 14a1 1 0 0 1-.78-1.63l9-11a1 1 0 0 1 1.78.63v7h6a1 1 0 0 1 .78 1.63l-9 11a1 1 0 0 1-1.78-.63v-7H4z" stroke="currentColor" stroke-width="1.5"/></svg>
              Deploy
            </button>
            <button class="dropdown-item" on:click={handleDownload} disabled={isQuarantined}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Download
            </button>
            <button class="dropdown-item" on:click={handleFork}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Fork to Studio
            </button>
          </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ Inline Playground (hero-level, always accessible) ═══ -->
  {#if tryExpanded}
    <div class="try-hero" transition:fly={{ y: -12, duration: 250 }}>
      <div class="try-hero-inner">
        <div class="try-hero-header">
          <h3 class="try-hero-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
            </svg>
            Quick Inference — {m.name}
          </h3>
          <span class="try-cost">0.001 HOOT / call</span>
        </div>
        <div class="try-hero-body">
          <div class="try-col">
            <label class="try-label">Input</label>
            <textarea class="try-editor" bind:value={tryInput} rows="6"></textarea>
            <div class="try-btn-row">
              <button class="try-run" on:click={runHeroInference} disabled={tryLoading}>
                {#if tryLoading}
                  <span class="spin-sm"></span> Running...
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                  </svg>
                  Run Inference
                {/if}
              </button>
              {#if !$wallet.connected}
                <span class="try-wallet-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>
                  Demo mode · Connect wallet for on-chain calls
                </span>
              {/if}
            </div>
          </div>
          <div class="try-col">
            <label class="try-label">Output</label>
            <pre class="try-result" class:empty={!tryResult}>{tryResult || '// Results will appear here after running inference...'}</pre>
            {#if tryResult}
              <div class="try-success">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Inference complete · 42ms latency
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ═══ Main Content: 2-column ═══ -->
  <div class="content-layout">
    <div class="content-main">
      <!-- Tabs (5 tabs — Playground removed, integrated into hero) -->
      <div class="tabs" role="tablist" aria-label="Model sections">
        <button class="tab" class:active={activeTab === 'card'} role="tab" aria-selected={activeTab === 'card'} on:click={() => activeTab = 'card'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Overview
        </button>
        <button class="tab" class:active={activeTab === 'experiments'} role="tab" aria-selected={activeTab === 'experiments'} on:click={() => activeTab = 'experiments'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Experiments
          <span class="tab-count" class:tab-count-active={activeTab === 'experiments'}>{m.totalExperiments}</span>
        </button>
        <button class="tab" class:active={activeTab === 'benchmark'} role="tab" aria-selected={activeTab === 'benchmark'} on:click={() => activeTab = 'benchmark'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="7" width="4" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="17" y="3" width="4" height="18" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Benchmark
        </button>
        <button class="tab" class:active={activeTab === 'usage'} role="tab" aria-selected={activeTab === 'usage'} on:click={() => activeTab = 'usage'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 20V10M18 20V4M6 20v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Usage
          {#if hasUsage}<span class="tab-count" class:tab-count-active={activeTab === 'usage'}>{usage.totalCalls.toLocaleString()}</span>{/if}
        </button>
        <button class="tab" class:active={activeTab === 'api'} role="tab" aria-selected={activeTab === 'api'} on:click={() => activeTab = 'api'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          API
        </button>
      </div>

      <!-- Tab content -->
      {#key activeTab}
      <div class="tab-panel" in:fly={{ y: 8, duration: 200, delay: 60 }} out:fade={{ duration: 80 }}>
        {#if activeTab === 'card'}
          <ModelCardTab {m} />
        {:else if activeTab === 'experiments'}
          <ExperimentsTab {m} {experimentLog} />
        {:else if activeTab === 'benchmark'}
          <BenchmarkTab visible={activeTab === 'benchmark'} />
        {:else if activeTab === 'usage'}
          <div class="usage-tab">
            <div class="usage-grid">
              <div class="usage-stat">
                <span class="us-val">{usage.totalCalls.toLocaleString()}</span>
                <span class="us-label">Total Calls</span>
              </div>
              <div class="usage-stat">
                <span class="us-val green">+{usage.totalRevenue.toFixed(2)}</span>
                <span class="us-label">Revenue (HOOT)</span>
              </div>
              <div class="usage-stat">
                <span class="us-val">{Math.round(usage.totalCalls / Math.max(sparkData.length, 1))}</span>
                <span class="us-label">Avg Daily Calls</span>
              </div>
            </div>
            {#if sparkData.length > 0}
              <div class="daily-chart">
                <span class="dc-title">Daily API Calls (7d)</span>
                <div class="dc-bars">
                  {#each sparkData as val, i}
                    <div class="dc-bar-wrap">
                      <div class="dc-bar" style:height="{Math.max(4, (val / sparkMax) * 100)}%"></div>
                      <span class="dc-bar-label">D{i + 1}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            <div class="pool-section">
              <span class="pool-title">Pool A Revenue Distribution</span>
              <div class="pool-grid">
                <div class="pool-item">
                  <span class="pi-val accent">{poolA.creator.toFixed(2)}</span>
                  <span class="pi-label">Creator (60%)</span>
                </div>
                <div class="pool-item">
                  <span class="pi-val">{poolA.notary.toFixed(2)}</span>
                  <span class="pi-label">Notary (15%)</span>
                </div>
                <div class="pool-item">
                  <span class="pi-val">{poolA.treasury.toFixed(2)}</span>
                  <span class="pi-label">Treasury (15%)</span>
                </div>
                <div class="pool-item">
                  <span class="pi-val">{poolA.burn.toFixed(2)}</span>
                  <span class="pi-label">Burn (10%)</span>
                </div>
              </div>
            </div>
            {#if dynamicModel?.vtr}
              <div class="vtr-section">
                <span class="vtr-title">Verification (VTR)</span>
                <div class="vtr-grid">
                  <span class="vtr-item"><strong>Grade:</strong> {dynamicModel.vtr.grade}</span>
                  <span class="vtr-item"><strong>Seed:</strong> {dynamicModel.vtr.trainingSeed}</span>
                  <span class="vtr-item"><strong>Checkpoint:</strong> {dynamicModel.vtr.ckptHash}</span>
                </div>
              </div>
            {/if}
          </div>
        {:else if activeTab === 'api'}
          <ApiTab
            bind:this={apiTabRef}
            modelSlug={m.id}
            on:openModal={(e) => handleOpenModal(e, 'apikey')}
          />
        {/if}
      </div>
      {/key}
    </div>

    <!-- Right: Sidebar -->
    <ModelSidebar {m} {sparkPath} {sparkArea} on:switchTab={handleSwitchTab} />
  </div>
  {/if}

  <!-- ContractCallModal -->
  <ContractCallModal
    {modalOpen}
    {modalCall}
    {modalStep}
    {walletConnected}
    {walletAddress}
    on:close={handleModalClose}
    on:confirm={handleModalConfirm}
    on:connectWallet={() => { wallet.connect('MetaMask'); }}
  />
</div>

<style>
  .detail {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--space-6, 24px);
  }

  /* ═══ VTR Banner ═══ */
  .vtr-banner {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 18px; margin-bottom: 16px;
    border-radius: 12px; font-size: 0.82rem; font-weight: 500;
  }
  .vtr-banner svg { flex-shrink: 0; }
  .vtr-resubmit-btn {
    appearance: none;
    border: 1.5px solid currentColor;
    background: rgba(255,255,255,0.6);
    color: inherit;
    font-size: 0.72rem; font-weight: 700;
    padding: 6px 16px; border-radius: 100px;
    cursor: pointer; flex-shrink: 0; margin-left: auto;
    transition: all 150ms; white-space: nowrap;
  }
  .vtr-resubmit-btn:hover { background: currentColor; color: #fff; }
  .vtr-banner.quarantined { background: rgba(243, 139, 168, 0.08); border: 1px solid rgba(243, 139, 168, 0.2); color: #e06c88; }
  .vtr-banner.pending { background: rgba(249, 226, 175, 0.1); border: 1px solid rgba(249, 226, 175, 0.25); color: #b7860e; }

  /* ═══ Loading ═══ */
  .loading-state {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 80px 24px; color: var(--text-muted, #9a9590); font-size: 0.82rem;
  }
  .loading-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid var(--border-subtle, #EDEAE5);
    border-top-color: var(--accent, #D97757);
    animation: spin 600ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ═══ Breadcrumb ═══ */
  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 16px; font-size: 0.76rem;
    animation: fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .bc-link { appearance: none; border: none; background: none; padding: 0; font-size: inherit; color: var(--text-secondary, #6b6560); cursor: pointer; }
  .bc-link:hover { color: var(--accent, #D97757); }
  .bc-sep { color: var(--border, #E5E0DA); }
  .bc-current { color: var(--text-primary, #2D2D2D); font-weight: 500; }

  /* ═══ Hero Section ═══ */
  .hero-section {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 24px;
    background:
      radial-gradient(ellipse at 15% 50%, rgba(217, 119, 87, 0.04), transparent 55%),
      var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 20px;
    margin-bottom: 0;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
  }

  .hero-info { flex: 1; min-width: 0; }

  .hero-identity {
    display: flex; align-items: flex-start; gap: 14px;
    margin-bottom: 16px;
  }

  .hero-icon {
    width: 52px; height: 52px;
    border-radius: 16px;
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .hero-text { flex: 1; min-width: 0; }

  .name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .model-name {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0; line-height: 1.2;
  }
  .state-badge {
    font-family: var(--font-mono);
    font-size: 0.52rem; font-weight: 700;
    padding: 2px 8px; border-radius: 4px;
    letter-spacing: 0.06em; flex-shrink: 0;
  }
  .model-slug {
    font-size: 0.74rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    display: block; margin-top: 2px;
  }

  /* Quick Stats */
  .quick-stats {
    display: flex; align-items: center; gap: 0;
    padding: 10px 14px;
    background: var(--page-bg, #FAF9F7);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    margin-bottom: 12px;
  }
  .qs-item { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
  .qs-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.92rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
  }
  .qs-val.green { color: var(--green, #27864a); }
  .qs-lbl { font-size: 0.56rem; color: var(--text-muted, #9a9590); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .qs-sep { width: 1px; height: 24px; background: var(--border-subtle, #EDEAE5); flex-shrink: 0; }
  .qs-spark { width: 80px; height: 24px; }

  /* Tags */
  .hero-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .htag {
    font-size: 0.64rem; font-weight: 500;
    padding: 3px 10px; border-radius: 100px;
    background: var(--border-subtle, #EDEAE5);
    color: var(--text-secondary, #6b6560);
    display: inline-flex; align-items: center; gap: 4px;
  }
  .htag.task { background: rgba(217, 119, 87, 0.1); color: var(--accent, #D97757); }
  .htag.framework { background: rgba(45, 108, 162, 0.08); color: var(--blue, #2d6ca2); }
  .htag.license { background: rgba(39, 134, 74, 0.08); color: var(--green, #27864a); }

  /* Hero Actions */
  .hero-actions {
    display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
    flex-shrink: 0;
  }

  .btn-try-hero {
    appearance: none; border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.86rem; font-weight: 600;
    padding: 12px 28px; border-radius: 100px;
    cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    transition: all 180ms ease;
    position: relative; overflow: hidden;
    white-space: nowrap;
  }
  .btn-try-hero:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 24px rgba(217, 119, 87, 0.3);
    transform: translateY(-1px);
  }
  .btn-try-hero.active {
    background: var(--text-primary, #2D2D2D);
  }
  .btn-try-hero::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .btn-try-hero:hover::after { animation: btn-shimmer 700ms ease-out; }
  @keyframes btn-shimmer { from { transform: translateX(-200%); } to { transform: translateX(200%); } }

  .action-group { display: flex; gap: 8px; }

  .like-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff); padding: 7px 14px;
    border-radius: 8px; font-size: 0.78rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    transition: all 200ms ease;
  }
  .like-btn:hover { border-color: var(--red, #c0392b); color: var(--red, #c0392b); }

  .action-btn-secondary {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 7px 16px; border-radius: 8px;
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    transition: all 200ms ease;
  }
  .action-btn-secondary:hover { border-color: var(--accent, #D97757); color: var(--accent, #D97757); }

  .chevron { transition: transform 200ms ease; }
  .chevron-open { transform: rotate(180deg); }
  .action-dropdown { position: relative; }
  .dropdown-menu {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 4px; min-width: 160px;
    z-index: var(--z-popover, 50);
  }
  .dropdown-item {
    appearance: none; border: none; background: none;
    width: 100%; padding: 8px 12px; font-size: 0.82rem; font-weight: 500;
    color: var(--text-primary, #2D2D2D); cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    border-radius: 8px; transition: background 100ms; text-align: left;
  }
  .dropdown-item:hover { background: var(--page-bg, #FAF9F7); }

  /* ═══ Inline Try Panel (Hero-level) ═══ */
  .try-hero {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-top: none;
    border-radius: 0 0 20px 20px;
    margin-bottom: 20px;
    overflow: hidden;
  }

  .try-hero-inner { padding: 20px 24px; }

  .try-hero-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .try-hero-title {
    font-size: 0.88rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    display: flex; align-items: center; gap: 8px; margin: 0;
  }
  .try-hero-title svg { color: var(--accent, #D97757); }
  .try-cost {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    padding: 4px 10px;
    background: var(--page-bg, #FAF9F7);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 100px;
  }

  .try-hero-body {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  }
  .try-col { display: flex; flex-direction: column; gap: 8px; }
  .try-label {
    font-size: 0.66rem; font-weight: 700;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.06em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .try-editor {
    width: 100%; padding: 12px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 10px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.8rem; color: var(--text-primary, #2D2D2D);
    background: #FAFAF9;
    resize: none; outline: none;
    transition: border-color 150ms;
  }
  .try-editor:focus { border-color: var(--accent, #D97757); }

  .try-btn-row { display: flex; align-items: center; gap: 12px; }

  .try-run {
    appearance: none; border: none;
    background: var(--accent, #D97757); color: #fff;
    font-size: 0.8rem; font-weight: 600;
    padding: 10px 22px; border-radius: 10px;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    transition: all 150ms; position: relative; overflow: hidden;
  }
  .try-run:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 16px rgba(217, 119, 87, 0.25);
  }
  .try-run:disabled { opacity: 0.5; cursor: not-allowed; }
  .try-run::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .try-run:hover:not(:disabled)::after { animation: btn-shimmer 700ms ease-out; }

  .try-wallet-hint {
    font-size: 0.66rem; color: var(--text-muted, #9a9590);
    display: flex; align-items: center; gap: 4px;
  }

  .try-result {
    padding: 12px; border: 1px solid var(--border, #E5E0DA);
    border-radius: 10px; background: #FAFAF9;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem; color: var(--text-primary, #2D2D2D);
    min-height: 140px; margin: 0;
    white-space: pre-wrap; overflow: auto; flex: 1;
  }
  .try-result.empty { color: var(--text-muted, #9a9590); }

  .try-success {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.72rem; font-weight: 600;
    color: var(--green, #27864a);
    padding: 6px 12px;
    background: rgba(39, 134, 74, 0.06);
    border: 1px solid rgba(39, 134, 74, 0.12);
    border-radius: 8px;
  }

  .spin-sm {
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* ═══ Content Layout ═══ */
  .content-layout {
    display: grid; grid-template-columns: 1fr 300px;
    gap: 32px; align-items: start;
    margin-top: 20px;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }
  .content-layout :global(.content-sidebar) { position: sticky; top: calc(var(--header-height, 52px) + 16px); }

  /* ═══ Tabs ═══ */
  .tabs {
    display: flex; gap: 4px; margin-bottom: 20px;
    overflow-x: auto; padding: 4px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: 12px;
  }
  .tab {
    appearance: none; border: none; background: none;
    padding: 8px 16px; font-size: 0.8rem; font-weight: 500;
    color: var(--text-secondary, #6b6560); cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 150ms; white-space: nowrap; border-radius: 8px;
  }
  .tab:hover { color: var(--text-primary, #2D2D2D); background: rgba(255,255,255,0.5); }
  .tab.active {
    color: var(--text-primary, #2D2D2D); font-weight: 600;
    background: var(--surface, #fff);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .tab-count {
    font-size: 0.62rem; font-weight: 600;
    background: var(--border-subtle, #EDEAE5);
    color: var(--text-muted, #9a9590);
    padding: 1px 6px; border-radius: 8px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    transition: background 200ms, color 200ms;
  }
  .tab-count-active { background: rgba(217, 119, 87, 0.15); color: var(--accent, #D97757); }

  /* ═══ Usage Tab ═══ */
  .usage-tab { display: flex; flex-direction: column; gap: 20px; }
  .usage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .usage-stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px 8px; background: var(--page-bg, #FAF9F7);
    border-radius: 12px; border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .us-val { font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .us-val.green { color: var(--green, #27864a); }
  .us-label { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #9a9590); }

  .daily-chart { display: flex; flex-direction: column; gap: 8px; }
  .dc-title { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6b6560); }
  .dc-bars {
    display: flex; gap: 6px; align-items: flex-end; height: 80px;
    padding: 8px; background: var(--page-bg, #FAF9F7); border-radius: 8px;
  }
  .dc-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .dc-bar { width: 100%; border-radius: 3px 3px 0 0; background: var(--accent, #D97757); min-height: 4px; transition: height 300ms ease; }
  .dc-bar-label { font-family: var(--font-mono); font-size: 0.5rem; color: var(--text-muted, #9a9590); }

  .pool-section, .vtr-section { display: flex; flex-direction: column; gap: 8px; }
  .pool-title, .vtr-title { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6b6560); }
  .pool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .pool-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 10px 4px; background: var(--page-bg, #FAF9F7);
    border-radius: 8px; border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .pi-val { font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .pi-val.accent { color: var(--accent, #D97757); }
  .pi-label { font-size: 0.52rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #9a9590); text-align: center; }

  .vtr-grid {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px; background: var(--page-bg, #FAF9F7);
    border-radius: 8px; border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .vtr-item { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-secondary, #6b6560); }
  .vtr-item strong { color: var(--text-primary, #2D2D2D); }

  /* ═══ Responsive ═══ */
  @media (max-width: 960px) {
    .content-layout { grid-template-columns: 1fr; }
    .content-layout :global(.content-sidebar) { position: static; }
    .hero-section { flex-direction: column; }
    .hero-actions { flex-direction: row; width: 100%; flex-wrap: wrap; }
  }

  @media (max-width: 600px) {
    .detail {
      padding: 12px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
    .hero-section { padding: 16px; border-radius: 14px; }
    .hero-icon { width: 44px; height: 44px; }
    .model-name { font-size: 1.2rem; }
    .quick-stats { flex-wrap: wrap; gap: 8px; }
    .qs-sep { display: none; }
    .qs-item { flex: 0 0 auto; min-width: 60px; }
    .btn-try-hero { width: 100%; justify-content: center; min-height: 48px; }
    .hero-actions { width: 100%; }
    .action-group { width: 100%; }
    .action-group .like-btn, .action-group .action-btn-secondary { flex: 1; justify-content: center; min-height: 44px; }
    .try-hero-body { grid-template-columns: 1fr; }
    .try-hero-inner { padding: 14px 16px; }
    .usage-grid { grid-template-columns: 1fr; }
    .pool-grid { grid-template-columns: repeat(2, 1fr); }
    .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .tab { flex-shrink: 0; min-height: 44px; }
  }

  @media (max-width: 400px) {
    .hero-section { padding: 12px; }
    .model-name { font-size: 1.1rem; }
    .hero-tags { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .breadcrumb, .content-layout, .hero-section, .try-hero { animation: none !important; }
    .chevron { transition: none; }
    .tab-count { transition: none; }
  }
</style>
