<script lang="ts">
  /**
   * ResearchComplete — Studio COMPLETE state wrapper.
   *
   * Wraps CompletePanel with Studio-specific navigation and actions:
   * - [Deploy] → Models > ModelDetail
   * - [Retrain] → Studio CREATE with existing config
   * - [Improve] → Studio CREATE with improvement config
   * - [New Research] → Studio IDLE
   * - [Model Publish] → Models > ModelDetail (Member only)
   *
   * Events:
   *   newResearch: void — start fresh
   *   deploy: { target: string } — deploy model
   *   retrain: { code: string; parentId: number | null } — edit & retrain
   *   improve: { instruction: string } — improve with instructions
   *   viewModel: { modelId: string } — navigate to model detail
   */
  import { createEventDispatcher } from 'svelte';
  import type { BranchInfo, Experiment } from '../../stores/jobStore.ts';
  import CompletePanel from '../research/CompletePanel.svelte';

  export let branches: BranchInfo[] = [];
  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;
  export let totalExperiments: number = 0;

  const dispatch = createEventDispatcher<{
    newResearch: void;
    deploy: { target: string };
    retrain: { code: string; parentId: number | null };
    improve: { instruction: string };
    viewModel: { modelId: string };
  }>();

  function handleNewResearch() {
    dispatch('newResearch');
  }

  function handleDeploy(e: CustomEvent<{ target: string }>) {
    dispatch('deploy', e.detail);
  }

  function handleRetrain(e: CustomEvent<{ code: string; parentId: number | null }>) {
    dispatch('retrain', e.detail);
  }

  function handleImprove(e: CustomEvent<{ instruction: string }>) {
    dispatch('improve', e.detail);
  }
</script>

<div class="complete-wrapper">
  <div class="complete-panel-container">
    <CompletePanel
      {branches}
      {experiments}
      {bestMetric}
      expandable={false}
      on:newresearch={handleNewResearch}
      on:deploy={handleDeploy}
      on:retrain={handleRetrain}
      on:improve={handleImprove}
    />
  </div>

  <!-- Studio-specific: model publish CTA -->
  <div class="publish-section">
    <div class="publish-hint">
      <span class="publish-icon">&#x1F3F7;</span>
      <span class="publish-text">모델을 발행하면 다른 사용자들이 사용하고, 사용량에 따라 수익을 받을 수 있어요</span>
    </div>
    <div class="publish-actions">
      <button class="publish-btn" on:click={() => dispatch('deploy', { target: 'publish' })}>
        모델 발행하기 &rarr;
      </button>
      <button class="my-models-btn" on:click={handleNewResearch}>
        새 연구 시작하기
      </button>
    </div>
  </div>
</div>

<style>
  .complete-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e2e;
    border-radius: 12px;
    overflow: hidden;
  }

  .complete-panel-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* ── Studio-specific publish section ── */
  .publish-section {
    padding: 10px 14px;
    border-top: 1px solid #313244;
    background: #181825;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .publish-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 400 10px/1.4 'SF Mono', 'Fira Code', monospace;
    color: #585b70;
  }

  .publish-icon {
    font-size: 12px;
  }

  .publish-text {
    flex: 1;
  }

  .publish-actions {
    display: flex;
    gap: 6px;
  }

  .publish-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font: 600 11px/1 'SF Mono', 'Fira Code', monospace;
    cursor: pointer;
    transition: all 150ms;
  }
  .publish-btn:hover {
    background: var(--accent-hover, #C4644A);
  }

  .my-models-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid #313244;
    background: transparent;
    color: #a6adc8;
    font: 500 11px/1 'SF Mono', 'Fira Code', monospace;
    cursor: pointer;
    transition: all 150ms;
  }
  .my-models-btn:hover {
    border-color: #45475a;
    color: #cdd6f4;
    background: rgba(205, 214, 244, 0.04);
  }
</style>
