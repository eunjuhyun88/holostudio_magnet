<script lang="ts">
  /**
   * StudioDashboard — Landing view for Magnet Studio.
   *
   * Shows:
   *   - "Magnet Studio" heading
   *   - "New Research" CTA button
   *   - My Research project list (running, completed, published)
   *   - Quick stats overview
   *
   * Events:
   *   newResearch: void — start new research
   *   resumeJob: void — navigate to running job
   *   openModel: { modelId: string } — view published model
   */
  import { createEventDispatcher } from 'svelte';
  import { jobStore, completedCount } from '../../stores/jobStore.ts';
  import { modelPublishStore } from '../../stores/modelPublishStore.ts';
  import { wallet } from '../../stores/walletStore.ts';
  import PixelIcon from '../PixelIcon.svelte';

  const dispatch = createEventDispatcher<{
    newResearch: void;
    resumeJob: void;
    openModel: { modelId: string };
  }>();

  // ── Job state ──
  $: job = $jobStore;
  $: isRunning = job.phase === 'running' || job.phase === 'setup';
  $: isComplete = job.phase === 'complete';
  $: publishedModels = $modelPublishStore;
  $: hasWallet = $wallet.connected;

  // Build project list
  interface ProjectItem {
    id: string;
    name: string;
    status: 'running' | 'complete' | 'published';
    metric?: number;
    progress?: number;
    time?: string;
    type?: string;
  }

  $: projects = buildProjectList(job, publishedModels, isRunning, isComplete);

  function buildProjectList(
    j: typeof job,
    published: typeof publishedModels,
    running: boolean,
    complete: boolean
  ): ProjectItem[] {
    const items: ProjectItem[] = [];

    // Running job
    if (running && j.topic) {
      items.push({
        id: 'current-job',
        name: j.topic,
        status: 'running',
        progress: j.progress ?? 0,
        metric: j.bestMetric < Infinity ? j.bestMetric : undefined,
      });
    }

    // Complete (not yet published)
    if (complete && j.topic) {
      items.push({
        id: 'current-complete',
        name: j.topic,
        status: 'complete',
        metric: j.bestMetric < Infinity ? j.bestMetric : undefined,
      });
    }

    // Published models
    for (const m of published) {
      items.push({
        id: m.id,
        name: m.name,
        status: 'published',
        metric: m.vtr.accuracy,
        type: m.architecture,
      });
    }

    return items;
  }

  function handleProjectClick(p: ProjectItem) {
    if (p.status === 'running' || p.status === 'complete') {
      dispatch('resumeJob');
    } else {
      dispatch('openModel', { modelId: p.id });
    }
  }

  const STATUS_CONFIG = {
    running: { label: 'Running', color: 'var(--accent, #D97757)', icon: 'research' as const },
    complete: { label: 'Complete', color: 'var(--green, #27864a)', icon: 'chart' as const },
    published: { label: 'Published', color: '#2980b9', icon: 'protocol' as const },
  };
</script>

