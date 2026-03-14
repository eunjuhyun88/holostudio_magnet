<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import PixelOwl from "./PixelOwl.svelte";

  export let searchQuery = "";
  export let topicSuggestions: string[] = [];
  const dispatch = createEventDispatcher<{ search: string; topic: string }>();

  function handleSearch() {
    if (!searchQuery.trim()) return;
    dispatch("search", searchQuery.trim());
  }

  function selectTopic(topic: string) {
    searchQuery = topic;
    dispatch("topic", topic);
  }
</script>

<div class="ws-editor">
  <div class="pe-editor-wrap">
    <div class="pe-owl-track">
      <div class="pe-walking-owl">
        <PixelOwl size={0.22} mood="idle" />
      </div>
    </div>
    <div class="program-editor">
      <div class="pe-chrome">
        <div class="pe-dots">
          <span class="pe-dot red"></span>
          <span class="pe-dot yellow"></span>
          <span class="pe-dot green"></span>
        </div>
        <span class="pe-filename">program.md</span>
      </div>
      <div class="pe-body">
        <div class="pe-line-numbers">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
        </div>
        <textarea
          class="pe-textarea"
          rows="6"
          placeholder={"# Research Goal\nPredict Ethereum price movements using on-chain data\n\n# Approach\nTrain a time-series model on DEX volume, gas fees,\nand whale wallet activity from the last 90 days"}
          bind:value={searchQuery}
          on:keydown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSearch(); }}
        ></textarea>
      </div>
      <div class="pe-footer">
        <div class="pe-meta">
          <span class="pe-tag">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="3" y="1" width="2" height="2" fill="currentColor"/>
              <rect x="5" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="7" y="5" width="2" height="2" fill="currentColor" opacity="0.7"/>
              <rect x="1" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
              <rect x="3" y="9" width="2" height="2" fill="currentColor" opacity="0.5"/>
              <rect x="9" y="1" width="2" height="2" fill="currentColor" opacity="0.4"/>
            </svg>
            60+ train.py mutations
          </span>
          <span class="pe-tag">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="1" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
              <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="5" y="7" width="2" height="2" fill="currentColor"/>
              <rect x="7" y="1" width="2" height="2" fill="currentColor"/>
              <rect x="9" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
            </svg>
            val_bpb hill-climbing
          </span>
          <span class="pe-tag">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="1" y="1" width="4" height="4" fill="currentColor"/>
              <rect x="7" y="1" width="4" height="4" fill="currentColor" opacity="0.7"/>
              <rect x="1" y="7" width="4" height="4" fill="currentColor" opacity="0.7"/>
              <rect x="7" y="7" width="4" height="4" fill="currentColor"/>
            </svg>
            Distributed GPU mesh
          </span>
          <span class="pe-tag accent">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="4" y="1" width="4" height="2" fill="currentColor"/>
              <rect x="2" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="8" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="2" y="5" width="2" height="4" fill="currentColor"/>
              <rect x="8" y="5" width="2" height="4" fill="currentColor"/>
              <rect x="4" y="9" width="4" height="2" fill="currentColor"/>
              <rect x="5" y="3" width="2" height="2" fill="currentColor" opacity="0.5"/>
              <rect x="5" y="5" width="2" height="2" fill="currentColor" opacity="0.3"/>
              <rect x="7" y="5" width="2" height="2" fill="currentColor" opacity="0.4"/>
            </svg>
            ~5 min
          </span>
        </div>
        <button class="pe-submit" on:click={handleSearch}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="6" y="0" width="2" height="2" fill="currentColor"/>
            <rect x="5" y="2" width="2" height="2" fill="currentColor"/>
            <rect x="3" y="4" width="4" height="2" fill="currentColor"/>
            <rect x="5" y="6" width="2" height="2" fill="currentColor"/>
            <rect x="4" y="8" width="2" height="2" fill="currentColor"/>
            <rect x="3" y="10" width="2" height="2" fill="currentColor"/>
          </svg>
          Launch Autoresearch
        </button>
      </div>
      <div class="pe-examples">
        <span class="pe-examples-label">Examples:</span>
        {#each topicSuggestions.slice(0, 4) as t}
          <button class="chip" on:click={() => selectTopic(t)}>{t}</button>
        {/each}
      </div>
    </div>
  </div>

</div>

<style>
  .ws-editor {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .ws-headline {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 12px;
  }

  .ws-sub {
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text-secondary, #6b6560);
    margin: 0 0 24px;
  }

  /* ── Program Editor ── */
  .pe-editor-wrap {
    position: relative;
  }
  .program-editor {
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    background: var(--surface, #fff);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    overflow: hidden;
    transition: box-shadow 300ms ease, border-color 300ms ease;
  }
  .program-editor:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217,119,87,0.08), var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.12));
  }
  .pe-chrome {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    background: rgba(0,0,0,0.02);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .pe-dots { display: flex; gap: 5px; }
  .pe-dot { width: 8px; height: 8px; border-radius: 50%; }
  .pe-dot.red { background: #ff5f56; }
  .pe-dot.yellow { background: #ffbd2e; }
  .pe-dot.green { background: #27c93f; }
  .pe-filename {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; font-weight: 600;
    color: var(--text-secondary, #6b6560); margin-left: 4px;
  }
  .pe-owl-track {
    position: absolute; top: -22px; left: 0; right: 0;
    height: 24px; z-index: 3; pointer-events: none;
  }
  .pe-walking-owl {
    position: absolute; bottom: 0; left: 20px;
    animation: owlPatrol 10s linear infinite, owlStep 0.35s ease-in-out infinite;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12));
  }
  @keyframes owlPatrol {
    0%   { left: 20px;  transform: scaleX(1); }
    45%  { left: calc(100% - 44px); transform: scaleX(1); }
    50%  { left: calc(100% - 44px); transform: scaleX(-1); }
    95%  { left: 20px;  transform: scaleX(-1); }
    100% { left: 20px;  transform: scaleX(1); }
  }
  @keyframes owlStep {
    0%, 100% { margin-bottom: 0; }
    50%      { margin-bottom: 2px; }
  }
  .pe-body { display: flex; min-height: 120px; }
  .pe-line-numbers {
    display: flex; flex-direction: column;
    padding: 12px 0 12px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; line-height: 1.7;
    color: var(--border, #E5E0DA); user-select: none;
    width: 28px; text-align: right; flex-shrink: 0;
  }
  .pe-textarea {
    flex: 1; border: none; outline: none; background: none; resize: none;
    padding: 12px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem; line-height: 1.7;
    color: var(--text-primary, #2D2D2D); min-width: 0;
  }
  .pe-textarea::placeholder { color: var(--text-muted, #9a9590); opacity: 0.7; }
  .pe-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015); gap: 10px;
  }
  .pe-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
  .pe-tag {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    background: rgba(0, 0, 0, 0.03);
    padding: 3px 9px; border-radius: 100px;
    border: 1px solid rgba(0, 0, 0, 0.04);
    white-space: nowrap; letter-spacing: 0.02em;
  }
  .pe-tag :global(svg) { color: var(--text-muted, #9a9590); flex-shrink: 0; }
  .pe-tag.accent {
    background: rgba(217, 119, 87, 0.06);
    border-color: rgba(217, 119, 87, 0.12);
    color: var(--accent, #D97757);
  }
  .pe-tag.accent :global(svg) { color: var(--accent, #D97757); }
  .pe-submit {
    appearance: none; border: none;
    background: var(--accent, #D97757); color: #fff;
    font-size: 0.72rem; font-weight: 600;
    padding: 10px 20px; border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; flex-shrink: 0;
    transition: background 150ms, transform 100ms;
  }
  .pe-submit:hover { background: var(--accent-hover, #C4644A); }
  .pe-submit:active { transform: scale(0.97); }
  .pe-examples {
    display: flex; align-items: center;
    gap: 6px; padding: 10px 14px; flex-wrap: wrap;
  }
  .pe-examples-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.55rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .chip {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 5px 14px; border-radius: 100px;
    font-size: 0.68rem; font-weight: 500;
    color: var(--text-secondary, #6b6560); cursor: pointer;
    transition: all 150ms;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .pe-footer { flex-direction: column; gap: 8px; }
    .pe-submit { width: 100%; justify-content: center; }
    .pe-meta { justify-content: center; }
    .pe-tag { font-size: 0.48rem; padding: 2px 7px; }
    .pe-line-numbers { display: none; }
    .pe-textarea { padding: 12px; }
    .pe-examples { gap: 4px; }
  }
</style>
