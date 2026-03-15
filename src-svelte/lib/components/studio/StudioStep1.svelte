<script lang="ts">
  /**
   * StudioStep1 — Topic input (spec §3.4)
   *
   * Focused single-purpose screen:
   *   - Big question: "어떤 연구를 하고 싶으세요?"
   *   - Topic input
   *   - Example chips (clickable)
   *   - [계속 →] button
   *   - [← 돌아가기] back
   *
   * Events:
   *   back: void — go to IDLE
   *   continue: { topic: string } — go to STEP2
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { studioStore, studioTopic } from '../../stores/studioStore.ts';

  const dispatch = createEventDispatcher<{
    back: void;
    continue: { topic: string };
  }>();

  let topic = $studioTopic || '';
  let inputEl: HTMLInputElement;

  const examples = [
    { label: '한국어 법률 Q&A 챗봇', topic: '한국어 법률 Q&A 챗봇' },
    { label: '스팸 탐지', topic: '스팸 탐지 모델' },
    { label: '의료 영상 분류', topic: '의료 영상 분류 모델' },
    { label: '고객 이탈 예측', topic: '고객 이탈 예측 모델' },
    { label: '감성 분석', topic: '감성 분석 모델' },
    { label: '시계열 예측', topic: '시계열 가격 예측 모델' },
  ];

  function selectExample(ex: typeof examples[0]) {
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

  onMount(() => {
    inputEl?.focus();
  });
</script>

<div class="step1">
  <div class="step1-header">
    <button class="back-btn" on:click={() => dispatch('back')} aria-label="돌아가기">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>돌아가기</span>
    </button>
  </div>

  <div class="step1-body">
    <h2 class="step1-question">어떤 연구를 하고 싶으세요?</h2>

    <div class="input-wrap">
      <input
        bind:this={inputEl}
        bind:value={topic}
        type="text"
        class="topic-input"
        class:has-value={topic.trim().length > 0}
        placeholder="비트코인 가격 예측 모델"
        on:keydown={handleKeydown}
      />
    </div>

    <div class="examples">
      <span class="examples-label">예시를 눌러보세요</span>
      <div class="example-chips">
        {#each examples as ex}
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
        계속 &rarr;
      </button>
    </div>
  </div>
</div>

<style>
  .step1 {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    justify-content: center;
    gap: 28px;
    padding: 40px 32px 80px;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  .step1-question {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.6rem;
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
    border-radius: 20px;
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
    border-radius: 12px;
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
      padding: 24px 16px 60px;
      gap: 24px;
    }
    .step1-question { font-size: 1.3rem; }
    .topic-input { font-size: 0.95rem; padding: 14px 16px; }
    .example-chip { padding: 6px 12px; font-size: 0.7rem; }
  }
</style>
