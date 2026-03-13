# Svelte Migration Spec

## Objective

Move the visualizer from React to Svelte without losing:

- globe interaction fidelity
- telemetry truth
- current evaluator compatibility
- current motion discipline

## Product Truth To Preserve

The app must still communicate:

1. multiple workers run in parallel
2. globally distributed browser donors back those workers
3. only claimed donors and active verification/training traffic glow
4. keep/discard/crash outcomes remain legible

## Technical Truth To Preserve

- The globe renderer remains imperative and performance-oriented.
- Ambient donors stay cheap to render.
- Only meaningful nodes get heavy decoration.
- React and Svelte do not fork the simulation logic.

## Performance Budgets

- idle donor field should remain points-based or instanced
- decorative labels must remain capped
- active traffic must be subset-based, not all-to-all
- cutover must not increase bundle complexity without a clear UX gain

## Migration Gates

### Phase 1 gate

- shared core exists for simulation and scene wiring
- React app still boots unchanged in behavior

### Phase 2 gate

- Svelte shell can mount in parallel using the shared core
- no truth logic duplicated into the Svelte UI layer

### Phase 3 gate

- summary, board, and tape live in Svelte components
- globe stage remains decluttered

### Phase 4 gate

- Svelte becomes the default entry
- `npm run build` passes
- `npm run eval:globe` passes

### Phase 5 gate

- legacy React shell removed
- migration notes updated

## Non-Goals

- rebuilding telemetry formats
- inventing new fake motion to hide state gaps
- adding heavy premium shader complexity before the shell migration is stable
