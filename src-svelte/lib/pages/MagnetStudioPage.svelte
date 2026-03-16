<script lang="ts">
  /**
   * MagnetStudioPage — Main entry point for Magnet Studio.
   *
   * State machine:
   *   IDLE → STEP1 → STEP2 → [SETUP] → RUNNING → COMPLETE → IDLE
   *                                                  ↓
   *                                              PUBLISH → PUBLISHED
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
  import { toastStore } from '../stores/toastStore.ts';
  import StudioStep1 from '../components/studio/StudioStep1.svelte';
  import StudioStep2 from '../components/studio/StudioStep2.svelte';
  import ConfirmModal from '../components/ConfirmModal.svelte';
  import ContractCallModal from '../components/ContractCallModal.svelte';
  import type { ContractCall } from '../data/protocolData.ts';
  import { wallet } from '../stores/walletStore.ts';

  // ── Confirmation state ──
  let showStopConfirm = false;
  let showStartConfirm = false;
  let showCreditInsufficient = false;
  let pendingStartEvent: { topic: string; resourceMode: ResourceMode } | null = null;

  // ── ContractCallModal state ──
  let modalOpen = false;
  let modalCall: ContractCall | null = null;
  let modalStep: 'review' | 'pending' | 'confirmed' | 'error' = 'review';
  let pendingAction: 'start' | 'stop' | null = null;

  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // Lazy-loaded heavy components
  let OntologySetup: any = null;
  let ResearchRunning: any = null;
  let ResearchComplete: any = null;
  let StudioPublish: any = null;

  // Auto-detect phase from jobStore on mount
  onMount(() => {
    studioStore.syncFromJobStore();

    // If idle (user navigated to /studio directly), auto-advance to step1
    if ($studioPhase === 'idle') {
      studioStore.startCreate();
    }

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

  /** From StudioStep1: user entered topic and hit Continue */
  function handleStep1Continue(e: CustomEvent<{ topic: string }>) {
    studioStore.goToStep2(e.detail.topic);
  }

  /** From StudioStep2: go to advanced setup */
  function handleGoToSetupFromStep2(e: CustomEvent<{ topic: string }>) {
    studioStore.setTopic(e.detail.topic);
    studioStore.goToSetup();
  }

  /** From StudioStep2: start research */
  function handleStartResearch(e: CustomEvent<{ topic: string; resourceMode: ResourceMode }>) {
    pendingStartEvent = e.detail;
    showStartConfirm = true;
  }

  function confirmStartResearch() {
    showStartConfirm = false;
    if (!pendingStartEvent) return;

    // Open ContractCallModal for ResearchJobCreated
    const { topic, resourceMode } = pendingStartEvent;
    const budget = resourceMode === 'demo' ? '0' : '150';

    modalCall = {
      title: 'Start Research',
      contract: '0x4F0a...7E3d  HootJobs.sol',
      fn: 'createResearchJob',
      params: [
        { name: 'topic', type: 'string', value: topic },
        { name: 'budget', type: 'uint256', value: `${budget} HOOT` },
        { name: 'tier', type: 'uint8', value: resourceMode === 'network' ? 'T2' : 'T1' },
        { name: 'config', type: 'bytes', value: '0x...' },
      ],
      fee: `${budget} HOOT (escrow)`,
      gas: '~120,000',
      note: 'Budget is deposited in escrow. Unused funds are refunded on completion or cancellation.',
      accentColor: 'var(--accent)',
      paymentEnabled: resourceMode !== 'demo',
      hootAmount: budget,
      usdcAmount: String(Math.round(Number(budget) * 1.25)),
    };
    modalStep = 'review';
    modalOpen = true;
    pendingAction = 'start';
  }

  function cancelStartResearch() {
    showStartConfirm = false;
    pendingStartEvent = null;
  }

  function handleLaunchFromSetup(e: CustomEvent<{ ontology: any }>) {
    const ontology = e.detail.ontology;
    const topic = ontology.name;
    studioStore.setTopic(topic);
    jobStore.startJob(topic, 3, 25);
    studioStore.startRunning();
  }

  function handleBack() {
    // If going back from step1, navigate to Home
    if ($studioPhase === 'step1') {
      studioStore.reset();
      router.navigate('home');
      return;
    }
    studioStore.goBack();
  }

  function handleStop() {
    showStopConfirm = true;
  }

  function confirmStop() {
    showStopConfirm = false;

    // Open ContractCallModal for ResearchJobCancelled
    const remaining = Math.round((1 - ($jobStore.progress ?? 0) / 100) * 150);
    modalCall = {
      title: 'Stop Research',
      contract: '0x4F0a...7E3d  HootJobs.sol',
      fn: 'cancelResearchJob',
      params: [
        { name: 'jobId', type: 'uint256', value: $jobStore.sessionId || 'JOB-001' },
      ],
      fee: `0 HOOT (refund: ${remaining} HOOT remaining)`,
      gas: '~68,000',
      note: 'Unused budget will be refunded to your wallet.',
      accentColor: 'var(--warn)',
    };
    modalStep = 'review';
    modalOpen = true;
    pendingAction = 'stop';
  }

  function cancelStop() {
    showStopConfirm = false;
  }

  // ── ContractCallModal handlers ──
  function handleModalConfirm() {
    modalStep = 'pending';
    setTimeout(() => {
      modalStep = 'confirmed';
      // Execute the actual action after confirmed
      if (pendingAction === 'start' && pendingStartEvent) {
        const { topic, resourceMode } = pendingStartEvent;
        studioStore.setTopic(topic);
        studioStore.setResourceMode(resourceMode);
        const branchCount = 3;
        const avgIters = 25;
        jobStore.startJob(topic, branchCount, avgIters);
        studioStore.startRunning();
        toastStore.success('Research started');
        pendingStartEvent = null;
      } else if (pendingAction === 'stop') {
        jobStore.set({ ...jobStore, phase: 'idle' } as any);
        studioStore.reset();
        toastStore.warning('Research stopped');
      }
    }, 2200);
  }

  function handleModalClose() {
    modalOpen = false;
    modalCall = null;
    modalStep = 'review';
    pendingAction = null;
  }

  function handleCreditBuy() {
    showCreditInsufficient = false;
    // Open external DEX link
    window.open('https://app.uniswap.org', '_blank');
  }

  function handleCreditBurn() {
    showCreditInsufficient = false;
    router.navigate('protocol');
  }

  function handleSubmit(e: CustomEvent<{ text: string; parentId: number | null }>) {
    // Submit experiment idea during RUNNING
  }

  function handleZoomIn() {
    router.navigate('research-lab');
  }

  function handleNewResearch() {
    studioStore.reset();
    router.navigate('home');
  }

  function handlePublish() {
    studioStore.goToPublish();
  }

  function handlePublished(e: CustomEvent<{ modelId: string }>) {
    studioStore.confirmPublished(e.detail.modelId);
    router.navigate('model-detail', { modelId: e.detail.modelId });
  }

  // Phase transition key for animations
  $: phaseKey = $studioPhase;
