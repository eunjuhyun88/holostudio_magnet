<script lang="ts">
  /**
   * MagnetStudioPage — Main entry point for Magnet Studio.
   *
   * State machine:
   *   IDLE → CREATE → [SETUP] → RUNNING → COMPLETE → IDLE
   *
   * Absorbs: DashboardPage, AutoresearchPage (partially), OntologyPage
   * Route: /  (studio)
   */
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { router } from '../stores/router.ts';
  import { jobStore } from '../stores/jobStore.ts';
  import { studioStore, studioPhase } from '../stores/studioStore.ts';
  import type { ResourceMode } from '../stores/studioStore.ts';
  import type { AppView } from '../stores/router.ts';
  import StudioIdle from '../components/studio/StudioIdle.svelte';
  import StudioCreate from '../components/studio/StudioCreate.svelte';

  // Lazy-loaded heavy components
  let OntologySetup: any = null;
  let ResearchRunning: any = null;
  let ResearchComplete: any = null;
  let StudioPublish: any = null;

  // Auto-detect phase from jobStore on mount
  onMount(() => {
    studioStore.syncFromJobStore();

    // Watch for job completion
    const unsub = jobStore.subscribe(($job) => {
      if ($job.phase === 'complete' && $studioPhase === 'running') {
        studioStore.completeResearch();
      }
    });

    return unsub;
  });

  // Lazy load components when needed
  $: if ($studioPhase === 'setup' && !OntologySetup) {
    import('../components/studio/OntologySetup.svelte').then(m => { OntologySetup = m.default; });
  }
  $: if ($studioPhase === 'running' && !ResearchRunning) {
    import('../components/studio/ResearchRunning.svelte').then(m => { ResearchRunning = m.default; });
  }
  $: if ($studioPhase === 'complete' && !ResearchComplete) {
    import('../components/studio/ResearchComplete.svelte').then(m => { ResearchComplete = m.default; });
  }
  $: if (($studioPhase === 'publish' || $studioPhase === 'published') && !StudioPublish) {
    import('../components/studio/StudioPublish.svelte').then(m => { StudioPublish = m.default; });
  }

  // ── Event Handlers ──

  function handleStartCreate(e: CustomEvent<{ topic?: string; presetId?: string }>) {
    studioStore.startCreate(e.detail.topic);
    if (e.detail.presetId) {
      studioStore.setPreset(e.detail.presetId);
    }
  }

  function handleGoToSetup() {
    studioStore.goToSetup();
  }

  function handleGoToSetupFromCreate(e: CustomEvent<{ topic: string }>) {
    studioStore.setTopic(e.detail.topic);
    studioStore.goToSetup();
  }

  function handleGoToRunning() {
    studioStore.startRunning();
  }

  function handleStartResearch(e: CustomEvent<{ topic: string; resourceMode: ResourceMode }>) {
    // Quick start: create job and go to RUNNING
    const { topic, resourceMode } = e.detail;
    studioStore.setTopic(topic);
    studioStore.setResourceMode(resourceMode);

    // Start the job (demo mode for now)
    const branchCount = 3;
    const avgIters = 25;
    jobStore.startJob(topic, branchCount, avgIters);
    studioStore.startRunning();
  }

  function handleLaunchFromSetup(e: CustomEvent<{ ontology: any }>) {
    // Launch from full setup
    const ontology = e.detail.ontology;
    const topic = ontology.name;
    studioStore.setTopic(topic);
    jobStore.startJob(topic, 3, 25);
    studioStore.startRunning();
  }

  function handleBack() {
    studioStore.goBack();
  }

  function handleStop() {
    jobStore.set({ ...jobStore, phase: 'idle' } as any);
    studioStore.reset();
  }

  function handleSubmit(e: CustomEvent<{ text: string; parentId: number | null }>) {
    // Submit experiment idea during RUNNING
    // TODO: wire to real API
  }

  function handleZoomIn() {
    router.navigate('research-lab');
  }

  function handleNewResearch() {
    studioStore.reset();
  }

  function handlePublish() {
    studioStore.goToPublish();
  }

  function handlePublished(e: CustomEvent<{ modelId: string }>) {
    studioStore.confirmPublished(e.detail.modelId);
    router.navigate('model-detail', { modelId: e.detail.modelId });
  }

  function handleNavigate(e: CustomEvent<{ view: AppView }>) {
    router.navigate(e.detail.view);
  }

  // Phase transition key for animations
  $: phaseKey = $studioPhase;
