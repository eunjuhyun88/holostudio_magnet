# CLAUDE.md

## Start Here

Read in order:
1. `memory/MEMORY.md`
2. `memory/session-log.md`
3. `memory/architecture.md`
4. `README.md`
5. `AGENTS.md`
6. `docs/README.md`

For context routing and compaction behavior:
- `docs/CONTEXT_ENGINEERING.md`
- `docs/CLAUDE_COMPATIBILITY.md`

For parallel agent work or handoffs:
- `docs/AGENT_BRANCHING.md`
- `docs/MULTI_AGENT_COORDINATION.md`
- `docs/GIT_WORKFLOW.md`

## Runtime Context Model

| Layer | Path |
| --- | --- |
| canonical project memory | `memory/` |
| canonical repo map | `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/` |
| runtime working memory | `.agent-context/checkpoints/`, `.agent-context/briefs/`, `.agent-context/handoffs/` |
| Claude-native routing | `.claude/agents/`, `.claude/commands/`, `.claude/hooks/` |

## Required Commands

Before non-trivial work:
```bash
npm run ctx:checkpoint -- --work-id "W-..." --surface "web" --objective "..."
```

After meaningful progress:
```bash
npm run ctx:compact
```

Resume from compacted state:
```bash
npm run ctx:restore -- --mode brief
```

## Project Shape

- UI: `src-svelte/`
- Runtime and telemetry: `scripts/`
- Evaluation: `eval/`
- Memory and decisions: `memory/`
- Context automation: `scripts/dev/`

## Rules

- Keep root `CLAUDE.md` short.
- Put stable truth in committed docs, not in transient chat.
- Keep `.agent-context/` local-only.
- Continuous autoresearch must be orchestrated outside the browser.
- Frontend / backend separation and API-first boundaries are mandatory.
- Branch/worktree split is mandatory when multiple agents are active.
