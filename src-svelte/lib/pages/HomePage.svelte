<script lang="ts">
  /**
   * HomePage — Activity-first dashboard (split from StudioIdle)
   *
   * Standalone landing page at '/'.
   * Actions navigate to Studio or other pages directly.
   *
   * Layout:
   *   1. Header: title + [+ New ▾] dropdown + stats bar
   *   2. Running research hero (conditional)
   *   3. Activity cards: GPU / Models / Earnings (member only)
   *   4. My Models list
   *   5. Quick Start: 4 action tiles
   *   6. Research presets: 4 preset cards
   *   7. 최근 활동: event log
   *   8. Guest view: hero search + 3-step + wallet CTA + public presets
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
  $: runningCount = $dashboardStore.runningCount;
  $: hasRunningResearch = runningCount > 0;
  $: jobPhase = $jobStore.phase;
  $: jobTopic = $jobStore.topic;
  $: jobProgress = $jobStore.progress;

  // ── Stats bar data ──
  $: statsBar = [
    { label: 'JOBS', value: String($dashboardStore.liveJobs?.length ?? 0), color: 'var(--accent, #D97757)' },
    { label: 'MODELS', value: String($dashboardStore.modelsSummary?.count ?? 0), color: '#2980b9' },
    { label: 'NODES', value: String($dashboardStore.networkSummary?.nodes ?? 0), color: 'var(--green, #27864a)' },
    { label: 'TVL', value: $dashboardStore.protocolSummary?.tvl ?? '$0', color: '#d4a017' },
  ];

  // ── Activity cards ──
  $: gpuActive = ($dashboardStore.networkSummary?.activeWorkers ?? 0) > 0;
  $: modelsCount = $dashboardStore.modelsSummary?.count ?? 0;
  $: hasModels = modelsCount > 0;
  $: earningsValue = $dashboardStore.protocolSummary?.tvl ?? '$0';
  $: hasEarnings = isLoggedIn;

  // ── [+ New] dropdown ──
  let newMenuOpen = false;
  function toggleNewMenu() { newMenuOpen = !newMenuOpen; }
  function closeNewMenu() { newMenuOpen = false; }
  function handleWindowClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.new-menu-wrap')) {
      newMenuOpen = false;
    }
  }

  const newMenuItems = [
    { label: '직접 입력', sub: 'AI 추천으로 연구 설계', action: () => { studioStore.startCreate(); router.navigate('studio'); } },
    { label: '프리셋에서 시작', sub: '검증된 연구 템플릿 선택', action: () => scrollToPresets() },
    { label: '고급 설정', sub: 'Ontology 직접 구성', action: () => { studioStore.goToSetup(); router.navigate('studio'); } },
    { label: '기존 연구 Fork', sub: '다른 연구를 복제하여 시작', action: () => { studioStore.goToSetup(); router.navigate('studio'); } },
  ];

  function scrollToPresets() {
    newMenuOpen = false;
    const el = document.querySelector('.presets-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Quick Start actions ──
  interface ActionTile {
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    action: () => void;
  }

  const actionTiles: ActionTile[] = [
    {
      id: 'research',
      icon: '🔬',
      title: 'AI 연구 시작',
      description: '데이터 수집부터 모델 학습까지 자동화된 연구 파이프라인',
      color: 'var(--accent, #D97757)',
      action: () => { studioStore.startCreate(); router.navigate('studio'); },
    },
    {
      id: 'gpu',
      icon: '⚡',
      title: 'GPU 등록',
      description: '내 GPU를 네트워크에 연결하고 컴퓨팅 파워 제공',
      color: 'var(--green, #27864a)',
      action: () => {
        if ($hasGpuNode) {
          router.navigate('network');
        } else {
          showGpuWizard = true;
        }
      },
    },
    {
      id: 'model',
      icon: '📦',
      title: '모델 배포',
      description: '학습 완료된 모델을 마켓플레이스에 등록하고 수익 창출',
      color: '#2980b9',
      action: () => router.navigate('models'),
    },
    {
      id: 'data',
      icon: '📊',
      title: '데이터 기여',
      description: 'PPAP 프로토콜로 데이터를 기여하고 보상 받기',
      color: '#d4a017',
      action: () => router.navigate('protocol'),
    },
  ];

  // ── Research Presets ──
  interface PresetCard {
    id: string;
    presetId: string;
    icon: string;
    title: string;
    description: string;
    difficulty: 'Advanced' | 'Intermediate' | 'Beginner';
    time: string;
    tags: string[];
  }

  const presetCards: PresetCard[] = [
    {
      id: 'crypto_market',
      presetId: 'crypto_market',
      icon: '⚡',
      title: '암호화폐 시장 예측',
      description: '온체인 + 시장 데이터 + 감성 지표로 단기 가격 방향 예측',
      difficulty: 'Advanced',
      time: '~2h',
      tags: ['XGBoost', 'Ensemble', 'Optuna'],
    },
    {
      id: 'defi_risk',
      presetId: 'defi_risk',
      icon: '≡',
      title: 'DeFi 리스크 분류',
      description: 'TVL 변동, 감사 이력, 토큰 이코노믹스로 프로토콜 위험도 분류',
      difficulty: 'Intermediate',
      time: '~1h',
      tags: ['Stacking', 'Classification'],
    },
    {
      id: 'fraud_detection',
      presetId: 'fraud_detection',
      icon: '🔍',
      title: '이상거래 탐지',
      description: '거래 패턴, 네트워크 분석, 행동 피처로 사기 거래 식별',
      difficulty: 'Intermediate',
      time: '~1h',
      tags: ['CatBoost', 'SMOTE', 'F1'],
    },
    {
      id: 'time_series',
      presetId: 'time_series',
      icon: '📈',
      title: '시계열 예측',
      description: '추세 분해, 계절성 분석, 외부 변수 결합한 범용 시계열 모델',
      difficulty: 'Beginner',
      time: '~30m',
      tags: ['LightGBM', 'Kalman', 'RMSE'],
    },
  ];

  const difficultyColors: Record<string, string> = {
    Advanced: '#D97757',
    Intermediate: '#d4a017',
    Beginner: '#27864a',
  };

  function selectPreset(card: PresetCard) {
    studioStore.startCreate(card.title);
    studioStore.setPreset(card.presetId);
    studioStore.goToStep2(card.title);
    router.navigate('studio');
  }

  // ── GPU Onboard Wizard ──
  let showGpuWizard = false;

  // ── My Models ──
  $: myModels = $modelPublishStore.slice(0, 3);
  $: hasMyModels = myModels.length > 0;

  // ── Event log ──
  $: recentEvents = ($dashboardStore.events ?? []).slice(0, 8);

  const TYPE_COLORS: Record<string, string> = {
    SYS: 'var(--accent, #D97757)',
    NET: 'var(--blue, #2980b9)',
    JOB: 'var(--green, #27864a)',
    EXP: 'var(--gold, #d4a017)',
    WARN: 'var(--red, #c0392b)',
  };

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Navigation helpers ──
  function goToRunning() {
    studioStore.startRunning();
    router.navigate('studio');
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="home-page">
  {#if isLoggedIn}
  <!-- ═══ MEMBER VIEW ═══ -->
  <div class="idle-header">
    <div class="header-top">
      <div class="header-title-area">
        <h1 class="idle-title">Magnet Studio</h1>
        <p class="idle-subtitle">BitNet + Nemotron + AutoResearch — 분산 AI 학습 네트워크</p>
      </div>
      <div class="new-menu-wrap">
        <button class="new-btn" on:click|stopPropagation={toggleNewMenu}>
          <span class="new-plus">+</span> New
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if newMenuOpen}
          <div class="new-dropdown" on:click|stopPropagation>
            {#each newMenuItems as item}
              <button class="new-dropdown-item" on:click={() => { item.action(); closeNewMenu(); }}>
                <span class="ndi-label">{item.label}</span>
                <span class="ndi-sub">{item.sub}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="stats-bar">
      {#each statsBar as stat, i}
        {#if i > 0}<span class="stats-sep">·</span>{/if}
        <span class="stats-chip">
          <span class="stats-val" style:color={stat.color}>{stat.value}</span>
          <span class="stats-label">{stat.label}</span>
        </span>
      {/each}
    </div>
  </div>

  <div class="idle-body">
    <!-- Running Research Hero -->
    {#if hasRunningResearch && jobPhase === 'running'}
      <button class="hero-running" on:click={goToRunning}>
        <div class="hero-status">
          <span class="hero-dot pulse"></span>
          <span class="hero-badge">LIVE</span>
        </div>
        <div class="hero-topic">{jobTopic || 'Research'}</div>
        <div class="hero-progress-bar"><div class="hero-progress-fill" style="width: {jobProgress}%"></div></div>
        <div class="hero-meta">
          <span>{jobProgress}%</span>
          <span class="hero-sep">·</span>
          <span>ETA calculating...</span>
        </div>
        <span class="hero-cta">열기 →</span>
      </button>
    {/if}

    <!-- Activity Cards -->
    {#if isLoggedIn && (gpuActive || hasModels || hasEarnings)}
      <div class="activity-cards">
        {#if gpuActive}
          <button class="ac-card" on:click={() => router.navigate('network')}>
            <span class="ac-icon" style:color="var(--green, #27864a)">⚡</span>
            <div class="ac-body">
              <span class="ac-title">GPU</span>
              <span class="ac-value">ON · {$dashboardStore.networkSummary?.activeWorkers ?? 0} active</span>
            </div>
          </button>
        {/if}
        {#if hasModels}
          <button class="ac-card" on:click={() => router.navigate('models')}>
            <span class="ac-icon" style:color="#2980b9">📦</span>
            <div class="ac-body">
              <span class="ac-title">모델 {modelsCount}</span>
              <span class="ac-value">{$dashboardStore.modelsSummary?.models?.length ?? 0} active</span>
            </div>
          </button>
        {/if}
        {#if hasEarnings}
          <button class="ac-card" on:click={() => router.navigate('protocol')}>
            <span class="ac-icon" style:color="#d4a017">💰</span>
            <div class="ac-body">
              <span class="ac-title">수익</span>
              <span class="ac-value">{earningsValue} TVL</span>
            </div>
          </button>
        {/if}
      </div>
    {/if}

    <!-- My Models -->
    {#if hasMyModels}
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">내 모델</h2>
          <button class="custom-setup-link" on:click={() => router.navigate('models')}>
            모델 전체 보기 <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="my-models-list">
          {#each myModels as model (model.id)}
            <button class="mm-row" on:click={() => router.navigate('models')}>
              <span class="mm-state" class:mm-active={model.state === 'NETWORK_ACTIVE'} class:mm-draft={model.state === 'DRAFT'}>
                {model.state === 'NETWORK_ACTIVE' ? '●' : '○'}
              </span>
              <span class="mm-name">{model.name}</span>
              <span class="mm-stat">{model.state === 'NETWORK_ACTIVE' ? 'ACTIVE' : model.state}</span>
              {#if model.usage && model.usage.totalCalls > 0}
                <span class="mm-calls">{model.usage.totalCalls.toLocaleString()} calls</span>
              {/if}
              {#if model.poolA && model.poolA.creator > 0}
                <span class="mm-earn">+{model.poolA.creator.toFixed(1)}H</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick Start Actions -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">시작하기</h2>
        <span class="section-sub">연구, GPU, 모델 배포, 데이터 기여</span>
      </div>
      <div class="action-grid">
        {#each actionTiles as tile (tile.id)}
          <button class="action-tile" on:click={tile.action}>
            <span class="at-icon" style:background="color-mix(in srgb, {tile.color} 10%, transparent)">{tile.icon}</span>
            <div class="at-text">
              <span class="at-title">{tile.title}</span>
              <span class="at-desc">{tile.description}</span>
            </div>
            <svg class="at-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {/each}
      </div>
    </div>

    <!-- Research Presets -->
    <div class="section presets-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">연구 프리셋</h2>
          <span class="section-sub">검증된 AI 연구 템플릿으로 빠르게 시작</span>
        </div>
        <button class="custom-setup-link" on:click={() => { studioStore.goToSetup(); router.navigate('studio'); }}>
          Custom setup <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="presets-grid">
        {#each presetCards as card (card.id)}
          <button class="preset-card" on:click={() => selectPreset(card)}>
            <div class="pc-top">
              <span class="pc-icon">{card.icon}</span>
              <span class="pc-diff" style:color={difficultyColors[card.difficulty]}>
                <span class="pc-diff-dot" style:background={difficultyColors[card.difficulty]}></span>
                {card.difficulty}
              </span>
            </div>
            <h3 class="pc-title">{card.title}</h3>
            <p class="pc-desc">{card.description}</p>
            <div class="pc-bottom">
              <span class="pc-time">{card.time}</span>
              <div class="pc-tags">
                {#each card.tags as tag}
                  <span class="pc-tag">{tag}</span>
                {/each}
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="section">
      <h2 class="section-title">최근 활동</h2>
      <div class="event-log">
        {#each recentEvents as ev (ev.id)}
          <div class="ev-row">
            <span class="ev-time">{fmtTime(ev.timestamp)}</span>
            <span class="ev-type" style:color={TYPE_COLORS[ev.type] || 'var(--text-muted)'}
                  style:background="color-mix(in srgb, {TYPE_COLORS[ev.type] || 'gray'} 10%, transparent)">
              {ev.type}
            </span>
            <span class="ev-msg">{ev.message}</span>
          </div>
        {/each}
        {#if recentEvents.length === 0}
          <div class="ev-empty">
            <PixelIcon type="sparkle" size={18} />
            <span>활동이 시작되면 여기에 표시됩니다</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {:else}
  <!-- ═══ GUEST VIEW ═══ -->
  <div class="guest-view">
    <div class="guest-hero">
      <h1 class="guest-title">무엇을 연구하고 싶으세요?</h1>
      <p class="guest-subtitle">AI가 자동으로 데이터 수집, 모델 학습, 최적화를 수행합니다</p>
      <div class="guest-search">
        <input
          class="guest-search-input"
          type="text"
          placeholder="예: 암호화폐 시장 예측, DeFi 리스크 분류..."
          bind:value={guestSearchTopic}
          on:keydown={handleGuestKeydown}
        />
        <button class="guest-search-btn" on:click={handleGuestSearch}>
          시작하기 →
        </button>
      </div>
    </div>

    <div class="guest-steps">
      <div class="step-card">
        <span class="step-num">1</span>
        <h3 class="step-title">토픽 입력</h3>
        <p class="step-desc">연구하고 싶은 주제를 입력하면 AI가 최적의 연구 설계를 제안합니다</p>
      </div>
      <div class="step-card">
        <span class="step-num">2</span>
        <h3 class="step-title">AI가 자동 탐색</h3>
        <p class="step-desc">분산 GPU 네트워크에서 자동으로 데이터 수집과 모델 학습이 진행됩니다</p>
      </div>
      <div class="step-card">
        <span class="step-num">3</span>
        <h3 class="step-title">모델 완성</h3>
        <p class="step-desc">최적화된 모델을 배포하고 API 엔드포인트로 수익을 창출하세요</p>
      </div>
    </div>

    <div class="guest-wallet">
      <h2 class="gw-title">지갑을 연결하고 시작하세요</h2>
      <p class="gw-desc">연구 실행, 모델 배포, GPU 기여에는 지갑 연결이 필요합니다</p>
      <div class="gw-buttons">
        {#each wallets as w}
          <button class="gw-btn" on:click={() => wallet.connect(w.name)}>
            <span class="gw-icon">{w.icon}</span>
            <span class="gw-name">{w.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div>
          <h2 class="section-title">공개 연구</h2>
          <span class="section-sub">커뮤니티에서 진행 중인 연구를 살펴보세요</span>
        </div>
      </div>
      <div class="presets-grid">
        {#each presetCards as card (card.id)}
          <button class="preset-card" on:click={() => selectPreset(card)}>
            <div class="pc-top">
              <span class="pc-icon">{card.icon}</span>
              <span class="pc-diff" style:color={difficultyColors[card.difficulty]}>
                <span class="pc-diff-dot" style:background={difficultyColors[card.difficulty]}></span>
                {card.difficulty}
              </span>
            </div>
            <h3 class="pc-title">{card.title}</h3>
            <p class="pc-desc">{card.description}</p>
            <div class="pc-bottom">
              <span class="pc-time">{card.time}</span>
              <div class="pc-tags">
                {#each card.tags as tag}
                  <span class="pc-tag">{tag}</span>
                {/each}
              </div>
            </div>
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
  .home-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding-bottom: 80px;
  }

  /* ═══ HEADER ═══ */
  .idle-header {
    padding: 24px 32px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .header-title-area {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .idle-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
  }
  .idle-subtitle {
    font-size: 0.7rem;
    color: var(--text-muted, #9a9590);
    margin: 0;
  }

  /* ── [+ New] dropdown ── */
  .new-menu-wrap { position: relative; flex-shrink: 0; }
  .new-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: 10px;
    padding: 7px 14px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 140ms;
    white-space: nowrap;
  }
  .new-btn:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.1);
  }
  .new-plus {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--accent, #D97757);
    line-height: 1;
  }
  .new-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 240px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.97));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    z-index: 100;
    animation: ddIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes ddIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  .new-dropdown-item {
    appearance: none;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
    transition: background 100ms;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .new-dropdown-item:last-child { border-bottom: none; }
  .new-dropdown-item:hover { background: rgba(0, 0, 0, 0.03); }
  .ndi-label { font-size: 0.78rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .ndi-sub { font-size: 0.6rem; color: var(--text-muted, #9a9590); }

  /* ── Stats Bar ── */
  .stats-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .stats-chip { display: inline-flex; align-items: baseline; gap: 3px; }
  .stats-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.82rem; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .stats-label {
    font-family: var(--font-mono); font-size: 0.5rem; font-weight: 600;
    color: var(--text-muted, #9a9590); text-transform: uppercase; letter-spacing: 0.06em;
  }
  .stats-sep { color: var(--border, #E5E0DA); font-weight: 700; font-size: 0.7rem; }

  /* ═══ BODY ═══ */
  .idle-body {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
    gap: 24px; padding: 20px 32px 32px;
  }

  /* ═══ HERO RUNNING ═══ */
  .hero-running {
    appearance: none; border: 1.5px solid var(--accent, #D97757);
    background: var(--surface, #fff); border-radius: 14px; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 8px; cursor: pointer;
    transition: all 200ms; text-align: left; width: 100%;
  }
  .hero-running:hover { box-shadow: 0 4px 16px rgba(217, 119, 87, 0.12); transform: translateY(-1px); }
  .hero-status { display: flex; align-items: center; gap: 6px; }
  .hero-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #D97757); }
  .hero-dot.pulse { animation: dotPulse 1.5s ease-in-out infinite; }
  @keyframes dotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .hero-badge {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 700;
    color: #fff; background: var(--accent, #D97757); padding: 1px 6px;
    border-radius: 4px; letter-spacing: 0.08em;
  }
  .hero-topic { font-size: 1.05rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .hero-progress-bar { width: 100%; height: 4px; border-radius: 2px; background: var(--border-subtle, #EDEAE5); overflow: hidden; }
  .hero-progress-fill { height: 100%; border-radius: 2px; background: var(--accent, #D97757); transition: width 300ms ease; }
  .hero-meta {
    display: flex; gap: 4px; align-items: center;
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-muted, #9a9590); font-variant-numeric: tabular-nums;
  }
  .hero-sep { color: var(--border, #E5E0DA); }
  .hero-cta { font-size: 0.72rem; font-weight: 600; color: var(--accent, #D97757); align-self: flex-end; }

  /* ═══ ACTIVITY CARDS ═══ */
  .activity-cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .ac-card {
    appearance: none; border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff); border-radius: 12px; padding: 12px 16px;
    display: flex; align-items: center; gap: 10px; cursor: pointer;
    transition: all 150ms; flex: 1; min-width: 140px;
  }
  .ac-card:hover { border-color: rgba(0, 0, 0, 0.12); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06); transform: translateY(-1px); }
  .ac-icon { font-size: 1.2rem; flex-shrink: 0; }
  .ac-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .ac-title { font-size: 0.78rem; font-weight: 700; color: var(--text-primary, #2D2D2D); white-space: nowrap; }
  .ac-value { font-family: var(--font-mono); font-size: 0.6rem; color: var(--text-muted, #9a9590); font-variant-numeric: tabular-nums; }

  /* ═══ SECTIONS ═══ */
  .section { display: flex; flex-direction: column; gap: 12px; }
  .section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .section-title { font-size: 1rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0; }
  .section-sub { font-size: 0.68rem; color: var(--text-muted, #9a9590); margin: 0; }
  .custom-setup-link {
    appearance: none; border: none; background: transparent; font-size: 0.68rem;
    font-weight: 600; color: var(--text-secondary, #6b6560); cursor: pointer;
    display: flex; align-items: center; gap: 2px; padding: 4px 0;
    transition: color 140ms; white-space: nowrap; flex-shrink: 0;
  }
  .custom-setup-link:hover { color: var(--accent, #D97757); }

  /* ═══ MY MODELS ═══ */
  .my-models-list {
    display: flex; flex-direction: column; background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5); border-radius: 12px; overflow: hidden;
  }
  .mm-row {
    appearance: none; border: none; background: transparent;
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    cursor: pointer; transition: background 100ms; text-align: left; width: 100%; font-size: 0.72rem;
  }
  .mm-row:last-child { border-bottom: none; }
  .mm-row:hover { background: rgba(0, 0, 0, 0.01); }
  .mm-state { font-size: 10px; flex-shrink: 0; }
  .mm-active { color: var(--green, #27864a); }
  .mm-draft { color: var(--text-muted, #9a9590); }
  .mm-name { font-weight: 600; color: var(--text-primary, #2D2D2D); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm-stat { font-family: var(--font-mono); font-size: 0.52rem; font-weight: 600; color: var(--text-muted, #9a9590); padding: 1px 6px; border-radius: 4px; background: rgba(0,0,0,0.03); }
  .mm-calls { font-family: var(--font-mono); font-size: 0.58rem; color: var(--text-secondary, #6b6560); }
  .mm-earn { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; color: var(--green, #27864a); }

  /* ═══ ACTION TILES ═══ */
  .action-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .action-tile {
    appearance: none; border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff); border-radius: 12px; padding: 14px 16px;
    display: flex; align-items: center; gap: 12px; cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1); text-align: left;
  }
  .action-tile:hover { border-color: var(--accent, #D97757); box-shadow: 0 3px 14px rgba(217, 119, 87, 0.08); transform: translateY(-1px); }
  .at-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
  .at-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .at-title { font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .at-desc { font-size: 0.6rem; color: var(--text-muted, #9a9590); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .at-arrow { flex-shrink: 0; color: var(--text-muted, #9a9590); opacity: 0; transition: opacity 140ms, transform 140ms; }
  .action-tile:hover .at-arrow { opacity: 1; transform: translateX(2px); }

  /* ═══ RESEARCH PRESETS ═══ */
  .presets-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .preset-card {
    appearance: none; border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff); border-radius: 14px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 8px; text-align: left;
    cursor: pointer; transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); min-height: 140px;
  }
  .preset-card:hover { border-color: var(--accent, #D97757); box-shadow: 0 4px 18px rgba(217, 119, 87, 0.08); transform: translateY(-2px); }
  .pc-top { display: flex; align-items: center; justify-content: space-between; }
  .pc-icon { font-size: 1.3rem; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: var(--bg-warm, #FAF9F7); border-radius: 9px; }
  .pc-diff { font-size: 0.56rem; font-weight: 600; display: flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 6px; background: rgba(0, 0, 0, 0.02); }
  .pc-diff-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .pc-title { font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0; line-height: 1.3; }
  .pc-desc { font-size: 0.64rem; color: var(--text-secondary, #6b6560); margin: 0; line-height: 1.5; flex: 1; }
  .pc-bottom { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; }
  .pc-time { font-family: var(--font-mono); font-size: 0.56rem; font-weight: 500; color: var(--text-muted, #9a9590); }
  .pc-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
  .pc-tag { font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500; color: var(--text-muted, #9a9590); background: var(--bg-warm, #FAF9F7); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle, #EDEAE5); }

  /* ═══ EVENT LOG ═══ */
  .event-log { background: var(--surface, #fff); border: 1px solid var(--border-subtle, #EDEAE5); border-radius: 12px; overflow: hidden; }
  .ev-row { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border-subtle, #EDEAE5); transition: background 100ms; }
  .ev-row:last-child { border-bottom: none; }
  .ev-row:hover { background: rgba(0, 0, 0, 0.01); }
  .ev-time { font-family: var(--font-mono); font-size: 0.52rem; font-weight: 500; color: var(--text-muted, #9a9590); white-space: nowrap; flex-shrink: 0; }
  .ev-type { font-family: var(--font-mono); font-size: 0.46rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; flex-shrink: 0; text-align: center; min-width: 28px; }
  .ev-msg { font-family: var(--font-mono); font-size: 0.56rem; color: var(--text-primary, #2C2824); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ev-empty { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 24px; color: var(--text-muted, #9a9590); font-size: 0.68rem; }

  /* ═══ GUEST VIEW ═══ */
  .guest-view { flex: 1; display: flex; flex-direction: column; gap: 32px; padding: 40px 32px 80px; overflow-y: auto; }
  .guest-hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0 16px; }
  .guest-title { font-family: var(--font-display, 'Playfair Display', serif); font-size: 2rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0; line-height: 1.3; }
  .guest-subtitle { font-size: 0.82rem; color: var(--text-secondary, #6b6560); margin: 0; max-width: 420px; }
  .guest-search { display: flex; gap: 0; margin-top: 8px; width: 100%; max-width: 520px; border: 1.5px solid var(--border, #E5E0DA); border-radius: 14px; overflow: hidden; transition: border-color 200ms, box-shadow 200ms; }
  .guest-search:focus-within { border-color: var(--accent, #D97757); box-shadow: 0 4px 20px rgba(217, 119, 87, 0.1); }
  .guest-search-input { flex: 1; appearance: none; border: none; outline: none; padding: 14px 18px; font-size: 0.82rem; background: var(--surface, #fff); color: var(--text-primary, #2D2D2D); font-family: inherit; }
  .guest-search-input::placeholder { color: var(--text-muted, #9a9590); }
  .guest-search-btn { appearance: none; border: none; background: var(--accent, #D97757); color: #fff; font-size: 0.78rem; font-weight: 700; padding: 14px 24px; cursor: pointer; white-space: nowrap; transition: background 150ms; }
  .guest-search-btn:hover { background: color-mix(in srgb, var(--accent, #D97757) 88%, black); }

  .guest-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .step-card { background: var(--surface, #fff); border: 1px solid var(--border-subtle, #EDEAE5); border-radius: 14px; padding: 20px 18px; display: flex; flex-direction: column; gap: 8px; text-align: center; transition: all 200ms; }
  .step-card:hover { border-color: rgba(0, 0, 0, 0.08); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); }
  .step-num { width: 32px; height: 32px; border-radius: 50%; background: color-mix(in srgb, var(--accent, #D97757) 10%, transparent); color: var(--accent, #D97757); font-family: var(--font-mono, monospace); font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  .step-title { font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0; }
  .step-desc { font-size: 0.68rem; color: var(--text-secondary, #6b6560); margin: 0; line-height: 1.5; }

  .guest-wallet { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 24px; background: var(--surface, #fff); border: 1.5px solid var(--border, #E5E0DA); border-radius: 16px; }
  .gw-title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary, #2D2D2D); margin: 0; }
  .gw-desc { font-size: 0.72rem; color: var(--text-secondary, #6b6560); margin: 0; max-width: 380px; }
  .gw-buttons { display: flex; gap: 10px; margin-top: 4px; }
  .gw-btn { appearance: none; border: 1px solid var(--border, #E5E0DA); background: var(--bg-warm, #FAF9F7); border-radius: 12px; padding: 12px 24px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.78rem; font-weight: 600; color: var(--text-primary, #2D2D2D); transition: all 180ms; }
  .gw-btn:hover { border-color: var(--accent, #D97757); box-shadow: 0 3px 12px rgba(217, 119, 87, 0.1); transform: translateY(-1px); }
  .gw-icon { font-size: 1.2rem; }
  .gw-name { white-space: nowrap; }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 640px) {
    .idle-header { padding: 16px 16px 0; }
    .header-top { flex-direction: column; gap: 10px; }
    .new-menu-wrap { align-self: flex-start; }
    .idle-title { font-size: 1.3rem; }
    .idle-body { padding: 16px 16px 24px; gap: 20px; }
    .action-grid { grid-template-columns: 1fr; }
    .presets-grid { grid-template-columns: 1fr; }
    .activity-cards { flex-direction: column; }
    .ac-card { min-width: auto; }
    .preset-card { min-height: 120px; }
    .stats-bar { gap: 4px; }
    .stats-val { font-size: 0.72rem; }
    .new-dropdown { right: auto; left: 0; }
    .guest-view { padding: 24px 16px 60px; gap: 24px; }
    .guest-title { font-size: 1.5rem; }
    .guest-steps { grid-template-columns: 1fr; }
    .gw-buttons { flex-direction: column; width: 100%; max-width: 260px; }
    .gw-btn { justify-content: center; }
  }
  @media (max-width: 420px) {
    .idle-header { padding: 12px 12px 0; }
    .idle-body { padding: 12px 12px 20px; }
  }
</style>
