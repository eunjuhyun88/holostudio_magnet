<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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

  // ── Inline Try state ──
  let tryModelId: string | null = null;
  let tryInput = '{\n  "symbol": "ETH",\n  "timeframe": "24h"\n}';
  let tryResult = '';
  let tryLoading = false;
  let tryTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    const [serviceModels] = await Promise.all([loadModels()]);
    allModels = serviceModels;
    loading = false;
  });

  onDestroy(() => {
    if (tryTimeout) clearTimeout(tryTimeout);
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

  // ── Aggregate stats ──
  $: totalCalls = mergedModels.reduce((s, m) => s + m.usage.totalCalls, 0);
  $: totalRevenue = mergedModels.reduce((s, m) => s + m.usage.totalRevenue, 0);
  $: activeCount = mergedModels.filter(m => m.state === 'NETWORK_ACTIVE').length;

  function onSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => { debouncedQuery = searchQuery; }, 300);
  }

  const filters = [
    { id: "all", label: "All" },
    { id: "prediction", label: "Prediction" },
    { id: "classification", label: "Classification" },
    { id: "timeseries", label: "Time Series" },
    { id: "nlp", label: "NLP" },
    { id: "anomaly", label: "Anomaly" },
  ];

  const CATEGORY_COLORS: Record<string, string> = {
    prediction: '#D97757',
    classification: '#2980b9',
    nlp: '#8B5CF6',
    timeseries: '#27864a',
    anomaly: '#c0392b',
  };

  // ── Sort + filter ──
  function sortModels(models: ModelRecord[], sort: typeof sortBy): ModelRecord[] {
    return [...models].sort((a, b) => {
      switch (sort) {
        case 'metric': return b.metrics.best - a.metrics.best;
        case 'usage': return b.usage.totalCalls - a.usage.totalCalls;
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });
  }

  function modelToCard(m: ModelRecord) {
    const category = inferCategory(m.name);
    return {
      ...m,
      displaySlug: `hoot/${m.slug}`,
      category,
      catColor: CATEGORY_COLORS[category] ?? '#9a9590',
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

  function formatState(state: string): { label: string; color: string; dot: string } {
    switch (state) {
      case 'NETWORK_ACTIVE': return { label: 'Active', color: '#27864a', dot: '●' };
      case 'PRIVATE_ACTIVE': return { label: 'Private', color: '#2980b9', dot: '◐' };
      case 'DRAFT': return { label: 'Draft', color: '#9a9590', dot: '○' };
      case 'MINTED': return { label: 'Minted', color: '#b7860e', dot: '◑' };
      case 'DEPRECATED': return { label: 'Deprecated', color: '#c0392b', dot: '✕' };
      default: return { label: state, color: '#9a9590', dot: '○' };
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

  /** Mini sparkline SVG path from dailyCalls */
  function sparkPath(calls: number[]): string {
    if (!calls || calls.length < 2) return '';
    const max = Math.max(...calls, 1);
    const w = 80, h = 24;
    return calls.map((v, i) => {
      const x = (i / (calls.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  $: displayModels = sortModels(trendingModels, sortBy).map(modelToCard);

  $: filteredModels = displayModels.filter(m => {
    const q = debouncedQuery.toLowerCase();
    const matchSearch = !q || m._nameLower.includes(q) || m._slugLower.includes(q);
    const matchFilter = activeFilter === 'all' || m.category === activeFilter;
    return matchSearch && matchFilter;
  });

  // Featured = most used model
  $: featuredModel = displayModels.length > 0 ? displayModels[0] : null;
  $: gridModels = filteredModels.filter(m => !featuredModel || m.id !== featuredModel.id);

  /** UX-M6: Track mouse position on card for directional glow */
  function handleCardMouse(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(0);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(0);
    card.style.setProperty('--glow-x', `${x}%`);
    card.style.setProperty('--glow-y', `${y}%`);
  }

  // ── Inline Try (zero-depth playground) ──
  function openTry(e: Event, modelId: string) {
    e.stopPropagation();
    if (tryModelId === modelId) {
      tryModelId = null;
      return;
    }
    tryModelId = modelId;
    tryResult = '';
    tryLoading = false;
    tryInput = '{\n  "symbol": "ETH",\n  "timeframe": "24h"\n}';
  }

  function runTry() {
    tryLoading = true;
    tryResult = '';
    if (tryTimeout) clearTimeout(tryTimeout);
    tryTimeout = setTimeout(() => {
      tryLoading = false;
      tryResult = JSON.stringify({
        prediction: 0.73,
        confidence: 0.89,
        direction: "up",
        model: tryModelId,
        latency_ms: 42,
      }, null, 2);
    }, 1200);
  }

  function closeTry() {
    tryModelId = null;
    tryResult = '';
    tryLoading = false;
  }
</script>

<div class="models">
  <!-- ── Hero Header ── -->
  <div class="hero-header">
    <div class="hero-text">
      <h1 class="hero-title">Model Hub</h1>
      <p class="hero-sub">Discover, try, and deploy AI models trained by autonomous research</p>
    </div>
    <button class="hero-cta" on:click={() => router.navigate('studio')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Train New Model
    </button>
  </div>

  <!-- ── Network Stats Ribbon ── -->
  {#if !loading}
    <div class="stats-ribbon">
      <div class="stat-pill">
        <span class="stat-val">{mergedModels.length}</span>
        <span class="stat-lbl">Models</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-pill">
        <span class="stat-val">{activeCount}</span>
        <span class="stat-lbl">Active</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-pill">
        <span class="stat-val">{fmtNumber(totalCalls)}</span>
        <span class="stat-lbl">Total Calls</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-pill">
        <span class="stat-val">{totalRevenue.toFixed(1)}</span>
        <span class="stat-lbl">HOOT Earned</span>
      </div>
    </div>
  {/if}

  <!-- ── Featured Model (Hero Card) ── -->
  {#if !loading && featuredModel}
    {@const st = formatState(featuredModel.state)}
    <div class="featured-card" on:mousemove={handleCardMouse}>
      <div class="featured-left">
        <div class="featured-badge">
          <PixelIcon type="sparkle" size={12} />
          <span>Most Popular</span>
        </div>
        <h2 class="featured-name">{featuredModel.name}</h2>
        <span class="featured-slug">{featuredModel.displaySlug}</span>
        <p class="featured-desc">
          {fmtNumber(featuredModel.usage.totalCalls)} inference calls ·
          {featuredModel.metrics.experiments} experiments ·
          {featuredModel.metrics.kept} models kept
        </p>
        <div class="featured-actions">
          <button class="btn-try" on:click={(e) => openTry(e, featuredModel.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
            </svg>
            Try it now
          </button>
          <button class="btn-detail" on:click={() => router.navigate('model-detail', { modelId: featuredModel.id })}>
            View Details
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="featured-right">
        <div class="featured-metric-block">
          <span class="featured-metric-val">{featuredModel.metricLabel}</span>
          <span class="featured-metric-lbl">accuracy</span>
        </div>
        <div class="featured-spark">
          <svg viewBox="0 0 80 24" class="spark-svg" preserveAspectRatio="none">
            <path d={sparkPath(featuredModel.usage.dailyCalls)} fill="none" stroke="var(--accent, #D97757)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="spark-label">7d calls</span>
        </div>
        <div class="featured-state" style:color={st.color}>
          <span class="state-dot">{st.dot}</span> {st.label}
        </div>
      </div>
    </div>

    <!-- Inline Try Panel for Featured -->
    {#if tryModelId === featuredModel.id}
      <div class="try-panel" class:open={tryModelId === featuredModel.id}>
        <div class="try-inner">
          <div class="try-header">
            <h3 class="try-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
              </svg>
              Quick Inference — {featuredModel.name}
            </h3>
            <button class="try-close" on:click={closeTry}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="try-body">
            <div class="try-col">
              <label class="try-label">Input</label>
              <textarea class="try-editor" bind:value={tryInput} rows="5"></textarea>
              <button class="try-run" on:click={runTry} disabled={tryLoading}>
                {#if tryLoading}
                  <span class="spin-sm"></span> Running...
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                  </svg>
                  Run · 0.001 HOOT
                {/if}
              </button>
            </div>
            <div class="try-col">
              <label class="try-label">Output</label>
              <pre class="try-result" class:empty={!tryResult}>{tryResult || 'Results will appear here...'}</pre>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ── Search + Filters ── -->
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
          placeholder="Search models by name..."
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
      {#each filters as f (f.id)}
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

  <!-- ── My Created Models ── -->
  {#if myCreatedModels.length > 0}
    <div class="section-block">
      <h2 class="section-title">
        <PixelIcon type="research" size={14} />
        My Models
        <span class="section-count">{myCreatedModels.length}</span>
      </h2>
      <div class="my-model-list">
        {#each myCreatedModels as m (m.id)}
          {@const st = formatState(m.state)}
          <button class="my-model-row" on:click={() => router.navigate('model-detail', { modelId: m.id })}>
            <span class="mmr-name">{m.name}</span>
            <span class="mmr-state" style:color={st.color}>{st.dot} {st.label}</span>
            <span class="mmr-calls">{fmtNumber(m.usage.totalCalls)} calls</span>
            <span class="mmr-revenue">+{m.poolA.creator.toFixed(2)} H</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Model Grid ── -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading models...</span>
    </div>
  {:else}
    <div class="section-block">
      <h2 class="section-title">
        <PixelIcon type="sparkle" size={14} />
        All Models
      </h2>
    </div>
    <div class="model-grid">
      {#each gridModels as model, i (model.id)}
        {@const st = formatState(model.state)}
        <div class="card-wrapper" style:--i={i}>
          <div class="model-card" on:mousemove={handleCardMouse}>
            <!-- Category color indicator -->
            <div class="card-cat-line" style:background={model.catColor}></div>

            <button class="card-main" on:click={() => router.navigate('model-detail', { modelId: model.id })}>
              <!-- Top row: state + category -->
              <div class="card-top">
                <span class="card-category" style:color={model.catColor}>{model.category}</span>
                <span class="card-state" style:color={st.color}>{st.dot} {st.label}</span>
              </div>

              <!-- Name + Slug -->
              <h3 class="card-name">{model.name}</h3>
              <span class="card-slug">{model.displaySlug}</span>

              <!-- Metric + Sparkline row -->
              <div class="card-metric-row">
                <div class="card-metric">
                  <span class="metric-value">{model.metricLabel}</span>
                  <span class="metric-label">accuracy</span>
                </div>
                <svg viewBox="0 0 80 24" class="card-spark" preserveAspectRatio="none">
                  <path d={sparkPath(model.usage.dailyCalls)} fill="none" stroke={model.catColor} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
                </svg>
              </div>

              <!-- Stats row -->
              <div class="card-stats-row">
                <span class="card-stat">{fmtNumber(model.usage.totalCalls)} calls</span>
                <span class="card-stat">{model.metrics.experiments} exp</span>
                <span class="card-stat-date">{timeAgo(model.updatedAt)}</span>
              </div>
            </button>

            <!-- Try button (surface-level CTA) -->
            <div class="card-actions">
              <button
                class="card-try-btn"
                class:active={tryModelId === model.id}
                on:click={(e) => openTry(e, model.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                </svg>
                {tryModelId === model.id ? 'Close' : 'Try'}
              </button>
              {#if model.usage.totalRevenue > 0}
                <span class="card-revenue">+{model.usage.totalRevenue.toFixed(2)} H</span>
              {/if}
            </div>
          </div>

          <!-- Inline Try Panel -->
          {#if tryModelId === model.id}
            <div class="try-panel card-try-panel" class:open={tryModelId === model.id}>
              <div class="try-inner">
                <div class="try-header">
                  <h3 class="try-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                    </svg>
                    Quick Inference
                  </h3>
                  <button class="try-close" on:click={closeTry}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
                <div class="try-body">
                  <div class="try-col">
                    <label class="try-label">Input</label>
                    <textarea class="try-editor" bind:value={tryInput} rows="4"></textarea>
                    <button class="try-run" on:click={runTry} disabled={tryLoading}>
                      {#if tryLoading}
                        <span class="spin-sm"></span> Running...
                      {:else}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                        </svg>
                        Run · 0.001 HOOT
                      {/if}
                    </button>
                  </div>
                  <div class="try-col">
                    <label class="try-label">Output</label>
                    <pre class="try-result" class:empty={!tryResult}>{tryResult || 'Results will appear here...'}</pre>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Empty State ── -->
  {#if !loading && filteredModels.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1"/>
          <path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="empty-title">No models found</h3>
      <p class="empty-desc">Try a different search or filter</p>
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

  /* ═══ Hero Header ═══ */
  .hero-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hero-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    line-height: 1.1;
  }

  .hero-sub {
    font-size: 0.88rem;
    color: var(--text-secondary, #6b6560);
    margin: 6px 0 0;
    line-height: 1.5;
  }

  .hero-cta {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 10px 22px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    transition: all 180ms ease;
    white-space: nowrap;
    position: relative;
    overflow: hidden;
  }
  .hero-cta:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 20px rgba(217, 119, 87, 0.25);
    transform: translateY(-1px);
  }
  .hero-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .hero-cta:hover::after { animation: btn-shimmer 700ms ease-out; }

  @keyframes btn-shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }

  /* ═══ Stats Ribbon ═══ */
  .stats-ribbon {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 12px 20px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 14px;
    margin-bottom: 20px;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
  }

  .stat-pill {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  .stat-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
  }

  .stat-lbl {
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-weight: 500;
  }

  .stat-sep {
    width: 1px;
    height: 20px;
    background: var(--border, #E5E0DA);
    flex-shrink: 0;
  }

  /* ═══ Featured Card ═══ */
  .featured-card {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 24px;
    padding: 28px;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(217, 119, 87, 0.06), transparent 60%),
      var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 20px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
  }

  .featured-card::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: radial-gradient(
      300px circle at var(--glow-x, 50%) var(--glow-y, 50%),
      rgba(217, 119, 87, 0.1) 0%, transparent 70%
    );
    opacity: 0;
    transition: opacity 300ms ease;
    pointer-events: none;
  }
  .featured-card:hover::before { opacity: 1; }

  .featured-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    padding: 4px 10px;
    background: rgba(217, 119, 87, 0.06);
    border: 1px solid rgba(217, 119, 87, 0.15);
    border-radius: 100px;
    width: fit-content;
    margin-bottom: 12px;
  }

  .featured-name {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 4px;
    line-height: 1.2;
  }

  .featured-slug {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    display: block;
    margin-bottom: 12px;
  }

  .featured-desc {
    font-size: 0.82rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.6;
    margin: 0 0 18px;
  }

  .featured-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .btn-try {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 10px 22px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 180ms ease;
    position: relative;
    overflow: hidden;
  }
  .btn-try:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 16px rgba(217, 119, 87, 0.3);
    transform: translateY(-1px);
  }
  .btn-try::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .btn-try:hover::after { animation: btn-shimmer 700ms ease-out; }

  .btn-detail {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: transparent;
    color: var(--text-secondary, #6b6560);
    font-size: 0.82rem;
    font-weight: 500;
    padding: 10px 18px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 180ms ease;
  }
  .btn-detail:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
  }

  .featured-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 16px;
  }

  .featured-metric-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .featured-metric-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--green, #27864a);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 12px rgba(39, 134, 74, 0.15);
    line-height: 1;
  }

  .featured-metric-lbl {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .featured-spark {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .spark-svg {
    width: 100px;
    height: 28px;
  }

  .spark-label {
    font-size: 0.58rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .featured-state {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.66rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .state-dot { font-size: 0.72rem; }

  /* ═══ Inline Try Panel ═══ */
  .try-panel {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 20px;
    animation: slide-down 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .card-try-panel {
    margin-bottom: 0;
    border-radius: 0 0 16px 16px;
    border-top: none;
  }

  @keyframes slide-down {
    from { opacity: 0; max-height: 0; transform: translateY(-8px); }
    to { opacity: 1; max-height: 500px; transform: translateY(0); }
  }

  .try-inner {
    padding: 16px 20px;
  }

  .try-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .try-title {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }

  .try-title svg { color: var(--accent, #D97757); }

  .try-close {
    appearance: none;
    border: none;
    background: var(--border-subtle, #EDEAE5);
    color: var(--text-muted, #9a9590);
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
  }
  .try-close:hover {
    background: var(--border, #E5E0DA);
    color: var(--text-primary, #2D2D2D);
  }

  .try-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .try-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .try-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .try-editor {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 10px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    color: var(--text-primary, #2D2D2D);
    background: #FAFAF9;
    resize: none;
    outline: none;
    transition: border-color 150ms;
  }
  .try-editor:focus { border-color: var(--accent, #D97757); }

  .try-run {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    transition: all 150ms;
    position: relative;
    overflow: hidden;
  }
  .try-run:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 12px rgba(217, 119, 87, 0.25);
  }
  .try-run:disabled { opacity: 0.5; cursor: not-allowed; }
  .try-run::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .try-run:hover:not(:disabled)::after { animation: btn-shimmer 700ms ease-out; }

  .try-result {
    padding: 10px 12px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 10px;
    background: #FAFAF9;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.76rem;
    color: var(--text-primary, #2D2D2D);
    min-height: 100px;
    margin: 0;
    white-space: pre-wrap;
    overflow: auto;
    flex: 1;
  }
  .try-result.empty { color: var(--text-muted, #9a9590); }

  .spin-sm {
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ═══ Toolbar ═══ */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both;
  }

  .search-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 12px;
    transition: border-color 150ms;
    flex: 1;
  }
  .search-bar:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.06);
  }

  .search-icon { color: var(--text-muted, #9a9590); flex-shrink: 0; }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    font-size: 0.86rem;
    color: var(--text-primary, #2D2D2D);
  }
  .search-input::placeholder { color: var(--text-muted, #9a9590); }

  .search-count {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    background: var(--border-subtle, #EDEAE5);
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .sort-select {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: 12px;
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

  .filter-chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    background: var(--border-subtle, #EDEAE5);
    padding: 3px;
    border-radius: 100px;
    width: fit-content;
  }

  .filter-chip {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .filter-chip:hover { color: var(--text-primary, #2D2D2D); }
  .filter-chip.active {
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    font-weight: 600;
  }

  /* ═══ Section blocks ═══ */
  .section-block { margin-bottom: 12px; }
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 8px;
  }
  .section-count {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    background: var(--border-subtle, #EDEAE5);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .my-model-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 20px;
  }
  .my-model-row {
    appearance: none;
    border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff);
    padding: 10px 14px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 150ms;
    text-align: left;
  }
  .my-model-row:hover {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.02);
  }
  .mmr-name { flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .mmr-state { font-family: var(--font-mono); font-size: 0.66rem; font-weight: 700; }
  .mmr-calls { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted, #9a9590); }
  .mmr-revenue { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; color: var(--green, #27864a); }

  /* ═══ Model Grid ═══ */
  .model-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .card-wrapper {
    animation: card-enter 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i, 0) * 60ms + 200ms);
  }

  @keyframes card-enter {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .model-card {
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    transition: all 200ms ease;
  }

  .model-card::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: radial-gradient(
      200px circle at var(--glow-x, 50%) var(--glow-y, 50%),
      rgba(217, 119, 87, 0.12) 0%, transparent 70%
    );
    opacity: 0;
    transition: opacity 250ms ease;
    pointer-events: none;
    z-index: 0;
  }
  .model-card:hover::before { opacity: 1; }
  .model-card:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 4px 20px rgba(217, 119, 87, 0.08);
    transform: translateY(-2px);
  }

  .card-cat-line {
    height: 3px;
    width: 100%;
    opacity: 0.6;
    transition: opacity 200ms;
  }
  .model-card:hover .card-cat-line { opacity: 1; }

  .card-main {
    appearance: none;
    border: none;
    background: none;
    padding: 16px 18px 10px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-category {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .card-state {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6rem;
    font-weight: 700;
  }

  .card-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    line-height: 1.3;
  }

  .card-slug {
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    margin-top: -2px;
  }

  .card-metric-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(39, 134, 74, 0.03);
    border: 1px solid rgba(39, 134, 74, 0.08);
    border-radius: 10px;
    margin-top: 4px;
  }

  .card-metric {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .metric-value {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--green, #27864a);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .card-spark {
    width: 72px;
    height: 22px;
    flex-shrink: 0;
  }

  .card-stats-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 8px;
  }

  .card-stat {
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }

  .card-stat-date {
    font-size: 0.64rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    margin-left: auto;
  }

  /* Card actions bar */
  .card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 18px 14px;
    gap: 10px;
  }

  .card-try-btn {
    appearance: none;
    border: 1px solid var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.04);
    color: var(--accent, #D97757);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 180ms ease;
  }
  .card-try-btn:hover {
    background: var(--accent, #D97757);
    color: #fff;
    box-shadow: 0 0 12px rgba(217, 119, 87, 0.2);
  }
  .card-try-btn.active {
    background: var(--accent, #D97757);
    color: #fff;
  }

  .card-revenue {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--green, #27864a);
    background: rgba(39, 134, 74, 0.06);
    padding: 3px 8px;
    border-radius: 6px;
  }

  /* ═══ Empty State ═══ */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
    animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both;
  }
  .empty-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: var(--border-subtle, #EDEAE5);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted, #9a9590);
    margin-bottom: 16px;
    animation: emptyBounce 2s ease-in-out infinite;
  }
  @keyframes emptyBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .empty-title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0 0 4px; }
  .empty-desc { font-size: 0.82rem; color: var(--text-secondary, #6b6560); margin: 0 0 16px; }
  .empty-cta {
    appearance: none; border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff); font-size: 0.82rem; font-weight: 600;
    color: var(--text-secondary, #6b6560); padding: 8px 18px;
    border-radius: 8px; cursor: pointer; transition: all 150ms;
  }
  .empty-cta:hover { border-color: var(--accent, #D97757); color: var(--accent, #D97757); }

  /* ═══ Loading ═══ */
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

  /* ═══ Responsive ═══ */
  @media (max-width: 960px) {
    .featured-card { grid-template-columns: 1fr; gap: 20px; }
    .featured-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: 20px; }
  }

  @media (max-width: 860px) {
    .models { padding: 16px; }
    .hero-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    .model-grid { grid-template-columns: 1fr; }
    .stats-ribbon { flex-wrap: wrap; gap: 8px; padding: 10px 16px; }
    .stat-sep { display: none; }
    .stat-pill { flex: 0 0 auto; min-width: 70px; }
  }

  @media (max-width: 600px) {
    .models {
      padding: 12px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
    .hero-title { font-size: 1.5rem; }
    .hero-sub { font-size: 0.76rem; }
    .hero-cta { width: 100%; justify-content: center; min-height: 48px; }
    .stats-ribbon { border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; }
    .stat-val { font-size: 0.88rem; }
    .stat-lbl { font-size: 0.6rem; }
    .featured-card { padding: 18px; border-radius: 14px; margin-bottom: 16px; }
    .featured-name { font-size: 1.2rem; }
    .featured-metric-val { font-size: 1.6rem; }
    .featured-actions { flex-direction: column; width: 100%; }
    .btn-try, .btn-detail { width: 100%; justify-content: center; min-height: 44px; }
    .toolbar { gap: 8px; margin-bottom: 16px; }
    .search-bar { padding: 12px 14px; min-height: 44px; border-radius: 10px; }
    .model-card { border-radius: 12px; }
    .card-main { padding: 12px 14px 8px; }
    .card-actions { padding: 6px 14px 12px; }
    .card-name { font-size: 0.88rem; }
    .metric-value { font-size: 1rem; }
    .model-grid { gap: 12px; }
    .try-body { grid-template-columns: 1fr; }
    .try-inner { padding: 12px 14px; }
    .filter-chips {
      overflow-x: auto; flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      margin: 0 -12px; padding-left: 12px; padding-right: 12px;
      width: auto; border-radius: 10px;
    }
    .filter-chip {
      flex-shrink: 0; padding: 10px 16px; font-size: 0.74rem;
      min-height: 44px; display: inline-flex; align-items: center;
      -webkit-tap-highlight-color: transparent;
    }
  }

  @media (max-width: 400px) {
    .models { padding: 8px; }
    .hero-title { font-size: 1.3rem; }
    .featured-card { padding: 14px; }
    .filter-chip { padding: 8px 12px; font-size: 0.68rem; }
  }

  /* ═══ Reduced motion ═══ */
  @media (prefers-reduced-motion: reduce) {
    .card-wrapper, .hero-header, .toolbar, .empty-state,
    .featured-card, .stats-ribbon, .try-panel { animation: none !important; }
    .empty-icon { animation: none !important; }
    .model-card::before { transition: none; }
    .loading-spinner { animation: none !important; }
  }
</style>
