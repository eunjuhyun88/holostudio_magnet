# Remove legacy React shell

## Phase Objective

Delete now-unused React shell code after the Svelte default runtime is stable.

## Source Root

`/Users/ej/mesh-autoresearch-visualizer`

## Editable Scope

- src/*
- src-svelte/*
- package.json
- README.md

## Deliverables

- React shell removed
- migration docs updated
- final structure simplified

## Non-Goals

- changing the product truth model

## Required Gates

- npm run build
- npm run eval:globe

## Iteration Rule

Do one scoped change, validate it, then log the outcome in `results.tsv`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
