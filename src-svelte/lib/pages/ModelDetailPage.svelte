<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from "../stores/router.ts";
  import { fly, fade } from 'svelte/transition';
  import { DEMO_MODEL, EXPERIMENT_LOG, SPARK_DATA } from "../data/modelDetailData.ts";
  import { loadModel } from "../services/modelService.ts";
  import { modelPublishStore } from "../stores/modelPublishStore.ts";
  import { studioStore } from "../stores/studioStore.ts";
  import ModelCardTab from "../components/ModelCardTab.svelte";
  import ExperimentsTab from "../components/ExperimentsTab.svelte";
  import BenchmarkTab from "../components/BenchmarkTab.svelte";
  import PlaygroundTab from "../components/PlaygroundTab.svelte";
  import ApiTab from "../components/ApiTab.svelte";
  import ModelSidebar from "../components/ModelSidebar.svelte";
  import type { ModelRecord } from '../../../packages/contracts/src/index.ts';

  let activeTab: 'card' | 'playground' | 'api' | 'experiments' | 'benchmark' | 'usage' = 'card';
  let loading = true;
  let dynamicModel: ModelRecord | null = null;

  // UX-MD4: "Use this model" dropdown
  let dropdownOpen = false;
  function toggleDropdown() { dropdownOpen = !dropdownOpen; }
  function closeDropdown() { dropdownOpen = false; }

  // ── Load model by ID from URL param ──
  let modelId: string = '';
  router.params.subscribe(p => { modelId = p.modelId ?? ''; })();

  onMount(async () => {
    if (modelId) {
      // Try loading from published models first, then service
      const published = $modelPublishStore.find(pm => pm.id === modelId);
      if (published) {
        dynamicModel = published;
      } else {
        dynamicModel = await loadModel(modelId);
      }
    }
    loading = false;
  });

  // Merged model: dynamic data overlaid on DEMO_MODEL (for fields not in ModelRecord)
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

  // Sparkline from daily calls or fallback
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
    // Simulated checkpoint download notification
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
</script>

