# Context Efficiency Report

This report estimates how much context the routing system saves before the agent reaches implementation files.

## Core Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| small map | 10 | 1013 | 8271 | 46.3% | 80.4% |
| canonical | 29 | 1998 | 15391 | 0.0% | 63.5% |
| all docs | 96 | 5435 | 42184 | -174.1% | 0.0% |

## Estimated Savings

- Small map saves approximately `7120` tokens vs the canonical bundle.
- Small map saves approximately `33913` tokens vs the all-doc bundle.
- Surface `web` saves approximately `33143` tokens vs the all-doc bundle.
- Surface `runtime-api` saves approximately `33138` tokens vs the all-doc bundle.
- Surface `protocol` saves approximately `33158` tokens vs the all-doc bundle.

## Surface Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| web | 14 | 1120 | 9041 | 41.3% | 78.6% |
| runtime-api | 14 | 1120 | 9046 | 41.2% | 78.6% |
| protocol | 14 | 1114 | 9026 | 41.4% | 78.6% |

## Structural Scorecard

| Check | Actual | Target | Result |
| --- | --- | --- | --- |
| Small-map reduction vs canonical | 46.3% | >= 40% | PASS |
| Small-map reduction vs all docs | 80.4% | >= 55% | PASS |
| Worst surface reduction vs all docs | 78.6% | >= 50% | PASS |
| Small-map approx tokens | 8271 | <= 3800 | FAIL |
| Small-map file count | 10 | <= 6 | FAIL |
| Canonical approx tokens | 15391 | <= 12000 | FAIL |

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

