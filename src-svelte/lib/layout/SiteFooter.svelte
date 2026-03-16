<script lang="ts">
  import PixelOwl from "../components/PixelOwl.svelte";

  type FooterLink = {
    label: string;
    href: string;
    external?: boolean;
  };

  const productLinks: FooterLink[] = [
    { label: "Magnet Studio", href: "#/studio" },
    { label: "Models", href: "#/models" },
    { label: "Network", href: "#/network" },
    { label: "Protocol", href: "#/protocol" },
  ];

  const resourceLinks: FooterLink[] = [
    { label: "HOOT Whitepaper", href: "https://hoot.holostudio.io", external: true },
  ];

  const followLinks: FooterLink[] = [
    { label: "Hoot Browser on X", href: "https://x.com/HootBrowser", external: true },
  ];

  const currentYear = new Date().getFullYear();
</script>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div class="footer-brand-block">
      <a class="footer-brand" href="#/">
        <span class="footer-owl"><PixelOwl size={0.22} mood="sleep" /></span>
        <span class="footer-brand-mark">HOOT</span>
        <span class="footer-brand-name">PROTOCOL</span>
      </a>
      <p class="footer-copy">
        Autonomous research mesh for live experiment orchestration, model benchmarking, and network-native compute workflows.
      </p>
    </div>

    <div class="footer-links-grid">
      <div class="footer-group">
        <h2 class="footer-group-title">Product</h2>
        <div class="footer-link-list">
          {#each productLinks as link}
            <a class="footer-link" href={link.href}>{link.label}</a>
          {/each}
        </div>
      </div>

      <div class="footer-group">
        <h2 class="footer-group-title">Resources</h2>
        <div class="footer-link-list">
          {#each resourceLinks as link}
            <a
              class="footer-link"
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </a>
          {/each}
        </div>
      </div>

      <div class="footer-group">
        <h2 class="footer-group-title">Follow</h2>
        <div class="footer-link-list">
          {#each followLinks as link}
            <a
              class="footer-link"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="site-footer-meta">
    <span>&copy; {currentYear} Holo Studio Co., Ltd.</span>
    <span>HOOT Protocol</span>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: auto;
    border-top: 1px solid rgba(217, 119, 87, 0.15);
    background:
      radial-gradient(circle at top left, rgba(217, 119, 87, 0.1), transparent 40%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(250, 249, 247, 0.98));
    color: var(--text-primary, #2D2D2D);
  }

  .site-footer-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 28px 24px 20px;
    display: grid;
    grid-template-columns: minmax(220px, 1.2fr) 2fr;
    gap: 28px;
  }

  .footer-brand-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    width: fit-content;
  }

  .footer-owl {
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity 300ms ease;
  }
  .footer-brand:hover .footer-owl {
    opacity: 1;
  }

  .footer-brand-mark {
    font-family: var(--font-display, "Playfair Display", serif);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    letter-spacing: 0.04em;
  }

  .footer-brand-name {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--accent, #D97757);
    letter-spacing: 0.16em;
  }

  .footer-copy {
    margin: 0;
    max-width: 420px;
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--text-secondary, #6b6560);
  }

  .footer-links-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    gap: 20px;
  }

  .footer-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .footer-group-title {
    margin: 0;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
  }

  .footer-link-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .footer-link {
    color: var(--text-secondary, #6b6560);
    text-decoration: none;
    font-size: 0.82rem;
    transition: color 160ms ease, transform 160ms ease;
    width: fit-content;
  }

  .footer-link:hover {
    color: var(--accent, #D97757);
    transform: translateX(2px);
  }

  .site-footer-meta {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px 18px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid rgba(217, 119, 87, 0.12);
    padding-top: 12px;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.62rem;
    color: var(--accent, #D97757);
    letter-spacing: 0.06em;
  }

  /* ── Tablet ── */
  @media (max-width: 960px) {
    .site-footer-inner {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .footer-links-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* ── Mobile — compact footer ── */
  @media (max-width: 600px) {
    .site-footer-inner {
      padding: 12px 14px 6px;
      gap: 10px;
    }

    .footer-brand { gap: 6px; }
    .footer-brand-mark { font-size: 0.94rem; }
    .footer-brand-name { font-size: 0.56rem; }

    /* Hide description — unnecessary on mobile */
    .footer-copy { display: none; }

    /* Links: column → horizontal inline */
    .footer-links-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .footer-group {
      flex-direction: row;
      align-items: center;
      gap: 4px;
    }
    .footer-group-title { display: none; }
    .footer-link-list {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 2px 10px;
    }
    .footer-link {
      font-size: 0.64rem;
      padding: 0;
    }

    .site-footer-meta {
      padding: 8px 14px 10px;
      font-size: 0.54rem;
      gap: 6px;
      flex-wrap: wrap;
    }
  }

  /* ── Very small screens ── */
  @media (max-width: 380px) {
    .site-footer-inner { padding: 12px 12px 6px; }
    .footer-link { font-size: 0.62rem; }
    .site-footer-meta { padding: 6px 12px 8px; }
  }
</style>
