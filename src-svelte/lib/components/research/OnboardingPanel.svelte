<script lang="ts">
  import PixelOwl from '../PixelOwl.svelte';
</script>

<div class="onboard">
  <div class="onboard-hero">
    <div class="onboard-owl">
      <PixelOwl size={0.7} mood="idle" />
    </div>
    <h1 class="onboard-heading">Automated<br/>Model Research</h1>
    <p class="onboard-sub">Define a research topic. The system handles everything else.</p>
  </div>

  <div class="onboard-steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <span class="step-title">Describe your research</span>
        <span class="step-desc">Enter a topic or choose a preset in the panel on the right.</span>
      </div>
    </div>
    <div class="step-connector"></div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <span class="step-title">Parallel experiments run</span>
        <span class="step-desc">Multiple branches explore different strategies simultaneously across GPU nodes.</span>
      </div>
    </div>
    <div class="step-connector"></div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <span class="step-title">Review &amp; deploy</span>
        <span class="step-desc">Inspect the best model, compare branches, and deploy with one click.</span>
      </div>
    </div>
  </div>

  <div class="onboard-cta">
    <span class="cta-arrow">&#x2192;</span>
    <span class="cta-text">Enter a topic in the panel to begin</span>
  </div>
</div>

<style>
  .onboard {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100%; padding: 32px 24px;
    gap: 28px;
    background:
      radial-gradient(ellipse 60% 50% at 30% 70%, rgba(217,119,87,0.03), transparent),
      radial-gradient(ellipse 50% 40% at 80% 30%, rgba(137,180,250,0.03), transparent),
      var(--page-bg, #FAF9F7);
    border-radius: 10px;
    overflow-y: auto;
  }

  .onboard-hero {
    display: flex; flex-direction: column;
    align-items: center; gap: 12px;
    text-align: center;
  }
  .onboard-owl {
    filter: drop-shadow(0 4px 16px rgba(217,119,87,0.12));
    animation: owlFloat 4s ease-in-out infinite;
  }
  @keyframes owlFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .onboard-heading {
    font: 800 28px/1.1 'Inter', -apple-system, sans-serif;
    color: #1a1a1a;
    letter-spacing: -0.03em;
    margin: 0;
  }
  .onboard-sub {
    font: 400 13px/1.5 'Inter', -apple-system, sans-serif;
    color: #999;
    margin: 0;
    max-width: 320px;
  }

  .onboard-steps {
    display: flex; flex-direction: column;
    align-items: stretch; gap: 0;
    width: 100%; max-width: 380px;
  }
  .step {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 16px;
    background: rgba(255,255,255,0.8);
    border: 1px solid rgba(0,0,0,0.04);
    border-radius: 12px;
    transition: transform 200ms ease, box-shadow 200ms ease;
  }
  .step:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  }
  .step-num {
    width: 28px; height: 28px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #D97757, #e89a7e);
    color: #fff;
    font: 700 13px/1 'Inter', -apple-system, sans-serif;
    box-shadow: 0 2px 8px rgba(217,119,87,0.2);
  }
  .step-body {
    display: flex; flex-direction: column; gap: 2px;
    min-width: 0;
  }
  .step-title {
    font: 600 13px/1.3 'Inter', -apple-system, sans-serif;
    color: #333;
  }
  .step-desc {
    font: 400 11px/1.4 'Inter', -apple-system, sans-serif;
    color: #999;
  }
  .step-connector {
    width: 2px; height: 12px;
    background: linear-gradient(180deg, rgba(217,119,87,0.2), rgba(217,119,87,0.05));
    margin-left: 29px;
    border-radius: 1px;
  }

  .onboard-cta {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 20px;
    border-radius: 999px;
    background: rgba(217,119,87,0.06);
    border: 1px solid rgba(217,119,87,0.12);
    animation: ctaPulse 3s ease-in-out infinite;
  }
  @keyframes ctaPulse {
    0%, 100% { border-color: rgba(217,119,87,0.12); }
    50% { border-color: rgba(217,119,87,0.28); }
  }
  .cta-arrow {
    font-size: 16px; color: #D97757;
    animation: arrowBounce 1.5s ease-in-out infinite;
  }
  @keyframes arrowBounce {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(4px); }
  }
  .cta-text {
    font: 500 12px/1 'Inter', -apple-system, sans-serif;
    color: #D97757;
  }

  @media (max-width: 600px) {
    .onboard { padding: 20px 16px; gap: 20px; }
    .onboard-heading { font-size: 22px; }
    .onboard-sub { font-size: 12px; }
    .step { padding: 10px 12px; }
    .step-num { width: 24px; height: 24px; font-size: 11px; border-radius: 6px; }
    .step-connector { margin-left: 25px; }
  }
</style>
