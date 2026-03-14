<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { router } from '../stores/router.ts';
  import { jobStore, keepCount, statusMessage } from '../stores/jobStore.ts';
  import ModelSummaryCard from '../components/ModelSummaryCard.svelte';
  import IdleEditor from '../components/IdleEditor.svelte';
  import SetupTerminal from '../components/SetupTerminal.svelte';
  import RunningDashboard from '../components/RunningDashboard.svelte';

  $: job = $jobStore;
  $: phase = job.phase;
  $: status = $statusMessage;

  // Owl mood — reacts to research phase
  let owlMood: 'idle' | 'research' | 'build' | 'celebrate' | 'sleep' = 'sleep';
  let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
  let prevKeepCount = 0;

  $: {
    if (phase === 'idle') owlMood = 'sleep';
    else if (phase === 'setup') owlMood = 'research';
    else if (phase === 'running') {
      if ($keepCount > prevKeepCount && prevKeepCount > 0) {
        owlMood = 'celebrate';
        if (celebrateTimer) clearTimeout(celebrateTimer);
        celebrateTimer = setTimeout(() => { owlMood = 'research'; }, 3000);
      } else if (owlMood !== 'celebrate') {
        owlMood = 'research';
      }
      prevKeepCount = $keepCount;
    }
    else if (phase === 'complete') owlMood = 'celebrate';
  }

  function handleLaunch(e: CustomEvent<string>) {
    jobStore.startJob(e.detail);
  }

  function handleStop() {
    jobStore.reset();
  }

  function handleNewResearch() {
    jobStore.reset();
  }

  onMount(() => {
    const unsub = router.params.subscribe(p => {
      if (p.topic && job.phase === 'idle') {
        jobStore.startJob(p.topic);
      }
    });
    return () => {
      if (celebrateTimer) clearTimeout(celebrateTimer);
      unsub();
    };
  });
</script>

<div class="autoresearch">
  {#if phase === 'idle'}
    <IdleEditor on:launch={handleLaunch} />
  {:else if phase === 'setup'}
    <SetupTerminal topic={job.topic} statusMessage={status} />
  {:else if phase === 'running'}
    <RunningDashboard {owlMood} on:stop={handleStop} />
  {:else if phase === 'complete'}
    <ModelSummaryCard
      onViewDetails={() => router.navigate('model-detail', { modelId: 'model-um69vho1' })}
      onNewResearch={handleNewResearch}
    />
  {/if}
</div>

<style>
  .autoresearch {
    max-width: 100%;
    margin: 0;
    padding: 0;
    min-height: calc(100vh - 52px);
    overflow-x: hidden;
  }
</style>
