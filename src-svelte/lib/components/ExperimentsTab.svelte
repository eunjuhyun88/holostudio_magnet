<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let m: {
    kept: number;
    discarded: number;
    crashed: number;
  };

  export let experimentLog: Array<{
    id: number;
    status: string;
    mod: string;
    metric: number;
    delta: number;
  }>;

  export let selectedId: number | null = null;

  const dispatch = createEventDispatcher<{
    selectExperiment: { experimentId: number };
  }>();

  function handleRowClick(id: number) {
    selectedId = id;
    dispatch('selectExperiment', { experimentId: id });
  }
</script>

<div class="exp-header">
  <h2 class="mc-heading">Experiment History</h2>
  <div class="exp-summary">
    <span class="exp-badge keep">{m.kept} kept</span>
    <span class="exp-badge discard">{m.discarded} discarded</span>
    <span class="exp-badge crash">{m.crashed} crashed</span>
  </div>
</div>
<div class="exp-table">
  <div class="exp-table-header">
    <span class="exp-col id">#</span>
    <span class="exp-col status">Status</span>
    <span class="exp-col mod">Modification</span>
    <span class="exp-col metric">Metric</span>
    <span class="exp-col delta">Delta</span>
  </div>
  {#each experimentLog as exp}
    <div
      class="exp-table-row"
      class:keep={exp.status === 'keep'}
      class:discard={exp.status === 'discard'}
      class:crash={exp.status === 'crash'}
      class:selected={selectedId === exp.id}
      on:click={() => handleRowClick(exp.id)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && handleRowClick(exp.id)}
    >
      <span class="exp-col id">{exp.id}</span>
      <span class="exp-col status">
        <span class="status-badge {exp.status}">{exp.status.toUpperCase()}</span>
      </span>
      <span class="exp-col mod">{exp.mod}</span>
      <span class="exp-col metric">{exp.status === 'crash' ? '—' : exp.metric.toFixed(3)}</span>
      <span class="exp-col delta" class:positive={exp.delta < 0} class:negative={exp.delta > 0}>
        {#if exp.status === 'crash'}—{:else if exp.delta < 0}↓{Math.abs(exp.delta).toFixed(3)}{:else if exp.delta > 0}↑{exp.delta.toFixed(3)}{:else}—{/if}
      </span>
    </div>
  {/each}
</div>

<style>
  .mc-heading {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 var(--space-3, 12px);
    padding-bottom: var(--space-2, 8px);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .exp-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: var(--space-4, 16px);
  }
  .exp-summary { display: flex; gap: 6px; }
  .exp-badge {
    font-size: 0.62rem; font-weight: 600;
    padding: 2px 8px; border-radius: 4px;
  }
  .exp-badge.keep { background: rgba(39, 134, 74, 0.08); color: var(--green, #27864a); }
  .exp-badge.discard { background: rgba(192, 57, 43, 0.08); color: var(--red, #c0392b); }
  .exp-badge.crash { background: rgba(142, 68, 173, 0.08); color: #8e44ad; }

  .exp-table {
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
    overflow: hidden;
  }
  .exp-table-header {
    display: flex; gap: 0;
    padding: 8px 14px;
    background: var(--border-subtle, #EDEAE5);
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .exp-table-row {
    display: flex; gap: 0;
    padding: 8px 14px;
    font-size: 0.8rem;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    border-left: 3px solid transparent;
    background: var(--surface, #fff);
    transition: background 100ms, border-color 100ms;
    cursor: pointer;
    outline: none;
  }
  .exp-table-row:hover { background: rgba(217, 119, 87, 0.02); }
  .exp-table-row.keep:hover { background: rgba(39, 134, 74, 0.03); }
  .exp-table-row.selected { border-left-color: var(--accent, #D97757); background: rgba(217, 119, 87, 0.04); }
  .exp-table-row:focus-visible { box-shadow: inset 0 0 0 2px rgba(217, 119, 87, 0.3); }
  .exp-col { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
  .exp-col.id { width: 50px; color: var(--text-muted, #9a9590); font-size: 0.72rem; }
  .exp-col.status { width: 90px; }
  .exp-col.mod { flex: 1; font-family: var(--font-body); color: var(--text-secondary, #6b6560); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exp-col.metric { width: 70px; text-align: right; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .exp-col.delta { width: 80px; text-align: right; font-size: 0.72rem; }
  .exp-col.delta.positive { color: var(--green, #27864a); }
  .exp-col.delta.negative { color: var(--red, #c0392b); }

  .status-badge {
    font-size: 0.58rem; font-weight: 700;
    padding: 2px 6px; border-radius: 3px;
    letter-spacing: 0.04em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .status-badge.keep { background: rgba(39, 134, 74, 0.08); color: var(--green, #27864a); }
  .status-badge.discard { background: rgba(192, 57, 43, 0.08); color: var(--red, #c0392b); }
  .status-badge.crash { background: rgba(142, 68, 173, 0.08); color: #8e44ad; }
</style>
