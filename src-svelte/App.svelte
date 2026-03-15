<script lang="ts">
  import { onMount } from "svelte";
  import { router, type AppView } from "./lib/stores/router.ts";
  import { unlockedPages } from "./lib/stores/stageStore.ts";
  import { fly, fade } from "svelte/transition";
  import NavBar from "./lib/layout/NavBar.svelte";
  import MagnetStudioPage from "./lib/pages/MagnetStudioPage.svelte";
  import SiteFooter from "./lib/layout/SiteFooter.svelte";
  import SplashScreen from "./lib/components/SplashScreen.svelte";
  import PageSkeleton from "./lib/components/PageSkeleton.svelte";
  import AgentDock from "./lib/components/agent/AgentDock.svelte";
  import ToastContainer from "./lib/components/ToastContainer.svelte";
  import { nodeStore } from "./lib/stores/nodeStore.ts";
  import { ppapStore } from "./lib/stores/ppapStore.ts";
  import "./lib/tokens.css";

  let showSplash = true;

  // Initialize demo data for stores
  onMount(() => {
    nodeStore.init();
    ppapStore.init();
  });

  // Lazy-loaded page components (everything except Dashboard which is the landing page)
  const pageLoaders: Record<string, () => Promise<{ default: any }>> = {
    models: () => import("./lib/pages/ModelsPage.svelte"),
    'research-lab': () => import("./lib/pages/ResearchZoomLabPage.svelte"),
    network: () => import("./lib/pages/NetworkView.svelte"),
    'model-detail': () => import("./lib/pages/ModelDetailPage.svelte"),
    protocol: () => import("./lib/pages/EconomicsPage.svelte"),
    pipeline: () => import("./lib/pages/PipelinePage.svelte"),
  };

  // Stage guard: redirect to studio if page is locked
  $: if (!$unlockedPages.includes($router) && $router !== 'studio' && $router !== 'dashboard') {
    router.navigate('studio');
  }

  // Page transition key — increments on route change
  $: routeKey = $router;
  $: isStudio = $router === 'studio' || $router === 'dashboard';
  $: pagePromise = !isStudio ? pageLoaders[$router]?.() : null;
</script>

<svelte:head>
  <title>HOOT Protocol — Autonomous Research Mesh</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
</svelte:head>

{#if showSplash}
  <SplashScreen onDone={() => showSplash = false} />
{/if}

<div class="app-shell" data-theme="light">
  <NavBar />
  <main class="app-main">
    {#key routeKey}
      <div class="page-transition" in:fly={{ y: 12, duration: 280, delay: 60 }} out:fade={{ duration: 150 }}>
        {#if isStudio}
          <MagnetStudioPage />
        {:else if pagePromise}
          {#await pagePromise}
            <PageSkeleton />
          {:then mod}
            <svelte:component this={mod.default} />
          {:catch}
            <div class="page-error">Failed to load page</div>
          {/await}
        {/if}
      </div>
    {/key}
  </main>
  {#if !isStudio}
    <SiteFooter />
  {/if}
  <AgentDock />
  <ToastContainer />
</div>

<style>
  :global(html, body, #app) {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
  }

  :global(body) {
    font-family: var(--font-body, 'Inter', -apple-system, sans-serif);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--page-bg, #FAF9F7);
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .page-transition {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .page-error {
    padding: 40px;
    text-align: center;
    color: var(--text-muted, #9a9590);
    font-size: 0.9rem;
  }
</style>