<div class="detail">
  <!-- UX-MD2: Accessible breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <button class="bc-link" on:click={() => router.navigate('studio')}>Magnet Studio</button>
    <span class="bc-sep">/</span>
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
  <!-- Main Content: 2-column -->
  <div class="content-layout">
    <!-- Left: Tab Content -->
    <div class="content-main">

      <!-- Model Header -->
      <header class="model-header">
        <div class="header-top">
          <div class="header-identity">
            <div class="header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div class="name-row">
                <h1 class="model-name">{m.name}</h1>
                <span class="state-badge" style:background={stateBadge.bg} style:color={stateBadge.text}>
                  {stateBadge.label}
                </span>
              </div>
              <span class="model-slug">{m.slug}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="like-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              {m.likes}
            </button>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="action-dropdown" on:mouseleave={closeDropdown}>
              <button class="action-btn primary" on:click={toggleDropdown} aria-haspopup="true" aria-expanded={dropdownOpen}>
                Use this model
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="chevron" class:chevron-open={dropdownOpen}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              {#if dropdownOpen}
              <div class="dropdown-menu" transition:fly={{ y: -8, duration: 150 }}>
                <button class="dropdown-item" on:click={handleDeploy}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 14a1 1 0 0 1-.78-1.63l9-11a1 1 0 0 1 1.78.63v7h6a1 1 0 0 1 .78 1.63l-9 11a1 1 0 0 1-1.78-.63v-7H4z" stroke="currentColor" stroke-width="1.5"/></svg>
                  Deploy
                </button>
                <button class="dropdown-item" on:click={handleDownload}>
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

        <!-- Tags -->
        <div class="header-tags">
          <span class="htag task">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Prediction
          </span>
          <span class="htag framework">{m.framework}</span>
          <span class="htag framework">{m.type}</span>
          <span class="htag license">{m.license}</span>
          {#each m.tags as tag}
            <span class="htag">{tag}</span>
          {/each}
        </div>
      </header>

      <!-- Tabs (6: added Usage) -->
      <div class="tabs" role="tablist" aria-label="Model sections">
        <button class="tab" class:active={activeTab === 'card'} role="tab" aria-selected={activeTab === 'card'} on:click={() => activeTab = 'card'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Model Card
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
        <button class="tab" class:active={activeTab === 'playground'} role="tab" aria-selected={activeTab === 'playground'} on:click={() => activeTab = 'playground'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          Playground
        </button>
        <button class="tab" class:active={activeTab === 'api'} role="tab" aria-selected={activeTab === 'api'} on:click={() => activeTab = 'api'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          API
        </button>
      </div>

      <!-- UX-MD1: Crossfade tab content -->
      {#key activeTab}
      <div class="tab-panel" in:fly={{ y: 8, duration: 200, delay: 60 }} out:fade={{ duration: 80 }}>
        {#if activeTab === 'card'}
          <ModelCardTab {m} />
        {:else if activeTab === 'experiments'}
          <ExperimentsTab {m} {experimentLog} />
        {:else if activeTab === 'benchmark'}
          <BenchmarkTab visible={activeTab === 'benchmark'} />
        {:else if activeTab === 'usage'}
          <!-- Usage Tab -->
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

            <!-- Daily calls chart (simple bars) -->
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

            <!-- Pool A Distribution -->
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

            <!-- VTR Info -->
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
        {:else if activeTab === 'playground'}
          <PlaygroundTab />
        {:else if activeTab === 'api'}
          <ApiTab modelSlug={m.id} />
        {/if}
      </div>
      {/key}
    </div>

    <!-- Right: Sidebar -->
    <ModelSidebar {m} {sparkPath} {sparkArea} on:switchTab={handleSwitchTab} />
  </div>
  {/if}
</div>

<style>
  .detail {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--space-6, 24px);
  }

  /* Loading state */
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

  /* Breadcrumb */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--space-4, 16px);
    font-size: 0.76rem;
    animation: fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .bc-link {
    appearance: none; border: none; background: none; padding: 0;
    font-size: inherit; color: var(--text-secondary, #6b6560); cursor: pointer;
  }
  .bc-link:hover { color: var(--accent, #D97757); }
  .bc-sep { color: var(--border, #E5E0DA); }
  .bc-current { color: var(--text-primary, #2D2D2D); font-weight: 500; }

  /* Header */
  .model-header {
    margin-bottom: var(--space-5, 20px);
  }
  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4, 16px);
    margin-bottom: var(--space-3, 12px);
  }
  .header-identity {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3, 12px);
  }
  .header-icon {
    width: 44px; height: 44px;
    border-radius: var(--radius-lg, 16px);
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: box-shadow 300ms ease;
  }
  .header-icon:hover {
    box-shadow: 0 0 20px rgba(217, 119, 87, 0.15);
  }
  .name-row {
    display: flex; align-items: center; gap: 8px;
  }
  .model-name {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 2px; line-height: 1.2;
  }
  .state-badge {
    font-family: var(--font-mono);
    font-size: 0.52rem; font-weight: 700;
    padding: 2px 8px; border-radius: 4px;
    letter-spacing: 0.06em; flex-shrink: 0;
  }
  .model-slug {
    font-size: 0.76rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .header-actions {
    display: flex; gap: 8px; flex-shrink: 0;
  }
  .like-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 7px 14px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 200ms ease;
  }
  .like-btn:hover { border-color: var(--red, #c0392b); color: var(--red, #c0392b); box-shadow: 0 0 8px rgba(192, 57, 43, 0.15); transform: translateY(-1px); }

  .action-btn.primary {
    appearance: none; border: none;
    background: var(--accent, #D97757);
    color: #fff;
    padding: 8px 16px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.8rem; font-weight: 600;
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 200ms ease;
  }
  .action-btn.primary:hover { background: var(--accent-hover, #C4644A); box-shadow: 0 4px 12px rgba(217, 119, 87, 0.25); transform: translateY(-1px); }

  /* Tags */
  .header-tags {
    display: flex; flex-wrap: wrap; gap: 5px;
  }
  .htag {
    font-size: 0.66rem; font-weight: 500;
    padding: 3px 10px;
    border-radius: var(--radius-pill, 100px);
    background: var(--border-subtle, #EDEAE5);
    color: var(--text-secondary, #6b6560);
    display: inline-flex; align-items: center; gap: 4px;
  }
  .htag.task {
    background: rgba(217, 119, 87, 0.1);
    color: var(--accent, #D97757);
  }
  .htag.framework {
    background: rgba(45, 108, 162, 0.08);
    color: var(--blue, #2d6ca2);
  }
  .htag.license {
    background: rgba(39, 134, 74, 0.08);
    color: var(--green, #27864a);
  }

  /* Tabs */
  .tabs {
    display: flex; gap: 4px;
    margin-bottom: var(--space-5, 20px);
    overflow-x: auto;
    padding: 4px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: var(--radius-md, 10px);
  }
  .tab {
    appearance: none; border: none; background: none;
    padding: 8px 16px;
    font-size: 0.8rem; font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    position: relative;
    transition: all 150ms;
    white-space: nowrap;
    border-radius: 8px;
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
  /* UX-MD5: Tab count accent on active */
  .tab-count-active {
    background: rgba(217, 119, 87, 0.15);
    color: var(--accent, #D97757);
  }

  /* UX-MD4: Dropdown menu */
  .action-dropdown {
    position: relative;
  }
  .chevron {
    transition: transform 200ms ease;
  }
  .chevron-open {
    transform: rotate(180deg);
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 4px;
    min-width: 160px;
    z-index: var(--z-popover, 50);
  }
  .dropdown-item {
    appearance: none;
    border: none;
    background: none;
    width: 100%;
    padding: 8px 12px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-primary, #2D2D2D);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 6px;
    transition: background 100ms;
    text-align: left;
  }
  .dropdown-item:hover {
    background: var(--page-bg, #FAF9F7);
  }

  /* Content Layout */
  .content-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: var(--space-8, 32px);
    align-items: start;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }

  /* UX-MD3: Sidebar sticky */
  .content-layout :global(.content-sidebar) {
    position: sticky;
    top: calc(var(--header-height, 52px) + 16px);
  }

  /* ── Usage Tab ── */
  .usage-tab { display: flex; flex-direction: column; gap: 20px; }
  .usage-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  }
  .usage-stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px 8px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .us-val {
    font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .us-val.green { color: var(--green, #27864a); }
  .us-label {
    font-size: 0.62rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted, #9a9590);
  }

  .daily-chart { display: flex; flex-direction: column; gap: 8px; }
  .dc-title {
    font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6b6560);
  }
  .dc-bars {
    display: flex; gap: 6px; align-items: flex-end; height: 80px;
    padding: 8px; background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
  }
  .dc-bar-wrap {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
    height: 100%;
    justify-content: flex-end;
  }
  .dc-bar {
    width: 100%; border-radius: 3px 3px 0 0;
    background: var(--accent, #D97757); min-height: 4px;
    transition: height 300ms ease;
  }
  .dc-bar-label {
    font-family: var(--font-mono); font-size: 0.5rem;
    color: var(--text-muted, #9a9590);
  }

  .pool-section, .vtr-section {
    display: flex; flex-direction: column; gap: 8px;
  }
  .pool-title, .vtr-title {
    font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6b6560);
  }
  .pool-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  .pool-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 10px 4px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .pi-val {
    font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .pi-val.accent { color: var(--accent, #D97757); }
  .pi-label {
    font-size: 0.52rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--text-muted, #9a9590);
    text-align: center;
  }

  .vtr-grid {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .vtr-item {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-secondary, #6b6560);
  }
  .vtr-item strong { color: var(--text-primary, #2D2D2D); }

  /* Responsive */
  @media (max-width: 960px) {
    .content-layout { grid-template-columns: 1fr; }
    .content-layout :global(.content-sidebar) { position: static; }
  }
  @media (max-width: 600px) {
    .detail { padding: var(--space-3, 12px); }
    .header-top { flex-direction: column; }
    .header-actions { width: 100%; }
    .model-name { font-size: 1.2rem; }
    .usage-grid { grid-template-columns: 1fr; }
    .pool-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* C-1: prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .breadcrumb, .content-layout { animation: none !important; }
    .chevron { transition: none; }
    .tab-count { transition: none; }
  }
</style>
