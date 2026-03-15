<script lang="ts">
  /**
   * StudioPublish — 3-step model publishing wizard.
   *
   * Step 1: Review Model Card (user reviews research results)
   * Step 2: VTR Registration (auto-progress, simulated)
   * Step 3: ModelNFT Mint Complete (success + next actions)
   *
   * Uses plain language per D10 — no "VTR"/"PPAP" terms in UI.
   * Protocol terms only shown in step 2 progress as technical detail.
   *
   * Events:
   *   back: void — return to COMPLETE
   *   published: { modelId: string } — model successfully published
   *   newResearch: void — start fresh
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { studioStore } from '../../stores/studioStore.ts';
  import { modelPublishStore } from '../../stores/modelPublishStore.ts';
  import { wallet } from '../../stores/walletStore.ts';
  import type { BranchInfo, Experiment } from '../../stores/jobStore.ts';
  import PixelIcon from '../PixelIcon.svelte';

  export let topic: string = '';
  export let bestMetric: number = 0;
  export let experiments: Experiment[] = [];
  export let branches: BranchInfo[] = [];
  export let totalExperiments: number = 0;

  const dispatch = createEventDispatcher<{
    back: void;
    published: { modelId: string };
    newResearch: void;
  }>();

  // ── Wizard state ──
  type PublishStep = 1 | 2 | 3;
  let step: PublishStep = 1;
  let publishedModelId: string | null = null;
  let isPublic = true;
  let trainingSeed: number | null = 42; // demo default

  // ── Derived data ──
  $: keptExperiments = experiments.filter(e => e.status === 'keep').length;
  $: bestBranch = branches.reduce((best, b) =>
    (b.bestMetric ?? Infinity) < (best?.bestMetric ?? Infinity) ? b : best,
    branches[0]
  );
  $: modelName = topic
    ? `${topic.replace(/\s+/g, '-').toLowerCase()}-v1`
    : 'untitled-model-v1';

  // ── Step 2: VTR registration simulation ──
  interface VTRStep {
    label: string;
    detail: string;
    done: boolean;
    active: boolean;
  }

  let vtrSteps: VTRStep[] = [
    { label: '학습 기록 해시 생성', detail: 'keccak256(result ‖ nonce)', done: false, active: false },
    { label: '모델 인증 등록', detail: 'VTR_COMMIT (0x101)', done: false, active: false },
    { label: '검증 확인 중', detail: 'Spot-Check (VRF)', done: false, active: false },
    { label: '재현 가능 등급 확인', detail: 'DETERMINISTIC', done: false, active: false },
  ];

  async function runVTRSimulation() {
    for (let i = 0; i < vtrSteps.length; i++) {
      vtrSteps[i].active = true;
      vtrSteps = [...vtrSteps]; // trigger reactivity
      await delay(1200 + Math.random() * 800);
      vtrSteps[i].done = true;
      vtrSteps[i].active = false;
      vtrSteps = [...vtrSteps];
    }

    // Build and publish model
    const record = modelPublishStore.buildModelRecord({
      topic,
      bestMetric,
      totalExperiments,
      keptExperiments,
    });

    publishedModelId = await modelPublishStore.publishModel(record);
    step = 3;
  }

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Actions ──
  function handleBack() {
    if (step === 1) {
      dispatch('back');
    }
  }

  function handleNextToVTR() {
    step = 2;
    runVTRSimulation();
  }

  function handleViewModel() {
    if (publishedModelId) {
      dispatch('published', { modelId: publishedModelId });
    }
  }

  function handleNewResearch() {
    dispatch('newResearch');
  }
</script>

<div class="studio-publish">
  <!-- Header -->
  <div class="publish-header">
    {#if step === 1}
      <button class="back-btn" on:click={handleBack} aria-label="Back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    {/if}
    <span class="header-label">모델 발행</span>
    <span class="step-indicator">{step}/3</span>
  </div>

  <!-- Step indicators -->
  <div class="step-bar">
    {#each [1, 2, 3] as s}
      <div class="step-dot" class:done={step > s} class:active={step === s}></div>
      {#if s < 3}
        <div class="step-line" class:done={step > s}></div>
      {/if}
    {/each}
  </div>

  <div class="publish-body">
    <!-- STEP 1: Review Model Card -->
    {#if step === 1}
      <div class="step-content" style="animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)">
        <h3 class="step-title">모델 정보 확인</h3>
        <p class="step-desc">연구 결과를 확인하고 모델을 발행합니다.</p>

        <div class="model-card">
          <div class="mc-row">
            <span class="mc-label">모델명</span>
            <span class="mc-value mc-name">{modelName}</span>
          </div>
          <div class="mc-row">
            <span class="mc-label">메트릭</span>
            <span class="mc-value">
              <span class="mc-metric">{bestMetric.toFixed(4)}</span>
              {#if bestBranch}
                <span class="mc-branch">({bestBranch.name || bestBranch.category || 'best'})</span>
              {/if}
            </span>
          </div>
          <div class="mc-row">
            <span class="mc-label">실험</span>
            <span class="mc-value">{totalExperiments}회 중 <strong>{keptExperiments}개</strong> 유효</span>
          </div>
          <div class="mc-row">
            <span class="mc-label">학습 시드</span>
            <span class="mc-value mc-mono">42 → 재현 가능 ✓</span>
          </div>
        </div>

        <!-- Public toggle -->
        <div class="public-toggle">
          <label class="toggle-label">
            <input type="checkbox" bind:checked={isPublic} class="toggle-input" />
            <span class="toggle-track" class:on={isPublic}>
              <span class="toggle-thumb"></span>
            </span>
            <span class="toggle-text">{isPublic ? '모델 공개' : '비공개'}</span>
          </label>
          <span class="toggle-hint">{isPublic ? '모든 사용자가 이 모델에 접근할 수 있습니다' : '본인만 사용 가능합니다'}</span>
        </div>

        <!-- Seed warning -->
        {#if trainingSeed === null}
          <div class="seed-warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>
            학습 시드가 설정되지 않아 재현이 불가능할 수 있습니다
          </div>
        {/if}

        <!-- Pool A distribution preview -->
        <div class="pool-preview">
          <span class="pool-label">수익 분배 (발행 후)</span>
          <div class="pool-bars">
            <div class="pool-segment creator" style="width: 60%">
              <span>Creator 60%</span>
            </div>
            <div class="pool-segment notary" style="width: 15%">
              <span>15%</span>
            </div>
            <div class="pool-segment treasury" style="width: 15%">
              <span>15%</span>
            </div>
            <div class="pool-segment burn" style="width: 10%">
              <span>10%</span>
            </div>
          </div>
          <div class="pool-legend">
            <span class="pl-item"><span class="pl-dot" style:background="var(--accent, #D97757)"></span>Creator</span>
            <span class="pl-item"><span class="pl-dot" style:background="#2980b9"></span>Notary</span>
            <span class="pl-item"><span class="pl-dot" style:background="#b7860e"></span>Treasury</span>
            <span class="pl-item"><span class="pl-dot" style:background="#c0392b"></span>Burn</span>
          </div>
        </div>

        {#if !$wallet.connected}
          <div class="wallet-warning">
            <PixelIcon type="protocol" size={14} />
            <span>모델을 발행하려면 지갑 연결이 필요합니다</span>
          </div>
        {/if}

        <div class="step-actions">
          <button class="secondary-btn" on:click={handleBack}>돌아가기</button>
          <button class="primary-btn" on:click={handleNextToVTR}>
            다음: 인증 &rarr;
          </button>
        </div>
      </div>

    <!-- STEP 2: VTR Registration (auto-progress) -->
    {:else if step === 2}
      <div class="step-content" style="animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)">
        <h3 class="step-title">모델 인증 중...</h3>
        <p class="step-desc">학습 기록을 검증하고 모델을 등록하고 있습니다.</p>

        <div class="vtr-progress">
          {#each vtrSteps as vs, i}
            <div class="vtr-step" class:done={vs.done} class:active={vs.active}>
              <div class="vtr-icon">
                {#if vs.done}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {:else if vs.active}
                  <div class="vtr-spinner"></div>
                {:else}
                  <div class="vtr-circle"></div>
                {/if}
              </div>
              <div class="vtr-text">
                <span class="vtr-label">{vs.label}</span>
                <span class="vtr-detail">{vs.detail}</span>
              </div>
            </div>
            {#if i < vtrSteps.length - 1}
              <div class="vtr-connector" class:done={vs.done}></div>
            {/if}
          {/each}
        </div>

        <div class="auto-hint">
          <div class="auto-dot"></div>
          자동 진행 중
        </div>
      </div>

    <!-- STEP 3: ModelNFT Mint Complete -->
    {:else if step === 3}
      <div class="step-content" style="animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)">
        <div class="success-icon">🎉</div>
        <h3 class="step-title success">모델 발행 완료!</h3>

        <div class="published-card">
          <div class="pub-name">{modelName}</div>
          <div class="pub-badge">● NETWORK_ACTIVE</div>

          <div class="pub-stats">
            <div class="pub-stat">
              <span class="ps-value">{bestMetric.toFixed(4)}</span>
              <span class="ps-label">Best Metric</span>
            </div>
            <div class="pub-stat">
              <span class="ps-value">{keptExperiments}</span>
              <span class="ps-label">Kept</span>
            </div>
            <div class="pub-stat">
              <span class="ps-value">DETERMINISTIC</span>
              <span class="ps-label">인증 등급</span>
            </div>
          </div>

          <div class="pub-revenue">
            <PixelIcon type="protocol" size={14} />
            <span>이후 모든 사용에서 Creator Pool 60% 자동 수령</span>
          </div>
        </div>

        <!-- Endpoint URL -->
        {#if publishedModelId}
          <div class="endpoint-box">
            <span class="endpoint-label">API Endpoint</span>
            <div class="endpoint-row">
              <code class="endpoint-url">https://api.hoot.network/v1/models/{publishedModelId}/predict</code>
              <button class="copy-btn" on:click={() => { navigator.clipboard.writeText(`https://api.hoot.network/v1/models/${publishedModelId}/predict`); }} title="복사">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.5"/></svg>
              </button>
            </div>
          </div>
        {/if}

        <div class="step-actions">
          <button class="secondary-btn" on:click={handleNewResearch}>새 연구 시작</button>
          <button class="primary-btn" on:click={handleViewModel}>
            모델 상세 보기 &rarr;
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .studio-publish {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 80px;
  }

  /* ── Header ── */
  .publish-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
  }
  .back-btn {
    appearance: none; border: none; background: none;
    padding: 6px; cursor: pointer;
    color: var(--text-muted, #9a9590);
    display: flex; border-radius: 6px; transition: all 100ms;
  }
  .back-btn:hover { color: var(--accent, #D97757); background: rgba(217,119,87,0.06); }
  .header-label {
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    flex: 1;
  }
  .step-indicator {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    background: rgba(0,0,0,0.03);
    padding: 3px 8px; border-radius: 8px;
  }

  /* ── Step bar ── */
  .step-bar {
    display: flex; align-items: center; justify-content: center;
    gap: 0; padding: 0 32px 12px;
  }
  .step-dot {
    width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    transition: all 300ms;
    flex-shrink: 0;
  }
  .step-dot.active {
    border-color: var(--accent, #D97757);
    background: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.2);
  }
  .step-dot.done {
    border-color: #27864a;
    background: #27864a;
  }
  .step-line {
    width: 60px; height: 2px;
    background: var(--border, #E5E0DA);
    transition: background 300ms;
  }
  .step-line.done { background: #27864a; }

  /* ── Body ── */
  .publish-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 32px;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  .step-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .step-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.2rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0; text-align: center;
  }
  .step-title.success { color: #27864a; }

  .step-desc {
    font-size: 0.78rem; color: var(--text-muted, #9a9590);
    margin: 0; text-align: center;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Model card (Step 1) ── */
  .model-card {
    width: 100%;
    padding: 16px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--surface, #fff);
    display: flex; flex-direction: column; gap: 10px;
  }
  .mc-row {
    display: flex; align-items: center; gap: 12px;
  }
  .mc-label {
    font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted, #9a9590);
    width: 80px; flex-shrink: 0;
  }
  .mc-value {
    font-size: 0.8rem; color: var(--text-primary, #2D2D2D);
    display: flex; align-items: center; gap: 6px;
  }
  .mc-name { font-weight: 600; color: var(--accent, #D97757); }
  .mc-metric { font-family: var(--font-mono); font-weight: 700; font-size: 0.9rem; }
  .mc-branch { font-size: 0.68rem; color: var(--text-muted, #9a9590); }
  .mc-mono { font-family: var(--font-mono); font-size: 0.72rem; }
  .mc-value strong { font-weight: 700; color: var(--accent, #D97757); }

  /* ── Pool A preview ── */
  .pool-preview {
    width: 100%;
    display: flex; flex-direction: column; gap: 6px;
  }
  .pool-label {
    font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--text-muted, #9a9590);
  }
  .pool-bars {
    display: flex; height: 24px; border-radius: 6px; overflow: hidden;
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .pool-segment {
    display: flex; align-items: center; justify-content: center;
    font-size: 0.56rem; font-weight: 700; color: #fff;
    letter-spacing: 0.02em;
  }
  .pool-segment.creator { background: var(--accent, #D97757); }
  .pool-segment.notary { background: #2980b9; }
  .pool-segment.treasury { background: #b7860e; }
  .pool-segment.burn { background: #c0392b; }
  .pool-segment span { white-space: nowrap; }

  .pool-legend {
    display: flex; gap: 12px; flex-wrap: wrap;
  }
  .pl-item {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.62rem; color: var(--text-muted, #9a9590);
  }
  .pl-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }

  /* ── Public toggle ── */
  .public-toggle {
    width: 100%;
    display: flex; flex-direction: column; gap: 4px;
  }
  .toggle-label {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
  }
  .toggle-input { display: none; }
  .toggle-track {
    width: 36px; height: 20px; border-radius: 10px;
    background: var(--border, #E5E0DA);
    position: relative; transition: background 200ms;
    flex-shrink: 0;
  }
  .toggle-track.on { background: var(--accent, #D97757); }
  .toggle-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; transition: transform 200ms;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .toggle-track.on .toggle-thumb { transform: translateX(16px); }
  .toggle-text {
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .toggle-hint {
    font-size: 0.68rem; color: var(--text-muted, #9a9590);
    margin-left: 46px;
  }

  /* ── Seed warning ── */
  .seed-warning {
    width: 100%;
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px; border-radius: 10px;
    background: rgba(249, 226, 175, 0.1);
    border: 1px solid rgba(249, 226, 175, 0.25);
    font-size: 0.72rem; color: #b7860e; font-weight: 500;
  }
  .seed-warning svg { flex-shrink: 0; }

  /* ── Endpoint URL ── */
  .endpoint-box {
    width: 100%;
    display: flex; flex-direction: column; gap: 6px;
  }
  .endpoint-label {
    font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--text-muted, #9a9590);
  }
  .endpoint-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 8px; background: var(--page-bg, #FAF9F7);
  }
  .endpoint-url {
    flex: 1;
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-secondary, #6b6560);
    word-break: break-all;
  }
  .copy-btn {
    appearance: none; border: none; background: none;
    color: var(--text-muted, #9a9590); cursor: pointer;
    padding: 4px; border-radius: 4px; display: flex;
    transition: all 150ms;
  }
  .copy-btn:hover { color: var(--accent, #D97757); background: rgba(217,119,87,0.06); }

  /* ── Wallet warning ── */
  .wallet-warning {
    width: 100%;
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 10px;
    background: rgba(217, 119, 87, 0.06);
    border: 1px solid rgba(217, 119, 87, 0.15);
    font-size: 0.72rem; color: var(--accent, #D97757);
  }

  /* ── VTR progress (Step 2) ── */
  .vtr-progress {
    width: 100%;
    display: flex; flex-direction: column;
    align-items: flex-start;
    padding: 20px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--surface, #fff);
  }
  .vtr-step {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 0;
    opacity: 0.4;
    transition: opacity 400ms;
  }
  .vtr-step.active, .vtr-step.done { opacity: 1; }
  .vtr-icon {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .vtr-icon svg { color: #27864a; }
  .vtr-circle {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
  }
  .vtr-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    border-top-color: var(--accent, #D97757);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .vtr-text {
    display: flex; flex-direction: column; gap: 2px;
  }
  .vtr-label {
    font-size: 0.78rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .vtr-detail {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
  }
  .vtr-connector {
    width: 2px; height: 16px;
    background: var(--border, #E5E0DA);
    margin-left: 11px;
    transition: background 300ms;
  }
  .vtr-connector.done { background: #27864a; }

  .auto-hint {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }
  .auto-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent, #D97757);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ── Success (Step 3) ── */
  .success-icon {
    font-size: 2.4rem;
    animation: bounceIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes bounceIn {
    from { transform: scale(0.3); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .published-card {
    width: 100%;
    padding: 20px;
    border: 1px solid #27864a;
    border-radius: 12px;
    background: rgba(39, 134, 74, 0.03);
    display: flex; flex-direction: column; gap: 12px;
    align-items: center;
  }
  .pub-name {
    font-family: var(--font-mono); font-size: 1rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .pub-badge {
    font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700;
    color: #27864a;
    padding: 3px 10px; border-radius: 8px;
    background: rgba(39, 134, 74, 0.08);
    border: 1px solid rgba(39, 134, 74, 0.2);
  }

  .pub-stats {
    display: flex; gap: 24px; padding: 8px 0;
  }
  .pub-stat {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }
  .ps-value {
    font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .ps-label {
    font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted, #9a9590);
  }

  .pub-revenue {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 8px;
    background: rgba(217, 119, 87, 0.06);
    font-size: 0.72rem; color: var(--accent, #D97757);
    font-weight: 500;
  }

  /* ── Actions ── */
  .step-actions {
    display: flex; gap: 10px; width: 100%; margin-top: 8px;
  }
  .secondary-btn {
    flex: 1; padding: 12px 16px; border-radius: 10px;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    font-size: 0.78rem; font-weight: 500;
    color: var(--text-secondary, #6b6560);
    cursor: pointer; transition: all 140ms;
  }
  .secondary-btn:hover { border-color: var(--accent, #D97757); color: var(--accent, #D97757); }

  .primary-btn {
    flex: 1; padding: 12px 16px; border-radius: 10px;
    border: none; background: var(--accent, #D97757);
    color: #fff; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; transition: all 140ms;
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.25);
  }
  .primary-btn:hover { background: var(--accent-hover, #C4644A); box-shadow: 0 4px 16px rgba(217, 119, 87, 0.3); transform: translateY(-1px); }

  @media (max-width: 640px) {
    .publish-body { padding: 16px; }
    .step-title { font-size: 1.05rem; }
    .step-actions { flex-direction: column; }
    .pub-stats { gap: 16px; }
  }
</style>
