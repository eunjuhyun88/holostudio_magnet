<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { BranchInfo, Experiment } from '../../stores/jobStore.ts';
  import { resolveExperimentCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '../../data/modifications.ts';
  import { flashCelebrate } from '../../stores/owlMoodStore.ts';
  import TerminalHeader from './TerminalHeader.svelte';
  import PixelOwl from '../PixelOwl.svelte';

  onMount(() => { flashCelebrate(3000); });

  export let branches: BranchInfo[] = [];
  export let experiments: Experiment[] = [];
  export let bestMetric: number = Infinity;
  export const totalExperiments: number = 0;
  export let expandable = false;

  const dispatch = createEventDispatcher<{
    newresearch: void;
    deploy: { target: string };
    retrain: { code: string; parentId: number | null };
    improve: { instruction: string };
    expand: void;
  }>();

  let showDeployOptions = false;
  let showCodeEditor = false;
  let showImproveInput = false;
  let codeEditorContent = '';
  let improveText = '';

  $: totalDone = experiments.filter(e => e.status !== 'training').length;
  $: totalKeeps = experiments.filter(e => e.status === 'keep').length;
  $: totalCrashes = experiments.filter(e => e.status === 'crash').length;
  $: sortedBranches = [...branches].sort((a, b) => a.bestMetric - b.bestMetric);
  $: globalBest = sortedBranches.length > 0 ? sortedBranches[0] : null;

  function generateCodeSnippet(modification: string, metric: number): string {
    const cat = resolveExperimentCategory(modification);
    const lines = [
      `# train.py — AI-generated configuration`,
      `# Modification: ${modification}`,
      `# Category: ${CATEGORY_LABELS[cat] ?? cat}`,
      `# Result: val_bpb = ${metric > 0 ? metric.toFixed(4) : 'pending'}`,
      ``,
    ];
    switch (cat) {
      case 'learning_rate':
        lines.push(`learning_rate = ${(0.0001 + Math.random() * 0.005).toFixed(6)}`);
        lines.push(`lr_scheduler = "cosine_warmup"`);
        lines.push(`warmup_steps = ${Math.floor(100 + Math.random() * 400)}`);
        break;
      case 'batch_size':
        lines.push(`batch_size = ${[16, 32, 64, 128][Math.floor(Math.random() * 4)]}`);
        lines.push(`gradient_accumulation = ${[1, 2, 4][Math.floor(Math.random() * 3)]}`);
        break;
      case 'architecture':
        lines.push(`n_layers = ${Math.floor(4 + Math.random() * 12)}`);
        lines.push(`n_heads = ${[4, 8, 12, 16][Math.floor(Math.random() * 4)]}`);
        lines.push(`d_model = ${[256, 384, 512, 768][Math.floor(Math.random() * 4)]}`);
        break;
      case 'optimizer':
        lines.push(`optimizer = "${['adamw', 'lion', 'sophia', 'sgd'][Math.floor(Math.random() * 4)]}"`);
        lines.push(`weight_decay = ${(0.001 + Math.random() * 0.1).toFixed(4)}`);
        break;
      case 'regularization':
        lines.push(`dropout = ${(0.05 + Math.random() * 0.3).toFixed(2)}`);
        lines.push(`label_smoothing = ${(0.01 + Math.random() * 0.15).toFixed(3)}`);
        break;
      default:
        lines.push(`# ${modification}`);
        lines.push(`config = { "type": "${cat}" }`);
    }
    lines.push('');
    lines.push('# Edit below to guide the next training run');
    return lines.join('\n');
  }

  function openCodeEditor(modification: string, metric: number) {
    codeEditorContent = generateCodeSnippet(modification, metric);
    showCodeEditor = true;
  }

  function handleRetrain() {
    dispatch('retrain', { code: codeEditorContent, parentId: null });
    showCodeEditor = false;
  }
</script>

<div class="owl-celebrate"><PixelOwl size={0.4} mood="celebrate" /></div>

<TerminalHeader title="Research Complete" showExpand={expandable} extraClass="complete-header" on:expand>
  <svg slot="before" class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
</TerminalHeader>

<div class="summary-card">
  <div class="summary-title">Research Summary</div>
  <div class="summary-text">{sortedBranches.length} branches &middot; {totalDone} experiments &middot; {totalKeeps} improvements &middot; {totalCrashes} crashes</div>
  {#if globalBest && bestMetric < Infinity}
    <div class="global-best">
      <span class="gb-label">Global Best</span>
      <span class="gb-branch">{globalBest.label}</span>
      <span class="gb-arrow">&rarr;</span>
      <span class="gb-metric">{bestMetric.toFixed(4)}</span>
    </div>
  {/if}
</div>

<div class="branch-section">
  <span class="section-label">Branch Leaderboard</span>
  <div class="branch-list">
    {#each sortedBranches as br, i}
      <div class="branch-row leaderboard" class:best={i === 0}>
        <span class="br-rank">#{i + 1}</span>
        <span class="br-name" title={br.label}>{br.label}</span>
        <span class="br-metric">{br.bestMetric < Infinity ? br.bestMetric.toFixed(4) : '\u2014'}</span>
        <span class="br-detail">{br.total} iters, {br.keeps} keeps</span>
      </div>
    {/each}
  </div>
</div>

<div class="code-section">
  <div class="code-header">
    <span class="code-title">Best Config</span>
    <span class="code-hint">train.py</span>
    {#if !showCodeEditor}
      <button class="code-toggle" on:click={() => { const bestExp = experiments.find(e => e.status === 'keep' && e.metric === bestMetric); if (bestExp) openCodeEditor(bestExp.modification, bestExp.metric); }}>Review & Edit</button>
    {:else}
      <button class="code-toggle" on:click={() => { showCodeEditor = false; }}>Hide</button>
    {/if}
  </div>
  {#if showCodeEditor}
    <textarea class="code-editor" bind:value={codeEditorContent} spellcheck="false" rows="10"></textarea>
    <div class="code-actions">
      <button class="action-btn retrain" on:click={handleRetrain}>Retrain with Edits</button>
      <span class="code-hint">Modify the config and retrain to improve further</span>
    </div>
  {/if}
</div>

<div class="improve-section">
  <span class="section-label">Improve & Iterate</span>
  {#if !showImproveInput}
    <button class="improve-toggle" on:click={() => { showImproveInput = true; }}>Tell me what to improve...</button>
  {:else}
    <textarea class="improve-input" bind:value={improveText} placeholder="e.g., Focus more on regularization, increase learning rate range, add dropout variations..." rows="3"></textarea>
    <div class="improve-actions">
      <button class="improve-btn" disabled={!improveText.trim()} on:click={() => { dispatch('improve', { instruction: improveText.trim() }); improveText = ''; showImproveInput = false; }}>Re-run with Improvements</button>
      <button class="improve-cancel" on:click={() => { showImproveInput = false; improveText = ''; }}>Cancel</button>
    </div>
  {/if}
</div>

<div class="next-actions">
  <span class="section-label">What's next?</span>
  {#if !showDeployOptions}
    <button class="deploy-btn" on:click={() => { showDeployOptions = true; }}>Deploy Best Model</button>
  {:else}
    <div class="deploy-options">
      <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'checkpoint' })}><span class="do-icon">&#x1F4E6;</span><div class="do-text"><span class="do-name">Export Checkpoint</span><span class="do-desc">Save model locally</span></div></button>
      <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'huggingface' })}><span class="do-icon">&#x1F917;</span><div class="do-text"><span class="do-name">Push to HF Hub</span><span class="do-desc">Publish to registry</span></div></button>
      <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'cloud' })}><span class="do-icon">&#x2601;</span><div class="do-text"><span class="do-name">Deploy as API</span><span class="do-desc">Cloud endpoint</span></div></button>
      <button class="deploy-back" on:click={() => { showDeployOptions = false; }}>Back</button>
    </div>
  {/if}
  <div class="action-grid">
    <button class="next-btn" on:click={() => dispatch('newresearch')}><span class="next-icon">+</span><div class="next-text"><span class="next-name">New Research</span><span class="next-desc">Start a different topic</span></div></button>
    <button class="next-btn"><span class="next-icon">&#x21BB;</span><div class="next-text"><span class="next-name">Re-run</span><span class="next-desc">Same topic, new seeds</span></div></button>
  </div>
  <div class="click-hint">Click any result to review & fork</div>
