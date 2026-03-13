<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = "";
  export let tone = "#f4f7fb";
  export let emphasized = false;
</script>

<div
  class:emphasized
  class="card"
  style={`--tone: ${tone};`}
>
  <div class="label">{label}</div>
  <div class="value">{value}</div>
  {#if detail}
    <div class="detail">{detail}</div>
  {/if}
</div>

<style>
  .card {
    display: grid;
    gap: 8px;
    padding: 18px 18px 16px;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(12, 18, 34, 0.94), rgba(8, 12, 24, 0.84));
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.22);
  }

  .card.emphasized {
    border-color: color-mix(in srgb, var(--tone) 40%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--tone) 16%, transparent) inset,
      0 18px 32px rgba(0, 0, 0, 0.22);
  }

  .label {
    font-size: 0.82rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8ea0bf;
  }

  .value {
    font-size: clamp(1.7rem, 2vw, 2.25rem);
    line-height: 1;
    color: var(--tone);
    font-weight: 700;
  }

  .detail {
    color: #a7b7d2;
    font-size: 0.96rem;
    line-height: 1.45;
  }
</style>
