<script lang="ts">
  /**
   * StudioStep1 — Research Type Selection + Topic Input
   *
   * Two sub-views:
   *   A) Preset card grid (5 research types)
   *   B) Type-specific topic input (after selecting a type)
   *
   * Events:
   *   back: void — go to IDLE / go back to type selection
   *   continue: { topic: string } — go to STEP2
   *   selectType: { type: ResearchTypeId } — type selected, show topic input
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { studioStore, studioTopic, studioResearchType } from '../../stores/studioStore.ts';
  import { RESEARCH_TYPES, LEVEL_LABELS, LEVEL_COLORS, type ResearchTypeId } from '../../data/researchTypes.ts';

  const dispatch = createEventDispatcher<{
    back: void;
    continue: { topic: string };
    selectType: { type: ResearchTypeId };
  }>();

  /** Which sub-view: 'types' (card grid) or 'topic' (input) */
  let view: 'types' | 'topic' = $studioResearchType ? 'topic' : 'types';
  let selectedType: ResearchTypeId | null = $studioResearchType;
  let topic = $studioTopic || '';
  let inputEl: HTMLInputElement;

  $: typeData = selectedType ? RESEARCH_TYPES.find(t => t.id === selectedType) : null;

  function selectPreset(type: ResearchTypeId) {
    selectedType = type;
    studioStore.setResearchType(type);
    view = 'topic';
    dispatch('selectType', { type });
    // Focus input after transition
    setTimeout(() => inputEl?.focus(), 300);
  }

  function selectExample(ex: { label: string; topic: string }) {
    topic = ex.topic;
    inputEl?.focus();
  }

  function handleContinue() {
    if (!topic.trim()) return;
    studioStore.setTopic(topic.trim());
    dispatch('continue', { topic: topic.trim() });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && topic.trim()) {
      handleContinue();
    }
  }

  function handleBack() {
    if (view === 'topic') {
      view = 'types';
      selectedType = null;
      return;
    }
    dispatch('back');
  }

  onMount(() => {
    if (view === 'topic') {
      inputEl?.focus();
    }
  });
</script>

