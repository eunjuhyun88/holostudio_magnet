# Architecture

## Current Baseline (2026-03-15)

### Runtime shape
- `src-svelte/*` is the active product shell.
- `scripts/*` acts like a backend runtime today, but it is not structured as an application boundary yet.
- `runtime/*` contains generated workspaces, manifests, logs, and telemetry artifacts.

### Known structural problems
- The browser still owns part of the domain runtime:
  - `src-svelte/lib/stores/jobStore.ts` mixes domain state, experiment simulation, timers, and UI-facing derived stores.
  - `DashboardPage.svelte` and `NetworkView.svelte` each replay fixture telemetry independently.
- Backend-like code already exists, but the UI contract is informal:
  - `scripts/autoresearch_loop_controller.ts` exposes `/events`, `/healthz`, `/manifest`, `/state`.
  - The frontend only uses SSE directly in `NetworkView.svelte`.
  - `AutoresearchPage.svelte` still runs a local in-browser simulation instead of consuming runtime events.
- Shared telemetry/domain logic is duplicated:
  - `src/fixed/*`
  - `src-svelte/lib/utils/{types,telemetry,fixturePlayer,liveTelemetry}.ts`
- Documentation drift exists:
  - README still references legacy React migration commands not present in `package.json`.
  - `memory/architecture.md` was missing before this file was created.

### Verified baseline
- `npm run build` passes.
- Current build warning only: unused selectors in `src-svelte/lib/components/HeroSection.svelte`.

## Confirmed Direction

The user confirmed these architecture requirements:

1. Frontend and backend must be separated.
2. API attachment must be easy for future integrations.
3. Autoresearch must run continuously outside the browser.
4. Refactoring must target both maintainability and performance.

## Karpathy Autoresearch Fit