</script>

<div class="studio-page">
  {#key phaseKey}
    <div class="phase-container" in:fly={{ y: 12, duration: 250, delay: 60 }} out:fade={{ duration: 120 }}>
      {#if $studioPhase === 'step1' || $studioPhase === 'step1-topic' || $studioPhase === 'idle'}
        <StudioStep1
          on:back={handleBack}
          on:continue={handleStep1Continue}
        />

      {:else if $studioPhase === 'step2'}
        <StudioStep2
          on:back={handleBack}
          on:startResearch={handleStartResearch}
          on:goToSetup={handleGoToSetupFromStep2}
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
            on:retrain={() => {
              studioStore.startCreate($studioStore.createTopic);
              studioStore.goToStep2($studioStore.createTopic);
            }}
            on:improve={() => {
              studioStore.startCreate($studioStore.createTopic);
              studioStore.goToStep2($studioStore.createTopic);
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

  <ConfirmModal
    open={showStopConfirm}
    title="Stop this research?"
    message="All running experiments will be cancelled. Data will not be preserved."
    confirmLabel="Stop"
    cancelLabel="Continue"
    variant="danger"
    on:confirm={confirmStop}
    on:cancel={cancelStop}
  />

  <ConfirmModal
    open={showStartConfirm}
    title="Start this research?"
    message={pendingStartEvent ? `${pendingStartEvent.topic} — ${pendingStartEvent.resourceMode} mode` : ''}
    confirmLabel="Start"
    cancelLabel="Cancel"
    on:confirm={confirmStartResearch}
    on:cancel={cancelStartResearch}
  />

  <!-- Credit Insufficient Modal -->
  <ConfirmModal
    open={showCreditInsufficient}
    title="Insufficient credits"
    message="Insufficient HOOT balance to start research."
    confirmLabel="Buy HOOT"
    cancelLabel="Later"
    on:confirm={handleCreditBuy}
    on:cancel={() => { showCreditInsufficient = false; }}
  />

  <!-- ContractCallModal for on-chain transactions -->
  <ContractCallModal
    {modalOpen}
    {modalCall}
    {modalStep}
    {walletConnected}
    {walletAddress}
    on:close={handleModalClose}
    on:confirm={handleModalConfirm}
    on:connectWallet={() => { wallet.connect('MetaMask'); }}
  />
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
