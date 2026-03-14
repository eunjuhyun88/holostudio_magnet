# Mesh Autoresearch Visualizer

Dual-panel visualization for:

- autoresearch worker swarm state
- globe-based browser compute mesh
- keep and discard experiment tape

## 1.1) Context Routing

Use this read order for fast resume and low token cost:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `ARCHITECTURE.md`
5. `memory/MEMORY.md`
6. `memory/session-log.md`
7. `memory/architecture.md`

If the task touches retrieval, compaction, agent manifests, or tool contracts, also read:

- `docs/CONTEXT_ENGINEERING.md`
- `docs/AGENT_FACTORY.md`
- `docs/TOOL_DESIGN.md`

### Context Artifact Model

- Canonical truth: `README.md`, `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/`, `memory/`
- Runtime working memory: `.agent-context/`
- Semantic checkpoint: `npm run ctx:checkpoint -- --work-id "W-..." --surface "web" --objective "..."`
- Runtime snapshot: `npm run ctx:save -- --title "..."`
- Compacted resume state: `npm run ctx:compact`
- Resume command: `npm run ctx:restore -- --mode brief`
- Generated context views: `npm run docs:refresh`

## Run

Install dependencies:

```bash
npm install
```

Start the default app:

```bash
npm run dev
```

Start the parallel runtime-api scaffold:

```bash
npm run dev:runtime-api
```

Bootstrap the pinned Karpathy upstream stack used by the controller and supervisor:

```bash
npm run autoresearch:bootstrap
```

This now boots the Svelte shell by default. The globe and telemetry behavior stay the same, but the primary layout and panel hierarchy are now driven by Svelte.

Build the default Svelte runtime:

```bash
npm run build
```

Evaluate the current state:

```bash
npm run eval:globe
```

Context maintenance:

```bash
npm run docs:refresh
npm run docs:check
```

## Live Telemetry Mock

Start the fixture-backed SSE stream:

```bash
npm run telemetry:mock
```

Open the app with live telemetry mode:

```text
http://localhost:5173/?telemetry=http://localhost:8787/events
```

Optional query parameters on the SSE endpoint:

- `loop=false` to stop after one pass
- `from=10` to start from a later event

## Autoresearch Adapter

Convert one or more `autoresearch` workspaces into the same telemetry NDJSON stream:

```bash
npm run telemetry:from-autoresearch -- \
  --workspace-root=fixtures/autoresearch-sample/workspaces \
  --manifest=fixtures/autoresearch-sample/manifest.json
```

Write the converted stream to a file:

```bash
npm run telemetry:from-autoresearch -- \
  --workspace-root=fixtures/autoresearch-sample/workspaces \
  --manifest=fixtures/autoresearch-sample/manifest.json \
  --output=fixtures/autoresearch-sample/events.ndjson
```

Serve live SSE directly from `autoresearch`-style workspaces:

```bash
npm run telemetry:mock -- \
  --autoresearch-root=fixtures/autoresearch-sample/workspaces \
  --manifest=fixtures/autoresearch-sample/manifest.json
```

The adapter expects each workspace to contain:

- `run.log`
- optional `results.tsv`

Current assumptions:

- each workspace maps to one worker, one node, and one job
- `results.tsv` rows use `commit`, `val_bpb`, `memory_gb`, `status`, `description`
- if no manifest is provided, the adapter falls back to deterministic pseudo-coordinates
- if `status` is missing, the adapter infers `keep` or `discard` from the latest `val_bpb`

## Loop Controller

For a long-running swarm that keeps emitting telemetry without the short fixture reset, start the integrated controller:

```bash
npm run controller:loop -- \
  --runtime-root=runtime/autoresearch-loop \
  --workers=6 \
  --mode=simulate \
  --port=8787
```

Open the app in live mode:

```text
http://localhost:5173/?telemetry=http://localhost:8787/events
```

What the controller does:

- bootstraps one git worktree per worker from the `autoresearch` repo
- writes a runtime `manifest.json` for the visualizer
- initializes `results.tsv` headers
- serves SSE directly from the controller
- in `simulate` mode, continuously appends realistic `run.log` and `results.tsv` updates
- in `watch` mode, keeps the SSE server up and reacts to real `results.tsv` / `run.log` changes

