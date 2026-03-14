# Context System Rollout

- Status: active
- Created: 2026-03-15

## Objective

Bootstrap the repository with a reusable context-management system.

## Current Status

- repo-local Memento layer installed
- root docs aligned with current repo shape
- `.agent-context/` checkpoint / save / compact workflow validated
- Claude hook layer and local risky `CLAUDE.md` files generated
- generated docs and context checks passing

## Scope

- keep canonical project truth in committed docs and `memory/`
- use `.agent-context/` for semantic runtime memory
- keep auto-commit limited to context artifacts only

## Exit Criteria

- canonical docs exist
- generated governance works
- context save/checkpoint/compact/restore works
- hooks are installed
