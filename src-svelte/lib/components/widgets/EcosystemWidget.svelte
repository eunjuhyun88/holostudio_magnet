<script lang="ts">
  import { router } from "../../stores/router.ts";

  export let tvl = "$12.4M";
  export let burned = "847K";
  export let bonds = "2,341";
  export let trustScore = 847;
  export let mau = "892 / 1,443";
  export let mauPercent = 62;
</script>

<button class="eco" on:click={() => router.navigate("protocol")}>
  <div class="eco-grid">
    <div class="eco-stat">
      <span class="eco-val eco-accent">{tvl}</span>
      <span class="eco-key">TVL</span>
    </div>
    <div class="eco-stat">
      <span class="eco-val eco-red">{burned}</span>
      <span class="eco-key">Burned</span>
    </div>
    <div class="eco-stat">
      <span class="eco-val">{bonds}</span>
      <span class="eco-key">Bonds</span>
    </div>
    <div class="eco-stat">
      <span class="eco-val eco-green">{trustScore}</span>
      <span class="eco-key">Trust</span>
    </div>
  </div>
  <div class="eco-mau">
    <span class="eco-mau-label">MAU</span>
    <span class="eco-mau-val">{mau}</span>
    <div class="eco-mau-bar">
      <div class="eco-mau-fill" style:width="{mauPercent}%"></div>
    </div>
  </div>
</button>

<style>
  .eco {
    appearance: none; border: none; background: transparent;
    width: 100%; cursor: pointer; text-align: left;
  }
  .eco-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px; margin-bottom: 10px;
  }
  .eco-stat {
    display: flex; flex-direction: column; gap: 2px;
    padding: 4px 0;
  }
  .eco-val {
    font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700;
    color: var(--text-primary, #2C2824); line-height: 1;
  }
  .eco-accent { color: var(--accent, #D97757); }
  .eco-red { color: var(--red, #c0392b); }
  .eco-green { color: var(--green, #27864a); }
  .eco-key {
    font-family: var(--font-mono); font-size: 0.42rem; font-weight: 600;
    color: var(--text-muted, #9a9590); text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .eco-mau {
    display: flex; align-items: center; gap: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .eco-mau-label {
    font-family: var(--font-mono); font-size: 0.44rem; font-weight: 700;
    color: var(--text-muted, #9a9590); text-transform: uppercase;
  }
  .eco-mau-val {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 600;
    color: var(--text-primary, #2C2824);
  }
  .eco-mau-bar {
    flex: 1; height: 4px; border-radius: 2px;
    background: rgba(0,0,0,0.04);
  }
  .eco-mau-fill {
    height: 100%; border-radius: 2px;
    background: var(--green, #27864a);
    transition: width 600ms ease;
    box-shadow: 0 0 3px rgba(39,134,74,0.2);
  }
</style>
