<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { resolveExperimentCategory, CATEGORY_COLORS, CATEGORY_LABELS, type ModCategory } from '../data/modifications.ts';
  import { selectedExperimentId } from '../stores/selectionStore.ts';
  import type { Experiment } from '../stores/jobStore.ts';

  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;

  const dispatch = createEventDispatcher<{ select: number }>();

  $: recent = experiments
    .filter(e => e.status !== 'training')
    .slice(0, 20);

  $: trainingList = experiments.filter(e => e.status === 'training');

  function handleClick(id: number) {
    selectedExperimentId.set(id);
    dispatch('select', id);
  }

  function formatDuration(s: number): string {
    if (s >= 3600) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
    if (s >= 60) return `${Math.floor(s / 60)}m${s % 60}s`;
    return `${s}s`;
  }

  function isNewBest(e: Experiment): boolean {
    return e.status === 'keep' && e.metric === bestMetric && e.metric < Infinity;
  }
</script>

<div class="stream">
  <div class="stream-head">
    <span class="stream-title">Feed</span>
    <span class="stream-count">{recent.length}</span>
    {#if trainingList.length > 0}
      <span class="stream-live">
        <span class="live-dot"></span>
        {trainingList.length} training
      </span>
    {/if}
  </div>

  <div class="stream-list">
    {#each trainingList as t (t.id)}
      <div class="st-row training">
        <span class="st-spinner"></span>
        <span class="st-cat" style="color: {CATEGORY_COLORS[resolveExperimentCategory(t.modification)]}">{CATEGORY_LABELS[resolveExperimentCategory(t.modification)] ?? '?'}</span>
        <span class="st-desc">training...</span>
      </div>
    {/each}
    {#each recent as exp (exp.id)}
      <button
        class="st-row"
        class:new-best={isNewBest(exp)}
        class:crash={exp.status === 'crash'}
        class:selected={$selectedExperimentId === exp.id}
        on:click={() => handleClick(exp.id)}
      >
        <span class="st-dot" style="background: {CATEGORY_COLORS[resolveExperimentCategory(exp.modification)]}"></span>
        <span class="st-cat">{CATEGORY_LABELS[resolveExperimentCategory(exp.modification)] ?? '?'}</span>
        <span class="st-metric">
          {#if exp.status === 'crash'}CRASH{:else}{exp.metric.toFixed(3)}{/if}
        </span>
        <span class="st-dur">{formatDuration(exp.duration)}</span>
        {#if isNewBest(exp)}<span class="st-best">★</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .stream {
    display: flex; flex-direction: column;
    min-height: 0; overflow: hidden;
    height: 100%;
  }
  .stream-head {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 8px 4px; flex-shrink: 0;
  }
  .stream-title {
    font: 600 9px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.06em; color: #bbb;
    text-transform: uppercase;
  }
  .stream-count {
    font: 600 9px/1 'Inter', -apple-system, sans-serif;
    color: #ccc;
    background: #f5f5f5; padding: 1px 4px; border-radius: 3px;
  }
  .stream-live {
    display: flex; align-items: center; gap: 3px;
    margin-left: auto;
    font: 500 9px/1 'Inter', -apple-system, sans-serif;
    color: #D97757;
  }
  .live-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #D97757;
    animation: blink 1.5s ease-in-out infinite alternate;
  }
  @keyframes blink { from { opacity: 0.4; } to { opacity: 1; } }

  .stream-list {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
  }
  .stream-list::-webkit-scrollbar { width: 3px; }
  .stream-list::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 2px; }

  .st-row {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 0;
    font: 500 10px/1.4 'Inter', -apple-system, sans-serif;
    color: #555;
    background: transparent; border: none; cursor: pointer;
    text-align: left; width: 100%;
    transition: background 120ms;
    animation: slideIn 200ms ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .st-row:hover { background: #fafafa; }
  .st-row.selected { background: rgba(217,119,87,0.06); box-shadow: inset 2px 0 0 #D97757; }
  .st-row.new-best {
    background: rgba(39,134,74,0.04);
    box-shadow: inset 2px 0 0 #27864a;
  }
  .st-row.crash { color: #c0392b; }
  .st-row.training { color: #999; }

  .st-spinner {
    width: 5px; height: 5px; border-radius: 50%;
    border: 1.5px solid #D97757;
    border-top-color: transparent;
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .st-dot {
    width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0;
  }
  .st-cat {
    font: 700 8px/1 'Inter', -apple-system, sans-serif;
    flex-shrink: 0; min-width: 28px;
    text-transform: uppercase; letter-spacing: 0.04em;
    color: #888;
  }
  .st-metric {
    font: 600 10px/1 'SF Mono', 'Fira Code', monospace;
    color: #444;
    font-variant-numeric: tabular-nums;
  }
  .st-desc {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 9px; color: #999;
  }
  .st-dur {
    color: #ccc; flex-shrink: 0;
    font: 400 9px/1 'Inter', -apple-system, sans-serif;
  }
  .st-best {
    color: #d4a017; font-size: 10px; flex-shrink: 0;
    text-shadow: 0 0 4px rgba(212,160,23,0.3);
  }
</style>
