<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import PixelOwl from "./PixelOwl.svelte";

  export let searchQuery = "";
  export let topicSuggestions: string[] = [];
  /** Live stats for social proof */
  export let onlineResearchers = 12;
  export let modelsTrained = 847;
  const dispatch = createEventDispatcher<{ search: string; topic: string }>();

  let textareaEl: HTMLTextAreaElement;
  /** Phase: 'typing' → 'holding' → 'clearing' → 'ready' */
  let phase: 'typing' | 'holding' | 'clearing' | 'ready' = 'typing';
  let typewriterText = "";

  // Short — just the heading to hint at the format, not a full example
  const TYPEWRITER_FULL = "# Research Goal\n";

  function handleSearch() {
    if (!searchQuery.trim()) return;
    dispatch("search", searchQuery.trim());
  }

  function selectTopic(topic: string) {
    searchQuery = topic;
    dispatch("topic", topic);
  }

  function handleFocus() {
    if (phase !== 'ready') {
      // User clicked during typewriter — adopt text and go ready
      searchQuery = typewriterText;
      typewriterText = "";
      phase = 'ready';
    }
  }

  onMount(() => {
    let charIdx = 0;
    let destroyed = false;

    // Phase 1: Type out example (45ms per char)
    const typeInterval = setInterval(() => {
      if (destroyed || phase !== 'typing') { clearInterval(typeInterval); return; }
      if (charIdx >= TYPEWRITER_FULL.length) {
        clearInterval(typeInterval);
        phase = 'holding';
        // Phase 2: Hold for 800ms, then fade away
        setTimeout(() => {
          if (destroyed || phase !== 'holding') return;
          phase = 'clearing';
          // Phase 3: After fade animation (400ms), go ready
          setTimeout(() => {
            if (destroyed) return;
            typewriterText = "";
            phase = 'ready';
            // Auto-focus after clearing
            tick().then(() => {
              if (textareaEl && !destroyed) textareaEl.focus();
            });
          }, 400);
        }, 800);
        return;
      }
      typewriterText = TYPEWRITER_FULL.slice(0, charIdx + 1);
      charIdx++;
    }, 45);

    return () => {
      destroyed = true;
      clearInterval(typeInterval);
    };
  });
</script>

