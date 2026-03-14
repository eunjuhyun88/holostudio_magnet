<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
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
    const runtimeConfig = readRuntimeConfig();
    if (runtimeConfig.runtimeRoot || runtimeConfig.apiBase) {
      void jobStore.connectRuntime(runtimeConfig);
      return;
    }
    jobStore.startJob(e.detail);
  }

  function handleStop() {
    jobStore.stopJob();
  }

  function handleNewResearch() {
    jobStore.reset();
  }

  onMount(() => {
    const runtimeConfig = readRuntimeConfig();
    void (async () => {
      const connected = await jobStore.connectRuntime(runtimeConfig);
      if (!connected) {
        const params = getCurrentRouteParams();
        if (params.topic && get(jobStore).phase === 'idle') {
          jobStore.startJob(params.topic);
        }
      }
    })();

    const unsub = router.params.subscribe(p => {
      const current = get(jobStore);
      if (current.sourceMode === 'runtime') {
        return;
      }
      if (p.topic && current.phase === 'idle') {
        jobStore.startJob(p.topic);
      }
    });
    return () => {
      if (celebrateTimer) clearTimeout(celebrateTimer);
      unsub();
    };
  });

  function readRuntimeConfig(): { runtimeRoot?: string | null; apiBase?: string | null } {
    if (typeof window === 'undefined') {
      return {};
    }

    const fromSearch = new URLSearchParams(window.location.search);
    const hash = window.location.hash.slice(1) || '/';
    const hashQueryIndex = hash.indexOf('?');
    const fromHash = new URLSearchParams(hashQueryIndex >= 0 ? hash.slice(hashQueryIndex + 1) : '');

    const runtimeRoot = fromHash.get('runtimeRoot') || fromSearch.get('runtimeRoot');
    const apiBase = fromHash.get('runtimeApi') || fromSearch.get('runtimeApi');

    return {
      runtimeRoot: runtimeRoot?.trim() || null,
      apiBase: apiBase?.trim() || null,
    };
  }

  function getCurrentRouteParams() {
    const hash = window.location.hash.slice(1) || '/';
    const queryIndex = hash.indexOf('?');
    const query = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : '');
    return {
      topic: query.get('topic') || undefined,
    };
  }
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
