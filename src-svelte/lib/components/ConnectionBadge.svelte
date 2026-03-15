<script lang="ts">
  import { connectionMode, isConnected } from '../stores/connectionStore.ts';
</script>

<button
  class="connection-badge"
  class:connected={$isConnected}
  on:click={() => connectionMode.toggle()}
  title={$isConnected ? 'Connected to API — click to switch to Demo' : 'Demo mode — click to connect to API'}
>
  <span class="dot" />
  <span class="label">{$connectionMode === 'connected' ? 'Live' : 'Demo'}</span>
</button>

<style>
  .connection-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid var(--border, rgba(255 255 255 / 0.1));
    background: rgba(255 255 255 / 0.04);
    color: var(--text-muted, #999);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .connection-badge:hover {
    background: rgba(255 255 255 / 0.08);
    border-color: rgba(255 255 255 / 0.2);
  }

  .connection-badge.connected {
    border-color: rgba(0, 220, 130, 0.3);
    color: var(--green, #00dc82);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #666);
    transition: background 0.2s ease;
  }

  .connected .dot {
    background: var(--green, #00dc82);
    box-shadow: 0 0 6px rgba(0, 220, 130, 0.5);
  }

  .label {
    text-transform: uppercase;
  }
</style>
