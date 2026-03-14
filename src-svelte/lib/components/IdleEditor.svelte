<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { router } from '../stores/router.ts';
  import PixelOwl from './PixelOwl.svelte';

  const dispatch = createEventDispatcher<{ launch: string }>();

  let quickTopic = '';

  function handleQuickStart() {
    if (!quickTopic.trim()) return;
    dispatch('launch', quickTopic.trim());
  }
</script>

<div class="idle-state">
  <div class="idle-owl">
    <PixelOwl size={1.2} mood="sleep" />
  </div>
  <span class="idle-eyebrow">AUTORESEARCH</span>
  <h2 class="idle-title">Your Autonomous Research Lab</h2>
  <p class="idle-desc">Write a research program below. AI agents will design experiments, train models, and surface the best results.</p>

  <div class="ie-editor-wrap">
    <div class="ie-owl-track">
      <div class="ie-walking-owl">
        <PixelOwl size={0.22} mood="idle" />
      </div>
    </div>
    <div class="idle-editor">
      <div class="ie-chrome">
        <div class="ie-dots">
          <span class="ie-dot red"></span>
          <span class="ie-dot yellow"></span>
          <span class="ie-dot green"></span>
        </div>
        <span class="ie-filename">program.md</span>
      </div>
      <div class="ie-body">
        <div class="ie-line-numbers">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
        </div>
        <textarea
          class="ie-textarea"
          rows="6"
          placeholder={"# Research Goal\nPredict Ethereum price movements using on-chain data\n\n# Approach\nTrain a time-series model on DEX volume, gas fees,\nand whale wallet activity from the last 90 days"}
          bind:value={quickTopic}
          on:keydown={(e) => { if (e.key === 'Enter' && e.metaKey) handleQuickStart(); }}
        ></textarea>
      </div>
      <div class="ie-footer">
        <div class="ie-tags">
          <span class="ie-tag">
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
          <span class="ie-tag">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="1" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
              <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="5" y="7" width="2" height="2" fill="currentColor"/>
              <rect x="7" y="1" width="2" height="2" fill="currentColor"/>
              <rect x="9" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
            </svg>
            val_bpb hill-climbing
          </span>
          <span class="ie-tag accent">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="4" y="1" width="4" height="2" fill="currentColor"/>
              <rect x="2" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="8" y="3" width="2" height="2" fill="currentColor"/>
              <rect x="2" y="5" width="2" height="4" fill="currentColor"/>
              <rect x="8" y="5" width="2" height="4" fill="currentColor"/>
              <rect x="4" y="9" width="4" height="2" fill="currentColor"/>
              <rect x="5" y="3" width="2" height="2" fill="currentColor" opacity="0.5"/>
            </svg>
            ~5 min
          </span>
        </div>
        <button class="ie-submit" on:click={handleQuickStart} disabled={!quickTopic.trim()}>
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
    </div>
  </div>

  <div class="idle-steps">
    <div class="idle-step"><span class="step-num">1</span><span class="step-text">Write a research program</span></div>
    <div class="idle-step-arrow">&rarr;</div>
    <div class="idle-step"><span class="step-num">2</span><span class="step-text">AI runs 100+ experiments</span></div>
    <div class="idle-step-arrow">&rarr;</div>
    <div class="idle-step"><span class="step-num">3</span><span class="step-text">You get a trained model</span></div>
  </div>
  <button class="idle-back" on:click={() => router.navigate('dashboard')}>&larr; Back to Dashboard</button>
</div>

