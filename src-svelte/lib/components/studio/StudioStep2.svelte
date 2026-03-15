<script lang="ts">
  /**
   * StudioStep2 — AI Recommendation Confirmation (spec §3.5)
   *
   * Shows:
   *   - Topic header (from step1)
   *   - "이렇게 연구할게요" title
   *   - AI recommendation card: branches, total experiments, budget, metric
   *   - Resource selection: demo / local / network / hybrid
   *   - [세부 설정 변경 →] → SETUP
   *   - [연구 시작하기 →] → RUNNING
   *
   * Events:
   *   back: void — go to STEP1
   *   startResearch: { topic: string; resourceMode: ResourceMode }
   *   goToSetup: { topic: string }
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { studioStore, studioTopic, studioResourceMode, type ResourceMode } from '../../stores/studioStore.ts';
  import { dashboardStore } from '../../stores/dashboardStore.ts';
  import {
    getEnabledBranches,
    getTotalExperiments,
    estimateBudgetHoot,
    createOntologyFromPreset,
    ONTOLOGY_PRESETS,
  } from '../../data/ontologyData.ts';
  import PixelIcon from '../PixelIcon.svelte';

  const dispatch = createEventDispatcher<{
    back: void;
    startResearch: { topic: string; resourceMode: ResourceMode };
    goToSetup: { topic: string };
  }>();

  let resourceMode: ResourceMode = $studioResourceMode;

  // ── Topic from studioStore ──
  $: topic = $studioTopic;

  // ── Preset detection ──
  $: currentPresetId = $studioStore.createPreset;
  $: matchedPreset = currentPresetId
    ? ONTOLOGY_PRESETS.find(p => p.id === currentPresetId)
    : null;

  // AI recommendation data
  $: recoOntology = matchedPreset
    ? createOntologyFromPreset(currentPresetId!)
    : createOntologyFromPreset('balanced');

  $: recoBranches = getEnabledBranches(recoOntology);
  $: recoTotal = getTotalExperiments(recoOntology);
  $: recoBudget = estimateBudgetHoot(recoOntology);
  $: recoMetric = recoOntology.evaluation?.metric ?? 'accuracy';
  $: recoDirection = recoOntology.evaluation?.direction ?? 'maximize';
  $: estimatedTime = recoTotal > 60 ? '~2시간' : recoTotal > 30 ? '~1시간' : '~30분';

  // Fork source detection
  $: forkSource = $studioStore.forkSource;

  // Resource options
  $: hasGpu = false;
  $: hasWallet = $dashboardStore.isLoggedIn;
  $: resourceOptions = buildResourceOptions(hasGpu, hasWallet);

  function buildResourceOptions(gpu: boolean, wallet: boolean) {
    const opts: { id: ResourceMode; label: string; available: boolean }[] = [
      { id: 'demo', label: '데모 (무료, 시뮬레이션)', available: true },
    ];
    if (gpu) {
      opts.push({ id: 'local', label: '내 GPU (무료)', available: true });
    }
    if (wallet) {
      opts.push({ id: 'network', label: `네트워크 (~${recoBudget} HOOT)`, available: true });
    }
    if (gpu && wallet) {
      opts.push({ id: 'hybrid', label: `하이브리드 (~${Math.round(recoBudget / 2)} HOOT)`, available: true });
    }
    return opts;
  }

  function handleStart() {
    if (!topic.trim()) return;
    studioStore.setResourceMode(resourceMode);
    dispatch('startResearch', { topic: topic.trim(), resourceMode });
  }

  function handleSetup() {
    dispatch('goToSetup', { topic: topic.trim() });
  }
</script>

<div class="step2">
  <div class="step2-header">
    <button class="back-btn" on:click={() => dispatch('back')} aria-label="돌아가기">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>{topic}</span>
    </button>
  </div>

  <div class="step2-body">
    <!-- Fork indicator -->
    {#if forkSource}
      <div class="fork-banner">
        <span class="fb-icon">🔀</span>
        <span class="fb-text">Fork from: <strong>{forkSource}</strong></span>
        <button class="fb-clear" on:click={() => studioStore.setForkSource(null)}>✕</button>
      </div>
    {/if}

    <h2 class="step2-title">이렇게 연구할게요</h2>

    <!-- AI Recommendation Card -->
    <div class="reco-card">
      {#if matchedPreset}
        <div class="preset-badge">
          <PixelIcon type="sparkle" size={12} />
          <span>{matchedPreset.name} 프리셋 적용</span>
        </div>
      {/if}

      <div class="reco-branches">
        {#each recoBranches as br}
          <div class="reco-branch">
            <span class="rb-icon" style:color={br.color || 'var(--accent)'}>{br.icon || '●'}</span>
            <div class="rb-body">
              <span class="rb-name">{br.label || br.type.replace('_', ' ')}</span>
              <span class="rb-desc">{br.iters} iterations</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-card">
      <div class="summary-row">
        <span class="sum-label">총 실험</span>
        <span class="sum-value">{recoTotal}회</span>
      </div>
      <div class="summary-row">
        <span class="sum-label">예상 시간</span>
        <span class="sum-value">{estimatedTime}</span>
      </div>
      <div class="summary-row">
        <span class="sum-label">예상 비용</span>
        <span class="sum-value sum-accent">~{recoBudget} HOOT</span>
      </div>
      <div class="summary-row">
        <span class="sum-label">메트릭</span>
        <span class="sum-value">{recoMetric} ({recoDirection})</span>
      </div>
      <div class="summary-row">
        <span class="sum-label">데이터</span>
        <span class="sum-value">AI 자동 수집</span>
      </div>
    </div>

    <!-- Resource selection -->
    <div class="resource-section">
      <span class="resource-label">실행 방식</span>
      <div class="resource-options">
        {#each resourceOptions as opt}
          <label class="resource-option" class:selected={resourceMode === opt.id}>
            <input type="radio" name="resource" value={opt.id} bind:group={resourceMode} />
            <span class="ro-radio"></span>
            <span class="ro-label">{opt.label}</span>
          </label>
        {/each}
      </div>
    </div>

    <!-- Wallet CTA (Guest only) -->
    {#if !hasWallet}
      <div class="wallet-cta">
        <PixelIcon type="protocol" size={14} />
        <span>지갑 연결하면 실제 GPU로 실행할 수 있어요</span>
      </div>
    {/if}

    <!-- Actions -->
    <div class="step2-actions">
      <button class="setup-btn" on:click={handleSetup}>
        세부 설정 변경 &rarr;
      </button>
      <button class="start-btn" on:click={handleStart} disabled={!topic.trim()}>
        연구 시작하기 &rarr;
      </button>
    </div>
  </div>
</div>

<style>
  .step2 {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 80px;
  }

  .step2-header {
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

  .step2-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 24px 32px 40px;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  .step2-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    text-align: center;
  }

  /* ── Recommendation Card ── */
  .reco-card {
    width: 100%;
    padding: 18px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 14px;
    background: var(--surface, #fff);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preset-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 8px;
    background: rgba(217, 119, 87, 0.06);
    border: 1px solid rgba(217, 119, 87, 0.15);
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--accent, #D97757);
    align-self: flex-start;
  }

  .reco-branches {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reco-branch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.015);
  }

  .rb-icon {
    font-size: 12px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .rb-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .rb-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    text-transform: capitalize;
  }

  .rb-desc {
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
  }

  /* ── Summary Card ── */
  .summary-card {
    width: 100%;
    padding: 14px 18px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--surface, #fff);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .sum-label {
    font-size: 0.76rem;
    color: var(--text-secondary, #6b6560);
  }

  .sum-value {
    font-family: var(--font-mono, monospace);
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }

  .sum-accent {
    color: var(--accent, #D97757);
  }

  /* ── Resource selection ── */
  .resource-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .resource-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
  }

  .resource-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .resource-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 120ms;
  }
  .resource-option:hover {
    background: rgba(0, 0, 0, 0.02);
  }
  .resource-option.selected {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.04);
  }
  .resource-option input { display: none; }

  .ro-radio {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    flex-shrink: 0;
    transition: all 120ms;
  }
  .resource-option.selected .ro-radio {
    border-color: var(--accent, #D97757);
    background: var(--accent, #D97757);
    box-shadow: inset 0 0 0 3px var(--surface, #fff);
  }

  .ro-label {
    font-size: 0.78rem;
    color: var(--text-primary, #2D2D2D);
  }

  /* ── Wallet CTA ── */
  .wallet-cta {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(45, 108, 162, 0.06);
    border: 1px solid rgba(45, 108, 162, 0.15);
    font-size: 0.72rem;
    color: var(--blue, #2d6ca2);
  }

  /* ── Actions ── */
  .step2-actions {
    width: 100%;
    display: flex;
    gap: 10px;
  }

  .setup-btn {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer;
    transition: all 140ms;
  }
  .setup-btn:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
  }

  .start-btn {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.25);
    position: relative;
    overflow: hidden;
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
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.3);
    transform: translateY(-1px);
  }
  .start-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Fork banner ── */
  .fork-banner {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(41, 128, 185, 0.06);
    border: 1px solid rgba(41, 128, 185, 0.15);
  }
  .fb-icon { font-size: 14px; }
  .fb-text {
    flex: 1;
    font-size: 0.72rem;
    color: var(--text-secondary, #6b6560);
  }
  .fb-text strong {
    font-family: var(--font-mono);
    color: var(--text-primary, #2D2D2D);
  }
  .fb-clear {
    appearance: none;
    border: none;
    background: none;
    font-size: 0.72rem;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }
  .fb-clear:hover { background: rgba(0,0,0,0.05); }

  @media (max-width: 640px) {
    .step2-body { padding: 16px 16px 40px; }
    .step2-title { font-size: 1.2rem; }
    .step2-actions { flex-direction: column; }
  }
</style>
