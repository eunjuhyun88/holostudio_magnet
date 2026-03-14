# Ontology Integration Design — v2

> **Status**: Draft
> **Date**: 2026-03-15
> **Author**: Agent (crazy-lumiere worktree)
> **Target**: Senior ML Engineers

---

## 1. Problem

현재 Ontology 페이지는 NavBar에 독립 탭으로 존재.
- Launch 누르면 Magnet Research(`#/research`)로 이동 → 페이지 간 관계가 불명확
- 모든 유저가 필요한 기능이 아님 (파워유저 전용 고급 설정)
- 5개 내부 탭(Overview/Branches/Data/Eval/Config) 전환이 번거로움
- 반응형 미지원

## 2. Decision

**Ontology를 NavBar에서 제거하고, Magnet Research의 IdleEditor에 통합한다.**

- 기본 유저: 토픽 입력 → Launch (기존과 동일)
- 고급 유저: Research Config 패널에서 설정 확인 → "Customize" → Ontology 상세 설정

## 3. Layout — IdleEditor Split

```
┌─ Magnet Research (idle phase) ────────────────────────────────┐
│                                                                │
│  [PixelOwl]                                                    │
│  AUTORESEARCH                                                  │
│  Your Autonomous Research Lab                                  │
│                                                                │
│  ┌─── program.md ──────────┐  ┌─── RESEARCH CONFIG ─────────┐ │
│  │  ●●● program.md         │  │                              │ │
│  │  ┌──────────────────┐   │  │  ▸ Branches      6 active    │ │
│  │  │ # Research Goal  │   │  │  ▸ Experiments   114         │ │
│  │  │ Predict ETH ...  │   │  │  ▸ Budget        ~103 HOOT  │ │
│  │  │                  │   │  │  ▸ Metric        bal_acc     │ │
│  │  │                  │   │  │  ▸ Target        ≥ 0.85      │ │
│  │  └──────────────────┘   │  │                              │ │
│  │  [tags...]  [Launch →]  │  │  ── Presets ──               │ │
│  └─────────────────────────┘  │  [Crypto] [DeFi] [Fraud]    │ │
│                                │  [Time Series]              │ │
│                                │                              │ │
│                                │  [⚙ Customize Ontology →]   │ │
│                                └──────────────────────────────┘ │
│                                                                │
│  1 → Write program  2 → AI runs 100+ exp  3 → Trained model   │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Desktop (≥ 1024px)
- 좌우 2-column (`1fr 320px`)
- 왼쪽: 기존 Editor (program.md textarea + Launch 버튼)
- 오른쪽: Research Config 카드 (ontology 요약 + presets + customize 링크)

### 3.2 Tablet (768–1023px)
- 2-column 유지, 오른쪽 컬럼 280px로 축소
- Config 카드 내부 폰트 축소

### 3.3 Mobile (< 768px)
- 1-column 스택
- Editor 먼저, Config 카드가 아래에 접힌 상태(collapsible)
- "Advanced Settings ▸" 토글로 접기/펼치기

## 4. Research Config Card — 상세

```svelte
<div class="config-card">
  <!-- Summary stats -->
  <div class="config-stats">
    <div class="stat-row">
      <span class="stat-label">Branches</span>
      <span class="stat-value">{enabledBranches.length} active</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Experiments</span>
      <span class="stat-value">{totalExperiments}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Budget</span>
      <span class="stat-value">~{estimatedBudget} HOOT</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Metric</span>
      <span class="stat-value">{ontology.evalConfig.metric}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Target</span>
      <span class="stat-value">≥ {ontology.evalConfig.target}</span>
    </div>
  </div>

  <!-- Presets -->
  <div class="config-presets">
    <span class="config-section-label">Quick Presets</span>
    <div class="preset-chips">
      {#each ONTOLOGY_PRESETS as preset}
        <button on:click={() => applyPreset(preset.id)}>{preset.name}</button>
      {/each}
    </div>
  </div>

  <!-- Customize link → full Ontology page -->
  <button class="customize-btn" on:click={() => router.navigate('ontology')}>
    ⚙ Customize Ontology →
  </button>
</div>
```

## 5. Ontology Full Page — 변경사항

### 5.1 NavBar에서 제거
- `NavBar.svelte`: `ontology` 항목 삭제
- `stageStore.ts`: `ontology` 항목 삭제
- 라우터는 유지 (`#/ontology` 직접 접근 가능)

### 5.2 단일 스크롤 페이지로 변환 (탭 제거)
기존 5개 탭을 순차적 섹션으로 표시:

```
┌─ Research Ontology ──────────────────────────────┐
│                                                    │
│  [← Back to Research]     [Preset chips...]        │
│                                                    │
│  ── § Overview ──────────────────────────────────  │
│  Name: [________]  Description: [________]         │
│  Tags: [_____]                                     │
│                                                    │
│  ── § Branches ──────────────────────────────────  │
│  ┌─ model_architecture ──┐ ┌─ feature_eng ──────┐ │
│  │  [ON] 10 iters        │ │  [ON] 10 iters     │ │
│  │  ▸ Expand details     │ │  ▸ Expand details  │ │
│  └───────────────────────┘ └────────────────────┘  │
│  ┌─ ensemble_methods ────┐ ┌─ regularization ───┐ │
│  │  ...                  │ │  ...               │  │
│  └───────────────────────┘ └────────────────────┘  │
│  ...                                               │
│                                                    │
│  ── § Data Source ───────────────────────────────  │
│  (●) Auto-generate  (○) Upload CSV  (○) Custom    │
│                                                    │
│  ── § Evaluation ────────────────────────────────  │
│  Metric: [bal_acc ▼]  Target: [0.85]               │
│  Validation: [5-fold ▼]  Custom script: [_____]    │
│                                                    │
│  ── § Resources ─────────────────────────────────  │
│  GPU: [A100 ▼]  Budget: [200 HOOT]                 │
│  Seed: [42]  [✓] Deterministic  Visibility: [○○●]  │
│                                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  [sticky] 6 branches · 114 exp · ~103 HOOT         │
│                              [🚀 Launch Research]   │
└────────────────────────────────────────────────────┘
```

### 5.3 반응형
- Desktop(≥1024px): 2-column grid for branch cards
- Tablet(768-1023px): 2-column, 좁은 패딩
- Mobile(<768px): 1-column 스택, 전체 width

### 5.4 네비게이션
- 상단에 `← Back to Research` 버튼 → `#/research`로 복귀
- Launch 후에도 `#/research`로 이동 (기존과 동일)

## 6. Data Flow

```
ontologyStore (새로 생성, 글로벌)
  ↓
IdleEditor → reads ontologyStore → displays summary in Config Card
  ↓
"Customize" → navigates to #/ontology
  ↓
OntologyPage → writes to ontologyStore
  ↓
"Launch" (from either page) → jobStore.startJob(topic, ontologyConfig)
  ↓
AutoresearchPage running phase
```

### 6.1 ontologyStore 스펙

```typescript
// src-svelte/lib/stores/ontologyStore.ts
import { writable, derived } from 'svelte/store';
import {
  type ResearchOntology,
  createEmptyOntology,
  getEnabledBranches,
  getTotalExperiments,
  estimateBudgetHoot,
} from '../data/ontologyData';

export const ontologyStore = writable<ResearchOntology>(createEmptyOntology());

// Derived convenience stores
export const enabledBranches = derived(ontologyStore, $o => getEnabledBranches($o));
export const totalExperiments = derived(ontologyStore, $o => getTotalExperiments($o));
export const estimatedBudget = derived(ontologyStore, $o => estimateBudgetHoot($o));
```

## 7. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `stores/ontologyStore.ts` | **CREATE** | 글로벌 ontology 상태 |
| `components/IdleEditor.svelte` | **MODIFY** | 좌우 split + Config Card 추가 |
| `components/ResearchConfigCard.svelte` | **CREATE** | ontology 요약 + preset + customize |
| `pages/OntologyPage.svelte` | **MODIFY** | 탭 제거 → 단일 스크롤, store 연동 |
| `layout/NavBar.svelte` | **MODIFY** | ontology 항목 제거 |
| `stores/stageStore.ts` | **MODIFY** | ontology 항목 제거 |
| `components/PixelIcon.svelte` | **NO CHANGE** | ontology 아이콘 유지 (Config Card에서 사용) |

## 8. Launch Flow (최종)

```
[Magnet Research - idle]
  │
  ├── Quick: type topic → Launch → running
  │
  └── Advanced:
        ├── Click preset chip → updates ontologyStore → stats update
        └── Click "Customize" → #/ontology page
              │
              └── Configure all sections → Launch
                    │
                    └── jobStore.startJob(topic, ontologyConfig) → #/research (running)
```

## 9. Open Questions

1. **Preset 적용 시 topic 자동 채움?** — Preset에 default topic이 있으면 editor textarea에도 반영?
2. **Ontology 페이지에서 Launch 시 topic은?** — Ontology의 `name` 필드를 topic으로 사용? 또는 별도 입력?
3. **Fork from completed job** — 완료된 연구의 ontology를 복제해서 새 연구 시작하는 플로우는 별도 구현 필요

---

*이 문서는 다른 에이전트가 구현할 수 있도록 작성됨.*
