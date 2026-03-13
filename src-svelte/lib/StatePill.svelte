<script lang="ts">
  export let label: string;
  export let color: string;
</script>

<span class="pill" style:--pill-color={color}>
  <span class="pill-dot"></span>
  {label}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: fit-content;
    padding: 4px 10px;
    border-radius: 100px;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--pill-color);
    background: color-mix(in srgb, var(--pill-color) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--pill-color) 18%, transparent);
    white-space: nowrap;
    transition: background 200ms ease;
  }

  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--pill-color);
    box-shadow: 0 0 6px color-mix(in srgb, var(--pill-color) 50%, transparent);
  }
</style>
