<script lang="ts">
  export let bestMetric: number = Infinity;
  export let baselineMetric: number = Infinity;
  export let targetPercent: number = 80;

  $: achieved = baselineMetric !== Infinity && bestMetric !== Infinity
    ? Math.round(((baselineMetric - bestMetric) / baselineMetric) * 10000) / 100
    : 0;
  $: achievedDisplay = bestMetric !== Infinity ? bestMetric.toFixed(2) : '--';
  $: isComplete = achieved >= targetPercent;
</script>

<div class="boost" class:complete={isComplete}>
  <span class="boost-metric">{achievedDisplay}</span>
  <span class="boost-label">{isComplete ? '✓ TARGET' : 'BOOST'}</span>
  <span class="boost-cost">25K <span class="boost-token">MAGNET</span></span>
</div>

<style>
  .boost {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 10px;
    font: 600 0.55rem/1 var(--font-mono, monospace);
    color: var(--text-secondary, #9a9590);
  }
  .boost-metric {
    font: 800 0.7rem/1 var(--font-mono, monospace);
    color: var(--text-primary, #3d3832);
    letter-spacing: -0.02em;
  }
  .boost.complete .boost-metric {
    color: var(--green, #27864a);
    text-shadow: 0 0 6px rgba(39,134,74,0.2);
  }
  .boost-label {
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    font-size: 0.5rem;
  }
  .boost-cost {
    margin-left: auto;
    color: var(--gold, #d4a017);
    font-weight: 700;
  }
  .boost-token {
    font-weight: 500; font-size: 0.45rem;
    letter-spacing: 0.06em;
  }
</style>
