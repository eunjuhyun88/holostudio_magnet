<script lang="ts">
  /**
   * DockExpansionBody — Context-aware expansion area inside AgentDock
   *
   * Three views based on research lifecycle:
   *   idle:     suggestion chips + preset cards + stats + launch button
   *   running:  topic + progress bar + stats + action chips
   *   complete: topic + result summary + action chips
   */
  import { createEventDispatcher } from 'svelte';
  import { jobStore, jobProgress } from '../../stores/jobStore.ts';
  import { dockStore, dockContext, dockPresetId, dockTopic, dockIntent } from '../../stores/dockStore.ts';
  import { studioStore } from '../../stores/studioStore.ts';
  import { router } from '../../stores/router.ts';
  import { IDLE_CHIPS, RUNNING_CHIPS, COMPLETE_CHIPS } from '../../data/dockSuggestions.ts';
  import {
    createOntologyFromPreset,
    getEnabledBranches,
    getTotalExperiments,
  } from '../../data/ontologyData.ts';

  const dispatch = createEventDispatcher();

  // ── Preset data (same as StudioIdle) ──
  const PRESETS = [
    { id: 'crypto_market', title: 'Crypto Market Prediction', desc: 'Price movements using on-chain + sentiment' },
    { id: 'defi_risk', title: 'DeFi Protocol Risk', desc: 'Classify risk via TVL and audit history' },
    { id: 'fraud_detection', title: 'Fraud Detection', desc: 'Identify suspicious wallet patterns' },
    { id: 'time_series', title: 'Time Series Forecasting', desc: 'Multi-variate financial forecasting' },
  ];

  // ── Reactive stats from selected preset ──
  $: ontology = $dockPresetId
    ? createOntologyFromPreset($dockPresetId)
    : createOntologyFromPreset('balanced');
  $: branchCount = getEnabledBranches(ontology).length;
  $: totalExp = getTotalExperiments(ontology);
  $: itersPerBranch = Math.round(totalExp / Math.max(branchCount, 1));
  $: eta = totalExp < 100 ? '~5m' : totalExp < 200 ? '~15m' : '~30m';

  // ── Running stats ──
  $: runProgress = $jobProgress;
  $: runTopic = $jobStore.topic;
  $: runBranches = $jobStore.branches?.length ?? 0;
  $: runTotalExp = $jobStore.totalExperiments ?? 0;
  $: runCompletedExp = $jobStore.experiments?.length ?? 0;
  $: runEta = (() => {
    if (runProgress >= 95) return '< 1m';
    const remaining = Math.round((100 - runProgress) / 15);
    return `~${Math.max(remaining, 1)}m`;
  })();

  // ── Handlers ──
  function handleChipClick(chip: any) {
    if (chip.presetId) {
      const preset = PRESETS.find(p => p.id === chip.presetId);
      dockStore.selectPreset(chip.presetId, preset?.title ?? chip.label);
    } else if (chip.action) {
      handleAction(chip.action);
    }
  }

  function handlePresetClick(preset: typeof PRESETS[0]) {
    dockStore.selectPreset(preset.id, preset.title);
  }

  function handleAction(action: string) {
    switch (action) {
      case 'viewRunning':
        dockStore.collapse();
        router.navigate('studio');
        break;
      case 'stop':
        dockStore.handleCommand('/stop');
        dockStore.collapse();
        break;
      case 'viewResults':
        dockStore.collapse();
        router.navigate('studio');
        break;
      case 'improve':
        dockStore.handleCommand('/improve');
        break;
      case 'retry':
        dockStore.handleCommand('/retry');
        break;
      case 'deploy':
        dockStore.handleCommand('/deploy');
        dockStore.collapse();
        break;
    }
  }

  function handleLaunch() {
    dockStore.launch();
  }

  // ── Intent labels ──
  $: intentTitle = (() => {
    switch ($dockIntent) {
      case 'improve': return 'Improve Research';
      case 'retry': return 'Retry Research';
      default: return 'Start Research';
    }
  })();
</script>

