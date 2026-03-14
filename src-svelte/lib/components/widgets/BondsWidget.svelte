<script lang="ts">
  export let bonds: { name: string; tier: string; amount: string }[] = [
    { name: "seoul-4090", tier: "Standard", amount: "2,000" },
    { name: "berlin-a100", tier: "Enterprise", amount: "10,000" },
  ];
</script>

<div class="bw">
  {#each bonds as b}
    <div class="bw-row">
      <span class="bw-name">{b.name}</span>
      <span class="bw-tier">{b.tier}</span>
      <span class="bw-amt">{b.amount}</span>
    </div>
  {/each}
</div>

<style>
  .bw { display: flex; flex-direction: column; gap: 3px; }
  .bw-row {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.02);
  }
  .bw-name {
    font-family: var(--font-mono); font-size: 0.56rem; font-weight: 600;
    color: var(--text-muted, #9a9590); flex: 1;
  }
  .bw-tier {
    font-family: var(--font-mono); font-size: 0.44rem; font-weight: 600;
    color: var(--gold, #d4a017);
    padding: 1px 4px; border-radius: 3px;
    background: rgba(212,160,23,0.1);
  }
  .bw-amt {
    font-family: var(--font-mono); font-size: 0.56rem; font-weight: 700;
    color: var(--text-primary, #2C2824);
  }
</style>
