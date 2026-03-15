<script lang="ts">
  import type { ResearchMetrics } from "../data/dashboardFixture.ts";
  import { router } from "../stores/router.ts";

  export let research: ResearchMetrics;
  export let runningCount = 0;
  export let doneCount = 0;

  function goToOntology() {
    router.navigate("studio");
  }
</script>

<div class="sp">
  <!-- Status bar -->
  <div class="sp-status">
    <span class="sp-dot"></span>
    <span class="sp-conn">Active</span>
    <span class="sp-sep">·</span>
    <span class="sp-stat">{runningCount} running</span>
    <span class="sp-sep">·</span>
    <span class="sp-stat">{doneCount} done</span>
    <span class="sp-sep">·</span>
    <span class="sp-stat">{research.findings} findings</span>
    <button class="sp-gear" on:click={goToOntology} title="Research settings">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.2"/>
        <path d="M6.7 1.5l-.4 1.3a5 5 0 00-1.5.9L3.5 3.2l-1.3 2.3 1 1a5 5 0 000 1.7l-1 1 1.3 2.3 1.3-.5a5 5 0 001.5.9l.4 1.3h2.6l.4-1.3a5 5 0 001.5-.9l1.3.5 1.3-2.3-1-1a5 5 0 000-1.7l1-1-1.3-2.3-1.3.5a5 5 0 00-1.5-.9L9.3 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <!-- 5 Research metric cells — single row -->
  <div class="sp-grid">
    <div class="sp-cell">
      <span class="sp-val" style:color="var(--accent)">{research.activeJobs}</span>
      <span class="sp-key">Jobs</span>
    </div>
    <div class="sp-cell">
      <span class="sp-val">{research.activeAgents}</span>
      <span class="sp-key">Agents</span>
    </div>
    <div class="sp-cell">
      <span class="sp-val">{research.configsTested}</span>
      <span class="sp-key">Configs</span>
    </div>
    <div class="sp-cell">
      <span class="sp-val" style:color="var(--green)">{research.findings}</span>
      <span class="sp-key">Findings</span>
    </div>
    <div class="sp-cell">
      <span class="sp-val">{research.hitRate}%</span>
      <span class="sp-key">Hit Rate</span>
    </div>
  </div>
</div>

<style>
  .sp {
    overflow: hidden;
  }

  /* ── Status bar ── */
  .sp-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015);
  }
  .sp-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39,134,74,0.4);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .sp-conn {
    font-family: var(--font-mono);
    font-size: 0.6rem; font-weight: 700;
    color: var(--green, #27864a);
  }
  .sp-sep { font-size: 0.5rem; color: var(--border, #E5E0DA); }
  .sp-stat {
    font-family: var(--font-mono);
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
  }
  .sp-gear {
    appearance: none; border: none; background: transparent;
    color: var(--text-muted, #9a9590); cursor: pointer;
    padding: 2px; border-radius: 4px; margin-left: auto;
    display: flex; align-items: center; justify-content: center;
    transition: all 120ms;
  }
  .sp-gear:hover { background: rgba(0,0,0,0.05); color: var(--accent, #D97757); }

  /* ── 5-cell research metrics — single row ── */
  .sp-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }
  .sp-cell {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px; padding: 12px 4px;
    border-right: 1px solid var(--border-subtle, #EDEAE5);
  }
  .sp-cell:last-child { border-right: none; }
  .sp-val {
    font-family: var(--font-mono);
    font-size: 0.92rem; font-weight: 700;
    line-height: 1; color: var(--text-primary);
  }
  .sp-key {
    font-family: var(--font-mono);
    font-size: 0.42rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    .sp-grid { grid-template-columns: repeat(3, 1fr); }
    .sp-cell { border-bottom: 1px solid var(--border-subtle, #EDEAE5); }
    .sp-cell:nth-child(3n) { border-right: none; }
    .sp-cell:nth-last-child(-n+2) { border-bottom: none; }
  }
</style>
