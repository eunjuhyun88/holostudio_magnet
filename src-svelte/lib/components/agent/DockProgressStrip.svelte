<script lang="ts">
  /**
   * DockProgressStrip — 2px full-width progress bar at dock top
   *
   * Only visible when research is running.
   * Shimmer animation during active progress.
   * Color transitions from accent → green at 100%.
   */
  import { fade } from 'svelte/transition';
  import { jobStore, jobProgress } from '../../stores/jobStore.ts';

  $: progress = $jobProgress;
  $: isRunning = $jobStore.phase === 'running' || $jobStore.phase === 'setup';
  $: isComplete = progress >= 100;
</script>

{#if isRunning}
  <div class="progress-strip" transition:fade={{ duration: 200 }}>
    <div
      class="progress-fill"
      class:progress-complete={isComplete}
      style="width: {progress}%"
    ></div>
  </div>
{/if}

<style>
  .progress-strip {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 20px 20px 0 0;
    overflow: hidden;
    z-index: 2;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 2px;
    transition: width 300ms ease;
    position: relative;
  }
  /* Shimmer animation */
  .progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 50%,
      transparent 100%
    );
    animation: shimmer 2s ease-in-out infinite;
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .progress-complete {
    background: var(--green, #27864a);
    transition: width 300ms ease, background 600ms ease;
  }
  .progress-complete::after {
    animation: none;
    opacity: 0;
  }
</style>
