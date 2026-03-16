<script lang="ts">
  /**
   * StudioCreator — Unified research creation view
   *
   * Merges StudioStep1 (type + topic) and StudioStep2 (config + launch) into
   * a single scrollable page with zero page transitions.
   *
   * Layout (top → bottom):
   *   1. Back button
   *   2. "What will you build?" title
   *   3. Type pill selector (horizontal scroll)
   *   4. Topic input + example chips
   *   5. Research Plan card (auto-computed, collapsible)
   *      - branches · experiments · time · cost
   *      - type-specific option dropdown
   *      - resource mode selector
   *   6. Start Research CTA
   *   7. Advanced Settings link
   *
   * Events:
   *   back: void
   *   startResearch: { topic: string; resourceMode: ResourceMode }
   *   goToSetup: { topic: string }
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { studioStore, studioTopic, studioResourceMode, studioResearchType, type ResourceMode } from '../../stores/studioStore.ts';
  import { dashboardStore } from '../../stores/dashboardStore.ts';
  import { RESEARCH_TYPES, LEVEL_LABELS, LEVEL_COLORS, type ResearchTypeId } from '../../data/researchTypes.ts';
  import {
    getEnabledBranches,
    getTotalExperiments,
    estimateBudgetHoot,
    createOntologyFromPreset,
  } from '../../data/ontologyData.ts';
  import PixelIcon from '../PixelIcon.svelte';

  const dispatch = createEventDispatcher<{
    back: void;
    startResearch: { topic: string; resourceMode: ResourceMode };
    goToSetup: { topic: string };
  }>();

  // ── Local state ──
  let selectedType: ResearchTypeId | null = $studioResearchType || 'llm';
  let topic = $studioTopic || '';
  let resourceMode: ResourceMode = $studioResourceMode;
  let selectedOption: string | null = $studioStore.step2Selection;
  let planOpen = true;
  let inputEl: HTMLInputElement;

  // ── Derived ──
  $: typeData = selectedType ? RESEARCH_TYPES.find(t => t.id === selectedType) : RESEARCH_TYPES[0];

  // Auto-select first step2 option when type changes
  $: if (typeData && !selectedOption) {
    selectedOption = typeData.step2Options[0]?.id ?? null;
  }

  // AI recommendation
  $: recoOntology = createOntologyFromPreset('balanced');
  $: recoBranches = getEnabledBranches(recoOntology);
  $: recoTotal = getTotalExperiments(recoOntology);
  $: recoBudget = estimateBudgetHoot(recoOntology);
  $: recoMetric = recoOntology.evaluation?.metric ?? 'accuracy';
  $: estimatedTime = typeData?.time || (recoTotal > 60 ? '~2h' : recoTotal > 30 ? '~1h' : '~30m');

  // Resource options
  $: hasGpu = false;
  $: hasWallet = $dashboardStore.isLoggedIn;
  $: resourceOptions = buildResourceOptions(hasGpu, hasWallet);

  function buildResourceOptions(gpu: boolean, wallet: boolean) {
    const opts: { id: ResourceMode; label: string; desc: string }[] = [
      { id: 'demo', label: 'Demo', desc: 'Free simulation' },
    ];
    if (gpu) {
      opts.push({ id: 'local', label: 'My GPU', desc: 'Local compute' });
    }
    if (wallet) {
      opts.push({ id: 'network', label: 'Network', desc: `~${recoBudget} HOOT` });
    }
    if (gpu && wallet) {
      opts.push({ id: 'hybrid', label: 'Hybrid', desc: `~${Math.round(recoBudget / 2)} HOOT` });
    }
    return opts;
  }

  // ── Handlers ──
  function selectType(type: ResearchTypeId) {
    selectedType = type;
    selectedOption = null; // reset option when type changes
    studioStore.setResearchType(type);
    // Focus topic input after type change
    setTimeout(() => inputEl?.focus(), 100);
  }

  function selectExample(ex: { label: string; topic: string }) {
    topic = ex.topic;
    inputEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && canStart) {
      handleStart();
    }
  }

  $: canStart = topic.trim().length > 0;

  function handleStart() {
    if (!canStart) return;
    studioStore.setTopic(topic.trim());
    studioStore.setResourceMode(resourceMode);
    if (selectedOption) studioStore.setStep2Selection(selectedOption);
    dispatch('startResearch', { topic: topic.trim(), resourceMode });
  }

  function handleSetup() {
    studioStore.setTopic(topic.trim());
    dispatch('goToSetup', { topic: topic.trim() });
  }

  onMount(() => {
    // If type is already selected, focus the input
    if (selectedType) {
      setTimeout(() => inputEl?.focus(), 400);
    }
  });
</script>

<div class="creator" in:fly={{ y: 16, duration: 300, delay: 60 }}>
  <!-- Back -->
  <div class="creator-header">
    <button class="back-btn" on:click={() => dispatch('back')} aria-label="Back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Back</span>
    </button>
  </div>

  <div class="creator-body">
    <!-- Title -->
    <h2 class="creator-title">What will you build?</h2>

    <!-- Type Pills (horizontal scroll) -->
    <div class="type-pills-wrap">
      <div class="type-pills">
        {#each RESEARCH_TYPES as rt (rt.id)}
          <button
            class="type-pill"
            class:pill-selected={selectedType === rt.id}
            style:--pill-accent={rt.accentColor}
            on:click={() => selectType(rt.id)}
          >
            <span class="pill-icon">
              <PixelIcon type={rt.pixelIcon} size={14} />
            </span>
            <span class="pill-label">{rt.name}</span>
            <span class="pill-meta">{rt.time}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Topic Input -->
    {#if typeData}
      <div class="topic-section">
        <div class="input-wrap">
          <input
            bind:this={inputEl}
            bind:value={topic}
            type="text"
            class="topic-input"
            class:has-value={topic.trim().length > 0}
            placeholder={typeData.step1Placeholder}
            on:keydown={handleKeydown}
          />
          <div class="input-glow"></div>
        </div>

        <!-- Example chips -->
        <div class="examples">
          <span class="examples-label">Try</span>
          <div class="example-chips">
            {#each typeData.step1Examples as ex}
              <button
                class="example-chip"
                class:active={topic === ex.topic}
                on:click={() => selectExample(ex)}
              >
                {ex.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Research Plan (collapsible) -->
      <div class="plan-section">
        <button class="plan-toggle" on:click={() => { planOpen = !planOpen; }}>
          <PixelIcon type="sparkle" size={12} />
          <span class="plan-toggle-label">Research Plan</span>
          <span class="plan-toggle-summary">{recoBranches.length} branches, {recoTotal} exp</span>
          <svg
            class="plan-chevron"
            class:plan-chevron-open={planOpen}
            width="12" height="12" viewBox="0 0 24 24" fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        {#if planOpen}
          <div class="plan-body" transition:slide={{ duration: 200 }}>
            <!-- Summary stats -->
            <div class="plan-stats">
              <div class="plan-stat">
                <span class="ps-label">Experiments</span>
                <span class="ps-value">{recoTotal}</span>
              </div>
              <div class="plan-stat-sep"></div>
              <div class="plan-stat">
                <span class="ps-label">Est. Time</span>
                <span class="ps-value">{estimatedTime}</span>
              </div>
              <div class="plan-stat-sep"></div>
              <div class="plan-stat">
                <span class="ps-label">Cost</span>
                <span class="ps-value ps-accent">~{recoBudget} HOOT</span>
              </div>
              <div class="plan-stat-sep"></div>
              <div class="plan-stat">
                <span class="ps-label">Metric</span>
                <span class="ps-value">{recoMetric}</span>
              </div>
            </div>

            <!-- Type-specific option (dropdown-style) -->
            <div class="plan-option">
              <span class="po-label">{typeData.step2Label}</span>
              <div class="po-pills">
                {#each typeData.step2Options as opt (opt.id)}
                  <button
                    class="po-pill"
                    class:po-pill-selected={selectedOption === opt.id}
                    on:click={() => { selectedOption = opt.id; studioStore.setStep2Selection(opt.id); }}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Resource mode -->
            <div class="plan-option">
              <span class="po-label">Execution</span>
              <div class="po-pills">
                {#each resourceOptions as opt (opt.id)}
                  <button
                    class="po-pill"
                    class:po-pill-selected={resourceMode === opt.id}
                    on:click={() => { resourceMode = opt.id; }}
                  >
                    {opt.label}
                    {#if opt.desc && opt.id !== 'demo'}
                      <span class="po-pill-desc">{opt.desc}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="creator-actions">
        <button
          class="start-btn"
          disabled={!canStart}
          on:click={handleStart}
        >
          <span>Start Research</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>

        <button class="advanced-link" on:click={handleSetup}>
          Advanced Settings
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .creator {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 100px;
  }

  .creator-header {
    padding: 16px 28px 8px;
  }

  .back-btn {
    appearance: none;
    border: none;
    background: none;
    padding: 6px 10px 6px 6px;
    cursor: pointer;
    color: var(--text-muted, #9a9590);
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 100px;
    font-size: 0.76rem;
    font-weight: 500;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .back-btn:hover {
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
  }

  .creator-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 12px 32px 40px;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Title ── */
  .creator-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.55rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    text-align: center;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  /* ═══ TYPE PILLS ═══ */
  .type-pills-wrap {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    margin: -8px 0;
  }
  .type-pills-wrap::-webkit-scrollbar { display: none; }

  .type-pills {
    display: flex;
    gap: 8px;
    padding: 4px 2px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .type-pill {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 10px 16px 10px 12px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    transition: all 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .type-pill:hover {
    border-color: color-mix(in srgb, var(--pill-accent, var(--accent)) 40%, transparent);
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  }
  .pill-selected {
    border-color: var(--pill-accent, var(--accent, #D97757));
    background: color-mix(in srgb, var(--pill-accent, var(--accent)) 6%, white);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--pill-accent, var(--accent)) 10%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.03);
  }
  .pill-selected .pill-label {
    color: var(--pill-accent, var(--accent, #D97757));
  }

  .pill-icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--pill-accent, var(--accent)) 10%, transparent);
    color: var(--pill-accent, var(--accent));
    transition: all 240ms cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
  }
  .pill-selected .pill-icon {
    background: color-mix(in srgb, var(--pill-accent, var(--accent)) 16%, transparent);
  }

  .pill-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: -0.005em;
    transition: color 200ms;
  }

  .pill-meta {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.56rem;
    color: var(--text-muted, #9a9590);
    padding: 2px 6px;
    border-radius: 100px;
    background: rgba(0, 0, 0, 0.03);
  }

  /* ═══ TOPIC INPUT ═══ */
  .topic-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .input-wrap {
    width: 100%;
    position: relative;
  }

  .topic-input {
    width: 100%;
    padding: 18px 24px;
    border: 2px solid var(--border, #E5E0DA);
    border-radius: 16px;
    font-size: 1.05rem;
    color: var(--text-primary, #2D2D2D);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 280ms cubic-bezier(0.16, 1, 0.3, 1);
    text-align: center;
    letter-spacing: -0.005em;
  }
  .topic-input.has-value {
    border-color: var(--accent, #D97757);
  }
  .topic-input:focus {
    outline: none;
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.1), 0 4px 16px rgba(217, 119, 87, 0.06);
    background: rgba(255, 255, 255, 0.92);
  }
  .topic-input::placeholder {
    color: var(--text-muted, #9a9590);
  }
  .input-glow {
    position: absolute;
    inset: -1px;
    border-radius: 17px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 400ms;
    background: conic-gradient(from 0deg, transparent 0%, rgba(217, 119, 87, 0.08) 25%, transparent 50%, rgba(217, 119, 87, 0.05) 75%, transparent 100%);
    filter: blur(8px);
  }
  .topic-input:focus ~ .input-glow {
    opacity: 1;
  }

  /* ── Examples ── */
  .examples {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .examples-label {
    font-size: 0.68rem;
    color: var(--text-muted, #9a9590);
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .example-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .example-chip {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 7px 14px;
    border-radius: 100px;
    font-size: 0.74rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }
  .example-chip:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    transform: translateY(-1px);
  }
  .example-chip.active {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
    color: var(--accent, #D97757);
    font-weight: 600;
  }

  /* ═══ RESEARCH PLAN (COLLAPSIBLE) ═══ */
  .plan-section {
    width: 100%;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .plan-toggle {
    appearance: none;
    border: none;
    background: none;
    width: 100%;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background 150ms;
  }
  .plan-toggle:hover {
    background: rgba(0, 0, 0, 0.015);
  }
  .plan-toggle-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--accent, #D97757);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .plan-toggle-summary {
    flex: 1;
    text-align: right;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
  }
  .plan-chevron {
    color: var(--text-muted, #9a9590);
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .plan-chevron-open {
    transform: rotate(180deg);
  }

  .plan-body {
    padding: 0 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Plan stats row */
  .plan-stats {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 12px 0;
    border-top: 1px solid rgba(0, 0, 0, 0.04);
  }
  .plan-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .plan-stat-sep {
    width: 1px;
    height: 24px;
    background: var(--border-subtle, #EDEAE5);
    flex-shrink: 0;
  }
  .ps-label {
    font-size: 0.58rem;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 500;
  }
  .ps-value {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .ps-accent { color: var(--accent, #D97757); }

  /* Plan option rows */
  .plan-option {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .po-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    white-space: nowrap;
    min-width: 68px;
  }
  .po-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
  }
  .po-pill {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: rgba(255, 255, 255, 0.72);
    padding: 6px 12px;
    border-radius: 100px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .po-pill:hover {
    border-color: color-mix(in srgb, var(--accent, #D97757) 40%, transparent);
    color: var(--accent, #D97757);
  }
  .po-pill-selected {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
    color: var(--accent, #D97757);
    font-weight: 600;
  }
  .po-pill-desc {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.56rem;
    opacity: 0.7;
  }

  /* ═══ ACTIONS ═══ */
  .creator-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .start-btn {
    width: 100%;
    padding: 16px 28px;
    border-radius: 100px;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 16px rgba(217, 119, 87, 0.3), 0 1px 4px rgba(217, 119, 87, 0.15);
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    letter-spacing: 0.01em;
  }
  .start-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .start-btn:hover:not(:disabled)::after {
    animation: shimmer 700ms ease-out;
  }
  @keyframes shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }
  .start-btn:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 6px 28px rgba(217, 119, 87, 0.35), 0 2px 8px rgba(217, 119, 87, 0.2);
    transform: translateY(-2px);
  }
  .start-btn:active:not(:disabled) {
    transform: translateY(0);
    transition-duration: 80ms;
  }
  .start-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .start-btn svg {
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .start-btn:hover:not(:disabled) svg {
    transform: translateX(3px);
  }

  .advanced-link {
    appearance: none;
    border: none;
    background: none;
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 100px;
    transition: all 180ms;
    font-weight: 500;
  }
  .advanced-link:hover {
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.05);
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 640px) {
    .creator-body {
      padding: 8px 16px 40px;
      gap: 22px;
    }
    .creator-title { font-size: 1.3rem; }
    .type-pills { justify-content: flex-start; flex-wrap: nowrap; }
    .type-pill { padding: 8px 12px 8px 10px; }
    .pill-label { font-size: 0.72rem; }
    .topic-input { font-size: 0.95rem; padding: 14px 18px; }
    .example-chip { padding: 6px 12px; font-size: 0.7rem; }
    .plan-stats { flex-wrap: wrap; gap: 8px; }
    .plan-stat-sep { display: none; }
    .plan-stat { min-width: 40%; }
    .start-btn { padding: 14px 24px; }
  }
</style>
