<script lang="ts">
  /**
   * GPUOnboardWizard — 4-step GPU onboarding wizard.
   *
   * Step 1: Connect GPU (detect → confirm)
   * Step 2: Select Tier & Bond (Lite/Standard/Enterprise + approve)
   * Step 3: PoAW Initial Verification (auto-progress)
   * Step 4: Confirmation (registered, show available jobs)
   *
   * Events:
   *   close: void — dismiss wizard
   *   complete: { nodeId: string; tier: number } — GPU registered
   */
  import { createEventDispatcher } from 'svelte';
  import { wallet } from '../../stores/walletStore.ts';
  import { nodeStore } from '../../stores/nodeStore.ts';

  const dispatch = createEventDispatcher<{
    close: void;
    complete: { nodeId: string; tier: number };
  }>();

  let step: 1 | 2 | 3 | 4 = 1;
  let connectionType: 'local' | 'remote' = 'local';
  let selectedTier = 2;
  let detecting = false;
  let detected = false;
  let registering = false;

  // PoAW verification state
  interface PoAWStep { label: string; done: boolean; active: boolean; }
  let poawSteps: PoAWStep[] = [
    { label: 'GPU 벤치마크 실행 완료', done: false, active: false },
    { label: '블록 서명 테스트 중...', done: false, active: false },
    { label: 'PoAW 검증자 승인 대기', done: false, active: false },
  ];

  // Demo GPU detection
  const detectedGPU = { model: 'NVIDIA RTX 4090', vram: 24 };

  const TIERS = [
    { id: 1, name: 'Lite', bond: 500, desc: 'GPU 1대 · 기본 잡', multiplier: '1.0×', color: '#9a9590' },
    { id: 2, name: 'Standard', bond: 2000, desc: 'GPU 4대 · 잡 무제한', multiplier: '1.5×', color: 'var(--accent, #D97757)' },
    { id: 3, name: 'Enterprise', bond: 10000, desc: 'GPU 무제한 · 우선 배정', multiplier: '3.0×', color: 'var(--green, #27864a)' },
  ];

  // Demo available jobs
  const availableJobs = [
    { id: 'eth-ts', tier: 2, reward: 8, name: 'eth-ts' },
    { id: 'spam-v3', tier: 1, reward: 3, name: 'spam-v3' },
  ];

  function detectGPU() {
    detecting = true;
    setTimeout(() => {
      detecting = false;
      detected = true;
    }, 1500);
  }

  function goToStep2() {
    step = 2;
  }

  $: currentTier = TIERS.find(t => t.id === selectedTier)!;

  function registerNode() {
    registering = true;
    const tier = TIERS.find(t => t.id === selectedTier)!;
    setTimeout(() => {
      nodeStore.registerNode({
        gpuModel: detectedGPU.model,
        vramGb: detectedGPU.vram,
        tier: selectedTier,
        bondAmount: tier.bond,
      });
      registering = false;
      step = 3;
      runPoAWVerification();
    }, 2000);
  }

  async function runPoAWVerification() {
    for (let i = 0; i < poawSteps.length; i++) {
      poawSteps[i].active = true;
      poawSteps = [...poawSteps];
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      poawSteps[i].done = true;
      poawSteps[i].active = false;
      poawSteps = [...poawSteps];
    }
    // Auto-advance to step 4
    setTimeout(() => { step = 4; }, 500);
  }

  function handleComplete() {
    const state = { nodeId: 'node-' + Math.random().toString(36).slice(2, 6), tier: selectedTier };
    dispatch('complete', state);
  }
</script>

