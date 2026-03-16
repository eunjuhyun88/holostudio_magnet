<script lang="ts">
  /**
   * MagnetStudioPage — Main entry point for Magnet Studio.
   *
   * Simplified state machine:
   *   IDLE → CREATE → [SETUP] → RUNNING → COMPLETE → IDLE
   *                                             ↓
   *                                         PUBLISH → PUBLISHED
   *
   * Multi-research: Multiple sessions can run concurrently.
   * jobSessionStore manages session snapshots; jobStore is the active view.
   *
   * Flow: Dashboard → StudioCreator (unified) → Running → Complete
   * Demo mode: 0 modals.  Network mode: 1 modal (ContractCallModal only).
   *
   * Route: /  (studio)
   */
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { router } from '../stores/router.ts';
  import { jobStore, jobProgress } from '../stores/jobStore.ts';
  import { studioStore, studioPhase } from '../stores/studioStore.ts';
  import type { ResourceMode } from '../stores/studioStore.ts';
  import { jobSessionStore } from '../stores/jobSessionStore.ts';
  import { toastStore } from '../stores/toastStore.ts';
  import StudioDashboard from '../components/studio/StudioDashboard.svelte';
  import StudioCreator from '../components/studio/StudioCreator.svelte';
  import ConfirmModal from '../components/ConfirmModal.svelte';
  import ContractCallModal from '../components/ContractCallModal.svelte';
  import type { ContractCall } from '../data/protocolData.ts';
  import { wallet } from '../stores/walletStore.ts';

  // ── Confirmation state (stop only — start confirm removed) ──
  let showStopConfirm = false;
  let showCreditInsufficient = false;

  // ── ContractCallModal state ──
  let modalOpen = false;
  let modalCall: ContractCall | null = null;
  let modalStep: 'review' | 'pending' | 'confirmed' | 'error' = 'review';
  let pendingAction: 'start' | 'stop' | null = null;
  let pendingStartEvent: { topic: string; resourceMode: ResourceMode } | null = null;

  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // Lazy-loaded heavy components
  let OntologySetup: any = null;
  let ResearchRunning: any = null;
  let ResearchComplete: any = null;
  let StudioPublish: any = null;

  // ── Session sync interval ──
  let syncInterval: ReturnType<typeof setInterval> | null = null;

  // Auto-detect phase from jobStore on mount
  onMount(() => {
    studioStore.syncFromJobStore();

    // Eagerly pre-load components based on current job state so they're
    // ready immediately when navigating back to Studio during research.
    const job = $jobStore;
    if ((job.phase === 'running' || job.phase === 'setup') && !ResearchRunning) {
      import('../components/studio/ResearchRunning.svelte').then(m => { ResearchRunning = m.default; });
    }
    if (job.phase === 'complete' && !ResearchComplete) {
      import('../components/studio/ResearchComplete.svelte').then(m => { ResearchComplete = m.default; });
    }
    // Also pre-load the next likely component (running → complete)
    if (job.phase === 'running' && !ResearchComplete) {
      import('../components/studio/ResearchComplete.svelte').then(m => { ResearchComplete = m.default; });
    }

    // Watch for job completion
    const unsub = jobStore.subscribe(($job) => {
      if ($job.phase === 'complete' && $studioPhase === 'running') {
        studioStore.completeResearch();
        jobSessionStore.syncActiveSession();
      }
    });

    // Periodically sync active session metadata (progress, metrics)
    // Only sync when research is actually running to avoid wasted work
    syncInterval = setInterval(() => {
      const phase = $studioPhase;
      if (phase === 'running' || phase === 'setup') {
        jobSessionStore.syncActiveSession();
      }
    }, 3000);

    return () => {
      unsub();
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    };
  });

  // Lazy load components when needed (fallback for phase transitions)
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

  /** From StudioCreator: start research (unified handler) */
  function handleStartResearch(e: CustomEvent<{ topic: string; resourceMode: ResourceMode }>) {
    const { topic, resourceMode } = e.detail;

    if (resourceMode === 'demo') {
      // Demo mode: no modal, start immediately
      // Create a session for multi-research tracking
      jobSessionStore.createSession(topic);
      studioStore.setTopic(topic);
      studioStore.setResourceMode(resourceMode);
      jobStore.startJob(topic, 3, 25);
      studioStore.startRunning();
      jobSessionStore.syncActiveSession();
      toastStore.success('Research started');
    } else {
      // Network/local/hybrid: show ContractCallModal only (no ConfirmModal)
      pendingStartEvent = e.detail;
      const budget = '150';
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
        paymentEnabled: true,
        hootAmount: budget,
        usdcAmount: String(Math.round(Number(budget) * 1.25)),
      };
      modalStep = 'review';
      modalOpen = true;
      pendingAction = 'start';
    }
  }

  /** From StudioCreator: go to advanced setup */
  function handleGoToSetup(e: CustomEvent<{ topic: string }>) {
    studioStore.setTopic(e.detail.topic);
    studioStore.goToSetup();
  }

  function handleLaunchFromSetup(e: CustomEvent<{ ontology: any }>) {
    const ontology = e.detail.ontology;
    const topic = ontology.name;
    jobSessionStore.createSession(topic);
    studioStore.setTopic(topic);
    jobStore.startJob(topic, 3, 25);
    studioStore.startRunning();
    jobSessionStore.syncActiveSession();
  }

  function handleBack() {
    studioStore.goBack();
  }

  function handleStop() {
    showStopConfirm = true;
  }

  function confirmStop() {
    showStopConfirm = false;

    // Open ContractCallModal for ResearchJobCancelled
    const remaining = Math.round((1 - $jobProgress / 100) * 150);
    modalCall = {
      title: 'Stop Research',
      contract: '0x4F0a...7E3d  HootJobs.sol',
      fn: 'cancelResearchJob',
      params: [
        { name: 'jobId', type: 'uint256', value: $jobStore.runtimeJobId || 'JOB-001' },
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
      if (pendingAction === 'start' && pendingStartEvent) {
        const { topic, resourceMode } = pendingStartEvent;
        // Create a session for multi-research tracking
        jobSessionStore.createSession(topic);
        studioStore.setTopic(topic);
        studioStore.setResourceMode(resourceMode);
        jobStore.startJob(topic, 3, 25);
        studioStore.startRunning();
        jobSessionStore.syncActiveSession();
        toastStore.success('Research started');
        pendingStartEvent = null;
      } else if (pendingAction === 'stop') {
        // Remove the stopped session and reset
        jobSessionStore.syncActiveSession();
        jobStore.stopJob();
        studioStore.setPhase('idle');
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
    window.open('https://app.uniswap.org', '_blank');
  }

  function handleSubmit(e: CustomEvent<{ text: string; parentId: number | null }>) {
    // Submit experiment idea during RUNNING
  }

  function handleZoomIn() {
    router.navigate('research-lab');
  }

  function handleNewResearch() {
    // Save current session snapshot, then go to create view
    jobSessionStore.syncActiveSession();
    studioStore.startCreate();
  }

  /** From StudioDashboard: switch to a different session */
  function handleSwitchSession(e: CustomEvent<{ sessionId: string }>) {
    jobSessionStore.switchSession(e.detail.sessionId);
    studioStore.syncFromJobStore();
    toastStore.info('Switched to session');
  }

  /** From ResearchComplete: view a model */
  function handleViewModel(e: CustomEvent<{ modelId: string }>) {
    router.navigate('model-detail', { modelId: e.detail.modelId });
  }

  /** From ResearchRunning/Complete: go back to dashboard (keeps session running) */
  function handleGoToDashboard() {
    jobSessionStore.syncActiveSession();
    studioStore.setPhase('idle');
  }

  /** From ResearchComplete: agent instruction input */
  function handleAgentInstruction(e: CustomEvent<{ instruction: string }>) {
    const instruction = e.detail.instruction.trim().toLowerCase();
    const topic = $studioStore.createTopic || $jobStore.topic;

    // Route common instructions to actions
    if (instruction.startsWith('/new') || instruction.includes('new research') || instruction.includes('새로운')) {
      handleNewResearch();
    } else if (instruction.startsWith('/deploy') || instruction.startsWith('/publish') || instruction.includes('deploy') || instruction.includes('publish')) {
      handlePublish();
    } else if (instruction.startsWith('/improve') || instruction.includes('improve') || instruction.includes('개선')) {
      studioStore.startCreate(topic);
    } else if (instruction.startsWith('/retry') || instruction.includes('retry') || instruction.includes('다시')) {
      studioStore.startCreate(topic);
    } else if (instruction.startsWith('/test') || instruction.includes('test') || instruction.includes('테스트')) {
      // Playground — dispatch handled in ResearchComplete internally
      toastStore.info('Open the Test panel to try your model');
    } else if (instruction.startsWith('/dashboard') || instruction.startsWith('/home') || instruction.includes('dashboard')) {
      handleGoToDashboard();
    } else {
      // Default: treat as improve instruction — start new research with the instruction as context
      studioStore.startCreate(`${topic} — ${e.detail.instruction}`);
      toastStore.info('Starting new research with your instruction');
    }
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
      {#if $studioPhase === 'idle'}
        <StudioDashboard
          on:newResearch={() => studioStore.startCreate()}
          on:quickStart={(e) => studioStore.startCreate(undefined, e.detail.typeId)}
          on:resumeJob={() => studioStore.syncFromJobStore()}
          on:switchSession={handleSwitchSession}
          on:openModel={(e) => router.navigate('model-detail', { modelId: e.detail.modelId })}
          on:viewModels={() => router.navigate('models')}
        />

      {:else if $studioPhase === 'create'}
        <StudioCreator
          on:back={handleBack}
          on:startResearch={handleStartResearch}
          on:goToSetup={handleGoToSetup}
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
            progress={$jobProgress}
            sessionId={$jobStore.runtimeJobId || ''}
            branches={$jobStore.branches}
            totalExperiments={$jobStore.totalExperiments}
            bestMetric={$jobStore.bestMetric}
            experiments={$jobStore.experiments}
            on:stop={handleStop}
            on:submit={handleSubmit}
            on:zoomIn={handleZoomIn}
            on:goToDashboard={handleGoToDashboard}
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
            on:viewModel={handleViewModel}
            on:goToDashboard={handleGoToDashboard}
            on:agentInstruction={handleAgentInstruction}
            on:retrain={() => studioStore.startCreate($studioStore.createTopic)}
            on:improve={() => studioStore.startCreate($studioStore.createTopic)}
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

  <!-- Stop confirm (kept — destructive action needs confirmation) -->
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

  <!-- ContractCallModal for on-chain transactions (network mode only) -->
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