<div class="dashboard">
  <!-- Header -->
  <div class="dash-header">
    <div class="dash-title-row">
      <div class="dash-icon-wrap">
        <PixelIcon type="research" size={22} />
      </div>
      <div class="dash-titles">
        <h1 class="dash-title">Magnet Studio</h1>
        <p class="dash-subtitle">Design, train, and deploy AI models on HOOT Protocol</p>
      </div>
    </div>
    <button class="new-btn" on:click={() => dispatch('newResearch')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>New Research</span>
    </button>
  </div>

  <!-- Stats row -->
  <div class="stats-row">
    <div class="stat-item">
      <span class="stat-val">{publishedModels.length}</span>
      <span class="stat-label">Models</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-val" class:running={isRunning}>{isRunning ? '1' : '0'}</span>
      <span class="stat-label">Active</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-val">{$completedCount}</span>
      <span class="stat-label">Experiments</span>
    </div>
  </div>

  <!-- Project list -->
  <div class="projects-section">
    <span class="section-label">My Research</span>

    {#if projects.length > 0}
      <div class="project-list">
        {#each projects as p, i (p.id)}
          {@const cfg = STATUS_CONFIG[p.status]}
          <button
            class="project-card"
            on:click={() => handleProjectClick(p)}
            style:animation-delay="{i * 50}ms"
          >
            <span class="pc-icon-wrap" style:color={cfg.color}>
              <PixelIcon type={cfg.icon} size={16} />
              {#if p.status === 'running'}
                <span class="pc-pulse"></span>
              {/if}
            </span>
            <div class="pc-body">
              <span class="pc-name">{p.name}</span>
              <span class="pc-meta">
                <span class="pc-status" style:color={cfg.color}>{cfg.label}</span>
                {#if p.metric !== undefined}
                  <span class="pc-dot"></span>
                  <span class="pc-metric">{p.metric.toFixed(3)}</span>
                {/if}
                {#if p.type}
                  <span class="pc-dot"></span>
                  <span class="pc-type">{p.type}</span>
                {/if}
              </span>
            </div>
            {#if p.status === 'running' && p.progress !== undefined}
              <div class="pc-progress">
                <div class="pc-bar" style:width="{p.progress}%"></div>
              </div>
            {:else}
              <span class="pc-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <!-- Empty state -->
      <div class="empty-state">
        <div class="empty-icon">
          <PixelIcon type="sparkle" size={28} />
        </div>
        <span class="empty-title">No research yet</span>
        <span class="empty-desc">Start your first research project to train AI models</span>
        <button class="empty-btn" on:click={() => dispatch('newResearch')}>
          Start Research
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 32px 32px 100px;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Header ── */
  .dash-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }
  .dash-title-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .dash-icon-wrap {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(217, 119, 87, 0.08);
    color: var(--accent, #D97757);
    animation: breathe 3s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50% { box-shadow: 0 0 16px rgba(217, 119, 87, 0.12); }
  }
  .dash-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dash-title {
    margin: 0;
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dash-subtitle {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.4;
  }

  .new-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    padding: 10px 22px;
    border-radius: 100px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 12px rgba(217, 119, 87, 0.25);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .new-btn:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 20px rgba(217, 119, 87, 0.35);
    transform: translateY(-1px);
  }

  /* ── Stats row ── */
  .stats-row {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 24px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 1;
  }
  .stat-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .stat-val.running {
    color: var(--accent, #D97757);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .stat-label {
    font-size: 0.66rem;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 500;
  }
  .stat-sep {
    width: 1px;
    height: 24px;
    background: var(--border-subtle, #EDEAE5);
  }

  /* ── Project list ── */
  .projects-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .project-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .project-card {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    text-align: left;
    transition: all 240ms cubic-bezier(0.16, 1, 0.3, 1);
    animation: cardIn 600ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  .project-card:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.88);
  }

  .pc-icon-wrap {
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: currentColor;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .pc-pulse {
    position: absolute;
    inset: -2px;
    border-radius: 12px;
    border: 1.5px solid currentColor;
    opacity: 0;
    animation: pcPulse 2s ease-out infinite;
  }
  @keyframes pcPulse {
    0% { transform: scale(0.9); opacity: 0.4; }
    100% { transform: scale(1.3); opacity: 0; }
  }

  .pc-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pc-name {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.005em;
  }
  .pc-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.66rem;
  }
  .pc-status { font-weight: 600; }
  .pc-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--border, #E5E0DA);
  }
  .pc-metric {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    font-weight: 600;
  }
  .pc-type {
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .pc-progress {
    width: 48px;
    height: 4px;
    background: rgba(217, 119, 87, 0.12);
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .pc-bar {
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 4px;
    transition: width 300ms ease;
  }
  .pc-arrow {
    flex-shrink: 0;
    color: var(--text-muted, #9a9590);
    opacity: 0.4;
    transition: all 200ms;
  }
  .project-card:hover .pc-arrow {
    opacity: 1;
    color: var(--accent, #D97757);
    transform: translateX(2px);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 48px 24px;
    border: 1px dashed var(--border, #E5E0DA);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.4);
    text-align: center;
  }
  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: rgba(217, 119, 87, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent, #D97757);
    animation: breathe 3s ease-in-out infinite;
  }
  .empty-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .empty-desc {
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    max-width: 280px;
  }
  .empty-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    padding: 12px 28px;
    border-radius: 100px;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 12px rgba(217, 119, 87, 0.25);
    margin-top: 4px;
  }
  .empty-btn:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 20px rgba(217, 119, 87, 0.35);
    transform: translateY(-1px);
  }

  @media (max-width: 640px) {
    .dashboard { padding: 20px 16px 80px; gap: 22px; }
    .dash-header { flex-direction: column; gap: 14px; }
    .dash-title { font-size: 1.35rem; }
    .dash-icon-wrap { width: 42px; height: 42px; border-radius: 12px; }
    .new-btn { align-self: stretch; justify-content: center; }
    .stats-row { gap: 14px; padding: 14px 16px; }
    .stat-val { font-size: 1rem; }
    .project-card { padding: 14px 14px; gap: 12px; }
    .pc-icon-wrap { width: 32px; height: 32px; }
    .empty-state { padding: 36px 16px; }
  }
</style>
