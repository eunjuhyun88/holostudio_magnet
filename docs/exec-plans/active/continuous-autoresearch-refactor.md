# Continuous Autoresearch Refactor

- Status: active
- Created: 2026-03-15

## Objective

Turn the current repo into a continuously running autoresearch product surface with:

- frontend / backend separation
- API-first runtime boundaries
- persistent research state outside the browser
- context-efficient repo operations through Memento

## What Is Already Done

### UI and local research loop
- `jobStore.ts` gained pause/resume, category boost/pause, and better selection logic.
- `RunningDashboard.svelte` was refactored into the current 5-zone layout.
- Current visual requirement remains intact:
  - branch control
  - metric chart
  - scatter
  - heatmap
  - experiment tree
  - distributed mesh

### Architecture direction
- Current baseline documented in `memory/architecture.md`.
- Target topology decided:
  - `apps/web`
  - `apps/runtime-api`
  - `packages/contracts`
  - `packages/domain`
  - `packages/autoresearch-adapter`
- `karpathy/autoresearch` is treated as the worker-loop pattern, not the full product backend.

### Context system
- `memento-kit` core repo layer integrated.
- Canonical doc routing, generated docs, Claude hooks, and `.agent-context/` runtime memory are working.
- `docs:refresh`, `docs:check`, `build`, `ctx:checkpoint`, `ctx:save`, `ctx:compact` all pass.

### Parallel refactor scaffold
- `apps/web/` boundary added without moving the live shell yet.
- `apps/runtime-api/src/server.ts` added as an in-memory API scaffold.
- `packages/contracts/` now contains shared runtime job and event contracts.
- `packages/domain/` now contains pure runtime state helpers.
- `packages/autoresearch-adapter/` now marks the future worker-ingestion boundary.
- runtime-api smoke check verified:
  - health endpoint
  - job creation
  - pause command

### Exact upstream pinning
- committed upstream spec added at `config/autoresearch-upstreams.json`
- pinned refs:
  - `karpathy/autoresearch@c2450add72cc80317be1fe8111974b892da10944`
  - `karpathy/nanochat@6ed7d1d82cee16c2e26f45d559ad3338447a6c1b`
- `npm run autoresearch:bootstrap` now materializes both repos under `runtime/upstreams/`
- controller and supervisor now default to the pinned stack without requiring `--repo`
- runtime-api now exposes `GET /api/runtime/upstream` for stack visibility

## Current Problems

1. `src-svelte/lib/stores/jobStore.ts` still owns state, timers, and simulation.
2. `AutoresearchPage`, `DashboardPage`, and `NetworkView` still use different runtime models.
3. controller/supervisor exist, but are not yet a real app/service boundary.
4. shared telemetry/types are still duplicated across `src/fixed/*` and `src-svelte/lib/utils/*`.

## Execution Sequence

### Phase 0
- Freeze contracts and routing truth.
- Keep docs and memory aligned while restructuring begins.

### Phase 1
- Extract canonical event contracts and command contracts.
- Define:
  - job snapshot shape
  - event stream shape
  - command shape for pause/resume/stop/boost

### Phase 2
- Extract duplicated telemetry/types into shared packages.
- Shrink `jobStore` into a frontend view store.

### Phase 3
- Turn controller/supervisor logic into `runtime-api`.
- Move browser pages to runtime snapshot + SSE consumption.

### Phase 4
- Add persistence for jobs, commands, events, and runtime snapshots.
- Make long-running autoresearch restartable.

### Phase 5
- Add engineering score evaluation for autoresearch workers:
  - build pass
  - evaluator pass
  - bundle/runtime performance
  - no regression in route behavior

## Immediate Next Tasks

1. Scaffold `apps/web`, `apps/runtime-api`, and `packages/*`.
2. Replace the in-memory runtime-api store with shared persisted state.
3. Move `jobStore` simulation responsibility behind runtime contracts.
4. Point `AutoresearchPage` at runtime state instead of local timers.

## Exit Criteria

- browser no longer simulates research state locally
- runtime owns job lifecycle and stream events
- shared contracts are single-source
- repo context can resume from docs + `.agent-context` without replaying chat history
