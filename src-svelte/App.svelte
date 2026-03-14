<script lang="ts">
  import { router } from "./lib/router.ts";
  import { fade, fly } from "svelte/transition";
  import NavBar from "./lib/NavBar.svelte";
  import DashboardPage from "./lib/DashboardPage.svelte";
  import ModelsPage from "./lib/ModelsPage.svelte";
  import AutoresearchPage from "./lib/AutoresearchPage.svelte";
  import NetworkView from "./lib/NetworkView.svelte";
  import ModelDetailPage from "./lib/ModelDetailPage.svelte";
  import SiteFooter from "./lib/SiteFooter.svelte";
  import SplashScreen from "./lib/SplashScreen.svelte";
  import "./lib/tokens.css";

  let showSplash = true;

  // Page transition key — increments on route change
  $: routeKey = $router;
</script>

<svelte:head>
  <title>HOOT Protocol — Autonomous Research Mesh</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

{#if showSplash}
  <SplashScreen onDone={() => showSplash = false} />
{/if}

<div class="app-shell" data-theme="light">
  <NavBar />
  <main class="app-main">
    {#key routeKey}
      <div class="page-transition" in:fade={{ duration: 200, delay: 80 }}>
        {#if $router === 'dashboard'}
          <DashboardPage />
        {:else if $router === 'models'}
          <ModelsPage />
        {:else if $router === 'research'}
          <AutoresearchPage />
        {:else if $router === 'network'}
          <NetworkView />
        {:else if $router === 'model-detail'}
          <ModelDetailPage />
        {/if}
      </div>
    {/key}
  </main>
  <SiteFooter />
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
</style>