<div class="ws-editor">
  <h1 class="ws-headline">Turn any idea into<br/>a specialized AI model.</h1>
  <p class="ws-sub">Write a goal. We handle the rest — from hyperparameter search to distributed training across a global GPU mesh.</p>
  <div class="ws-proof">
    <span class="ws-proof-item">
      <span class="ws-proof-dot live"></span>
      {onlineResearchers} researchers online
    </span>
    <span class="ws-proof-sep">·</span>
    <span class="ws-proof-item">{modelsTrained.toLocaleString()} models trained</span>
  </div>
  <div class="pe-editor-wrap">
    <div class="pe-owl-track">
      <div class="pe-walking-owl">
        <PixelOwl size={0.32} mood="idle" />
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
          class:pe-hidden={phase === 'typing' || phase === 'holding'}
          rows="6"
          placeholder={"# Research Goal\nDescribe what you want to predict, classify, or generate.\n\n# Approach\nWe'll automatically search architectures, hyperparameters,\nand training strategies across a distributed GPU mesh."}
          bind:this={textareaEl}
          bind:value={searchQuery}
          on:focus={handleFocus}
          on:keydown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSearch(); }}
        ></textarea>
        {#if (phase === 'typing' || phase === 'holding') && typewriterText}
          <div class="pe-typewriter-overlay" class:pe-fading={phase === 'holding'}>
            {typewriterText}{#if phase === 'typing'}<span class="pe-cursor">|</span>{/if}
          </div>
        {/if}
        {#if phase === 'clearing'}
          <div class="pe-typewriter-overlay pe-fade-out">{typewriterText}</div>
        {/if}
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
        <span class="pe-examples-label">Try it:</span>
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
    align-items: center;
  }

  .ws-headline {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 12px;
    text-align: center;
  }

  .ws-sub {
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--text-secondary, #6b6560);
    margin: 0 0 24px;
    text-align: center;
    max-width: 540px;
  }

  /* ── Social Proof ── */
  .ws-proof {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 20px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.58rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
  }
  .ws-proof-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .ws-proof-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ws-proof-dot.live {
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39, 134, 74, 0.5);
    animation: proofPulse 2.5s ease-in-out infinite;
  }
  @keyframes proofPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .ws-proof-sep {
    color: var(--border, #E5E0DA);
    font-weight: 300;
  }

  /* ── Program Editor ── */
  .pe-editor-wrap {
    position: relative;
    width: 100%;
    max-width: 640px;
  }
  .program-editor {
    border: 1.5px solid var(--accent, #D97757);
    border-radius: var(--radius-md, 10px);
    background: var(--surface, #fff);
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.06),
                0 4px 20px rgba(217, 119, 87, 0.12),
                0 8px 32px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    transition: box-shadow 300ms ease, border-color 300ms ease;
    animation: editorGlow 3s ease-in-out infinite;
    position: relative;
  }
  @keyframes editorGlow {
    0%, 100% {
      box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.06),
                  0 4px 20px rgba(217, 119, 87, 0.12),
                  0 8px 32px rgba(0, 0, 0, 0.06);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.1),
                  0 4px 28px rgba(217, 119, 87, 0.2),
                  0 8px 40px rgba(0, 0, 0, 0.08);
    }
  }
  .program-editor:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.12),
                0 8px 32px rgba(217, 119, 87, 0.15);
    animation: none;
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
    position: absolute; top: -32px; left: 0; right: 0;
    height: 34px; z-index: 3; pointer-events: none;
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
  .pe-body { display: flex; min-height: 120px; position: relative; }
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
  .pe-textarea.pe-hidden { color: transparent; caret-color: transparent; }

  /* ── Typewriter overlay ── */
  .pe-typewriter-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    padding: 12px 14px 12px 42px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem; line-height: 1.7;
    color: var(--text-primary, #2D2D2D);
    pointer-events: none;
    white-space: pre-wrap;
    z-index: 2;
    transition: opacity 500ms ease;
  }
  .pe-typewriter-overlay.pe-fade-out {
    opacity: 0;
  }
  .pe-cursor {
    animation: cursorBlink 0.8s ease-in-out infinite;
    color: var(--accent, #D97757);
    font-weight: 300;
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
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
    font-size: 0.78rem; font-weight: 700;
    padding: 12px 24px; border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; flex-shrink: 0;
    transition: background 150ms, transform 100ms, box-shadow 150ms;
    box-shadow: 0 4px 14px rgba(217, 119, 87, 0.3);
    animation: launchPulse 3s ease-in-out infinite;
  }
  .pe-submit:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 6px 20px rgba(217, 119, 87, 0.4);
    transform: translateY(-1px);
  }
  .pe-submit:active { transform: scale(0.97); box-shadow: 0 2px 8px rgba(217, 119, 87, 0.3); }
  @keyframes launchPulse {
    0%, 100% { box-shadow: 0 4px 14px rgba(217, 119, 87, 0.3); }
    50% { box-shadow: 0 4px 20px rgba(217, 119, 87, 0.45); }
  }
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
    .ws-headline {
      font-size: 2rem;
      margin-bottom: 8px;
    }
    .ws-sub {
      font-size: 0.76rem;
      margin-bottom: 16px;
      max-width: 340px;
    }
    .ws-proof {
      margin-bottom: 14px;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .ws-proof-item {
      font-size: 0.54rem;
    }
    .program-editor {
      border-radius: 14px;
    }
    .pe-chrome {
      padding: 7px 12px;
    }
    .pe-body {
      min-height: 104px;
    }
    .pe-footer { flex-direction: column; gap: 8px; }
    .pe-submit { width: 100%; justify-content: center; }
    .pe-meta { justify-content: center; }
    .pe-tag { font-size: 0.48rem; padding: 2px 7px; }
    .pe-line-numbers { display: none; }
    .pe-textarea { padding: 12px; }
    .pe-examples {
      gap: 4px;
      padding: 8px 10px 10px;
      justify-content: center;
    }
    .chip {
      font-size: 0.64rem;
      padding: 5px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .program-editor { animation: none; }
    .pe-walking-owl { animation: none; }
    .pe-submit { animation: none; }
    .ws-proof-dot.live { animation: none; }
    .pe-cursor { animation: none; }
    .pe-typewriter-overlay { transition: none; }
  }
</style>
