<script lang="ts">
  import { router } from "../../stores/router.ts";

  export let models: { name: string; metric: string; type: string }[] = [];
</script>

<div class="mw">
  {#each models as m}
    <button class="mw-row" on:click={() => router.navigate("model-detail", { modelId: m.name })}>
      <span class="mw-name">{m.name}</span>
      <span class="mw-metric">{m.metric}</span>
    </button>
  {/each}
</div>

<style>
  .mw { display: flex; flex-direction: column; gap: 2px; }
  .mw-row {
    appearance: none; border: none;
    background: rgba(0,0,0,0.02);
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 6px; border-radius: 4px;
    cursor: pointer; transition: background 120ms;
    text-align: left; width: 100%;
  }
  .mw-row:hover { background: rgba(0,0,0,0.04); }
  .mw-name {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500;
    color: var(--text-primary, #2C2824);
  }
  .mw-metric {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 700;
    color: var(--accent, #D97757);
  }
</style>