</div>

<style>
  /* -- Owl celebrate -- */
  .owl-celebrate { display: flex; justify-content: center; padding: 12px 14px 4px; }

  /* -- Complete header -- */
  :global(.complete-header) { border-bottom-color: rgba(166,227,161,0.2) !important; }
  .check-icon { color: #a6e3a1; flex-shrink: 0; }

  /* -- Summary card -- */
  .summary-card { margin: 8px 14px; padding: 10px 12px; background: #181825; border-radius: 8px; border: 1px solid #313244; display: flex; flex-direction: column; gap: 6px; }
  .summary-title { font: 700 11px/1 'SF Mono', 'Fira Code', monospace; color: #7f849c; text-transform: uppercase; letter-spacing: 0.04em; }
  .summary-text { font: 400 11px/1.4 'SF Mono', 'Fira Code', monospace; color: #a6adc8; }
  .global-best { display: flex; align-items: center; gap: 6px; padding-top: 6px; border-top: 1px solid #313244; margin-top: 2px; }
  .gb-label { font: 600 9px/1 'SF Mono', monospace; color: #f9e2af; text-transform: uppercase; letter-spacing: 0.04em; }
  .gb-branch { font: 600 11px/1 'SF Mono', monospace; color: #cdd6f4; text-transform: uppercase; }
  .gb-arrow { color: #45475a; font-size: 11px; }
  .gb-metric { font: 800 13px/1 'SF Mono', monospace; color: #a6e3a1; font-variant-numeric: tabular-nums; }

  /* -- Branch section & leaderboard -- */
  .branch-section { padding: 8px 14px; display: flex; flex-direction: column; gap: 4px; }
  .section-label { font: 600 9px/1 'SF Mono', monospace; color: #7f849c; text-transform: uppercase; letter-spacing: 0.06em; }
  .branch-list { display: flex; flex-direction: column; gap: 2px; }
  .branch-row {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 6px; border-radius: 4px;
    font: 500 11px/1.3 'SF Mono', monospace; transition: background 150ms;
  }
  .branch-row:hover { background: rgba(205,214,244,0.03); }
  .branch-row.best { background: rgba(166,227,161,0.06); }
  .branch-row.leaderboard { padding: 5px 6px; }
  .br-rank { font: 700 10px/1 'SF Mono', monospace; color: #585b70; min-width: 18px; }
  .br-name { color: #bac2de; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; }
  .br-metric { font: 700 11px/1 'SF Mono', monospace; color: #a6e3a1; font-variant-numeric: tabular-nums; }
  .br-detail { font: 400 9px/1 'SF Mono', monospace; color: #585b70; }

  /* -- Code section & editor -- */
  .code-section { padding: 8px 14px; border-top: 1px solid #313244; display: flex; flex-direction: column; gap: 4px; }
  .code-header { display: flex; align-items: center; gap: 6px; }
  .code-title { font: 700 10px/1 'SF Mono', monospace; color: #89b4fa; }
  .code-hint { font: 400 9px/1 'SF Mono', monospace; color: #585b70; flex: 1; }
  .code-toggle {
    font: 600 9px/1 'SF Mono', monospace;
    color: #fab387; background: rgba(250,179,135,0.1);
    border: none; border-radius: 4px;
    padding: 3px 8px; cursor: pointer; transition: all 150ms;
  }
  .code-toggle:hover { background: rgba(250,179,135,0.2); }
  .code-editor {
    font: 400 11px/1.5 'SF Mono', 'Fira Code', monospace;
    color: #a6e3a1; background: #11111b;
    border: 1px solid #313244; border-radius: 6px;
    padding: 8px 10px; resize: vertical;
    outline: none; tab-size: 2; transition: border-color 200ms;
  }
  .code-editor:focus { border-color: #89b4fa; }
  .code-actions { display: flex; align-items: center; gap: 8px; }
  .action-btn.retrain {
    background: #a6e3a1; color: #1e1e2e;
    padding: 7px 14px; border-radius: 6px;
    font: 600 11px/1 'SF Mono', monospace;
    border: none; cursor: pointer; transition: background 150ms;
  }
  .action-btn.retrain:hover { background: #94e2d5; }

  /* -- Improve & Iterate -- */
  .improve-section { padding: 0 14px 8px; }
  .improve-toggle {
    width: 100%; padding: 10px 12px;
    background: rgba(166,227,161,0.06); color: #a6e3a1;
    border: 1px dashed rgba(166,227,161,0.3); border-radius: 6px;
    font: 500 11px/1.3 'SF Mono', monospace;
    cursor: pointer; transition: all 150ms; text-align: left;
  }
  .improve-toggle:hover { background: rgba(166,227,161,0.1); border-color: rgba(166,227,161,0.5); }
  .improve-input {
    width: 100%; box-sizing: border-box;
    padding: 8px 10px; margin-top: 4px;
    background: #313244; border: 1px solid #45475a;
    border-radius: 6px; resize: vertical;
    font: 400 11px/1.5 'SF Mono', monospace; color: #cdd6f4;
  }
  .improve-input:focus { border-color: #a6e3a1; outline: none; }
  .improve-actions { display: flex; gap: 6px; margin-top: 6px; align-items: center; }
  .improve-btn {
    flex: 1; padding: 8px;
    background: #a6e3a1; color: #1e1e2e;
    border: none; border-radius: 6px;
    font: 600 11px/1 'SF Mono', monospace;
    cursor: pointer; transition: background 150ms;
  }
  .improve-btn:hover { background: #94e2d5; }
  .improve-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .improve-cancel {
    padding: 8px 12px;
    background: none; border: 1px solid #45475a;
    border-radius: 6px; color: #7f849c;
    font: 500 10px/1 'SF Mono', monospace;
    cursor: pointer; transition: all 150ms;
  }
  .improve-cancel:hover { border-color: #585b70; color: #cdd6f4; }

  /* -- Next actions -- */
  .next-actions { padding: 8px 14px; margin-top: auto; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #313244; }
  .action-grid { display: flex; gap: 6px; }
  .next-btn {
    flex: 1; display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px;
    border: 1px solid #313244; background: #181825;
    cursor: pointer; transition: all 150ms; text-align: left;
  }
  .next-btn:hover { border-color: #89b4fa; background: rgba(137,180,250,0.05); }
  .next-icon { font: 600 16px/1 'SF Mono', monospace; color: #fab387; width: 24px; text-align: center; }
  .next-text { display: flex; flex-direction: column; gap: 1px; }
  .next-name { font: 600 11px/1 'SF Mono', monospace; color: #cdd6f4; }
  .next-desc { font: 400 9px/1 'SF Mono', monospace; color: #585b70; }
  .click-hint { font: 400 10px/1 'SF Mono', monospace; color: #45475a; text-align: center; margin-top: 2px; }

  /* -- Deploy -- */
  .deploy-btn {
    width: 100%; padding: 10px;
    background: #fab387; color: #1e1e2e;
    border: none; border-radius: 6px;
    font: 600 12px/1 'SF Mono', monospace;
    cursor: pointer; transition: background 150ms; letter-spacing: 0.02em;
  }
  .deploy-btn:hover { background: #f9e2af; }
  .deploy-options { display: flex; flex-direction: column; gap: 4px; }
  .deploy-opt {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px;
    border: 1px solid #313244; background: #181825;
    cursor: pointer; transition: all 150ms; text-align: left;
  }
  .deploy-opt:hover { border-color: #89b4fa; background: rgba(137,180,250,0.05); }
  .do-icon { font-size: 16px; width: 24px; text-align: center; flex-shrink: 0; }
  .do-text { display: flex; flex-direction: column; gap: 1px; }
  .do-name { font: 600 11px/1 'SF Mono', monospace; color: #cdd6f4; }
  .do-desc { font: 400 9px/1 'SF Mono', monospace; color: #585b70; }
  .deploy-back { padding: 4px 8px; border: none; background: none; font: 500 10px/1 'SF Mono', monospace; color: #585b70; cursor: pointer; align-self: flex-start; }
  .deploy-back:hover { color: #cdd6f4; }
</style>
