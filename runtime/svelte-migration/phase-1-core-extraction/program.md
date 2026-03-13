# Extract shared TypeScript core

## Phase Objective

Split simulation, scene lifecycle, and renderer updates out of the React shell while keeping the current app live.

## Source Root

`/Users/ej/mesh-autoresearch-visualizer`

## Editable Scope

- src/Visualizer.tsx
- src/core/*
- src/lib/*

## Deliverables

- shared simulation module
- shared globe scene module
- React shell still working

## Non-Goals

- adding Svelte dependencies
- switching the app entry

## Required Gates

- npm run build
- npm run eval:globe

## Iteration Rule

Do one scoped change, validate it, then log the outcome in `results.tsv`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