<div class="expansion-body">
  {#if $dockContext === 'idle'}
    <!-- ═══ IDLE VIEW ═══ -->
    <div class="exp-section">
      <div class="suggestion-chips">
        {#each IDLE_CHIPS as chip}
          <button
            class="chip"
            class:chip-active={chip.presetId === $dockPresetId}
            on:click={() => handleChipClick(chip)}
          >
            {chip.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="preset-list">
      {#each PRESETS as preset (preset.id)}
        <button
          class="preset-row"
          class:preset-selected={preset.id === $dockPresetId}
          on:click={() => handlePresetClick(preset)}
        >
          <span class="preset-title">{preset.title}</span>
          <span class="preset-desc">{preset.desc}</span>
        </button>
      {/each}
    </div>

    <div class="stats-strip">
      <div class="stat"><span class="stat-val">{branchCount}</span><span class="stat-label">BRANCHES</span></div>
      <div class="stat"><span class="stat-val">{itersPerBranch}</span><span class="stat-label">ITERS/BRANCH</span></div>
      <div class="stat"><span class="stat-val">{totalExp}</span><span class="stat-label">TOTAL EXP</span></div>
      <div class="stat"><span class="stat-val">{eta}</span><span class="stat-label">ETA</span></div>
    </div>

    <button class="launch-btn" on:click={handleLaunch} disabled={!$dockTopic.trim()}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 2l10 6-10 6z"/>
      </svg>
      Launch Autoresearch
      <span class="launch-shortcut">⌘↵</span>
    </button>

  {:else if $dockContext === 'running'}
    <!-- ═══ RUNNING VIEW ═══ -->
    <div class="running-view">
      <div class="running-header">
        <span class="running-dot"></span>
        <span class="running-topic">{runTopic || 'Research'}</span>
      </div>
      <div class="running-progress-bar">
        <div class="running-progress-fill" style="width: {runProgress}%"></div>
      </div>
      <div class="running-meta">
        <span>{runProgress}%</span>
        <span class="meta-sep">·</span>
        <span>ETA {runEta}</span>
        <span class="meta-sep">·</span>
        <span>{runCompletedExp}/{runTotalExp} experiments</span>
      </div>
      <div class="suggestion-chips">
        {#each RUNNING_CHIPS as chip}
          <button
            class="chip"
            class:chip-danger={chip.variant === 'danger'}
            on:click={() => handleChipClick(chip)}
          >
            {chip.label}
          </button>
        {/each}
      </div>
    </div>

  {:else if $dockContext === 'complete'}
    <!-- ═══ COMPLETE VIEW ═══ -->
    <div class="complete-view">
      <div class="complete-header">
        <span class="complete-check">✓</span>
        <span class="complete-topic">{runTopic || $studioStore.createTopic} — Complete</span>
      </div>
      <div class="complete-meta">
        Best: {$jobStore.bestMetric?.toFixed(3) ?? '—'} AUC · {runTotalExp} experiments
      </div>
      <div class="suggestion-chips">
        {#each COMPLETE_CHIPS as chip}
          <button
            class="chip"
            class:chip-primary={chip.variant === 'primary'}
            on:click={() => handleChipClick(chip)}
          >
            {chip.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .expansion-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: min(420px, 50vh);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2px 0;
  }

  /* ═══ SUGGESTION CHIPS ═══ */
  .suggestion-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    appearance: none;
    border: 1px solid rgba(229, 224, 218, 0.7);
    background: rgba(0, 0, 0, 0.02);
    border-radius: 100px;
    padding: 6px 14px;
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }
  .chip:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
  }
  .chip-active {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.08);
    font-weight: 600;
  }
  .chip-danger {
    border-color: var(--red, #c0392b);
    color: var(--red, #c0392b);
  }
  .chip-danger:hover {
    background: rgba(192, 57, 43, 0.06);
    border-color: var(--red, #c0392b);
    color: var(--red, #c0392b);
  }
  .chip-primary {
    border-color: var(--accent, #D97757);
    background: var(--accent, #D97757);
    color: #fff;
    box-shadow: 0 2px 6px rgba(217, 119, 87, 0.2);
  }
  .chip-primary:hover {
    background: color-mix(in srgb, var(--accent, #D97757) 88%, black);
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.3);
  }

  /* ═══ PRESET LIST ═══ */
  .preset-list {
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(229, 224, 218, 0.6);
    border-radius: 12px;
    overflow: hidden;
  }
  .preset-row {
    appearance: none;
    border: none;
    background: transparent;
    padding: 10px 14px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-bottom: 1px solid rgba(229, 224, 218, 0.4);
    transition: all 160ms ease;
  }
  .preset-row:last-child { border-bottom: none; }
  .preset-row:hover { background: rgba(0, 0, 0, 0.025); }
  .preset-selected {
    background: rgba(217, 119, 87, 0.05);
    border-left: 3px solid var(--accent, #D97757);
  }
  .preset-title {
    font-family: var(--font-mono, monospace);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .preset-desc {
    font-size: 0.58rem;
    color: var(--text-muted, #9a9590);
  }

  /* ═══ STATS STRIP ═══ */
  .stats-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    text-align: center;
    padding: 6px 0;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .stat-val {
    font-family: var(--font-mono, monospace);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
  }
  .stat-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.4rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ═══ LAUNCH BUTTON ═══ */
  .launch-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    border-radius: 100px;
    padding: 11px 24px;
    font-family: var(--font-mono, monospace);
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    width: 100%;
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.15);
  }
  .launch-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent, #D97757) 88%, black);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(217, 119, 87, 0.3);
  }
  .launch-btn:active:not(:disabled) {
    transform: scale(0.98);
  }
  .launch-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .launch-shortcut {
    font-size: 0.56rem;
    opacity: 0.7;
    font-weight: 500;
  }

  /* ═══ RUNNING VIEW ═══ */
  .running-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .running-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .running-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent, #D97757);
    animation: dotPulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .running-topic {
    font-family: var(--font-mono, monospace);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .running-progress-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--border-subtle, #EDEAE5);
    overflow: hidden;
  }
  .running-progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent, #D97757);
    transition: width 300ms ease;
  }
  .running-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono, monospace);
    font-size: 0.58rem;
    color: var(--text-muted, #9a9590);
    font-variant-numeric: tabular-nums;
  }
  .meta-sep {
    color: var(--border, #E5E0DA);
  }

  /* ═══ COMPLETE VIEW ═══ */
  .complete-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .complete-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .complete-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--green, #27864a);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .complete-topic {
    font-family: var(--font-mono, monospace);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .complete-meta {
    font-family: var(--font-mono, monospace);
    font-size: 0.6rem;
    color: var(--text-secondary, #6b6560);
    font-variant-numeric: tabular-nums;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 600px) {
    .expansion-body {
      max-height: min(320px, 45vh);
    }
    .stats-strip {
      grid-template-columns: repeat(2, 1fr);
    }
    .preset-title { font-size: 0.68rem; }
    .chip { padding: 4px 10px; font-size: 0.56rem; }
  }
</style>
