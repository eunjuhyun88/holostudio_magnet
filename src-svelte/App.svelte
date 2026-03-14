<script lang="ts">
  import { router, type AppView } from "./lib/stores/router.ts";
  import { unlockedPages } from "./lib/stores/stageStore.ts";
  import { fly } from "svelte/transition";
  import NavBar from "./lib/layout/NavBar.svelte";
  import DashboardPage from "./lib/pages/DashboardPage.svelte";
  import SiteFooter from "./lib/layout/SiteFooter.svelte";
  import SplashScreen from "./lib/components/SplashScreen.svelte";
  import "./lib/tokens.css";

  let showSplash = true;

  // Lazy-loaded page components (everything except Dashboard which is the landing page)
  const pageLoaders: Record<string, () => Promise<{ default: any }>> = {
    models: () => import("./lib/pages/ModelsPage.svelte"),
    research: () => import("./lib/pages/AutoresearchPage.svelte"),
    network: () => import("./lib/pages/NetworkView.svelte"),
    'model-detail': () => import("./lib/pages/ModelDetailPage.svelte"),
    protocol: () => import("./lib/pages/EconomicsPage.svelte"),
    ontology: () => import("./lib/pages/OntologyPage.svelte"),
    pipeline: () => import("./lib/pages/PipelinePage.svelte"),
  };

  // Stage guard: redirect to dashboard if page is locked
  $: if (!$unlockedPages.includes($router) && $router !== 'dashboard') {
    router.navigate('dashboard');
  }

  // Page transition key — increments on route change
  $: routeKey = $router;
  $: isDashboard = $router === 'dashboard';
  $: pagePromise = !isDashboard ? pageLoaders[$router]?.() : null;
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
      <div class="page-transition" in:fly={{ y: 12, duration: 280, delay: 60 }}>
        {#if isDashboard}
          <DashboardPage />
        {:else if pagePromise}
          {#await pagePromise then mod}
            <svelte:component this={mod.default} />
          {:catch}
            <div class="page-error">Failed to load page</div>
          {/await}
        {/if}
      </div>
    {/key}
  </main>
  {#if !isDashboard}
    <SiteFooter />
  {/if}
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
