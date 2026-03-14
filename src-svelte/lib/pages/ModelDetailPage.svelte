<script lang="ts">
  import { router } from "../stores/router.ts";
  import { DEMO_MODEL, EXPERIMENT_LOG, SPARK_DATA } from "../data/modelDetailData.ts";
  import ModelCardTab from "../components/ModelCardTab.svelte";
  import ExperimentsTab from "../components/ExperimentsTab.svelte";
  import BenchmarkTab from "../components/BenchmarkTab.svelte";
  import PlaygroundTab from "../components/PlaygroundTab.svelte";
  import ApiTab from "../components/ApiTab.svelte";
  import ModelSidebar from "../components/ModelSidebar.svelte";

  let activeTab: 'card' | 'playground' | 'api' | 'experiments' | 'benchmark' = 'card';

  const m = DEMO_MODEL;
  const experimentLog = EXPERIMENT_LOG;

  // Sparkline path computation
  const sparkData = SPARK_DATA;
  const sparkMax = Math.max(...sparkData);
  const sparkPath = sparkData.map((v, i) => {
    const x = (i / (sparkData.length - 1)) * 120;
    const y = 28 - (v / sparkMax) * 24;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const sparkArea = sparkPath + ` L120,28 L0,28 Z`;

  function handleSwitchTab(e: CustomEvent<string>) {
    activeTab = e.detail as typeof activeTab;
  }
</script>

<div class="detail" data-theme="light">
  <!-- Breadcrumb -->
  <nav class="breadcrumb">
    <button class="bc-link" on:click={() => router.navigate('dashboard')}>Dashboard</button>
    <span class="bc-sep">/</span>
    <button class="bc-link" on:click={() => router.navigate('models')}>Models</button>
    <span class="bc-sep">/</span>
    <span class="bc-current">{m.slug}</span>
  </nav>

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
              <h1 class="model-name">{m.name}</h1>
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
            <button class="action-btn primary">
              Use this model
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
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

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" class:active={activeTab === 'card'} on:click={() => activeTab = 'card'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Model Card
        </button>
        <button class="tab" class:active={activeTab === 'experiments'} on:click={() => activeTab = 'experiments'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Experiments
          <span class="tab-count">{m.totalExperiments}</span>
        </button>
        <button class="tab" class:active={activeTab === 'benchmark'} on:click={() => activeTab = 'benchmark'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="7" width="4" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="17" y="3" width="4" height="18" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Benchmark
        </button>
        <button class="tab" class:active={activeTab === 'playground'} on:click={() => activeTab = 'playground'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          Playground
        </button>
        <button class="tab" class:active={activeTab === 'api'} on:click={() => activeTab = 'api'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          API
        </button>
      </div>

      <!-- Tab Content -->
      {#if activeTab === 'card'}
        <ModelCardTab {m} />
      {:else if activeTab === 'experiments'}
        <ExperimentsTab {m} {experimentLog} />
      {:else if activeTab === 'benchmark'}
        <BenchmarkTab visible={activeTab === 'benchmark'} />
      {:else if activeTab === 'playground'}
        <PlaygroundTab />
      {:else if activeTab === 'api'}
        <ApiTab modelSlug={m.id} />
      {/if}
    </div>

    <!-- Right: Sidebar -->
    <ModelSidebar {m} {sparkPath} {sparkArea} on:switchTab={handleSwitchTab} />
  </div>
</div>

<style>
  .detail {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--space-6, 24px);
  }

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
  .model-name {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 2px; line-height: 1.2;
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
  }

  /* Content Layout */
  .content-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: var(--space-8, 32px);
    align-items: start;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }

  /* Responsive */
  @media (max-width: 960px) {
    .content-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .detail { padding: var(--space-3, 12px); }
    .header-top { flex-direction: column; }
    .header-actions { width: 100%; }
    .model-name { font-size: 1.2rem; }
  }
</style>
