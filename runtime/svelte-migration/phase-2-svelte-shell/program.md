# Add a parallel Svelte shell

## Phase Objective

Introduce Svelte entry files and mount a parallel shell that reuses the shared core.

## Source Root

`/Users/ej/mesh-autoresearch-visualizer`

## Editable Scope

- src-svelte/*
- package.json
- vite.config.ts
- src/core/*

## Deliverables

- Svelte entry scaffold
- shared store contract
- no duplicated core logic

## Non-Goals

- deleting React
- changing evaluator files

## Required Gates

- npm run build
- npm run eval:globe

## Iteration Rule

Do one scoped change, validate it, then log the outcome in `results.tsv`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