Reference repo reviewed: [karpathy/autoresearch](https://github.com/karpathy/autoresearch) as of 2026-03-15.

### What is reusable
- The loop design is directly useful:
  - isolate edits
  - run a short bounded experiment
  - measure one canonical score
  - keep or discard
  - continue indefinitely until stopped
- `program.md` as "research org policy" is a strong fit for our runtime workers.
- Dedicated worktree/branch per run is a good fit for parallel swarms.

### What is not directly reusable
- It is built for:
  - one GPU
  - one editable file (`train.py`)
  - one fixed metric (`val_bpb`)
  - one local autonomous loop without API or persistence
- Our target requires:
  - multi-surface refactoring (`frontend`, `backend`, `shared packages`)
  - build/test/perf gates instead of one ML metric
  - API control plane
  - persisted state and resumability
  - UI telemetry for long-running operations

### Adaptation rule
- Treat `karpathy/autoresearch` as the **experiment loop pattern**, not as the final product runtime.
- Reuse the keep/discard/revert mechanics.
- Replace:
  - `train.py` -> scoped code areas (`apps/web`, `apps/runtime-api`, `packages/*`)
  - `val_bpb` -> composite engineering score
  - local forever loop -> runtime-managed job/worker system

### Composite score direction
- Hard gates:
  - build passes
  - no new console/runtime errors
  - API contract still valid
- Soft optimization:
  - bundle size
  - route load time
  - chart/globe render cost
  - memory retention
  - code complexity delta

## Target Topology

### Apps
- `apps/web`
  - Svelte frontend only
  - no domain timers for research execution
  - consumes API + SSE/WebSocket only
- `apps/runtime-api`
  - Node/TypeScript service
  - owns job lifecycle, runtime state, control commands, SSE fanout
  - wraps current controller/supervisor responsibilities behind stable endpoints

### Shared packages
- `packages/contracts`
  - shared API schemas and event contracts
  - source of truth for REST payloads and stream events
- `packages/domain`
  - pure reducers, selectors, and state machines
  - no DOM, no filesystem, no HTTP
- `packages/autoresearch-adapter`
  - filesystem watcher
  - manifest parsing
  - `run.log` / `results.tsv` ingestion
  - workspace bootstrap helpers

### Runtime persistence
- Start with SQLite for local durability and restart recovery.
- Persist:
  - jobs
  - commands
  - experiment results
  - runtime snapshots
  - append-only event log
- Keep file-based runtime artifacts for workspaces, but do not treat them as the only state store.

## Context Management Layer

### Installed repo-local layer
- `memento-kit` is now installed as the repo-local context layer.
- Canonical context:
  - `README.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `ARCHITECTURE.md`
  - `docs/*`
  - `memory/*`
- Runtime context:
  - `.agent-context/checkpoints`
  - `.agent-context/snapshots`
  - `.agent-context/briefs`
  - `.agent-context/handoffs`

### Practical rule
- `memory/*` remains the committed project memory required by this repo.
- `.agent-context/*` is the cheap, resumable runtime layer for semantic save/compact/restore.
- They solve different problems and should both remain.

### Auto-commit rule
- Auto-commit is enabled only for context artifacts on `stop` and `pre-push`.
- It should not auto-commit arbitrary product code.
- This keeps resumability high without creating unsafe surprise code commits.

## API-First Boundary

### Minimum API surface (v1)
- `POST /api/jobs`
  - create a research job
- `GET /api/jobs/:jobId`
  - job summary and current state
- `GET /api/jobs/:jobId/events`
  - SSE stream for that job
- `POST /api/jobs/:jobId/commands`
  - `pause`, `resume`, `stop`, `boost_category`, `pause_category`
- `GET /api/runtime/mesh`
  - mesh/network summary for dashboard and network pages
- `GET /api/runtime/health`
  - service/runtime health
- `GET /api/runtime/workspaces`
  - workspace and worker status

### Event model rule
- Backend is the single writer of domain events.
- Frontend only derives view state from events and snapshots.
- No page may invent research progress locally after the cutover.

## Execution Flow

1. UI or external client creates a job via `POST /api/jobs`.
2. Runtime persists the job and emits `job.created`.
3. Adapter attaches to autoresearch workspaces or bootstraps them.
4. Workspace results become normalized domain events.
5. Runtime persists events and fans them out through SSE.
6. Frontend subscribes once and derives cards/charts/tables from the shared event stream.
7. Commands from UI or API clients are stored, executed, and echoed back as events.

## Performance Goals

### Structural goals
- Remove duplicated telemetry reducers and types.
- Remove browser-owned experiment timers for research state.
- Replace page-local fixture playback loops with one shared runtime source.

### Runtime goals
- Runtime state must recover after restart from persisted data.
- SSE fanout must not require rebuilding the full model on every subscriber update.
- Event ingestion must remain incremental and append-only.

### UI goals
- Research, Dashboard, and Network pages must read from a shared query/store layer.
- Large lists and feeds should be windowed or capped.
- Heavy visual components must receive already-shaped view models instead of raw runtime state.

## Refactor Sequence

### Phase 0 — Baseline and Contracts
- Freeze current behavior with architecture notes and interface inventory.
- Define canonical event schema and REST payloads.
- Decide folder split and workspace tooling.

### Phase 1 — Extract Shared Core
- Move duplicated telemetry/types into `packages/contracts` and `packages/domain`.
- Keep adapters for existing frontend imports during transition.
- Add reducer tests for event application and snapshot recovery.

### Phase 2 — Introduce Runtime API
- Turn `scripts/autoresearch_loop_controller.ts` into service logic behind `apps/runtime-api`.
- Move `/events`, `/healthz`, `/manifest`, `/state` into versioned `/api/*`.
- Add SQLite persistence and command handling.

### Phase 3 — Frontend Cutover
- Replace `jobStore` simulation responsibilities with API client + frontend view store.
- Make `AutoresearchPage`, `DashboardPage`, and `NetworkView` consume the same runtime source.
- Keep visual components, but feed them normalized view models.

### Phase 4 — Continuous Autoresearch Operations
- Attach supervisor/control flows to persisted jobs.
- Add resumable runs, stop reasons, and error states.
- Add runtime metrics for throughput, keep rate, crash rate, queue depth, and stale worker detection.

### Phase 5 — Performance Hardening
- Remove full-model cloning on hot paths where possible.
- Cap tape/history retention in memory while keeping full persistence on disk.
- Profile globe rendering, chart updates, and SSE throughput under long-running sessions.

### Phase 6 — Remove Legacy Drift
- Delete obsolete duplicated helpers.
- Update README and runbooks to match the new topology.
- Remove frontend assumptions that bypass the API boundary.

## Immediate Backlog

### P0
- Create the folder split plan (`apps/web`, `apps/runtime-api`, `packages/*`).
- Define canonical event contracts.
- Define the command model for pause/resume/boost/pause-category/stop.
- Decide snapshot vs replay rules for frontend hydration.

### P1
- Extract duplicated telemetry/types.
- Convert controller endpoints to service handlers.
- Introduce persistence for jobs and events.

### P2
- Migrate Autoresearch page to live runtime data.
- Migrate Dashboard and Network pages to a shared query layer.
- Add performance instrumentation and retention limits.

## Non-Goals

- Rewriting the visual language from scratch.
- Changing HOOT protocol economics or domain terminology.
- Replacing the current GPU/workspace execution model before the API boundary is stable.
