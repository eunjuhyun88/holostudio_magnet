<script lang="ts">
  export let modelSlug: string = 'model-um69vho1';

  const curlSnippet = `curl -X POST https://api.hoot.holostudio.io/v1/predict \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "${modelSlug}",
    "input": { "symbol": "ETH", "timeframe": "24h" }
  }'`;

  const pySnippet = `import hoot

client = hoot.Client(api_key="YOUR_API_KEY")
result = client.predict(
    model_id="${modelSlug}",
    input={"symbol": "ETH", "timeframe": "24h"}
)
print(result.prediction)  # 0.73`;
</script>

<div class="api-block">
  <div class="api-header">
    <h3 class="api-lang">cURL</h3>
    <button class="copy-btn">Copy</button>
  </div>
  <pre class="api-code">{curlSnippet}</pre>
</div>
<div class="api-block">
  <div class="api-header">
    <h3 class="api-lang">Python</h3>
    <button class="copy-btn">Copy</button>
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
