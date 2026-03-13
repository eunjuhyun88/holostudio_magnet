<script lang="ts">
  import { onMount } from "svelte";
  import { StrictMode, createElement } from "react";
  import { createRoot, type Root } from "react-dom/client";

  import GlobeCanvas from "../../src/react/GlobeCanvas.tsx";
  import type { Job, Node, Worker } from "../../src/fixed/types.ts";

  export let nodes: Node[] = [];
  export let jobs: Job[] = [];
  export let workers: Worker[] = [];
  export let selectedWorker: Worker | null = null;
  export let viewerLocation:
    | {
        lat: number;
        lng: number;
        label: string;
      }
    | null = null;

  let host: HTMLDivElement | null = null;
  let root: Root | null = null;

  function renderIsland() {
    if (!root) {
      return;
    }

    root.render(
      createElement(
        StrictMode,
        null,
        createElement(GlobeCanvas, {
          nodes,
          jobs,
          workers,
          selectedWorker,
          viewerLocation,
        }),
      ),
    );
  }

  onMount(() => {
    if (!host) {
      throw new Error("Missing globe host");
    }

    root = createRoot(host);
    renderIsland();

    return () => {
      root?.unmount();
      root = null;
    };
  });

  $: if (root) {
    renderIsland();
  }
</script>

<div bind:this={host} class="host"></div>

<style>
  .host {
    width: 100%;
    height: 100%;
    min-height: 100%;
    position: absolute;
    inset: 0;
  }
</style>