Useful endpoints:

- `/events` — live telemetry SSE
- `/healthz` — controller health and iteration counters
- `/manifest` — generated workspace manifest
- `/state` — controller runtime state

Useful flags:

- `--mode=simulate|watch`
- `--workers=8`
- `--simulate-iteration-ms=24000`
- `--max-iterations=500`
- `--max-no-keep=40`
- `--target-val-bpb=0.990500`
- `--max-runtime-minutes=480`

Notes:

- `simulate` is the safe path on this machine if CUDA/data prep are not available.
- run `npm run autoresearch:bootstrap` first to materialize the pinned upstream repos under `runtime/upstreams/`.
- real `autoresearch` execution still requires an NVIDIA GPU, `uv sync`, and `uv run prepare.py` inside each workspace lineage.
- the controller intentionally separates `bootstrap + telemetry + stop conditions` from the actual code-editing agent. In production, you point your agent at the generated workspaces and keep the controller in `watch` mode.

## Swarm Supervisor

To attach real `codex exec` workers to the generated worktrees, use the supervisor:

```bash
npm run swarm:supervisor -- \
  --runtime-root=runtime/autoresearch-loop-live \
  --workers=6 \
  --controller-port=8787
```

What it does:

- reuses or launches a `watch` controller
- resolves the pinned `karpathy/autoresearch` repo and `karpathy/nanochat@6ed7d1d` reference set
- checks `uv`, `codex`, `nvidia-smi`, and `~/.cache/autoresearch`
- writes per-worker status files under `runtime/.../agent-logs/*`
- if preflight passes, launches `codex exec` once per workspace
- optionally restarts workers after they finish

Useful flags:

- `--preflight-only=true`
- `--force-launch=true`
- `--restart-agents=false`
- `--agent-experiments=12`
- `--model=gpt-5`

Current machine status matters:

- if `nvidia-smi` is missing or `~/.cache/autoresearch` has not been prepared, the supervisor will stop at preflight and write the exact blockers into each worker status file instead of launching broken runs.

## Current Architecture

- `src/Visualizer.tsx` is the only editable visualizer file
- `src/fixed/*` are read-only model and telemetry helpers
- `eval/*` are read-only scoring and structural checks
- `fixtures/events.ndjson` is the default telemetry source

## Autoresearch-Guided Svelte Migration

This repo now includes a dedicated migration track under:

- `migration/svelte/README.md`
- `migration/svelte/spec.md`
- `migration/svelte/program.md`

Prepare a phase-by-phase runtime pack for long-running workers:

```bash
npm run migration:svelte:prepare -- --runtime-root=runtime/svelte-migration
```

Svelte runtime commands:

```bash
npm run dev:svelte
npm run build:svelte
```

Current post-cutover shape:

- `src-svelte/App.svelte` owns the responsive shell, metrics, panels, and tape
- `src-svelte/lib/*` contains native Svelte UI components
- `src/react/GlobeCanvas.tsx` remains the shared Three renderer while the Svelte shell owns the layout
- `index.html` + `vite.config.ts` now boot the Svelte runtime by default
- `index.react.html` + `vite.react.config.ts` keep the legacy React shell available for fallback and evaluator maintenance

What it generates:

- `runtime/svelte-migration/manifest.json`
- one folder per migration phase
- per-phase `program.md`
- per-phase `results.tsv`

Recommended use:

1. phase 1 extracts shared TypeScript core while React remains the live shell
2. phase 2 adds Svelte runtime and a parallel shell
3. phase 3 ports layout and panels
4. phase 4 switches the entry only after parity
5. phase 5 removes stale migration scaffolding and keeps React only as a compatibility fallback until evaluator assumptions are relaxed

Important:

- do not attempt a one-shot rewrite
- keep `npm run build` and `npm run eval:globe` green throughout the migration
- the default runtime now lives under `src-svelte/*`
- the legacy React runtime is still available through `npm run dev:react`
