<script lang="ts">
  import { router, type AppView } from "../stores/router.ts";
  import { jobStore, completedCount } from "../stores/jobStore.ts";
  import { wallet, WALLET_OPTIONS } from "../stores/walletStore.ts";
  import { unlockedPages } from "../stores/stageStore.ts";
  import PixelOwl from "../components/PixelOwl.svelte";
  import PixelIcon from "../components/PixelIcon.svelte";
  import ConnectionBadge from "../components/ConnectionBadge.svelte";

  type PixelIconType = "sparkle" | "grid" | "chart" | "globe" | "protocol" | "ontology" | "research";

  const navItems: { view: AppView; label: string; icon: PixelIconType }[] = [
    { view: "studio", label: "Magnet Studio", icon: "research" },
    { view: "models", label: "Models", icon: "grid" },
    { view: "network", label: "Network", icon: "globe" },
    { view: "protocol", label: "Protocol", icon: "protocol" },
  ];

  $: currentView = $router;
  // studio is always visible; other tabs follow stage gate
  $: visibleNavItems = navItems.filter(item => item.view === 'studio' || $unlockedPages.includes(item.view));
  $: isAIActive = $jobStore.phase === 'running' || $jobStore.phase === 'setup';
  $: owlMood = (() => {
    const p = $jobStore.phase;
    if (p === 'running') return 'research';
    if (p === 'setup') return 'build';
    if (p === 'complete') return 'celebrate';
    return 'idle';
  })();
  $: researchProgress = $jobStore.totalExperiments > 0
    ? Math.round(($completedCount / $jobStore.totalExperiments) * 100)
    : 0;

  let mobileMenuOpen = false;
  let walletDropdownOpen = false;

  const wallets = WALLET_OPTIONS;

  function navTo(view: AppView) {
    router.navigate(view);
    mobileMenuOpen = false;
  }

  function handleWalletClick() {
    if ($wallet.connected) {
      walletDropdownOpen = !walletDropdownOpen;
    } else {
      walletDropdownOpen = !walletDropdownOpen;
    }
  }

  function selectWallet(name: string) {
    wallet.connect(name);
    walletDropdownOpen = false;
  }

  function handleDisconnect() {
    wallet.disconnect();
    walletDropdownOpen = false;
  }
</script>

