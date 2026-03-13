<script lang="ts">
  export let label: string;
  export let active = false;
  export let disabled = false;
</script>

<button class:active class="btn" {disabled} on:click>
  {#if active}
    <span class="active-dot"></span>
  {/if}
  {label}
</button>

<style>
  .btn {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.4);
    border-radius: 100px;
    padding: 6px 14px;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 180ms ease;
    -webkit-user-select: none;
    user-select: none;
  }

  .btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }

  .btn.active {
    background: rgba(51, 209, 255, 0.1);
    border-color: rgba(51, 209, 255, 0.25);
    color: #8deaff;
  }

  .btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .active-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #33d1ff;
    box-shadow: 0 0 8px rgba(51, 209, 255, 0.5);
  }
</style>