</script>

<div class="studio-page">
  {#key phaseKey}
    <div class="phase-container" in:fly={{ y: 12, duration: 250, delay: 60 }} out:fade={{ duration: 120 }}>
      {#if $studioPhase === 'idle'}
        <StudioIdle
          on:startCreate={handleStartCreate}
          on:goToSetup={handleGoToSetup}
          on:goToRunning={handleGoToRunning}
          on:navigate={handleNavigate}
        />

      {:else if $studioPhase === 'create'}
        <StudioCreate
          on:back={handleBack}
          on:startResearch={handleStartResearch}
          on:goToSetup={handleGoToSetupFromCreate}
        />

      {:else if $studioPhase === 'setup'}
        {#if OntologySetup}
          <svelte:component
            this={OntologySetup}
            headerTitle="{$studioStore.createTopic || 'Research Ontology'}"
            on:launch={handleLaunchFromSetup}
            on:back={handleBack}
          />
        {:else}
          <div class="loading-state">Loading setup...</div>
        {/if}

      {:else if $studioPhase === 'running'}
        {#if ResearchRunning}
          <svelte:component
            this={ResearchRunning}
            topic={$jobStore.topic}
            progress={$jobStore.progress}
            sessionId={$jobStore.sessionId}
            branches={$jobStore.branches}
            totalExperiments={$jobStore.totalExperiments}
            bestMetric={$jobStore.bestMetric}
            experiments={$jobStore.experiments}
            on:stop={handleStop}
            on:submit={handleSubmit}
            on:zoomIn={handleZoomIn}
          />
        {:else}
          <div class="loading-state">Loading research view...</div>
        {/if}

      {:else if $studioPhase === 'complete'}
        {#if ResearchComplete}
          <svelte:component
            this={ResearchComplete}
            branches={$jobStore.branches}
            experiments={$jobStore.experiments}
            bestMetric={$jobStore.bestMetric}
            totalExperiments={$jobStore.totalExperiments}
            on:newResearch={handleNewResearch}
            on:deploy={handlePublish}
            on:retrain={(e) => {
              // Retrain → back to CREATE with existing config
              studioStore.startCreate($studioStore.createTopic);
            }}
            on:improve={(e) => {
              // Improve → back to CREATE with improvement instructions
              studioStore.startCreate($studioStore.createTopic);
            }}
          />
        {:else}
          <div class="loading-state">Loading results...</div>
        {/if}

      {:else if $studioPhase === 'publish' || $studioPhase === 'published'}
        {#if StudioPublish}
          <svelte:component
            this={StudioPublish}
            topic={$studioStore.createTopic || $jobStore.topic}
            bestMetric={$jobStore.bestMetric}
            experiments={$jobStore.experiments}
            branches={$jobStore.branches}
            totalExperiments={$jobStore.totalExperiments}
            on:back={handleBack}
            on:published={handlePublished}
            on:newResearch={handleNewResearch}
          />
        {:else}
          <div class="loading-state">Loading publish wizard...</div>
        {/if}
      {/if}
    </div>
  {/key}
</div>

<style>
  .studio-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    background: var(--page-bg, #FAF9F7);
  }

  .phase-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #9a9590);
    font-size: 0.82rem;
    font-family: var(--font-mono, monospace);
  }
</style>
