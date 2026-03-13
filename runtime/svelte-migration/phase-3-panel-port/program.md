# Port panels and layout to Svelte

## Phase Objective

Move summaries, swarm board, tape, and layout hierarchy into Svelte components while keeping the globe renderer shared.

## Source Root

`/Users/ej/mesh-autoresearch-visualizer`

## Editable Scope

- src-svelte/*
- src/core/*
- src/lib/*

## Deliverables

- Svelte panel components
- responsive layout parity
- shared selection state

## Non-Goals

- entry cutover
- heavy shader rewrite

## Required Gates

- npm run build
- npm run eval:globe

## Iteration Rule

Do one scoped change, validate it, then log the outcome in `results.tsv`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