<div class="wizard-overlay" on:click|self={() => dispatch('close')}>
  <div class="wizard">
    <!-- Header -->
    <div class="wiz-header">
      <h2 class="wiz-title">
        {#if step === 1}GPU 연결
        {:else if step === 2}노드 본딩
        {:else if step === 3}PoAW 초기 검증
        {:else}등록 완료!
        {/if}
      </h2>
      <span class="wiz-step">{step}/4</span>
      <button class="wiz-close" on:click={() => dispatch('close')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Step 1: Connect GPU -->
    {#if step === 1}
      <div class="wiz-body">
        <span class="wiz-label">연결 방법을 선택하세요:</span>
        <div class="conn-options">
          <button
            class="conn-card"
            class:conn-active={connectionType === 'local'}
            on:click={() => { connectionType = 'local'; }}
          >
            <span class="conn-icon">🖥</span>
            <span class="conn-name">로컬</span>
            <span class="conn-desc">이 컴퓨터 GPU 사용</span>
          </button>
          <button
            class="conn-card"
            class:conn-active={connectionType === 'remote'}
            on:click={() => { connectionType = 'remote'; }}
          >
            <span class="conn-icon">☁️</span>
            <span class="conn-name">원격</span>
            <span class="conn-desc">서버/클라우드 GPU</span>
          </button>
        </div>

        {#if !detected && !detecting}
          <button class="detect-btn" on:click={detectGPU}>
            GPU 감지 시작
          </button>
        {/if}

        {#if detecting}
          <div class="detecting">
            <span class="detect-spinner"></span>
            <span>GPU 감지 중...</span>
          </div>
        {/if}

        {#if detected}
          <div class="detected-info">
            <span class="di-icon">✓</span>
            <div class="di-body">
              <span class="di-model">{detectedGPU.model} ({detectedGPU.vram}GB)</span>
              <span class="di-status">● 연결됨</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="wiz-footer">
        <button class="wiz-btn secondary" on:click={() => dispatch('close')}>취소</button>
        <button class="wiz-btn primary" disabled={!detected} on:click={goToStep2}>
          다음: 본딩 →
        </button>
      </div>

    <!-- Step 2: Select Tier & Bond -->
    {:else if step === 2}
      <div class="wiz-body">
        <div class="tier-tabs">
          {#each TIERS as tier}
            <button
              class="tier-tab"
              class:tier-active={selectedTier === tier.id}
              style:border-color={selectedTier === tier.id ? tier.color : 'transparent'}
              on:click={() => { selectedTier = tier.id; }}
            >
              <span class="tt-name" style:color={tier.color}>{tier.name} {tier.bond}H</span>
            </button>
          {/each}
        </div>

        <div class="tier-detail">
          <span class="td-desc">{currentTier.desc}</span>
          <span class="td-mult">보상 배수: <strong>{currentTier.multiplier}</strong></span>
        </div>

        <div class="bond-summary">
          <div class="bs-row">
            <span>본딩 금액</span>
            <span class="bs-val">{currentTier.bond.toLocaleString()} HOOT</span>
          </div>
          <div class="bs-row">
            <span>잔액</span>
            <span class="bs-val">12,450 HOOT</span>
          </div>
        </div>

        {#if !$wallet.connected}
          <div class="wallet-warn">지갑을 먼저 연결해주세요</div>
        {/if}
      </div>

      <div class="wiz-footer">
        <button class="wiz-btn secondary" on:click={() => { step = 1; }}>← 돌아가기</button>
        <button class="wiz-btn primary" disabled={registering || !$wallet.connected} on:click={registerNode}>
          {#if registering}
            <span class="btn-spinner"></span> 등록 중...
          {:else}
            Approve & Bond →
          {/if}
        </button>
      </div>

    <!-- Step 3: PoAW Verification -->
    {:else if step === 3}
      <div class="wiz-body">
        <p class="poaw-desc">GPU 성능을 검증하고 네트워크에 등록하고 있습니다.</p>

        <div class="poaw-progress">
          {#each poawSteps as ps, i}
            <div class="poaw-step" class:done={ps.done} class:active={ps.active}>
              <div class="poaw-icon">
                {#if ps.done}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {:else if ps.active}
                  <div class="poaw-spinner"></div>
                {:else}
                  <div class="poaw-circle"></div>
                {/if}
              </div>
              <span class="poaw-label">{ps.label}</span>
            </div>
            {#if i < poawSteps.length - 1}
              <div class="poaw-connector" class:done={ps.done}></div>
            {/if}
          {/each}
        </div>

        <div class="poaw-hint">
          <div class="poaw-dot"></div>
          자동 진행 중
        </div>
      </div>

    <!-- Step 4: Complete -->
    {:else}
      <div class="wiz-body">
        <div class="success-icon">🎉</div>

        <div class="result-card">
          <div class="rc-row"><span>노드 ID</span><strong>seoul-4090</strong></div>
          <div class="rc-row"><span>Tier</span><strong>{TIERS.find(t => t.id === selectedTier)?.name} ({TIERS.find(t => t.id === selectedTier)?.bond.toLocaleString()} HOOT)</strong></div>
          <div class="rc-row"><span>Trust Score</span><strong>100/1000 (Silver)</strong></div>
        </div>

        <div class="avail-jobs">
          <span class="aj-label">지금 가용한 Job:</span>
          {#each availableJobs as job}
            <div class="aj-row">
              <span class="aj-name">{job.name}</span>
              <span class="aj-tier">Tier{job.tier}+</span>
              <span class="aj-reward">{job.reward} HOOT</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="wiz-footer">
        <button class="wiz-btn secondary" on:click={handleComplete}>
          네트워크 보기 →
        </button>
        <button class="wiz-btn primary" on:click={handleComplete}>
          Job 수락하기 →
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .wizard-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
    animation: fadeIn 200ms ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .wizard {
    width: 440px; max-width: 92vw;
    max-height: 85vh;
    background: var(--surface, #fff);
    border-radius: 20px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
    display: flex; flex-direction: column;
    overflow: hidden;
    animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .wiz-header {
    display: flex; align-items: center; gap: 8px;
    padding: 20px 24px 0;
  }
  .wiz-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0; flex: 1;
  }
  .wiz-step {
    font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    padding: 2px 8px; border-radius: 4px;
    background: rgba(0,0,0,0.03);
  }
  .wiz-close {
    appearance: none; border: none; background: none;
    padding: 4px; cursor: pointer; color: var(--text-muted, #9a9590);
    border-radius: 6px; transition: all 150ms;
  }
  .wiz-close:hover { background: rgba(0,0,0,0.05); color: var(--text-primary, #2D2D2D); }

  .wiz-body {
    flex: 1; overflow-y: auto;
    padding: 20px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }

  .wiz-footer {
    display: flex; gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }

  .wiz-label {
    font-size: 0.76rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
  }

  /* Connection options */
  .conn-options { display: flex; gap: 10px; }
  .conn-card {
    flex: 1; appearance: none;
    border: 2px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff);
    border-radius: 14px;
    padding: 16px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    transition: all 200ms;
  }
  .conn-card:hover { border-color: var(--border, #E5E0DA); }
  .conn-active { border-color: var(--accent, #D97757) !important; background: rgba(217,119,87,0.03); }
  .conn-icon { font-size: 1.5rem; }
  .conn-name { font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .conn-desc { font-size: 0.6rem; color: var(--text-muted, #9a9590); text-align: center; }

  .detect-btn {
    appearance: none; border: 1px solid var(--accent, #D97757);
    background: rgba(217,119,87,0.05); color: var(--accent, #D97757);
    padding: 10px 20px; border-radius: 10px;
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
    transition: all 150ms;
  }
  .detect-btn:hover { background: rgba(217,119,87,0.1); }

  .detecting {
    display: flex; align-items: center; gap: 8px;
    padding: 12px; border-radius: 10px;
    background: rgba(0,0,0,0.02);
    font-size: 0.76rem; color: var(--text-secondary, #6b6560);
  }
  .detect-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--accent, #D97757);
    animation: spin 600ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .detected-info {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-radius: 10px;
    background: rgba(39,134,74,0.05);
    border: 1px solid rgba(39,134,74,0.15);
  }
  .di-icon {
    width: 24px; height: 24px; border-radius: 50%;
    background: rgba(39,134,74,0.15); color: var(--green, #27864a);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .di-body { display: flex; flex-direction: column; gap: 2px; }
  .di-model { font-size: 0.78rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .di-status { font-size: 0.62rem; color: var(--green, #27864a); font-weight: 600; }

  /* Tier selection */
  .tier-tabs { display: flex; gap: 6px; }
  .tier-tab {
    flex: 1; appearance: none;
    border: 2px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff);
    border-radius: 10px;
    padding: 10px 8px; cursor: pointer;
    text-align: center;
    transition: all 200ms;
  }
  .tier-tab:hover { border-color: var(--border, #E5E0DA); }
  .tier-active { background: rgba(0,0,0,0.02); }
  .tt-name { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; }

  .tier-detail {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px 16px; border-radius: 10px;
    background: rgba(0,0,0,0.02);
  }
  .td-desc { font-size: 0.72rem; color: var(--text-secondary, #6b6560); }
  .td-mult { font-size: 0.68rem; color: var(--text-muted, #9a9590); }
  .td-mult strong { color: var(--text-primary, #2D2D2D); }

  .bond-summary {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px 16px; border-radius: 10px;
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .bs-row {
    display: flex; justify-content: space-between;
    font-size: 0.72rem; color: var(--text-secondary, #6b6560);
  }
  .bs-val { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary, #2D2D2D); }

  .wallet-warn {
    padding: 10px;
    border-radius: 8px;
    background: rgba(192,57,43,0.05);
    border: 1px solid rgba(192,57,43,0.15);
    font-size: 0.68rem;
    color: #c0392b;
    text-align: center;
  }

  /* PoAW Verification (Step 3) */
  .poaw-desc {
    font-size: 0.76rem; color: var(--text-muted, #9a9590);
    margin: 0; text-align: center;
  }
  .poaw-progress {
    display: flex; flex-direction: column;
    padding: 16px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 12px;
    background: var(--surface, #fff);
  }
  .poaw-step {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0; opacity: 0.4;
    transition: opacity 400ms;
  }
  .poaw-step.active, .poaw-step.done { opacity: 1; }
  .poaw-icon {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .poaw-icon svg { color: #27864a; }
  .poaw-circle {
    width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
  }
  .poaw-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid var(--border, #E5E0DA);
    border-top-color: var(--accent, #D97757);
    animation: spin 600ms linear infinite;
  }
  .poaw-label {
    font-size: 0.76rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
  }
  .poaw-connector {
    width: 2px; height: 14px;
    background: var(--border, #E5E0DA);
    margin-left: 10px;
    transition: background 300ms;
  }
  .poaw-connector.done { background: #27864a; }
  .poaw-hint {
    display: flex; align-items: center; gap: 8px;
    justify-content: center;
    font-size: 0.68rem; color: var(--text-muted, #9a9590);
  }
  .poaw-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent, #D97757);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Success */
  .success-icon { font-size: 2rem; text-align: center; }

  .result-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 16px; border-radius: 12px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.01);
  }
  .rc-row {
    display: flex; justify-content: space-between;
    font-size: 0.72rem; color: var(--text-secondary, #6b6560);
  }
  .rc-row strong { font-family: var(--font-mono); color: var(--text-primary, #2D2D2D); }

  .avail-jobs { display: flex; flex-direction: column; gap: 6px; }
  .aj-label {
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
  }
  .aj-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 8px;
    background: rgba(0,0,0,0.02);
    font-size: 0.72rem;
  }
  .aj-name { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary, #2D2D2D); flex: 1; }
  .aj-tier {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    padding: 1px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.04);
  }
  .aj-reward { font-family: var(--font-mono); font-weight: 600; color: var(--green, #27864a); }

  /* Buttons */
  .wiz-btn {
    flex: 1; appearance: none; border: none;
    padding: 10px 18px; border-radius: 10px;
    font-size: 0.78rem; font-weight: 600;
    cursor: pointer; transition: all 150ms;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .wiz-btn.primary {
    background: var(--accent, #D97757); color: #fff;
  }
  .wiz-btn.primary:hover { background: var(--accent-hover, #C4644A); }
  .wiz-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .wiz-btn.secondary {
    background: transparent;
    border: 1px solid var(--border, #E5E0DA);
    color: var(--text-secondary, #6b6560);
  }
  .wiz-btn.secondary:hover { border-color: var(--text-muted, #9a9590); }

  .btn-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    animation: spin 600ms linear infinite;
  }

  @media (max-width: 500px) {
    .wizard { border-radius: 16px; }
    .wiz-body { padding: 16px; }
    .conn-options { flex-direction: column; }
    .tier-tabs { flex-direction: column; }
  }
</style>
