<script lang="ts">
  /**
   * StudioDashboard — Card-based studio landing view.
   *
   * Pattern: Each section = glass card showing "what you can do" + stats + actions.
   *
   * Sections:
   *   1. Page header (title + subtitle)
   *   2. Hero CTA card — Start a new research
   *   3. Active Research card — running job summary + actions (conditional)
   *   4. My Models card — published models + actions (conditional)
   *   5. Quick Start pills — 3-col compact grid
   *   6. Stats footer — subtle centered text
   *
   * Events:
   *   newResearch: void
   *   quickStart: { typeId: ResearchTypeId }
   *   resumeJob: void
   *   openModel: { modelId: string }
   *   viewModels: void
   */
  import { createEventDispatcher } from 'svelte';
  import { jobStore, completedCount } from '../../stores/jobStore.ts';
  import { modelPublishStore } from '../../stores/modelPublishStore.ts';
  import { allSessions, activeSessionId, type JobSession } from '../../stores/jobSessionStore.ts';
  import { RESEARCH_TYPES, type ResearchTypeId } from '../../data/researchTypes.ts';
  import PixelIcon from '../PixelIcon.svelte';

  const dispatch = createEventDispatcher<{
    newResearch: void;
    quickStart: { typeId: ResearchTypeId };
    resumeJob: void;
    switchSession: { sessionId: string };
    openModel: { modelId: string };
    viewModels: void;
  }>();

  // ── Reactive data ──
  $: job = $jobStore;
  $: isRunning = job.phase === 'running' || job.phase === 'setup';
  $: isComplete = job.phase === 'complete';
  $: publishedModels = $modelPublishStore;
  $: hasActiveJob = isRunning || isComplete;
  $: jobProgress = job.progress ?? 0;
  $: sessions = $allSessions;
  $: currentSessionId = $activeSessionId;
  $: hasMultipleSessions = sessions.length > 1 || (sessions.length === 1 && !hasActiveJob);
</script>

