<script lang="ts">
  import PixelOwl from './PixelOwl.svelte';

  export let topic: string = '';
  export let statusMessage: string = '';
</script>

<div class="setup-state">
  <div class="setup-owl">
    <PixelOwl size={1} mood="research" />
  </div>
  <div class="setup-terminal">
    <div class="term-dots">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="term-title">hoot — setup</span>
    </div>
    <div class="term-body">
      <div class="term-line"><span class="term-prompt">❯</span> hoot init --topic "{topic}"</div>
      <div class="term-line dim"><span class="term-cursor"></span>{statusMessage}</div>
    </div>
  </div>
</div>

<style>
  .setup-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 64px 32px; min-height: 60vh; gap: 24px;
    animation: setup-enter 0.5s ease-out;
  }
  .setup-owl { filter: drop-shadow(0 0 20px rgba(217, 119, 87, 0.12)); }
  @keyframes setup-enter {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  .setup-terminal {
    background: #0D0D14; border-radius: 10px; overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255,255,255,0.06);
    width: 100%; max-width: 520px;
  }
  .term-dots {
    display: flex; align-items: center; gap: 6px; padding: 10px 14px;
    background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot.red { background: #FF5F57; }
  .dot.yellow { background: #FEBC2E; }
  .dot.green { background: #28C840; }
  .term-title {
    margin-left: 8px; font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; color: rgba(255,255,255,0.3); letter-spacing: 0.04em;
  }
  .term-body {
    padding: 14px 16px; font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem; line-height: 1.7;
  }
  .term-line { color: rgba(255,255,255,0.7); }
  .term-line.dim { color: rgba(255,255,255,0.35); }
  .term-prompt { color: #D97757; margin-right: 8px; font-weight: 700; }
  .term-cursor {
    display: inline-block; width: 6px; height: 12px; background: #D97757;
    margin-right: 6px; animation: blink 1s step-end infinite; vertical-align: middle;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>
