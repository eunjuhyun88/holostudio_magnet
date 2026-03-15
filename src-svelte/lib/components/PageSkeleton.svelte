<script lang="ts">
  // Lightweight skeleton placeholder shown while lazy-loaded pages are loading.
  // Uses CSS shimmer animation for visual feedback.
</script>

<div class="page-skeleton" aria-busy="true" aria-label="Loading page content">
  <div class="sk-header">
    <div class="sk-bar sk-title"></div>
    <div class="sk-bar sk-subtitle"></div>
  </div>
  <div class="sk-grid">
    <div class="sk-card"></div>
    <div class="sk-card"></div>
    <div class="sk-card sk-card-wide"></div>
  </div>
</div>

<style>
  .page-skeleton {
    padding: 40px 32px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .sk-header {
    margin-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sk-bar {
    border-radius: var(--radius-sm, 6px);
    background: linear-gradient(
      90deg,
      var(--border-subtle, #EDEAE5) 25%,
      var(--surface, #fff) 50%,
      var(--border-subtle, #EDEAE5) 75%
    );
    background-size: 400% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .sk-title {
    height: 24px;
    width: 260px;
  }

  .sk-subtitle {
    height: 14px;
    width: 180px;
  }

  .sk-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .sk-card {
    height: 140px;
    border-radius: var(--radius-md, 10px);
    background: linear-gradient(
      90deg,
      var(--border-subtle, #EDEAE5) 25%,
      var(--surface, #fff) 50%,
      var(--border-subtle, #EDEAE5) 75%
    );
    background-size: 400% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .sk-card:nth-child(2) {
    animation-delay: 0.2s;
  }

  .sk-card-wide {
    grid-column: span 2;
    height: 100px;
    animation-delay: 0.4s;
  }

  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk-bar, .sk-card {
      animation: none;
      background: var(--border-subtle, #EDEAE5);
    }
  }

  @media (max-width: 600px) {
    .page-skeleton { padding: 24px 16px; }
    .sk-grid { grid-template-columns: 1fr; }
    .sk-card-wide { grid-column: span 1; }
  }
</style>
