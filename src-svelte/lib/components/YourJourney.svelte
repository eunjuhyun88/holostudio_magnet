<script lang="ts">
  import { JOURNEY_ACTORS } from '../data/protocolData.ts';

  const journeyActors = JOURNEY_ACTORS;
</script>

<div class="journey-section">
  <div class="journey-inner">
    <h2 class="journey-title">Your Journey in HOOT</h2>
    <p class="journey-subtitle">Five roles power the autonomous research mesh</p>
    <div class="journey-grid">
      {#each journeyActors as actor, i}
        <div class="journey-card" style="--journey-delay: {i}; --journey-color: {actor.color}">
          <div class="journey-card-icon">{actor.icon}</div>
          <h3 class="journey-card-role">{actor.role}</h3>
          <p class="journey-card-desc">{actor.desc}</p>
          <ul class="journey-card-actions">
            {#each actor.actions as action}
              <li>{action}</li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .journey-section {
    padding: 40px 24px 48px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    background: linear-gradient(180deg, var(--page-bg, #FAF9F7) 0%, color-mix(in srgb, var(--accent) 3%, var(--page-bg, #FAF9F7)) 100%);
  }

  .journey-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  .journey-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text-primary);
    text-align: center;
  }

  .journey-subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
    margin: 0 0 28px;
    font-weight: 500;
  }

  .journey-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }

  .journey-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 20px 16px;
    text-align: center;
    transition: all 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--journey-delay, 0) * 80ms + 400ms) both;
  }

  .journey-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--journey-color);
  }

  .journey-card-icon {
    font-size: 1.8rem;
    margin-bottom: 10px;
    line-height: 1;
  }

  .journey-card-role {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text-primary);
  }

  .journey-card-desc {
    font-size: 0.72rem;
    color: var(--text-secondary);
    margin: 0 0 12px;
    font-weight: 500;
  }

  .journey-card-actions {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .journey-card-actions li {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-muted);
    padding: 4px 8px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    line-height: 1.3;
  }

  .journey-card-actions li::before {
    content: '→ ';
    color: var(--journey-color);
  }

  @media (max-width: 860px) {
    .journey-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 600px) {
    .journey-grid { grid-template-columns: 1fr 1fr; }
    .journey-section { padding: 28px 12px 36px; }
    .journey-title { font-size: 1.2rem; }
  }
</style>
