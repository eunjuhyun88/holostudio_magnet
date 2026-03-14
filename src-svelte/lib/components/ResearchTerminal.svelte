<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Experiment } from '../stores/jobStore.ts';

  export let eventLog: { time: string; type: string; message: string }[] = [];
  export let trainingExp: Experiment | null = null;
  export let title: string = 'hoot — research log';
  export let collapsed: boolean = false;

  let terminalEl: HTMLDivElement;
  let scrollRafHandle: number | null = null;

  // Auto-scroll with RAF cleanup
  $: if (terminalEl && eventLog.length && !collapsed) {
    if (scrollRafHandle !== null) cancelAnimationFrame(scrollRafHandle);
    scrollRafHandle = requestAnimationFrame(() => {
      if (terminalEl) terminalEl.scrollTop = terminalEl.scrollHeight;
      scrollRafHandle = null;
    });
  }

  onDestroy(() => {
    if (scrollRafHandle !== null) cancelAnimationFrame(scrollRafHandle);
  });
</script>

{#if !collapsed}
  <div class="run-terminal">
    <div class="term-dots">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="term-title">{title}</span>
    </div>
    <div class="term-body term-scroll" bind:this={terminalEl}>
      {#each eventLog as evt}
        <div class="term-log-line" class:keep={evt.type === 'KEEP'} class:crash={evt.type === 'CRASH'}>
          <span class="tl-time">{evt.time}</span>
          <span class="tl-type"
            class:type-keep={evt.type === 'KEEP'}
            class:type-crash={evt.type === 'CRASH'}
            class:type-discard={evt.type === 'DISCARD'}
            class:type-system={evt.type === 'SYSTEM' || evt.type === 'SUBMIT'}
          >{evt.type}</span>
          <span class="tl-msg">{evt.message}</span>
        </div>
      {/each}
      {#if trainingExp}
        <div class="term-log-line training">
          <span class="tl-time">now</span>
          <span class="tl-type type-training">TRAIN</span>
          <span class="tl-msg">#{trainingExp.id} {trainingExp.modification} <span class="tl-blink">█</span></span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .run-terminal {
    background: #0D0D14; border-radius: 10px; overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255,255,255,0.06);
    max-height: 200px; display: flex; flex-direction: column;
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
  .term-scroll {
    flex: 1; overflow-y: auto; max-height: 148px;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .term-scroll::-webkit-scrollbar { width: 4px; }
  .term-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  .term-log-line {
    display: flex; align-items: baseline; gap: 10px; padding: 2px 0;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.65rem; color: rgba(255,255,255,0.5); line-height: 1.6;
  }
  .term-log-line.keep { color: rgba(39,134,74,0.9); }
  .term-log-line.crash { color: rgba(192,57,43,0.7); }
  .term-log-line.training { color: rgba(183,134,14,0.9); }

  .tl-time { color: rgba(255,255,255,0.2); flex-shrink: 0; min-width: 52px; }
  .tl-type {
    flex-shrink: 0; min-width: 52px; font-weight: 700;
    font-size: 0.58rem; letter-spacing: 0.04em;
  }
  .tl-type.type-keep { color: #4ade80; }
  .tl-type.type-crash { color: #f87171; }
  .tl-type.type-discard { color: rgba(255,255,255,0.3); }
  .tl-type.type-system { color: #D97757; }
  .tl-type.type-training { color: #fbbf24; }
  .tl-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tl-blink { animation: blink 0.8s step-end infinite; color: #fbbf24; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>
