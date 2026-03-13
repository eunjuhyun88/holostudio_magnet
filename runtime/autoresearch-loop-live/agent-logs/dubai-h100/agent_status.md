# Agent Status

worker: worker-dubai-h100
region: Dubai
workspace: /Users/ej/mesh-autoresearch-visualizer/runtime/autoresearch-loop-live/workspaces/dubai-h100
launch_attempted: false

## Preflight

- uv: true
- codex: true
- nvidia-smi: false
- cache root: false
- tokenizer: false

## Blockers

- nvidia-smi not found
- ~/.cache/autoresearch missing
- ~/.cache/autoresearch/tokenizer.json missing

## Required Commands

- `cd /Users/ej/autoresearch && uv sync`
- `cd /Users/ej/autoresearch && uv run prepare.py`
- run on a machine with a visible NVIDIA GPU (`nvidia-smi` must succeed)
