<script lang="ts">
  /**
   * ApiTab — API reference + key issuance.
   *
   * Spec: PlatformUX §7-B API Key
   *
   * Events:
   *   openModal: ContractCall — parent handles ContractCallModal
   */
  import { createEventDispatcher } from 'svelte';
  import type { ContractCall } from '../../../packages/contracts/src/index.ts';

  const dispatch = createEventDispatcher<{
    openModal: ContractCall;
  }>();

  export let modelSlug: string = 'model-um69vho1';

  // ── API Key state ──
  let apiKeyIssued = false;
  let apiKey = '';

  /** Called by parent after ContractCallModal confirmed */
  export function onApiKeyIssued() {
    apiKey = `hoot_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    apiKeyIssued = true;
  }

  function requestApiKey() {
    dispatch('openModal', {
      title: 'API Key 발급',
      contract: '0x7B2e...A1f8  HootInference.sol',
      fn: 'issueApiKey',
      params: [
        { name: 'modelId', type: 'string', value: modelSlug },
      ],
      fee: '0 HOOT',
      gas: '~55,000',
      note: 'API Key는 모델별로 1개만 발급됩니다. 분실 시 재발급할 수 있습니다.',
      accentColor: 'var(--green)',
    });
  }

  $: displayKey = apiKeyIssued ? apiKey : 'YOUR_API_KEY';

  $: curlSnippet = `curl -X POST https://api.hoot.holostudio.io/v1/predict \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "${modelSlug}",
    "input": { "symbol": "ETH", "timeframe": "24h" }
  }'`;

  $: pySnippet = `import hoot

client = hoot.Client(api_key="${displayKey}")
result = client.predict(
    model_id="${modelSlug}",
    input={"symbol": "ETH", "timeframe": "24h"}
)
print(result.prediction)  # 0.73`;
</script>

<!-- API Key Section -->
<div class="api-key-section">
  {#if apiKeyIssued}
    <div class="api-key-issued">
      <span class="aki-label">API Key</span>
      <div class="aki-row">
        <code class="aki-key">{apiKey}</code>
        <button class="copy-btn" on:click={() => { navigator.clipboard?.writeText(apiKey); }}>Copy</button>
      </div>
      <span class="aki-note">이 키는 다시 표시되지 않습니다. 안전한 곳에 보관하세요.</span>
    </div>
  {:else}
    <div class="api-key-cta">
      <span class="akc-text">API를 사용하려면 먼저 키를 발급받으세요.</span>
      <button class="akc-btn" on:click={requestApiKey}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        API Key 발급
      </button>
    </div>
  {/if}
</div>

<div class="api-block">
  <div class="api-header">
    <h3 class="api-lang">cURL</h3>
    <button class="copy-btn" on:click={() => { navigator.clipboard?.writeText(curlSnippet); }}>Copy</button>
  </div>
  <pre class="api-code">{curlSnippet}</pre>
</div>
<div class="api-block">
  <div class="api-header">
    <h3 class="api-lang">Python</h3>
    <button class="copy-btn" on:click={() => { navigator.clipboard?.writeText(pySnippet); }}>Copy</button>
  </div>
  <pre class="api-code">{pySnippet}</pre>
</div>

<style>
  .api-block { margin-bottom: var(--space-5, 20px); }
  .api-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: var(--space-2, 8px);
  }
  .api-lang {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D); margin: 0;
  }
  .copy-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-secondary, #6b6560);
    cursor: pointer; transition: all 150ms;
  }
  .copy-btn:hover { border-color: var(--accent, #D97757); color: var(--accent, #D97757); box-shadow: var(--glow-accent-sm, 0 0 6px rgba(217, 119, 87, 0.25)); }

  /* ═══ API KEY SECTION ═══ */
  .api-key-section {
    margin-bottom: var(--space-5, 20px);
    padding: 16px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: var(--radius-md, 10px);
    background: var(--page-bg, #FAF9F7);
  }

  .api-key-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .akc-text {
    font-size: 0.76rem;
    color: var(--text-secondary, #6b6560);
  }
  .akc-btn {
    appearance: none;
    border: 1.5px solid var(--green, #27864a);
    background: rgba(39,134,74,0.04);
    color: var(--green, #27864a);
    font-size: 0.74rem;
    font-weight: 700;
    padding: 8px 18px;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 150ms;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .akc-btn:hover {
    background: var(--green, #27864a);
    color: #fff;
    box-shadow: 0 0 16px rgba(39,134,74,0.2);
  }

  .api-key-issued {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .aki-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
  }
  .aki-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .aki-key {
    flex: 1;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--green, #27864a);
    background: rgba(39,134,74,0.06);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(39,134,74,0.15);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .aki-note {
    font-size: 0.66rem;
    color: var(--accent, #D97757);
    font-weight: 500;
  }

  .api-code {
    padding: 16px;
    border-radius: var(--radius-sm, 6px);
    background: #2A1E18; color: #E8D5C4;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    margin: 0; overflow-x: auto;
    white-space: pre-wrap; line-height: 1.6;
  }
</style>