<style>
  .idle-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px 32px; text-align: center; min-height: 60vh;
  }
  .idle-owl {
    margin-bottom: 16px;
    filter: drop-shadow(0 0 20px rgba(217, 119, 87, 0.1));
    animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }
  .idle-eyebrow {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--accent, #D97757);
    display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
  }
  .idle-eyebrow::before, .idle-eyebrow::after {
    content: ''; width: 12px; height: 1px; background: var(--accent, #D97757); opacity: 0.3;
  }
  .idle-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.6rem; font-weight: 700; color: var(--text-primary, #2D2D2D);
    margin: 0 0 8px; animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
  }
  .idle-desc {
    font-size: 0.9rem; color: var(--text-secondary, #6b6560); max-width: 440px;
    margin: 0 0 24px; line-height: 1.5;
    animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both;
  }

  .ie-editor-wrap { position: relative; width: 100%; max-width: 580px; margin-bottom: 20px; }
  .idle-editor {
    width: 100%; border: 1px solid var(--border, #E5E0DA); border-radius: 10px;
    background: var(--surface, #fff); box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    overflow: hidden; animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.36s both;
    transition: border-color 300ms, box-shadow 300ms;
  }
  .idle-editor:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217,119,87,0.08), 0 8px 32px rgba(0,0,0,0.12);
  }
  .ie-chrome {
    display: flex; align-items: center; gap: 8px; padding: 8px 14px;
    background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .ie-dots { display: flex; gap: 5px; }
  .ie-dot { width: 8px; height: 8px; border-radius: 50%; }
  .ie-dot.red { background: #ff5f56; }
  .ie-dot.yellow { background: #ffbd2e; }
  .ie-dot.green { background: #27c93f; }
  .ie-filename {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; font-weight: 600; color: var(--text-secondary, #6b6560); margin-left: 4px;
  }

  .ie-owl-track {
    position: absolute; top: -22px; left: 0; right: 0; height: 24px; z-index: 3; pointer-events: none;
  }
  .ie-walking-owl {
    position: absolute; bottom: 0; left: 20px;
    animation: ieOwlPatrol 10s linear infinite, ieOwlStep 0.35s ease-in-out infinite;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12));
  }
  @keyframes ieOwlPatrol {
    0%   { left: 20px; transform: scaleX(1); }
    48%  { left: calc(100% - 44px); transform: scaleX(1); }
    50%  { left: calc(100% - 44px); transform: scaleX(-1); }
    98%  { left: 20px; transform: scaleX(-1); }
    100% { left: 20px; transform: scaleX(1); }
  }
  @keyframes ieOwlStep {
    0%, 100% { margin-bottom: 0; }
    50%      { margin-bottom: 2px; }
  }

  .ie-body { display: flex; min-height: 120px; }
  .ie-line-numbers {
    display: flex; flex-direction: column; padding: 12px 0 12px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; line-height: 1.7; color: var(--border, #E5E0DA);
    user-select: none; width: 28px; text-align: right; flex-shrink: 0;
  }
  .ie-textarea {
    flex: 1; border: none; outline: none; background: none; resize: none;
    padding: 12px 14px; font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem; line-height: 1.7; color: var(--text-primary, #2D2D2D); min-width: 0;
  }
  .ie-textarea::placeholder { color: var(--text-muted, #9a9590); opacity: 0.7; }

  .ie-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-top: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015); gap: 10px;
  }
  .ie-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
  .ie-tag {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem; font-weight: 600; color: var(--text-secondary, #6b6560);
    background: rgba(0,0,0,0.03); padding: 3px 9px; border-radius: 100px;
    border: 1px solid rgba(0,0,0,0.04); white-space: nowrap;
  }
  .ie-tag :global(svg) { color: var(--text-muted, #9a9590); flex-shrink: 0; }
  .ie-tag.accent {
    background: rgba(217,119,87,0.06); border-color: rgba(217,119,87,0.12);
    color: var(--accent, #D97757);
  }
  .ie-tag.accent :global(svg) { color: var(--accent, #D97757); }

  .ie-submit {
    appearance: none; border: none; background: var(--accent, #D97757); color: #fff;
    font-size: 0.72rem; font-weight: 600; padding: 10px 20px; border-radius: 6px;
    cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;
    flex-shrink: 0; transition: background 150ms, transform 100ms;
  }
  .ie-submit:hover:not(:disabled) { background: var(--accent-hover, #C4644A); }
  .ie-submit:active:not(:disabled) { transform: scale(0.97); }
  .ie-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  .idle-back {
    appearance: none; border: none; background: none; font-size: 0.78rem;
    color: var(--text-muted, #9a9590); cursor: pointer;
    transition: color 200ms, transform 200ms;
    animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.52s both;
  }
  .idle-back:hover { color: var(--accent, #D97757); transform: translateX(-3px); }

  .idle-steps {
    display: flex; align-items: center; justify-content: center; gap: 0;
    margin-bottom: 24px; padding: 16px 24px; background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA); border-radius: 10px;
    animation: idle-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.44s both;
  }
  .idle-step { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center; }
  .step-num {
    width: 24px; height: 24px; border-radius: 50%; background: rgba(217,119,87,0.08);
    color: var(--accent, #D97757); font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem; font-weight: 700; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }
  .step-text { font-size: 0.78rem; color: var(--text-secondary, #6b6560); white-space: nowrap; }
  .idle-step-arrow { color: var(--text-muted, #9a9590); font-size: 0.82rem; flex-shrink: 0; padding: 0 6px; }

  @keyframes idle-enter {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    .idle-steps { flex-wrap: wrap; }
    .idle-step-arrow { display: none; }
  }
  @media (max-width: 480px) {
    .idle-state { padding: 32px 16px; }
    .idle-title { font-size: 1.3rem; }
    .ie-footer { flex-direction: column; gap: 8px; }
    .ie-submit { width: 100%; justify-content: center; }
    .ie-tags { justify-content: center; }
    .ie-line-numbers { display: none; }
    .ie-textarea { padding: 12px; }
    .ie-tag { font-size: 0.48rem; padding: 2px 7px; }
  }
</style>