<header class="navbar" class:menu-open={mobileMenuOpen}>
  <div class="navbar-inner">
    <button class="logo" on:click={() => navTo('home')}>
      <span class="logo-icon" class:ai-active={isAIActive}>
        <PixelOwl size={0.28} mood={owlMood} />
        {#if isAIActive}
          <span class="ai-pulse-ring"></span>
          <span class="ai-pulse-ring r2"></span>
        {/if}
      </span>
      <span class="logo-text">HOOT PROTOCOL</span>
      {#if isAIActive}
        <span class="ai-badge">AI</span>
      {/if}
    </button>

    <!-- Desktop Nav -->
    <nav class="nav desktop-nav">
      {#each visibleNavItems as item}
        <button
          class="nav-item"
          class:active={currentView === item.view}
          on:click={() => navTo(item.view)}
        >
          <span class="nav-icon">
            <PixelIcon type={item.icon} size={16} />
          </span>
          <span class="nav-label">{item.label}</span>
          {#if item.view === 'network'}
            <span class="nav-live-dot"></span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="navbar-right">
      {#if isAIActive}
        <button class="research-indicator" on:click={() => navTo('studio')}>
          <span class="ri-pulse"></span>
          <span class="ri-label">Research</span>
          <span class="ri-bar">
            <span class="ri-fill" style="width: {researchProgress}%"></span>
          </span>
          <span class="ri-pct">{researchProgress}%</span>
        </button>
      {/if}
      <ConnectionBadge />
      <span class="powered">powered by <strong>holostudio</strong></span>
      <!-- Wallet Connect -->
      <div class="wallet-wrap">
        {#if $wallet.connected}
          <button class="wallet-btn wallet-connected" on:click={handleWalletClick}>
            <span class="wallet-dot-live"></span>
            <span class="wallet-addr">{$wallet.address}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        {:else}
          <button class="wallet-btn" on:click={handleWalletClick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/>
              <path d="M16 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
              <path d="M2 10h20" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Connect
          </button>
        {/if}
        {#if walletDropdownOpen}
          <div class="wallet-dropdown">
            {#if $wallet.connected}
              <div class="wallet-dd-info">
                <span class="wallet-dd-name">{$wallet.name}</span>
                <span class="wallet-dd-addr">{$wallet.address}</span>
              </div>
              <button class="wallet-dd-item wallet-dd-disconnect" on:click={handleDisconnect}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Disconnect
              </button>
            {:else}
              {#each wallets as w}
                <button class="wallet-dd-item" on:click={() => selectWallet(w.name)}>
                  <span class="wallet-dd-icon">{w.icon}</span>
                  <span>{w.name}</span>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
      <!-- Mobile hamburger -->
      <button class="hamburger" class:open={mobileMenuOpen} on:click={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Menu">
        <span class="hline"></span>
        <span class="hline"></span>
        <span class="hline"></span>
      </button>
    </div>
  </div>
</header>

<!-- Mobile overlay menu -->
{#if mobileMenuOpen}
  <button type="button" class="mobile-overlay" aria-label="Close navigation menu" on:click={() => mobileMenuOpen = false}></button>
  <nav class="mobile-menu">
    {#each visibleNavItems as item, i}
      <button
        class="mobile-nav-item"
        class:active={currentView === item.view}
        style="animation-delay: {i * 50}ms"
        on:click={() => navTo(item.view)}
      >
        <span class="nav-icon">
          <PixelIcon type={item.icon} size={20} />
        </span>
        <span class="mobile-nav-label">{item.label}</span>
        {#if item.view === 'network'}
          <span class="nav-live-dot"></span>
        {/if}
        {#if currentView === item.view}
          <span class="mobile-active-dot"></span>
        {/if}
      </button>
    {/each}
    <div class="mobile-menu-footer">
      {#if $wallet.connected}
        <div class="mobile-wallet-info">
          <span class="wallet-dot-live"></span>
          <span class="mobile-wallet-addr">{$wallet.name} · {$wallet.address}</span>
        </div>
        <button class="mobile-sign-in mobile-disconnect" on:click={() => { wallet.disconnect(); mobileMenuOpen = false; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Disconnect
        </button>
      {:else}
        {#each wallets as w}
          <button class="mobile-sign-in" on:click={() => { selectWallet(w.name); mobileMenuOpen = false; }}>
            <span>{w.icon}</span>
            {w.name}
          </button>
        {/each}
      {/if}
    </div>
  </nav>
{/if}

<style>
  .navbar {
    position: sticky;
    top: 0;
    z-index: var(--z-nav, 100);
    background: var(--glass-bg, rgba(255, 255, 255, 0.72));
    backdrop-filter: blur(var(--glass-blur, 24px));
    -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
    border-bottom: 1px solid var(--border, #E5E0DA);
    transition: background var(--dur-normal, 300ms) var(--ease-smooth);
  }

  .navbar-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--space-4, 16px);
    height: 44px;
    display: flex;
    align-items: center;
    gap: var(--space-6, 24px);
  }

  .logo {
    appearance: none;
    border: none;
    background: none;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .logo-icon {
    position: relative;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 6px;
    animation: magnet-pulse 3s ease-in-out infinite;
  }
  .logo-icon :global(.pixel-owl) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .logo-icon :global(.magnet-icon) { overflow: visible; }

  .logo-icon :global(.field-line) { animation: field-pulse 3s ease-in-out infinite; }
  .logo-icon :global(.f1) { animation-delay: 0s; }
  .logo-icon :global(.f2) { animation-delay: 0.5s; }
  .logo-icon :global(.f3) { animation-delay: 1s; }

  @keyframes field-pulse {
    0%, 100% { opacity: 0.1; stroke-width: 0.4; }
    50% { opacity: 0.35; stroke-width: 0.8; }
  }

  .logo-icon :global(.particle) { animation: particle-attract 2.8s ease-in-out infinite; }
  .logo-icon :global(.p1) { animation-delay: 0s; }
  .logo-icon :global(.p2) { animation-delay: 0.5s; }
  .logo-icon :global(.p3) { animation-delay: 1s; }
  .logo-icon :global(.p4) { animation-delay: 1.5s; }
  .logo-icon :global(.p5) { animation-delay: 2s; }

  @keyframes particle-attract {
    0%, 100% { transform: translateY(-3px); opacity: 0.3; }
    30% { opacity: 0.9; }
    50% { transform: translateY(2px); opacity: 0.8; }
    80% { opacity: 0.5; }
  }

  @keyframes magnet-pulse {
    0%, 100% { filter: drop-shadow(0 0 0px rgba(217, 119, 87, 0)); }
    50% { filter: drop-shadow(0 0 6px rgba(217, 119, 87, 0.3)); }
  }

  .logo-icon.ai-active { animation: magnet-ai-active 1.8s ease-in-out infinite; }
  .logo-icon.ai-active :global(.particle) { animation: particle-ai-orbit 1.6s ease-in-out infinite; }
  .logo-icon.ai-active :global(.field-line) { animation: field-ai-active 1.5s ease-in-out infinite; }

  @keyframes magnet-ai-active {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(217, 119, 87, 0.3)); }
    50% { filter: drop-shadow(0 0 12px rgba(217, 119, 87, 0.6)); }
  }
  @keyframes particle-ai-orbit {
    0% { transform: translateY(-2px); opacity: 0.4; }
    25% { transform: translateY(1px) translateX(1px); opacity: 0.9; }
    50% { transform: translateY(2px); opacity: 0.7; }
    75% { transform: translateY(0px) translateX(-1px); opacity: 0.5; }
    100% { transform: translateY(-2px); opacity: 0.4; }
  }
  @keyframes field-ai-active {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.5; }
  }

  .ai-pulse-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 1.5px solid var(--accent, #D97757);
    opacity: 0;
    animation: ai-ring-expand 2s ease-out infinite;
    pointer-events: none;
  }
  .ai-pulse-ring.r2 { animation-delay: 1s; }
  @keyframes ai-ring-expand {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .ai-badge {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.5rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #fff;
    background: var(--accent, #D97757);
    padding: 1px 5px;
    border-radius: 3px;
    animation: ai-badge-pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes ai-badge-pulse {
    0%, 100% { opacity: 0.8; box-shadow: 0 0 4px rgba(217, 119, 87, 0.2); }
    50% { opacity: 1; box-shadow: 0 0 10px rgba(217, 119, 87, 0.5); }
  }

  :global(.px-icon) {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .logo-text {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .desktop-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
  }

  .nav-item {
    appearance: none;
    border: none;
    background: none;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    border-radius: var(--radius-pill, 100px);
    position: relative;
    transition: all var(--dur-fast, 150ms) var(--ease-smooth);
  }

  .nav-item .nav-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted, #9a9590);
    transition: color var(--dur-fast, 150ms) var(--ease-smooth);
  }
  .nav-item .nav-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    transition: color var(--dur-fast, 150ms) var(--ease-smooth);
  }
  .nav-item:hover .nav-label { color: var(--text-primary, #2D2D2D); }
  .nav-item:hover .nav-icon { color: var(--text-secondary, #6b6560); }
  .nav-item:hover { background: rgba(0, 0, 0, 0.03); }
  .nav-item.active { background: rgba(217, 119, 87, 0.10); }
  .nav-item.active .nav-label { color: var(--text-primary, #2D2D2D); font-weight: 600; }
  .nav-item.active .nav-icon { color: var(--accent, #D97757); }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-4, 16px);
    flex-shrink: 0;
  }

  .powered {
    font-size: 0.7rem;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: 0.04em;
  }
  .powered strong { color: var(--text-secondary, #6b6560); font-weight: 600; }
  @media (max-width: 1100px) { .powered { display: none; } }

  /* ── Wallet Connect ── */
  .wallet-wrap {
    position: relative;
  }

  .wallet-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: var(--radius-pill, 100px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all var(--dur-fast, 150ms) var(--ease-smooth);
    white-space: nowrap;
  }

  .wallet-btn:hover {
    border-color: var(--accent, #D97757);
    box-shadow: var(--glow-accent-sm);
  }

  .wallet-btn.wallet-connected {
    border-color: color-mix(in srgb, var(--green, #27864a) 30%, transparent);
    background: color-mix(in srgb, var(--green, #27864a) 4%, transparent);
  }

  .wallet-btn.wallet-connected:hover {
    border-color: color-mix(in srgb, var(--green, #27864a) 50%, transparent);
    box-shadow: var(--glow-green-sm);
  }

  .wallet-dot-live {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39, 134, 74, 0.5);
    animation: nav-dot-pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  .wallet-addr {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .wallet-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 200px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.12));
    z-index: var(--z-nav-overlay, 200);
    padding: 6px;
    animation: scaleIn 150ms var(--ease-out-expo, ease);
  }

  .wallet-dd-info {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    margin-bottom: 4px;
  }

  .wallet-dd-name {
    display: block;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin-bottom: 2px;
  }

  .wallet-dd-addr {
    display: block;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6rem;
    color: var(--text-muted, #9a9590);
  }

  .wallet-dd-item {
    appearance: none;
    border: none;
    background: none;
    width: 100%;
    padding: 10px 12px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-primary, #2D2D2D);
    transition: background var(--dur-fast, 150ms) ease;
  }

  .wallet-dd-item:hover {
    background: rgba(217, 119, 87, 0.06);
  }

  .wallet-dd-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .wallet-dd-disconnect {
    color: var(--red, #c0392b);
  }

  .wallet-dd-disconnect:hover {
    background: color-mix(in srgb, var(--red, #c0392b) 6%, transparent);
  }

  /* ── Hamburger ── */
  .hamburger {
    display: none;
    appearance: none;
    border: none;
    background: none;
    cursor: pointer;
    width: 32px;
    height: 32px;
    padding: 6px;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
  }
  .hline {
    display: block;
    width: 100%;
    height: 2px;
    background: var(--text-primary, #2D2D2D);
    border-radius: 2px;
    transition: all var(--dur-normal, 300ms) var(--ease-out-expo);
    transform-origin: center;
  }
  .hamburger.open .hline:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open .hline:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .hamburger.open .hline:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ── Mobile Overlay ── */
  .mobile-overlay {
    appearance: none;
    border: none;
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 0;
    cursor: pointer;
    z-index: calc(var(--z-nav, 100) - 1);
    animation: fadeIn var(--dur-normal, 300ms) var(--ease-smooth);
  }

  .mobile-menu {
    display: none;
    position: fixed;
    top: 52px;
    right: 0;
    width: 280px;
    max-height: calc(100vh - 52px);
    background: var(--glass-bg, rgba(255, 255, 255, 0.92));
    backdrop-filter: blur(var(--glass-blur, 24px));
    -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
    border-left: 1px solid var(--border, #E5E0DA);
    border-bottom: 1px solid var(--border, #E5E0DA);
    border-radius: 0 0 0 var(--radius-lg, 16px);
    box-shadow: var(--shadow-lg);
    z-index: calc(var(--z-nav, 100) + 1);
    padding: var(--space-3, 12px);
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  .mobile-nav-item {
    appearance: none;
    border: none;
    background: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-md, 10px);
    cursor: pointer;
    transition: all var(--dur-fast, 150ms) var(--ease-smooth);
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) backwards;
    position: relative;
  }
  .mobile-nav-item .nav-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted, #9a9590);
    transition: color var(--dur-fast, 150ms) var(--ease-smooth);
  }
  .mobile-nav-label {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-secondary, #6b6560);
    transition: color var(--dur-fast, 150ms) var(--ease-smooth);
  }
  .mobile-nav-item:hover {
    background: rgba(217, 119, 87, 0.06);
  }
  .mobile-nav-item.active {
    background: rgba(217, 119, 87, 0.08);
  }
  .mobile-nav-item.active .mobile-nav-label {
    color: var(--text-primary, #2D2D2D);
    font-weight: 600;
  }
  .mobile-nav-item.active .nav-icon {
    color: var(--accent, #D97757);
  }
  .mobile-active-dot {
    margin-left: auto;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent, #D97757);
    box-shadow: 0 0 8px rgba(217, 119, 87, 0.4);
  }

  .nav-live-dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39, 134, 74, 0.4);
    animation: nav-dot-pulse 2s ease-in-out infinite;
    margin-left: 4px;
    vertical-align: middle;
  }
  @keyframes nav-dot-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .mobile-menu-footer {
    margin-top: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .mobile-sign-in {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radius-md, 10px);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all var(--dur-fast, 150ms) var(--ease-smooth);
  }
  .mobile-sign-in:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    box-shadow: var(--glow-accent-sm, 0 0 6px rgba(217, 119, 87, 0.25));
  }

  .mobile-sign-in + .mobile-sign-in {
    margin-top: 6px;
  }

  .mobile-disconnect {
    color: var(--red, #c0392b);
    border-color: color-mix(in srgb, var(--red, #c0392b) 20%, transparent);
  }
  .mobile-disconnect:hover {
    color: var(--red, #c0392b);
    border-color: var(--red, #c0392b);
    box-shadow: var(--glow-red, 0 0 8px rgba(192, 57, 43, 0.3));
  }

  .mobile-wallet-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 12px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: var(--text-secondary, #6b6560);
  }

  .mobile-wallet-addr {
    font-variant-numeric: tabular-nums;
  }

  .mobile-menu-footer {
    display: flex;
    flex-direction: column;
  }

  /* ── Research Progress Indicator ── */
  .research-indicator {
    appearance: none;
    border: 1px solid rgba(217, 119, 87, 0.2);
    background: rgba(217, 119, 87, 0.04);
    border-radius: var(--radius-pill, 100px);
    padding: 3px 12px 3px 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all var(--dur-fast, 150ms) var(--ease-smooth);
    white-space: nowrap;
  }
  .research-indicator:hover {
    border-color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.08);
    box-shadow: var(--glow-accent-sm);
  }
  .ri-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent, #D97757);
    box-shadow: 0 0 6px rgba(217, 119, 87, 0.5);
    animation: nav-dot-pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .ri-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ri-bar {
    width: 40px;
    height: 3px;
    background: rgba(217, 119, 87, 0.12);
    border-radius: 2px;
    overflow: hidden;
  }
  .ri-fill {
    display: block;
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 2px;
    transition: width 300ms var(--ease-smooth);
    box-shadow: 0 0 4px rgba(217, 119, 87, 0.4);
  }
  .ri-pct {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.58rem;
    font-weight: 700;
    color: var(--accent, #D97757);
    font-variant-numeric: tabular-nums;
    min-width: 24px;
    text-align: right;
  }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .navbar-inner { gap: var(--space-3, 12px); }
    .logo-text { display: none; }
    .desktop-nav { display: none; }
    .powered { display: none; }
    .hamburger { display: flex; }
    .mobile-overlay { display: block; }
    .mobile-menu { display: flex; width: 100%; border-radius: 0 0 var(--radius-lg) var(--radius-lg); border-left: none; }
    .navbar-right {
      margin-left: auto;
      gap: var(--space-2, 8px);
    }
    .wallet-btn {
      padding: 5px 12px;
      font-size: 0.68rem;
    }
  }

  @media (max-width: 600px) {
    .navbar-inner { padding: 0 var(--space-3, 12px); height: 44px; }
    .wallet-btn {
      padding: 4px 10px;
      font-size: 0.64rem;
    }
    .wallet-dropdown {
      width: 180px;
    }
    .hamburger {
      width: 28px;
      height: 28px;
      padding: 5px;
      gap: 4px;
    }
    .hline { height: 1.5px; }
    .navbar-right { gap: 6px; }
    .mobile-menu {
      top: 44px;
      width: 100%;
      max-height: calc(100vh - 44px);
      border-radius: 0;
      border-left: none;
      padding: 8px 8px calc(12px + env(safe-area-inset-bottom, 0px));
      gap: 1px;
      background: rgba(255, 255, 255, 0.96);
    }
    .mobile-nav-item {
      gap: 10px;
      padding: 12px 12px;
      border-radius: 12px;
    }
    .mobile-nav-label {
      font-size: 0.88rem;
    }
    .mobile-menu-footer {
      margin-top: 6px;
      padding: 10px 12px calc(8px + env(safe-area-inset-bottom, 0px));
    }
    .mobile-wallet-info {
      padding: 4px 0 10px;
      font-size: 0.66rem;
    }
    .mobile-sign-in {
      padding: 10px 12px;
      font-size: 0.82rem;
    }
  }
</style>
