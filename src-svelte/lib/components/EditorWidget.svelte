<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import HeroSection from "./HeroSection.svelte";

  export let searchQuery = "";
  export let topicSuggestions: string[] = [];
  export let collapsed = false;

  const dispatch = createEventDispatcher();

  function toggleCollapse() {
    collapsed = !collapsed;
  }

  function handleSearch(e: CustomEvent<string>) {
    dispatch("search", e.detail);
  }

  function handleTopic(e: CustomEvent<string>) {
    dispatch("topic", e.detail);
  }

  $: previewText = searchQuery
    ? searchQuery.split("\n")[0].slice(0, 50)
    : "Describe your research goal...";
</script>

{#if collapsed}
  <!-- Minibar: single-line compact view -->
  <button class="ew-mini" on:click={toggleCollapse}>
    <span class="ew-mini-icon">✏️</span>
    <span class="ew-mini-file">program.md</span>
    <span class="ew-mini-sep">·</span>
    <span class="ew-mini-preview">{previewText}</span>
    <span class="ew-mini-expand">▼</span>
  </button>
{:else}
  <!-- Full editor -->
  <div class="ew-full">
    <button class="ew-collapse-btn" on:click={toggleCollapse} title="Collapse editor">▲</button>
    <HeroSection
      bind:searchQuery
      {topicSuggestions}
      on:search={handleSearch}
      on:topic={handleTopic}
    />
  </div>
{/if}

<style>
  /* ── Minibar ── */
  .ew-mini {
    appearance: none;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    width: 100%;
    cursor: pointer;
    transition: background 150ms;
  }
  .ew-mini:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .ew-mini-icon {
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .ew-mini-file {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--accent, #D97757);
    white-space: nowrap;
  }

  .ew-mini-sep {
    color: var(--border, #E5E0DA);
    font-size: 0.5rem;
  }

  .ew-mini-preview {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.6rem;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: left;
  }

  .ew-mini-expand {
    font-size: 0.5rem;
    color: var(--text-muted, #9a9590);
    flex-shrink: 0;
  }

  /* ── Full editor ── */
  .ew-full {
    position: relative;
  }

  .ew-collapse-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 3;
    appearance: none;
    border: none;
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-muted, #9a9590);
    font-size: 0.5rem;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ew-collapse-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: var(--text-primary, #2C2824);
  }
</style>
