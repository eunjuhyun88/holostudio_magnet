# Agent Catalog

This generated catalog lists the repo-local agent blueprints that outsiders can inspect and reuse.

## Overview

- Agent count: `3`
- Public agents: `3`

## Agents

| ID | Role | Surfaces | Manifest | Writes |
| --- | --- | --- | --- | --- |
| `implementer` | implementer | `web, runtime-api, protocol` | `agents/implementer.json` | `src-svelte/, scripts/, memory/, .agent-context/, docs/AGENT_WATCH_LOG.md` |
| `planner` | planner | `web, runtime-api, protocol` | `agents/planner.json` | `docs/exec-plans/active/, memory/, .agent-context/, docs/AGENT_WATCH_LOG.md` |
| `reviewer` | reviewer | `web, runtime-api, protocol` | `agents/reviewer.json` | `.agent-context/, docs/AGENT_WATCH_LOG.md` |

## How To Use

- Create a new blueprint with `npm run agent:new -- --id "<agent-id>" --role "<role>" --surface "<surface>"`.
- Refresh generated artifacts with `npm run agent:refresh` and `npm run docs:refresh`.
- Search the public manifest with `npm run registry:query -- --kind agent --q "<term>"`.

