# Memory Index

## Session Start Rule
**ALWAYS read these files first before any work:**
1. This file (MEMORY.md) — state + decisions
2. session-log.md — pending tasks
3. architecture.md / protocol-domain.md as needed
**ALWAYS update session-log.md at end of session.**

## User Preferences
- Language: Korean (한국어) for conversation, English for code/docs
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`)
- Branch strategy: `feat/xxx` off `main`, push to origin
- Prefers concise Korean responses, no over-explaining
- Dislikes dashboard clutter — keep pages focused on their purpose
- Uses Chrome MCP for visual QA
- **Don't reduce info, only add** — user explicitly rejected removing visualizations

## Project State
- Branch: `feat/next-iteration` (uncommitted changes)
- All builds pass (`npm run build`)
- No test runner configured — verify via build
- `memento-kit` core repo layer integrated
- `docs:refresh` and `docs:check` pass
- `.agent-context/` runtime memory now available for checkpoints / briefs / handoffs
- parallel refactor scaffold added:
  - `apps/web`
  - `apps/runtime-api`
  - `packages/contracts`
  - `packages/domain`
  - `packages/autoresearch-adapter`

## Key Decisions (confirmed by user)
- Economics tab → renamed **Protocol**
- Research tab → renamed **Magnet** (NavBar) / "Model Magnet Research" (full name)
- OntologyPage connected to router at `/ontology`
- Protocol page new sections: Page Header, PPAP Pipeline, Trust Score, Your Journey
- **All 6 viz elements must stay**: Branch panel + 5 viz cards (MetricChart, ParamScatter, ModHeatmap, ExpTree, DistributedMesh)
- **GPU 프로모션**: 1→2→4→8 GPU 티어드 승격 시뮬레이션
- **AutoresearchPage 분할**: 1,153줄 → 80줄 셸 + 4개 서브컴포넌트
- **유저 개입(intervention)**: Pause/Resume, Branch Boost/Pause — fire and forget가 아닌 실시간 조향
- **Frontend / Backend 분리 필수**
- **API-first 구조 필수**: 외부 API나 runtime을 쉽게 붙일 수 있어야 함
- **Autoresearch는 브라우저 밖에서 지속 실행**되어야 함
- **Memento context system 적용**: canonical docs + runtime memory + Claude hooks 조합
- **Auto-commit 범위는 context artifacts 중심으로 제한**: 코드 전체 자동 커밋이 아니라 안전한 context/doc autosave

## Architecture Updates (2026-03-15)
- **RunningDashboard**: 5-Zone 레이아웃 (Command Bar → Hero Metric → Branch Control → Analysis Grid 2×2 → Terminal)
- **jobStore**: 피드백 루프 (`selectModification()` 가중치 선택), `togglePause/toggleCategoryBoost/toggleCategoryPause` API
- **jobStore 파생 스토어**: `improvementDelta`, `bestBranch`, `isPaused` + 기존 유지
- **BranchInfo**: `boosted`, `paused` 필드 추가
- **AutoresearchJob 상태**: `paused`, `boostedCategories`, `pausedCategories`, `baselineMetric` 추가
- **Architecture baseline documented** in `memory/architecture.md`
- **Target refactor direction**: `apps/web` + `apps/runtime-api` + shared contracts/domain packages
- **Persistence direction**: runtime state should move toward durable storage instead of in-browser timers only
- **Memento layer installed**:
  - `context-kit.json`
  - `scripts/dev/*`
  - `.claude/*`
  - `.githooks/*`
  - `docs/*` generated/context docs
- **Claude local risk guides created**:
  - `src-svelte/lib/stores/CLAUDE.md`
  - `scripts/CLAUDE.md`
  - `runtime/CLAUDE.md`
  - `memory/CLAUDE.md`
- **Autopilot extension added**: semantic autosave + compact + context-only auto-commit on `stop` / `pre-push`
- **Canonical rollout summary added** in `docs/exec-plans/active/continuous-autoresearch-refactor.md`
- **Engineering authority doc populated** in `docs/ENGINEERING.md`
- **Runtime API scaffold added** and smoke-tested (`health`, `job create`, `pause command`)

## Topic Files
- [session-log.md](session-log.md) — what was done, pending tasks
- [architecture.md](architecture.md) — current baseline, target split, refactor roadmap
