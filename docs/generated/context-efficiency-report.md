# Context Efficiency Report

This report estimates how much context the routing system saves before the agent reaches implementation files.

## Core Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| small map | 10 | 1091 | 8926 | 44.7% | 95.0% |
| canonical | 29 | 2079 | 16133 | 0.0% | 91.0% |
| all docs | 319 | 22254 | 178514 | -1006.5% | 0.0% |

## Estimated Savings

- Small map saves approximately `7207` tokens vs the canonical bundle.
- Small map saves approximately `169588` tokens vs the all-doc bundle.
- Surface `web` saves approximately `168709` tokens vs the all-doc bundle.
- Surface `runtime-api` saves approximately `168704` tokens vs the all-doc bundle.
- Surface `protocol` saves approximately `168724` tokens vs the all-doc bundle.

## Surface Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| web | 14 | 1207 | 9805 | 39.2% | 94.5% |
| runtime-api | 14 | 1207 | 9810 | 39.2% | 94.5% |
| protocol | 14 | 1201 | 9790 | 39.3% | 94.5% |

## Structural Scorecard

| Check | Actual | Target | Result |
| --- | --- | --- | --- |
| Small-map reduction vs canonical | 44.7% | >= 40% | PASS |
| Small-map reduction vs all docs | 95.0% | >= 55% | PASS |
| Worst surface reduction vs all docs | 94.5% | >= 50% | PASS |
| Small-map approx tokens | 8926 | <= 3800 | FAIL |
| Small-map file count | 10 | <= 6 | FAIL |
| Canonical approx tokens | 16133 | <= 12000 | FAIL |

## Structural Readiness

- FAIL: structural routing gate
- Final acceptance still requires a repeated runtime benchmark with controlled noise.

## Budget Checks

- FAIL: Small map approx tokens <= 3800
- FAIL: Small map files <= 6
- FAIL: Canonical approx tokens <= 12000

## Small Map Files

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `ARCHITECTURE.md`
- `docs/SYSTEM_INTENT.md`
- `docs/CONTEXT_ENGINEERING.md`
- `docs/CLAUDE_COMPATIBILITY.md`
- `docs/AGENT_FACTORY.md`
- `docs/TOOL_DESIGN.md`
- `docs/AGENT_OBSERVABILITY.md`

## How To Use

- Compare small-map and surface bundles against canonical/all-doc bundles.
- Review `docs/generated/contextual-retrieval.md` if ambiguous tasks still open too many docs.
- Review `docs/generated/agent-catalog.md` if outsiders still cannot discover reusable agents quickly.
- Use this with `docs/CONTEXT_EVALUATION.md` for task-level evaluation.
- Run `npm run harness:benchmark -- --base-url http://localhost:4173` for repeated runtime/noise validation.
- If the small map grows too much, routing quality is degrading even if docs remain correct.

