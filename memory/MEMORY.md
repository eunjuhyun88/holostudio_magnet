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

## Key Decisions (confirmed by user)
- Economics tab → renamed **Protocol**
- Research tab → renamed **Magnet** (NavBar) / "Model Magnet Research" (full name)
- OntologyPage connected to router at `/ontology`
- Protocol page new sections: Page Header, PPAP Pipeline, Trust Score, Your Journey
- **All 6 viz elements must stay**: Branch panel + 5 viz cards (MetricChart, ParamScatter, ModHeatmap, ExpTree, DistributedMesh)
- **GPU 프로모션**: 1→2→4→8 GPU 티어드 승격 시뮬레이션
- **AutoresearchPage 분할**: 1,153줄 → 80줄 셸 + 4개 서브컴포넌트
- **유저 개입(intervention)**: Pause/Resume, Branch Boost/Pause — fire and forget가 아닌 실시간 조향

## Architecture Updates (2026-03-15)
- **RunningDashboard**: 5-Zone 레이아웃 (Command Bar → Hero Metric → Branch Control → Analysis Grid 2×2 → Terminal)
- **jobStore**: 피드백 루프 (`selectModification()` 가중치 선택), `togglePause/toggleCategoryBoost/toggleCategoryPause` API
- **jobStore 파생 스토어**: `improvementDelta`, `bestBranch`, `isPaused` + 기존 유지
- **BranchInfo**: `boosted`, `paused` 필드 추가
- **AutoresearchJob 상태**: `paused`, `boostedCategories`, `pausedCategories`, `baselineMetric` 추가

## Topic Files
- [session-log.md](session-log.md) — what was done, pending tasks