<div class="dashboard">
  <!-- Page Header -->
  <div class="dash-header">
    <h1 class="dash-title">Magnet Studio</h1>
    <p class="dash-sub">Train and deploy AI models</p>
  </div>

  <!-- Hero CTA Card -->
  <button class="hero-card" on:click={() => dispatch('newResearch')}>
    <div class="hero-icon">
      <PixelIcon type="research" size={22} />
    </div>
    <div class="hero-body">
      <span class="hero-title">Start a new research</span>
      <span class="hero-desc">Build LLMs, classifiers, fine-tune models</span>
    </div>
    <div class="hero-action">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
      <span>New Research</span>
    </div>
  </button>

  <!-- Active Research Cards (multi-session support) -->
  {#if sessions.length > 0}
    <div class="section-card">
      <div class="sc-header">
        <span class="sc-title">My Researches</span>
        <span class="sc-count">{sessions.filter(s => s.phase === 'running' || s.phase === 'setup').length} active</span>
      </div>
      <div class="sessions-list">
        {#each sessions as sess (sess.id)}
          <button
            class="session-row"
            class:session-active={sess.id === currentSessionId}
            on:click={() => {
              if (sess.id === currentSessionId) {
                dispatch('resumeJob');
              } else {
                dispatch('switchSession', { sessionId: sess.id });
              }
            }}
          >
            <span class="sr-status" class:running={sess.phase === 'running' || sess.phase === 'setup'} class:done={sess.phase === 'complete'}></span>
            <div class="sr-body">
              <span class="sr-topic">{sess.topic || 'Untitled'}</span>
              <div class="sr-meta">
                {#if sess.phase === 'complete'}
                  <span class="sr-stat sr-done">Complete</span>
                {:else}
                  <span class="sr-stat">{sess.progress}%</span>
                {/if}
                {#if sess.bestMetric < Infinity}
                  <span class="sr-sep"></span>
                  <span class="sr-stat">{sess.bestMetric.toFixed(3)}</span>
                {/if}
                <span class="sr-sep"></span>
                <span class="sr-stat">{sess.completedExperiments}/{sess.totalExperiments} exp</span>
              </div>
            </div>
            {#if sess.phase === 'running' || sess.phase === 'setup'}
              <div class="sr-progress"><div class="sr-bar" style:width="{sess.progress}%"></div></div>
            {/if}
            <span class="sr-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
        {/each}
      </div>
    </div>
  {:else if hasActiveJob}
    <!-- Fallback: single active job (no session store) -->
    <div class="section-card active-card">
      <div class="sc-header">
        <span class="sc-status" class:running={isRunning} class:done={isComplete}></span>
        <span class="sc-title">Research in progress</span>
      </div>
      <div class="sc-body">
        <span class="sc-topic">{job.topic || 'Untitled Research'}</span>
        <div class="sc-stats">
          {#if isRunning}
            <span class="sc-stat">{jobProgress}% complete</span>
          {:else}
            <span class="sc-stat sc-done">Complete</span>
            {#if job.bestMetric < Infinity}
              <span class="sc-stat-sep"></span>
              <span class="sc-stat">{job.bestMetric.toFixed(4)}</span>
            {/if}
          {/if}
        </div>
        {#if isRunning}
          <div class="sc-progress"><div class="sc-bar" style:width="{jobProgress}%"></div></div>
        {/if}
      </div>
      <div class="sc-actions">
        <button class="sc-btn sc-btn-primary" on:click={() => dispatch('resumeJob')}>
          {isRunning ? 'View Progress' : 'View Results'}
        </button>
      </div>
    </div>
  {/if}

  <!-- My Models Card (conditional) -->
  {#if publishedModels.length > 0}
    <div class="section-card">
      <div class="sc-header">
        <span class="sc-title">My Models</span>
        <span class="sc-count">{publishedModels.length} published</span>
      </div>
      <div class="models-grid">
        {#each publishedModels.slice(0, 4) as model (model.id)}
          <button class="model-chip" on:click={() => dispatch('openModel', { modelId: model.id })}>
            <PixelIcon type="portfolio" size={12} />
            <span class="mchip-name">{model.name}</span>
            <span class="mchip-state" class:active={model.state === 'NETWORK_ACTIVE'}>
              {model.state === 'NETWORK_ACTIVE' ? 'Live' : 'Paused'}
            </span>
          </button>
        {/each}
      </div>
      <div class="sc-actions">
        <button class="sc-btn" on:click={() => dispatch('viewModels')}>View All Models</button>
      </div>
    </div>
  {/if}

  <!-- Quick Start -->
  <div class="qs-section">
    <span class="qs-label">Quick Start</span>
    <div class="qs-grid">
      {#each RESEARCH_TYPES as t (t.id)}
        <button
          class="qs-pill"
          on:click={() => dispatch('quickStart', { typeId: t.id })}
          style:--qs-accent={t.accentColor}
        >
          <span class="qs-icon">
            <PixelIcon type={t.pixelIcon} size={14} />
          </span>
          <span class="qs-name">{t.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Stats Footer -->
  <div class="stats-footer">
    <span>{isRunning ? '1' : '0'} Active</span>
    <span class="sf-dot"></span>
    <span>{publishedModels.length} Models</span>
    <span class="sf-dot"></span>
    <span>{$completedCount} Experiments</span>
  </div>
</div>

<style>
  .dashboard {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 32px 32px 100px;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Page Header ── */
  .dash-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 4px;
  }
  .dash-title {
    margin: 0;
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.55rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dash-sub {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.4;
  }

  /* ═══ HERO CTA CARD ═══ */
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hero-card {
    appearance: none;
    border: 1px solid color-mix(in srgb, var(--accent, #D97757) 25%, var(--border, #E5E0DA));
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 18px;
    padding: 24px 22px;
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 280ms cubic-bezier(0.16, 1, 0.3, 1);
    animation: cardIn 600ms cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
  }
  .hero-card::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--accent, #D97757);
    border-radius: 0 4px 4px 0;
  }
  .hero-card:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 8px 32px rgba(217, 119, 87, 0.1), 0 2px 8px rgba(217, 119, 87, 0.06);
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.88);
  }

  .hero-icon {
    width: 48px; height: 48px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    flex-shrink: 0;
    transition: all 280ms cubic-bezier(0.16, 1, 0.3, 1);
    animation: breathe 3s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50% { box-shadow: 0 0 16px rgba(217, 119, 87, 0.12); }
  }
  .hero-card:hover .hero-icon {
    background: rgba(217, 119, 87, 0.12);
    transform: scale(1.04);
  }

  .hero-body {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 4px;
  }
  .hero-title {
    font-size: 0.92rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: -0.005em;
  }
  .hero-desc {
    font-size: 0.72rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.35;
  }

  .hero-action {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 6px;
    padding: 8px 18px;
    border-radius: 100px;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.76rem; font-weight: 600;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.25);
    white-space: nowrap;
    position: relative; overflow: hidden;
  }
  .hero-action::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .hero-card:hover .hero-action::after { animation: shimmer 700ms ease-out; }
  @keyframes shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }
  .hero-card:hover .hero-action {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.3);
  }

  /* ═══ SECTION CARD (shared) ═══ */
  .section-card {
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: cardIn 600ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .active-card {
    border-color: color-mix(in srgb, var(--accent, #D97757) 20%, var(--border-subtle, #EDEAE5));
  }

  .sc-header {
    display: flex; align-items: center; gap: 8px;
  }
  .sc-status {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-muted, #9a9590);
    flex-shrink: 0;
  }
  .sc-status.running {
    background: var(--accent, #D97757);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .sc-status.done { background: var(--green, #27864a); }
  .sc-title {
    font-size: 0.72rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .sc-count {
    margin-left: auto;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6rem;
    color: var(--text-muted, #9a9590);
  }

  .sc-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sc-topic {
    font-size: 0.88rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sc-stats {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.66rem;
    color: var(--text-secondary, #6b6560);
  }
  .sc-stat-sep {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--border, #E5E0DA);
  }
  .sc-done { color: var(--green, #27864a); font-weight: 700; }

  .sc-progress {
    height: 4px; border-radius: 4px;
    background: rgba(217, 119, 87, 0.1);
    overflow: hidden;
  }
  .sc-bar {
    height: 100%; border-radius: 4px;
    background: var(--accent, #D97757);
    transition: width 300ms ease;
  }

  .sc-actions {
    display: flex; gap: 8px;
  }
  .sc-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 0.72rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .sc-btn:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
  }
  .sc-btn-primary {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
    color: var(--accent, #D97757);
  }
  .sc-btn-primary:hover {
    background: rgba(217, 119, 87, 0.12);
  }

  /* ═══ SESSIONS LIST (multi-research) ═══ */
  .sessions-list {
    display: flex; flex-direction: column; gap: 4px;
  }
  .session-row {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; text-align: left;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    width: 100%;
    position: relative;
  }
  .session-row:hover {
    border-color: color-mix(in srgb, var(--accent, #D97757) 40%, transparent);
    background: rgba(255, 255, 255, 0.8);
  }
  .session-active {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.03);
  }

  .sr-status {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-muted, #9a9590);
    flex-shrink: 0;
  }
  .sr-status.running {
    background: var(--accent, #D97757);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .sr-status.done { background: var(--green, #27864a); }

  .sr-body {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 4px;
  }
  .sr-topic {
    font-size: 0.8rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sr-meta {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    color: var(--text-secondary, #6b6560);
  }
  .sr-sep {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--border, #E5E0DA);
  }
  .sr-done { color: var(--green, #27864a); font-weight: 700; }

  .sr-progress {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; border-radius: 0 0 10px 10px;
    background: rgba(217, 119, 87, 0.1);
    overflow: hidden;
  }
  .sr-bar {
    height: 100%;
    background: var(--accent, #D97757);
    transition: width 300ms ease;
  }

  .sr-arrow {
    flex-shrink: 0;
    color: var(--text-muted, #9a9590);
    opacity: 0.4;
    transition: all 200ms;
  }
  .session-row:hover .sr-arrow {
    opacity: 1;
    color: var(--accent, #D97757);
    transform: translateX(2px);
  }

  /* ═══ MODELS GRID ═══ */
  .models-grid {
    display: flex; flex-direction: column; gap: 4px;
  }
  .model-chip {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; text-align: left;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    color: var(--text-muted, #9a9590);
  }
  .model-chip:hover {
    border-color: var(--accent, #D97757);
    background: rgba(255, 255, 255, 0.8);
  }
  .mchip-name {
    flex: 1; font-size: 0.78rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mchip-state {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem; font-weight: 700;
    padding: 1px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.04);
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.04em;
  }
  .mchip-state.active {
    background: rgba(39, 134, 74, 0.1);
    color: var(--green, #27864a);
  }

  /* ═══ QUICK START ═══ */
  .qs-section {
    display: flex; flex-direction: column; gap: 10px;
  }
  .qs-label {
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .qs-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .qs-pill {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 12px;
    padding: 12px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .qs-pill:hover {
    border-color: color-mix(in srgb, var(--qs-accent, var(--accent)) 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    background: rgba(255, 255, 255, 0.88);
  }
  .qs-icon {
    width: 28px; height: 28px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--qs-accent, var(--accent)) 10%, transparent);
    color: var(--qs-accent, var(--accent));
    transition: all 200ms;
  }
  .qs-pill:hover .qs-icon {
    background: color-mix(in srgb, var(--qs-accent, var(--accent)) 16%, transparent);
    transform: scale(1.06);
  }
  .qs-name {
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: -0.005em;
    text-align: center;
  }

  /* ═══ STATS FOOTER ═══ */
  .stats-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding-top: 8px;
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .sf-dot {
    width: 3px; height: 3px;
    border-radius: 50%;
    background: var(--border, #E5E0DA);
  }

  @media (max-width: 640px) {
    .dashboard {
      padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
      gap: 14px;
    }
    .dash-title { font-size: 1.3rem; }
    .dash-sub { font-size: 0.72rem; }

    /* Hero card — full-width CTA */
    .hero-card {
      padding: 18px 16px; gap: 12px;
      flex-wrap: wrap; border-radius: 14px;
    }
    .hero-icon { width: 44px; height: 44px; border-radius: 12px; }
    .hero-action {
      width: 100%; justify-content: center;
      margin-top: 4px; padding: 10px 18px;
    }

    /* Section cards — tighter */
    .section-card { padding: 14px 16px; border-radius: 14px; gap: 10px; }
    .sc-btn { padding: 10px 16px; font-size: 0.72rem; min-height: 36px; }

    /* Session rows — larger touch targets */
    .session-row { padding: 14px 14px; border-radius: 10px; min-height: 44px; }
    .sr-topic { font-size: 0.78rem; }
    .sr-meta { font-size: 0.58rem; }

    /* Models grid */
    .model-chip { padding: 12px 14px; min-height: 44px; }

    /* Quick start — 3-col with larger touch targets */
    .qs-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .qs-pill { padding: 12px 8px; border-radius: 10px; min-height: 44px; }
    .qs-name { font-size: 0.62rem; }
    .qs-icon { width: 26px; height: 26px; border-radius: 7px; }

    /* Stats footer */
    .stats-footer { font-size: 0.58rem; padding-top: 4px; }
  }

  @media (max-width: 360px) {
    .dashboard { padding: 16px 12px calc(80px + env(safe-area-inset-bottom, 0px)); }
    .dash-title { font-size: 1.15rem; }
    .hero-body .hero-title { font-size: 0.84rem; }
    .hero-body .hero-desc { font-size: 0.66rem; }
    .qs-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
