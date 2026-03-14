# Autoresearch Adapter

This package will bridge external autoresearch workers into runtime events.

## Role

- read workspace manifests
- watch `run.log` and `results.tsv`
- normalize worker outputs into shared runtime events
- stay independent from the browser

## Current Status

- contract skeleton only
- safe to build in parallel while the existing controller remains live
- pinned upstream stack support for:
  - `karpathy/autoresearch`
  - `karpathy/nanochat@6ed7d1d`
- runtime-root inspection support for:
  - `manifest.json`
  - `supervisor-state.json`
  - `results.tsv`
  - `run.log`
  - `agent_status.md`
