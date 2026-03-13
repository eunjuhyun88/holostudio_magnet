# Switch default entry to Svelte

## Phase Objective

Make Svelte the default runtime only after parity and evaluator gates pass.

## Source Root

`/Users/ej/mesh-autoresearch-visualizer`

## Editable Scope

- src/main.*
- src/App.*
- src-svelte/*
- package.json
- vite.config.ts

## Deliverables

- Svelte default boot entry
- React shell retained only as fallback if necessary

## Non-Goals

- aggressive cleanup before parity

## Required Gates

- npm run build
- npm run eval:globe

## Iteration Rule

Do one scoped change, validate it, then log the outcome in `results.tsv`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
