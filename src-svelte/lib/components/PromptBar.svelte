<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { JobPhase } from '../stores/jobStore.ts';

  export let phase: JobPhase = 'idle';
  export let topic: string = '';
  export let progress: number = 0;
  export let eta: string = '—';
  export let paused: boolean = false;
  export let setupMessage: string = '';
  export let runtimeReadonly: boolean = false;

  const dispatch = createEventDispatcher<{
    stop: void;
    pause: void;
    newresearch: void;
  }>();
</script>

<!-- Status-only bar — all input lives in ContextPanel -->
<div class="status-bar" class:idle={phase === 'idle'} class:running={phase === 'running'} class:setup={phase === 'setup'} class:complete={phase === 'complete'}>
  {#if phase === 'idle'}
    <span class="sb-icon">🦉</span>
    <span class="sb-label">Ready to research</span>
    <span class="sb-hint">← Enter a topic in the panel to begin</span>

  {:else if phase === 'setup'}
    <span class="sb-spinner"></span>
    <span class="sb-label">{setupMessage}</span>

  {:else if phase === 'running'}
    <span class="sb-dot"></span>
    <span class="sb-topic" title={topic}>{topic}</span>
    <div class="sb-spacer"></div>
    <div class="sb-progress-wrap">
      <div class="sb-progress-fill" style="width: {progress}%"></div>
    </div>
    <span class="sb-progress-text">{progress}%</span>
    <span class="sb-eta">ETA {eta}</span>
    <div class="sb-controls">
      <button class="sb-btn" on:click={() => dispatch('pause')} disabled={runtimeReadonly} title={paused ? 'Resume' : 'Pause'}>
        {#if paused}
          <svg width="11" height="11" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>
        {:else}
          <svg width="11" height="11" viewBox="0 0 16 16"><rect x="3" y="2" width="3" height="12" rx="0.5" fill="currentColor"/><rect x="10" y="2" width="3" height="12" rx="0.5" fill="currentColor"/></svg>
        {/if}
      </button>
      <button class="sb-btn sb-stop" on:click={() => dispatch('stop')} disabled={runtimeReadonly} title="Stop">
        <svg width="10" height="10" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/></svg>
      </button>
    </div>

  {:else if phase === 'complete'}
    <svg class="sb-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span class="sb-label complete-label">Research Complete</span>
    <span class="sb-topic dim">{topic}</span>
    <div class="sb-spacer"></div>
    <button class="sb-new" on:click={() => dispatch('newresearch')}>New Research</button>
  {/if}
</div>

<style>
  .status-bar {
    display: flex; align-items: center;
    padding: 0 16px; gap: 10px;
    height: 40px;
    background: #fff;
    border-bottom: 1px solid #eee;
    font: 500 12px/1 'Inter', -apple-system, sans-serif;
    color: #888;
  }

  .sb-icon { font-size: 1rem; }
  .sb-label { color: #666; font-weight: 600; white-space: nowrap; }
  .sb-hint { color: #bbb; font-size: 11px; }

  /* Spinner */
  .sb-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid #D97757; border-top-color: transparent;
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Running */
  .sb-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #27864a; flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(39, 134, 74, 0.3); }
    50% { box-shadow: 0 0 0 4px rgba(39, 134, 74, 0); }
  }
  .sb-topic {
    font-weight: 600; color: #444;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 300px;
  }
  .sb-topic.dim { color: #999; font-weight: 400; }
  .sb-spacer { flex: 1; }

  .sb-progress-wrap {
    width: 60px; height: 3px; border-radius: 2px;
    background: #eee; overflow: hidden; flex-shrink: 0;
  }
  .sb-progress-fill {
    height: 100%; border-radius: 2px;
    background: #D97757; transition: width 300ms ease;
  }
  .sb-progress-text {
    font: 700 11px/1 'Inter', -apple-system, sans-serif;
    color: #D97757; font-variant-numeric: tabular-nums;
    min-width: 26px; text-align: right;
  }
  .sb-eta { font-size: 11px; color: #bbb; }

  .sb-controls { display: flex; gap: 4px; flex-shrink: 0; }
  .sb-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border: none; border-radius: 7px;
    background: #f5f5f5; color: #888; cursor: pointer;
    transition: all 150ms;
  }
  .sb-btn:hover:not(:disabled) { background: #eee; color: #444; }
  .sb-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .sb-stop:hover:not(:disabled) { background: rgba(192,57,43,0.06); color: #c0392b; }

  /* Complete */
  .sb-check { color: #27864a; flex-shrink: 0; }
  .complete-label { color: #27864a; }
  .sb-new {
    padding: 6px 14px; border: 1px solid #D97757; border-radius: 7px;
    background: transparent; color: #D97757;
    font: 600 11px/1 'Inter', -apple-system, sans-serif;
    cursor: pointer; white-space: nowrap; transition: all 200ms;
  }
  .sb-new:hover { background: #D97757; color: #fff; }
</style>
