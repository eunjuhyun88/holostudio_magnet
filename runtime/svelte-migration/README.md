# Prepared Svelte Migration Runtime

Generated for:

- source root: `/Users/ej/mesh-autoresearch-visualizer`
- runtime root: `/Users/ej/mesh-autoresearch-visualizer/runtime/svelte-migration`

## Dependency Status

Svelte dependencies already appear in package.json.

## Phase Order

1. `phase-1-core-extraction` — Extract shared TypeScript core
2. `phase-2-svelte-shell` — Add a parallel Svelte shell
3. `phase-3-panel-port` — Port panels and layout to Svelte
4. `phase-4-entry-cutover` — Switch default entry to Svelte
5. `phase-5-cleanup` — Remove legacy React shell

## Recommended Usage

Use each phase folder as a separate long-running task contract for an autoresearch-style worker.

Do not skip directly to the entry cutover.
