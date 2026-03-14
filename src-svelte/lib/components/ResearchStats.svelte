<script lang="ts">
  export let nodes: number = 0;
  export let keeps: number = 0;
  export let crashes: number = 0;
  export let completed: number = 0;
  export let total: number = 0;
  export let hitRate: number = 0;
</script>

<div class="stats">
  <div class="stat-row">
    <div class="s">
      <span class="s-val">{nodes}</span>
      <span class="s-lbl">Nodes</span>
    </div>
    <div class="s">
      <span class="s-val">{completed}<span class="s-dim">/{total}</span></span>
      <span class="s-lbl">Configs</span>
    </div>
    <div class="s">
      <span class="s-val green">{keeps}</span>
      <span class="s-lbl">Keep</span>
    </div>
    <div class="s">
      <span class="s-val red">{crashes}</span>
      <span class="s-lbl">Crash</span>
    </div>
    <div class="s">
      <span class="s-val accent">{hitRate}%</span>
      <span class="s-lbl">Hit Rate</span>
    </div>
  </div>
</div>

<style>
  .stats {
    display: flex; flex-direction: column; justify-content: center;
    padding: 10px 14px;
    height: 100%;
  }
  .stat-row {
    display: flex; gap: 10px; flex-wrap: wrap;
    justify-content: center;
  }
  .s {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    min-width: 40px;
  }
  .s-val {
    font: 800 1rem/1 'Inter', -apple-system, sans-serif;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: #333;
  }
  .s-val .s-dim {
    font-weight: 400; font-size: 0.65rem;
    color: #ccc;
  }
  .s-val.green { color: #27864a; }
  .s-val.red { color: #c0392b; }
  .s-val.accent { color: #D97757; }
  .s-lbl {
    font: 500 9px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: #bbb;
  }
</style>
