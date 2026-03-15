<script lang="ts">
  import { router } from "../stores/router.ts";
  import { fmtNumber } from "../utils/format.ts";

  let searchQuery = "";
  let debouncedQuery = "";
  let activeFilter = "all";
  let _searchTimer: ReturnType<typeof setTimeout> | undefined;

  function onSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => { debouncedQuery = searchQuery; }, 120);
  }

  const filters = [
    { id: "all", label: "All Models" },
    { id: "prediction", label: "Prediction" },
    { id: "classification", label: "Classification" },
    { id: "timeseries", label: "Time Series" },
    { id: "nlp", label: "NLP" },
    { id: "anomaly", label: "Anomaly Detection" },
  ];

  // Demo model data — richer
  const models = [
    {
      id: "model-um69vho1",
      name: "Crypto Market 24h Prediction",
      slug: "hoot/crypto-market-24h",
      topic: "Ethereum price prediction",
      type: "Transformer",
      framework: "PyTorch",
      category: "prediction",
      metric: "val_bpb",
      metricValue: 1.231,
      metricLabel: "1.231 bpb",
      experiments: 147,
      kept: 48,
      rows: 479,
      features: 18,
      downloads: 1243,
      likes: 38,
      updated: "2 days ago",
      date: "2026-03-12",
      tags: ["crypto", "price-prediction", "transformer"],
      status: "published",
    },
    {
      id: "model-xk82qp3",
      name: "DeFi Risk Classifier",
      slug: "hoot/defi-risk-v2",
      topic: "DeFi protocol risk analysis",
      type: "XGBoost",
      framework: "Scikit-learn",
      category: "classification",
      metric: "bal_acc",
      metricValue: 0.847,
      metricLabel: "84.7% acc",
      experiments: 92,
      kept: 31,
      rows: 2140,
      features: 42,
      downloads: 876,
      likes: 24,
      updated: "5 days ago",
      date: "2026-03-09",
      tags: ["defi", "risk", "classification"],
      status: "published",
    },
    {
      id: "model-jn47ws9",
      name: "Token Sentiment Analyzer",
      slug: "hoot/token-sentiment",
      topic: "Social sentiment for crypto tokens",
      type: "BERT-tiny",
      framework: "Transformers",
      category: "nlp",
      metric: "f1",
      metricValue: 0.912,
      metricLabel: "91.2% F1",
      experiments: 203,
      kept: 67,
      rows: 15200,
      features: 1,
      downloads: 3420,
      likes: 91,
      updated: "1 day ago",
      date: "2026-03-13",
      tags: ["sentiment", "nlp", "social"],
      status: "published",
    },
    {
      id: "model-ab12cd3",
      name: "MEV Detection Engine",
      slug: "hoot/mev-detector",
      topic: "Maximal extractable value detection",
      type: "LightGBM",
      framework: "LightGBM",
      category: "anomaly",
      metric: "auc_roc",
      metricValue: 0.968,
      metricLabel: "96.8% AUC",
      experiments: 58,
      kept: 19,
      rows: 890,
      features: 24,
      downloads: 412,
      likes: 15,
      updated: "1 week ago",
      date: "2026-03-07",
      tags: ["mev", "detection", "anomaly"],
      status: "published",
    },
    {
      id: "model-ef45gh6",
      name: "Gas Fee Forecaster",
      slug: "hoot/gas-forecast",
      topic: "Ethereum gas fee prediction",
      type: "LSTM",
      framework: "PyTorch",
      category: "timeseries",
      metric: "mae",
      metricValue: 2.31,
      metricLabel: "2.31 MAE",
      experiments: 120,
      kept: 41,
      rows: 52000,
      features: 8,
      downloads: 2180,
      likes: 56,
      updated: "3 days ago",
      date: "2026-03-11",
      tags: ["gas", "forecasting", "time-series"],
      status: "published",
    },
    {
      id: "model-ij78kl9",
      name: "Whale Wallet Tracker",
      slug: "hoot/whale-tracker",
      topic: "Large wallet movement classification",
      type: "Random Forest",
      framework: "Scikit-learn",
      category: "classification",
      metric: "precision",
      metricValue: 0.923,
      metricLabel: "92.3% prec",
      experiments: 76,
      kept: 25,
      rows: 3400,
      features: 31,
      downloads: 645,
      likes: 22,
      updated: "4 days ago",
      date: "2026-03-10",
      tags: ["whale", "wallet", "tracking"],
      status: "published",
    },
  ];

  // Pre-compute lowercase strings to avoid repeated .toLowerCase() on each filter pass
  const modelsIndexed = models.map(m => ({
    ...m,
    _nameLower: m.name.toLowerCase(),
    _topicLower: m.topic.toLowerCase(),
  }));

  $: filteredModels = modelsIndexed.filter(m => {
    const q = debouncedQuery.toLowerCase();
    const matchSearch = !q || m._nameLower.includes(q) || m._topicLower.includes(q);
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
    <button class="header-cta" on:click={() => router.navigate('research')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      New Research
    </button>
  </div>

  <!-- Search + Filters -->
  <div class="toolbar">
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

  <!-- Model Grid -->
  <div class="model-grid">
    {#each filteredModels as model, i (model.id)}
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
          <span class="card-framework">{model.framework}</span>
        </div>

        <!-- Name + Slug -->
        <h3 class="card-name">{model.name}</h3>
        <span class="card-slug">{model.slug}</span>

        <!-- Metric Highlight -->
        <div class="card-metric">
          <span class="metric-value">{model.metricLabel}</span>
          <span class="metric-label">{model.metric}</span>
        </div>

        <!-- Tags -->
        <div class="card-tags">
          <span class="tag type">{model.type}</span>
          {#each model.tags.slice(0, 2) as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>

        <!-- Footer Stats -->
        <div class="card-footer">
          <div class="card-stats">
            <span class="card-stat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              {fmtNumber(model.downloads)}
            </span>
            <span class="card-stat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {model.likes}
            </span>
          </div>
          <span class="card-date">{model.updated}</span>
        </div>

        <!-- Training badge -->
        <div class="card-training">
          <span class="training-info">{model.experiments} experiments &middot; {model.kept} kept</span>
        </div>
      </button>
    {/each}
  </div>

  <!-- Empty State -->
  {#if filteredModels.length === 0}
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
    .models { padding: var(--space-3, 12px); }
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
    .header-cta { width: 100%; justify-content: center; margin-top: 4px; }
    .toolbar {
      gap: var(--space-2, 10px);
      margin-bottom: var(--space-4, 16px);
    }
    .search-bar {
      padding: 9px 12px;
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
    .filter-chip { flex-shrink: 0; padding: 5px 12px; font-size: 0.72rem; }
  }

  @media (max-width: 400px) {
    .models { padding: var(--space-2, 8px); }
    .page-title { font-size: 1.15rem; }
    .card-tags { display: none; }
  }

  /* C-1: prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .model-card, .page-header, .toolbar, .empty-state { animation: none !important; }
    .empty-icon { animation: none !important; }
    .model-card::before { transition: none; }
  }
</style>
