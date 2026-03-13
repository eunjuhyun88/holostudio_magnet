# Svelte Migration Program

## Objective

Convert this visualizer from React to Svelte in controlled phases while preserving current behavior, visual truth, and evaluator compatibility.

## Core Principle

Do not attempt a one-shot rewrite.

The correct order is:

1. extract framework-independent logic
2. add a Svelte shell that reuses that logic
3. switch the entry only after parity checks pass

## Migration Truth

The globe is not a normal component tree problem. The renderer, node synthesis, simulation clock, and event adapters must remain shared core logic.

Svelte should own:

- page shell
- panel composition
- summaries
- responsive layout
- selection state wiring

Shared TypeScript core should own:

- telemetry interpretation
- donor synthesis
- timing and motion model
- globe scene lifecycle
- Three object updates

## Rules

1. One phase at a time.
2. Keep the current app working until the cutover phase.
3. Do not delete React entry files early.
4. Do not duplicate core logic into both frameworks.
5. If a dependency install is blocked, log the blocker and continue with extraction work that does not require new packages.
6. Keep `eval:globe` green.
7. If a phase ties on outcome, keep the simpler structure.

## Allowed Work

- editing `src/*`
- editing `vite.config.ts`
- editing `package.json`
- adding migration docs and scripts

## Protected Work

Do not edit:

- `fixtures/*`
- `eval/*`
- `public/textures/*`

unless a later human explicitly expands scope.

## Required Checks

After any meaningful change:

```bash
npm run build
npm run eval:globe
```

## Phase Discipline

Each worker or loop must take a single phase contract and stay inside that phase.

Bad:

- extract core
- add Svelte
- switch entry

in one iteration.

Good:

- phase 1 only: move donor synthesis and scene lifecycle into shared TypeScript modules

## Logging

Each phase folder gets a `results.tsv` with:

```text
iteration	status	description
```

Use:

- `keep`
- `discard`
- `block`

## Success Definition

The migration is complete only when the Svelte app is the default entry and the current motion, performance, and truth constraints still hold.
