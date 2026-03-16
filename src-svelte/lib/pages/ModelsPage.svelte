<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from "../stores/router.ts";
  import { wallet } from "../stores/walletStore.ts";
  import { modelPublishStore } from "../stores/modelPublishStore.ts";
  import { loadModels } from "../services/modelService.ts";
  import { fmtNumber } from "../utils/format.ts";
  import PixelIcon from "../components/PixelIcon.svelte";
  import type { ModelRecord } from '../../../packages/contracts/src/index.ts';

  let searchQuery = "";
  let debouncedQuery = "";
  let activeFilter = "all";
  let sortBy: 'metric' | 'usage' | 'newest' = 'usage';
  let _searchTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Dynamic model loading ──
  let allModels: ModelRecord[] = [];
  let loading = true;

  onMount(async () => {
    const [serviceModels] = await Promise.all([loadModels()]);
    allModels = serviceModels;
    loading = false;
  });

  // Merge published models from user
  $: publishedModels = $modelPublishStore;
  $: mergedModels = mergeModels(allModels, publishedModels);

  function mergeModels(service: ModelRecord[], published: ModelRecord[]): ModelRecord[] {
    const ids = new Set(service.map(m => m.id));
    const extras = published.filter(p => !ids.has(p.id));
    return [...service, ...extras];
  }

  // ── Section splits ──
  $: myCreatedModels = $wallet.connected ? mergedModels.filter(m =>
    publishedModels.some(p => p.id === m.id)
  ) : [];

  $: myUsedModels = $wallet.connected ? mergedModels.filter(m =>
    m.usage.totalCalls > 0 && !publishedModels.some(p => p.id === m.id)
  ) : [];

  $: trendingModels = mergedModels;

  function onSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => { debouncedQuery = searchQuery; }, 300);
  }

  const filters = [
    { id: "all", label: "All Models" },
    { id: "prediction", label: "Prediction" },
    { id: "classification", label: "Classification" },
    { id: "timeseries", label: "Time Series" },
    { id: "nlp", label: "NLP" },
    { id: "anomaly", label: "Anomaly Detection" },
  ];

  // ── Sort + filter ──
  function sortModels(models: ModelRecord[], sort: typeof sortBy): ModelRecord[] {
    return [...models].sort((a, b) => {
      switch (sort) {
        case 'metric': return a.metrics.best - b.metrics.best;
        case 'usage': return b.usage.totalCalls - a.usage.totalCalls;
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });
  }

  // Build display-friendly data from ModelRecord
  function modelToCard(m: ModelRecord) {
    const slugParts = m.slug.split('-');
    const category = inferCategory(m.name);
    return {
      ...m,
      displaySlug: `hoot/${m.slug}`,
      category,
      metricLabel: `${m.metrics.best.toFixed(3)}`,
      metricName: 'best',
      _nameLower: m.name.toLowerCase(),
      _slugLower: m.slug.toLowerCase(),
    };
  }

  function inferCategory(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('predict') || n.includes('forecast')) return 'prediction';
    if (n.includes('classif') || n.includes('risk') || n.includes('detect')) return 'classification';
    if (n.includes('sentiment') || n.includes('nlp') || n.includes('text')) return 'nlp';
    if (n.includes('time') || n.includes('series') || n.includes('gas')) return 'timeseries';
    if (n.includes('anomaly') || n.includes('mev') || n.includes('fraud')) return 'anomaly';
    return 'prediction';
  }

  function formatState(state: string): { label: string; color: string } {
    switch (state) {
      case 'NETWORK_ACTIVE': return { label: '● ACTIVE', color: '#27864a' };
      case 'PRIVATE_ACTIVE': return { label: '◐ PRIVATE', color: '#2980b9' };
      case 'DRAFT': return { label: '○ DRAFT', color: '#9a9590' };
      case 'MINTED': return { label: '◑ MINTED', color: '#b7860e' };
      case 'DEPRECATED': return { label: '✕ DEPRECATED', color: '#c0392b' };
      default: return { label: state, color: '#9a9590' };
    }
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  $: displayModels = sortModels(trendingModels, sortBy).map(modelToCard);

  $: filteredModels = displayModels.filter(m => {
    const q = debouncedQuery.toLowerCase();
    const matchSearch = !q || m._nameLower.includes(q) || m._slugLower.includes(q);
    const matchFilter = activeFilter === 'all' || m.category === activeFilter;
    return matchSearch && matchFilter;
  });

  /** UX-M6: Track mouse position on card for directional glow */
  function handleCardMouse(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(0);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(0);
    card.style.setProperty('--glow-x', `${x}%`);
    card.style.setProperty('--glow-y', `${y}%`);
  }
</script>

<div class="models">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <span class="page-eyebrow">MODEL HUB</span>
        <h1 class="page-title">Models</h1>
        <p class="page-sub">Trained by autonomous research. Ready to deploy.</p>
      </div>
    </div>
    <button class="header-cta" on:click={() => router.navigate('studio')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      New Research
    </button>
  </div>

  <!-- Search + Filters + Sort -->
  <div class="toolbar">
    <div class="search-row">
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="search-icon">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="Search models..."
          value={searchQuery}
          on:input={onSearchInput}
        />
        <span class="search-count">{filteredModels.length}</span>
      </div>
      <select class="sort-select" bind:value={sortBy}>
        <option value="usage">Most Used</option>
        <option value="metric">Best Metric</option>
        <option value="newest">Newest</option>
      </select>
    </div>
    <div class="filter-chips" role="tablist" aria-label="Model filters">
      {#each filters as f}
        <button
          class="filter-chip"
          class:active={activeFilter === f.id}
          role="tab"
          aria-selected={activeFilter === f.id}
          on:click={() => activeFilter = f.id}
        >{f.label}</button>
      {/each}
    </div>
  </div>

  <!-- My Created Models (Builder Member) -->
  {#if myCreatedModels.length > 0}
    <div class="section-block">
      <h2 class="section-title">
        <span class="section-icon"><PixelIcon type="research" size={14} /></span>
        My Models
        <span class="section-count">{myCreatedModels.length}</span>
      </h2>
      <div class="my-model-list">
        {#each myCreatedModels as m}
          {@const st = formatState(m.state)}
          <button class="my-model-row" on:click={() => router.navigate('model-detail', { modelId: m.id })}>
            <span class="mmr-name">{m.name}</span>
            <span class="mmr-state" style:color={st.color}>{st.label}</span>
            <span class="mmr-calls">{fmtNumber(m.usage.totalCalls)} calls</span>
            <span class="mmr-revenue">+{m.poolA.creator.toFixed(2)} H</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- My Used Models (Member) -->
  {#if myUsedModels.length > 0}
    <div class="section-block">
      <h2 class="section-title">
        <span class="section-icon"><PixelIcon type="portfolio" size={14} /></span>
        In Use
        <span class="section-count">{myUsedModels.length}</span>
      </h2>
      <div class="my-model-list">
        {#each myUsedModels as m}
          {@const st = formatState(m.state)}
          <button class="my-model-row" on:click={() => router.navigate('model-detail', { modelId: m.id })}>
            <span class="mmr-name">{m.name}</span>
            <span class="mmr-state" style:color={st.color}>{st.label}</span>
            <span class="mmr-calls">{fmtNumber(m.usage.totalCalls)} calls</span>
            <span class="mmr-cost">-{m.usage.totalRevenue.toFixed(2)} H</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Trending / All Models Grid -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading models...</span>
    </div>
  {:else}
    <div class="section-block">
      <h2 class="section-title">
        <span class="section-icon"><PixelIcon type="sparkle" size={14} /></span>
        Trending
      </h2>
    </div>
    <div class="model-grid">
      {#each filteredModels as model, i (model.id)}
        {@const st = formatState(model.state)}
        <button class="model-card" style:--i={i} on:click={() => router.navigate('model-detail', { modelId: model.id })} on:mousemove={handleCardMouse}>
          <!-- Card Header -->
          <div class="card-top">
            <div class="card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="card-state-badge" style:color={st.color} style:border-color={st.color}>{st.label}</span>
          </div>

          <!-- Name + Slug -->
          <h3 class="card-name">{model.name}</h3>
          <span class="card-slug">{model.displaySlug}</span>

          <!-- Metric Highlight -->
          <div class="card-metric">
            <span class="metric-value">{model.metricLabel}</span>
            <span class="metric-label">best</span>
          </div>

          <!-- Footer Stats -->
          <div class="card-footer">
            <div class="card-stats">
              <span class="card-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {fmtNumber(model.usage.totalCalls)} calls
              </span>
              <span class="card-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                {model.metrics.experiments} exp
              </span>
            </div>
            <span class="card-date">{timeAgo(model.updatedAt)}</span>
          </div>

          <!-- Revenue badge (if earning) -->
          {#if model.usage.totalRevenue > 0}
            <div class="card-revenue">
              +{model.usage.totalRevenue.toFixed(2)} HOOT earned
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Empty State -->
  {#if !loading && filteredModels.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1"/>
          <path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="empty-title">No models found</h3>
      <p class="empty-desc">Try a different search query or filter.</p>
      <button class="empty-cta" on:click={() => { searchQuery = ''; debouncedQuery = ''; activeFilter = 'all'; }}>
        Clear Filters
      </button>
    </div>
  {/if}
</div>

<style>
  .models {
    padding: var(--space-6, 24px);
    max-width: 1280px;
    width: 100%;
    min-width: 0;
    margin: 0 auto;
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4, 16px);
    margin-bottom: var(--space-6, 24px);
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4, 16px);
  }

  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(217, 119, 87, 0.06);
    transition: box-shadow 300ms ease;
  }

  .header-icon:hover {
    box-shadow: 0 0 20px rgba(217, 119, 87, 0.15);
  }

  .page-eyebrow {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    display: block;
    margin-bottom: 2px;
  }

  .page-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 4px;
  }

  .page-sub {
    font-size: 0.88rem;
    color: var(--text-secondary, #6b6560);
    margin: 0;
  }

  .header-cta {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 10px 20px;
    border-radius: var(--radius-pill, 100px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    transition: background 150ms, transform 100ms;
    white-space: nowrap;
    position: relative;
    overflow: hidden;
  }
  .header-cta:hover { background: var(--accent-hover, #C4644A); box-shadow: 0 0 16px rgba(217, 119, 87, 0.25); transform: translateY(-1px); }

  .header-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .header-cta:hover::after {
    animation: btn-shimmer 700ms ease-out;
  }
  @keyframes btn-shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
    margin-bottom: var(--space-5, 20px);
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    transition: border-color 150ms;
  }

  .search-bar:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.08), 0 0 12px rgba(217, 119, 87, 0.04);
  }

  .search-icon { color: var(--text-muted, #9a9590); flex-shrink: 0; }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    font-size: 0.88rem;
    font-family: var(--font-body);
    color: var(--text-primary, #2D2D2D);
  }
  .search-input::placeholder { color: var(--text-muted, #9a9590); }

  .search-count {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    background: var(--border-subtle, #EDEAE5);
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* UX-M3: Segment control style filter chips */
  .filter-chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    background: var(--border-subtle, #EDEAE5);
    padding: 3px;
    border-radius: var(--radius-pill, 100px);
    width: fit-content;
  }

  .filter-chip {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    padding: 6px 16px;
    border-radius: var(--radius-pill, 100px);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .filter-chip:hover {
    color: var(--text-primary, #2D2D2D);
  }

  .filter-chip.active {
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    font-weight: 600;
  }

  /* ── Model Grid ── */
  .model-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4, 16px);
  }

  .model-card {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: var(--radius-lg, 16px);
    padding: var(--space-5, 20px);
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
    transition: all 200ms ease;
    position: relative;
    animation: card-enter 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i, 0) * 80ms + 200ms);
  }

  @keyframes card-enter {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* UX-M6: Mouse-position directional glow */
  .model-card::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: radial-gradient(
      200px circle at var(--glow-x, 50%) var(--glow-y, 50%),
      rgba(217, 119, 87, 0.15) 0%,
      transparent 70%
    );
    opacity: 0;
    transition: opacity 250ms ease;
    pointer-events: none;
    z-index: 0;
  }
  .model-card:hover::before { opacity: 1; }
  .model-card:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.08);
    transform: translateY(-3px);
  }

  /* Card Top */
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-framework {
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    padding: 2px 8px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 4px;
    letter-spacing: 0.02em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Name + Slug */
  .card-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    line-height: 1.3;
  }

  .card-slug {
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    margin-top: -6px;
  }

  /* Metric */
  .card-metric {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(39, 134, 74, 0.04);
    border: 1px solid rgba(39, 134, 74, 0.1);
    border-radius: var(--radius-sm, 6px);
  }

  .metric-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--green, #27864a);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-shadow: 0 0 6px rgba(39, 134, 74, 0.2);
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Tags */
  .card-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 0.64rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-pill, 100px);
    background: var(--border-subtle, #EDEAE5);
    color: var(--text-secondary, #6b6560);
  }

  .tag.type {
    background: rgba(45, 108, 162, 0.08);
    color: var(--blue, #2d6ca2);
    border: 1px solid rgba(45, 108, 162, 0.12);
  }

  /* Footer */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--space-3, 12px);
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }

  .card-stats {
    display: flex;
    gap: 12px;
  }

  .card-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }

  .card-date {
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Training badge */
  .card-training {
    margin-top: -4px;
  }

  .training-info {
    font-size: 0.66rem;
    color: var(--text-muted, #9a9590);
    font-style: normal;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* ── Empty State ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-16, 64px) var(--space-6, 24px);
    text-align: center;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both;
  }

  /* UX-M5: Empty state bounce animation */
  .empty-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--border-subtle, #EDEAE5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #9a9590);
    margin-bottom: var(--space-4, 16px);
    animation: emptyBounce 2s ease-in-out infinite;
  }
  @keyframes emptyBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 4px;
  }

  .empty-desc {
    font-size: 0.85rem;
    color: var(--text-secondary, #6b6560);
    margin: 0 0 var(--space-4, 16px);
  }

  .empty-cta {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    padding: 8px 18px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: all 150ms;
  }
  .empty-cta:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    box-shadow: var(--glow-accent-sm, 0 0 6px rgba(217, 119, 87, 0.25));
    transform: translateY(-1px);
  }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .models { padding: var(--space-4, 16px); }
    .page-header { flex-direction: column; gap: var(--space-3, 12px); }
    .header-left { flex-direction: column; align-items: flex-start; }
    .header-icon { width: 40px; height: 40px; }
    .model-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 600px) {
    .models {
      padding: var(--space-3, 12px);
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
    .page-header {
      gap: var(--space-2, 10px);
      margin-bottom: var(--space-4, 16px);
    }
    .header-left {
      gap: var(--space-3, 12px);
    }
    .header-icon {
      width: 36px;
      height: 36px;
    }
    .page-title { font-size: 1.22rem; }
    .page-sub {
      font-size: 0.74rem;
      line-height: 1.45;
    }
    .header-cta {
      width: 100%; justify-content: center; margin-top: 4px;
      min-height: 48px;
    }
    .toolbar {
      gap: var(--space-2, 10px);
      margin-bottom: var(--space-4, 16px);
    }
    .search-bar {
      padding: 12px 14px;
      min-height: 44px;
    }
    .search-count {
      font-size: 0.68rem;
      padding: 2px 7px;
    }
    .model-card { padding: 14px; }
    .card-name { font-size: 0.88rem; }
    .metric-value { font-size: 1rem; }
    .card-metric { padding: 8px 12px; }
    .model-grid { gap: var(--space-3, 12px); }
    .filter-chips {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 4px;
      margin: 0 -12px;
      padding-left: 12px;
      padding-right: 12px;
      width: auto;
      border-radius: var(--radius-md, 10px);
    }
    .filter-chip {
      flex-shrink: 0; padding: 10px 16px; font-size: 0.74rem;
      min-height: 44px; display: inline-flex; align-items: center;
      -webkit-tap-highlight-color: transparent;
    }
  }

  @media (max-width: 400px) {
    .models { padding: var(--space-2, 8px); }
    .page-title { font-size: 1.15rem; }
    .card-tags { display: none; }
    .filter-chip { padding: 8px 12px; font-size: 0.68rem; }
  }

  /* ── Sort select ── */
  .search-row {
    display: flex; gap: 10px; align-items: stretch;
  }
  .sort-select {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: var(--radius-md, 10px);
    padding: 8px 30px 8px 12px;
    font-size: 0.76rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a9590' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    flex-shrink: 0;
  }
  .sort-select:focus { outline: none; border-color: var(--accent, #D97757); }

  /* ── Section blocks (My Models, My Used, Trending) ── */
  .section-block {
    margin-bottom: var(--space-3, 12px);
  }
  .section-title {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.82rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 8px;
  }
  .section-icon { font-size: 14px; }
  .section-count {
    font-family: var(--font-mono); font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    background: var(--border-subtle, #EDEAE5);
    padding: 1px 6px; border-radius: 8px;
  }

  .my-model-list {
    display: flex; flex-direction: column; gap: 4px;
    margin-bottom: var(--space-5, 20px);
  }
  .my-model-row {
    appearance: none; border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff); padding: 10px 14px;
    border-radius: 10px; cursor: pointer;
    display: flex; align-items: center; gap: 12px;
    transition: all 150ms; text-align: left;
  }
  .my-model-row:hover {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.02);
  }
  .mmr-name {
    flex: 1; font-size: 0.8rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .mmr-state {
    font-family: var(--font-mono); font-size: 0.66rem; font-weight: 700;
  }
  .mmr-calls {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
  }
  .mmr-revenue {
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;
    color: var(--green, #27864a);
  }
  .mmr-cost {
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;
    color: var(--accent, #D97757);
  }

  /* ── Model card state badge ── */
  .card-state-badge {
    font-family: var(--font-mono); font-size: 0.62rem; font-weight: 700;
    padding: 2px 8px; border-radius: 6px;
    border: 1px solid;
    letter-spacing: 0.02em;
  }

  /* ── Revenue badge on card ── */
  .card-revenue {
    font-family: var(--font-mono); font-size: 0.66rem; font-weight: 600;
    color: var(--green, #27864a);
    background: rgba(39, 134, 74, 0.06);
    padding: 4px 10px; border-radius: 6px;
    text-align: center;
  }

  /* ── Loading state ── */
  .loading-state {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; padding: 60px 0;
    color: var(--text-muted, #9a9590); font-size: 0.82rem;
  }
  .loading-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    border-top-color: var(--accent, #D97757);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* C-1: prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .model-card, .page-header, .toolbar, .empty-state { animation: none !important; }
    .empty-icon { animation: none !important; }
    .model-card::before { transition: none; }
    .loading-spinner { animation: none !important; }
  }
</style>
