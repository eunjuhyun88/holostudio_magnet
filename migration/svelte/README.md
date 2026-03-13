## Svelte Migration Track

This track converts the current React/Vite/Three implementation into a Svelte-based app without losing:

- telemetry truth
- `eval:globe` compatibility
- the current motion and performance budgets

The migration is intentionally phased. Do not rewrite the app in one shot.

## Why This Exists

The current visualizer can still improve in three areas:

- motion hierarchy
- UI information hierarchy
- renderer/component separation

Svelte is useful for the UI shell and state wiring, but it does not solve the globe quality problem by itself. The renderer and simulation must first be split into framework-independent modules so that React parity can be preserved while the shell changes.

## Phase Order

1. `phase-1-core-extraction`
   Extract framework-independent simulation and scene modules while React stays live.
2. `phase-2-svelte-shell`
   Add Svelte runtime and mount a parallel shell that reuses the shared core.
3. `phase-3-panel-port`
   Move board, legend, tape, and summary panels into Svelte components.
4. `phase-4-entry-cutover`
   Switch the boot entry from React to Svelte after parity gates pass.
5. `phase-5-cleanup`
   Remove leftover React shell code after the Svelte entry is stable.

## Global Rules

- Preserve the current truth model.
- Keep the current app buildable until the cutover phase.
- Do not remove `eval/*`.
- Do not make a phase larger than its declared scope.
- Prefer extracting pure TypeScript over re-implementing logic in framework code.

## Success Criteria

A migration is only valid if:

- `npm run build` passes
- `npm run eval:globe` passes
- live telemetry still renders meaningful activity
- the globe remains interactive and does not reset on steady-state animation
- the UI gets simpler, not noisier

## Prepare An Autoresearch Runtime

Generate a phase-by-phase runtime pack:

```bash
npm run migration:svelte:prepare -- --runtime-root=runtime/svelte-migration
```

This creates:

- a migration manifest
- one folder per phase
- a per-phase `program.md`
- a per-phase `results.tsv`

Use those phase folders as the task contracts for long-running `autoresearch` style workers.
