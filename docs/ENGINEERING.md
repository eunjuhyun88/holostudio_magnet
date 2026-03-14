# Engineering Authority

## Current Inventory Snapshot
<!-- BEGIN MEMENTO MANAGED INVENTORY -->
Refreshed: `2026-03-14`

| Surface | Routes | Stores | APIs | Mapping Mode |
| --- | --- | --- | --- | --- |
| `web` | 5 | 3 | 1 | manual-preserved |
| `runtime-api` | 4 | 0 | 4 | auto-seeded-heuristic |
| `protocol` | 1 | 0 | 0 | auto-seeded-heuristic |

### Unmapped Discovered Routes
- none

### Unmapped Discovered Stores
- `stageStore`
- `walletStore`

### Unmapped Discovered APIs
- `/api/autoresearch_loop_controller`
- `/api/autoresearch_swarm_supervisor`
- `/api/autoresearch_to_telemetry`
- `/api/mock_telemetry_server`
- `/api/prepare_svelte_migration`

Review this snapshot, then replace the placeholder language in `State Authority` with project-specific rules.
<!-- END MEMENTO MANAGED INVENTORY -->

## State Authority

### Current authoritative split

- Router state:
  - client-owned in `src-svelte/lib/stores/router.ts`
- view-local UX state:
  - client-owned in Svelte page/component state
- research simulation state today:
  - temporarily client-owned in `src-svelte/lib/stores/jobStore.ts`
- live mesh / telemetry state:
  - runtime-authored, consumed through controller SSE endpoints
- project memory and decisions:
  - committed authority in `memory/`
- runtime checkpoint / brief / handoff:
  - local runtime authority in `.agent-context/`

### Target authoritative split

- `apps/web`
  - route state
  - presentational state
  - derived view state from runtime snapshots/events
- `apps/runtime-api`
  - job lifecycle
  - command handling
  - event emission
  - persistence
- `packages/contracts`
  - event and command schema authority
- `packages/domain`
  - reducer and selector authority

### Rules

1. The browser must not remain the long-term source of research progress.
2. Runtime-originated job state should be exposed as snapshot + stream, not re-simulated per page.
3. `memory/` stores stable project truth; `.agent-context/` stores resumable working memory.
4. If a type or event shape is used by both frontend and runtime, it must move to shared contracts.
5. During migration, adapters are acceptable; duplicated core logic is not.
6. When multiple agents are active, each implementation lane must run on its own branch/worktree/claim boundary.
7. Integration happens from validated commits only; another agent's dirty WIP is not an authoritative source.

## Boundary Rules

- Parse external data at boundaries
- Prefer stable contracts over inferred shapes
- Document ownership changes here before large refactors spread
- Promote repeated state and API ownership rules into this file
