# Web App Boundary

This directory marks the future `apps/web` boundary for the frontend split.

## Current Reality

- The live shell still runs from `src-svelte/`.
- New product work should continue there until the runtime split is stable.

## Migration Rule

- Do not move existing pages all at once.
- First extract shared contracts and runtime APIs.
- Then migrate page-by-page behind adapters.

## First Targets

- `AutoresearchPage`
- `jobStore`
- shared telemetry consumers used by dashboard and network views