<div class="step1">
  <div class="step1-header">
    <button class="back-btn" on:click={handleBack} aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>{view === 'topic' ? 'Change Type' : 'Back'}</span>
    </button>
  </div>

  {#if view === 'types'}
    <!-- ═══ TYPE SELECTION GRID ═══ -->
    <div class="step1-body" in:fly={{ x: -20, duration: 250, delay: 60 }} out:fade={{ duration: 120 }}>
      <h2 class="step1-title">What would you like to create?</h2>
      <p class="step1-subtitle">Choose a research type to get started</p>

      <div class="type-grid">
        {#each RESEARCH_TYPES as rt (rt.id)}
          <button
            class="type-card"
            on:click={() => selectPreset(rt.id)}
            style:--card-accent={rt.accentColor}
          >
            <div class="tc-icon">{rt.icon}</div>
            <div class="tc-body">
              <h3 class="tc-name">{rt.name}</h3>
              <p class="tc-desc">{rt.desc}</p>
            </div>
            <div class="tc-meta">
              <span class="tc-level" style:color={LEVEL_COLORS[rt.level]}>{LEVEL_LABELS[rt.level]}</span>
              <span class="tc-sep">·</span>
              <span class="tc-time">{rt.time}</span>
            </div>
            <div class="tc-tags">
              {#each rt.tags as tag}
                <span class="tc-tag">{tag}</span>
              {/each}
            </div>
            <div class="tc-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </button>
        {/each}
      </div>
    </div>

  {:else if view === 'topic' && typeData}
    <!-- ═══ TYPE-SPECIFIC TOPIC INPUT ═══ -->
    <div class="step1-body step1-topic-view" in:fly={{ x: 20, duration: 250, delay: 60 }} out:fade={{ duration: 120 }}>
      <div class="type-badge" style:--badge-color={typeData.accentColor}>
        <span class="tb-icon">{typeData.icon}</span>
        <span class="tb-name">{typeData.name}</span>
      </div>

      <h2 class="step1-question">{typeData.step1Question}</h2>

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
      </div>

      <div class="examples">
        <span class="examples-label">Try an example</span>
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

      <div class="step1-footer">
        <button
          class="continue-btn"
          disabled={!topic.trim()}
          on:click={handleContinue}
        >
          Continue &rarr;
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .step1 {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .step1-header {
    padding: 12px 24px;
  }

  .back-btn {
    appearance: none;
    border: none;
    background: none;
    padding: 6px 8px;
    cursor: pointer;
    color: var(--text-muted, #9a9590);
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    transition: all 120ms;
  }
  .back-btn:hover {
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
  }

  .step1-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 24px 32px 80px;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
  }

  .step1-topic-view {
    max-width: 560px;
    gap: 28px;
    padding-top: 32px;
  }

  /* ── Title ── */
  .step1-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    text-align: center;
    line-height: 1.3;
  }
  .step1-subtitle {
    margin: -16px 0 0;
    font-size: 0.88rem;
    color: var(--text-secondary, #6b6560);
    text-align: center;
  }

  /* ═══ TYPE CARD GRID ═══ */
  .type-grid {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .type-card {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: 14px;
    padding: 18px 20px;
    text-align: left;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    gap: 4px 14px;
    position: relative;
    overflow: hidden;
  }
  .type-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--card-accent, var(--accent));
    opacity: 0;
    transition: opacity 200ms;
  }
  .type-card:hover {
    border-color: var(--card-accent, var(--accent));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }
  .type-card:hover::before {
    opacity: 1;
  }
  .type-card:active {
    transform: scale(0.99);
  }

  .tc-icon {
    font-size: 1.6rem;
    grid-row: 1 / 3;
    display: flex;
    align-items: center;
    padding-right: 2px;
  }

  .tc-body {
    grid-column: 2;
    min-width: 0;
  }
  .tc-name {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    line-height: 1.3;
  }
  .tc-desc {
    margin: 2px 0 0;
    font-size: 0.74rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.4;
  }

  .tc-meta {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.66rem;
    font-family: var(--font-mono, monospace);
    margin-top: 2px;
  }
  .tc-level { font-weight: 600; }
  .tc-sep { color: var(--border, #E5E0DA); }
  .tc-time { color: var(--text-muted, #9a9590); }

  .tc-tags {
    grid-column: 2;
    display: flex;
    gap: 5px;
    margin-top: 2px;
  }
  .tc-tag {
    font-family: var(--font-mono, monospace);
    font-size: 0.58rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-muted, #9a9590);
  }

  .tc-arrow {
    grid-row: 1 / 3;
    grid-column: 3;
    display: flex;
    align-items: center;
    color: var(--text-muted, #9a9590);
    transition: all 200ms;
  }
  .type-card:hover .tc-arrow {
    color: var(--card-accent, var(--accent));
    transform: translateX(3px);
  }

  /* ═══ TYPE-SPECIFIC TOPIC VIEW ═══ */
  .type-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 100px;
    background: color-mix(in srgb, var(--badge-color, var(--accent)) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color, var(--accent)) 25%, transparent);
  }
  .tb-icon { font-size: 1rem; }
  .tb-name {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--badge-color, var(--accent));
  }

  .step1-question {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    text-align: center;
    line-height: 1.3;
  }

  .input-wrap {
    width: 100%;
  }
  .topic-input {
    width: 100%;
    padding: 16px 20px;
    border: 2px solid var(--border, #E5E0DA);
    border-radius: 14px;
    font-size: 1.05rem;
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    text-align: center;
  }
  .topic-input.has-value {
    border-color: var(--accent, #D97757);
  }
  .topic-input:focus {
    outline: none;
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.1);
  }
  .topic-input::placeholder {
    color: var(--text-muted, #9a9590);
  }

  .examples {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  .examples-label {
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    font-weight: 500;
  }
  .example-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .example-chip {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 7px 14px;
    border-radius: 100px;
    font-size: 0.76rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 140ms cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }
  .example-chip:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.08);
  }
  .example-chip.active {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.06);
    color: var(--accent, #D97757);
    font-weight: 600;
  }

  .step1-footer {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
  .continue-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    padding: 12px 32px;
    border-radius: 100px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.25);
    position: relative;
    overflow: hidden;
  }
  .continue-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .continue-btn:hover:not(:disabled)::after {
    animation: shimmer 700ms ease-out;
  }
  @keyframes shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }
  .continue-btn:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.3);
    transform: translateY(-1px);
  }
  .continue-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .step1-body {
      padding: 16px 16px 60px;
      gap: 20px;
    }
    .step1-title { font-size: 1.3rem; }
    .step1-question { font-size: 1.25rem; }
    .topic-input { font-size: 0.95rem; padding: 14px 16px; }
    .example-chip { padding: 6px 12px; font-size: 0.7rem; }
    .tc-icon { font-size: 1.3rem; }
    .tc-name { font-size: 0.84rem; }
    .tc-desc { font-size: 0.7rem; }
    .type-card { padding: 14px 16px; }
  }
</style>
