# HOOT MAGNET - UI/UX Redesign Plan
## Distributed Autoresearch Visualizer

---

## 1. Design Problems (Current State)

| Issue | Detail |
|-------|--------|
| Globe fills entire screen | #/globe view has zero breathing room, feels claustrophobic |
| Design language mismatch | Landing page (light), Globe (dark cinematic), Network (light flat) all feel disconnected |
| Inconsistent with holostudio.io | Local app's tone, spacing, components don't match production site |
| No semantic zoom | Can't zoom from globe → region → city → node level smoothly |
| Landing page lacks impact | Generic marketing page, no live visualization hook |
| Poor information hierarchy | HUD panels compete with globe for attention |
| 2D Network view is flat | Canvas-based MeshCanvas lacks depth and visual quality |

---

## 2. Design Vision

**Concept**: "Mission Control for Autonomous Research" — Apple's spatial computing aesthetic meets Bloomberg Terminal data density. The globe is a contextual minimap when doing work, and becomes an immersive theater when exploring the network.

### Design Principles
1. **Context-aware density** — Show less when browsing, more when working
2. **Semantic zoom** — Globe → Region → City → Node, each level reveals more detail
3. **Unified color system** — One palette across all views, dark/light modes share same tokens
4. **60fps always** — LOD, instancing, frustum culling, no dropped frames

---

## 3. Unified Color System (Matching holostudio.io)

### Base Palette
```
--surface-0:        #FAFAF8     // Page background (light)
--surface-1:        #F5F4F0     // Card backgrounds (light)
--surface-2:        #EEEDEA     // Borders, dividers (light)
--surface-dark-0:   #0B0F1A     // Page background (dark/immersive)
--surface-dark-1:   #111827     // Card backgrounds (dark)
--surface-dark-2:   #1F2937     // Borders (dark)

--text-primary:     #1A1A1A     // Light mode
--text-secondary:   #6B7280
--text-dark-primary: #F1F5F9    // Dark mode
--text-dark-secondary: #94A3B8
```

### Accent Palette (from holostudio.io)
```
--accent:           #D97757     // Terra cotta (primary action)
--accent-hover:     #C4644A
--accent-light:     #FFF5F0     // Accent background tint
--accent-glow:      rgba(217, 119, 87, 0.3)  // For dark mode glow
```

### Data Visualization Palette
```
--viz-cyan:         #33D1FF     // Active nodes, data flow
--viz-mint:         #2AD47D     // Keep/success
--viz-gold:         #F59E0B     // Evaluating/warning
--viz-red:          #EF4444     // Discard/crash
--viz-purple:       #A78BFA     // Verifying
--viz-blue:         #3B82F6     // Idle/supply
```

### Globe-specific
```
--atmo-glow:        #48C8FF     // Atmosphere rim
--atmo-inner:       #1744C9     // Inner glow
--node-beam:        #33D1FF     // Node stem/beam
--arc-color:        rgba(51, 209, 255, 0.4)  // Connection arcs
```

---

## 4. Page Architecture (5 Views)

### 4.1 Landing/Hero Page → `/#/` (REDESIGN)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  HOOT MAGNET   Dashboard  Models  Network  [Auth]│  ← Unified nav
├─────────────────────────────────────────────────┤
│                                                  │
│            ┌──────────────┐                      │
│            │   Mini Globe  │  ← 280px, auto-spin │
│            │   (3D, live)  │     showing live     │
│            └──────────────┘     node activity     │
│                                                  │
│        Distributed Autoresearch                  │  ← Display font
│   Global compute mesh that autonomously          │
│   runs ML research across {N} nodes              │
│                                                  │
│   ┌─────────────────────────────────┐           │
│   │ 🔍 Enter a research topic...  [Start] │      │  ← Search bar
│   └─────────────────────────────────┘           │
│                                                  │
│  ● NETWORK LIVE  2,043 nodes  4x GPU  3 workers │  ← Live stats bar
│                                                  │
├─────────────────────────────────────────────────┤
│  How Autoresearch Works                          │
│  ┌─────┐  →  ┌─────┐  →  ┌─────┐  →  ┌─────┐  │
│  │Topic│     │Train│     │Eval │     │Keep │   │  ← Pipeline cards
│  └─────┘     └─────┘     └─────┘     └─────┘  │
├─────────────────────────────────────────────────┤
│  Live Activity Feed                              │  ← Real-time ticker
│  [node seoul-4090 → training job-0012]           │
│  [experiment exp-441 → keep +0.03 bpb]          │
└─────────────────────────────────────────────────┘
```

**Key changes:**
- Mini globe (280px diameter) replaces huge hero image — still 3D, still interactive, but contextual
- Live stats bar pulled directly from telemetry
- Search-first CTA (matches holostudio.io pattern)
- Light theme (`--surface-0` background)
- Subtle particle effect behind globe (not overwhelming)

---

### 4.2 Dashboard → `/#/dashboard` (NEW — replaces old globe full-screen)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Nav                                             │
├─────┬───────────────────────────────┬───────────┤
│     │                               │           │
│ S   │     Active Research Jobs      │  Globe    │
│ T   │  ┌─────────────────────────┐  │  Widget   │
│ A   │  │ Job: Crypto Prediction  │  │  (320px)  │
│ T   │  │ ████████░░ 72% training │  │           │
│ S   │  │ 3 nodes · berlin, seoul │  │  Click to │
│     │  └─────────────────────────┘  │  expand   │
│ 650 │  ┌─────────────────────────┐  │           │
│nodes│  │ Job: DeFi Risk Model    │  │  Shows    │
│     │  │ ██████████ evaluating   │  │  active   │
│ 4x  │  │ 2 nodes · singapore    │  │  nodes    │
│ GPU │  └─────────────────────────┘  │  glowing  │
│     │                               │           │
│ 3   │  Experiment Tape              │           │
│jobs │  [keep +0.03] [discard] [keep]│           │
├─────┴───────────────────────────────┴───────────┤
│  Footer: Protocol pipeline status                │
└─────────────────────────────────────────────────┘
```

**Key changes:**
- Globe is a **widget** (320px) on the right side — interactive mini-map
- Center column shows active jobs with progress, node assignments
- Left rail shows key metrics (matches holostudio.io card pattern)
- Light theme with `--surface-0` background
- Click globe widget → transitions to full Network view

---

### 4.3 Network View → `/#/network` (MAJOR UPGRADE)

This is the **immersive theater** — dark theme, cinematic, Unity/Unreal quality.

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Nav (transparent, glass blur over scene)        │
├─────────────────────────────────────────────────┤
│  ● Network  2,043 nodes  4x GPU  3 workers      │  ← Stats bar
├─────────────────────────────────────────────────┤
│                                                  │
│              ┌────────────────┐                  │
│              │                │                  │
│              │    3D Globe    │    ┌──────────┐  │
│              │    (60% vw)    │    │ Sidebar  │  │
│              │                │    │ Jobs  2  │  │
│              │  Nodes glow    │    │ Nodes 3  │  │
│              │  Arcs animate  │    │ Tape  3  │  │
│              │  Zoom enabled  │    │          │  │
│              │                │    │ Details  │  │
│              └────────────────┘    └──────────┘  │
│                                                  │
│  [Legend: ● Supply  ● Training  ● Verifying]     │
└─────────────────────────────────────────────────┘
```

**Semantic Zoom Levels:**
```
Level 1 — Far (default, camera dist > 8)
├── Globe with atmosphere
├── Region hotspots glow (12 cities)
├── City labels visible
├── Node count badges per region
└── No individual nodes visible (performance)

Level 2 — Mid (camera dist 4-8)
├── Individual node clusters visible per city
├── Connection arcs between active job nodes
├── Data flow particles on arcs
├── Job hub indicators
└── City labels larger, node counts detailed

Level 3 — Close (camera dist < 4)
├── Individual node details (GPU label, state)
├── Node stems with tip glows
├── Dense data flow visualization
├── Worker assignment lines
└── Full detail, limited to visible frustum
```

**Visual Quality Upgrades (Unity/Unreal level):**
1. **Enhanced atmosphere**: Two-pass atmosphere shader (Rayleigh + Mie scattering approximation via custom ShaderMaterial)
2. **Bloom tuning**: UnrealBloomPass threshold 0.6, strength 0.8, radius 0.4 (less blown-out)
3. **Vignette**: Post-processing vignette for cinematic feel
4. **Node beams**: Instanced mesh cylinders with emissive glow (not lines)
5. **Connection arcs**: TubeGeometry with animated UV offset (not plain curves)
6. **Region heat**: Sprite-based heat glow under active regions
7. **Star field**: Enhanced twinkle shader with nebula background plane
8. **Ambient particles**: Three orbital shells with depth-of-field blur

**Performance Budget:**
- Target: 60fps on M1 MacBook Air at 1x pixel ratio
- Max draw calls: 50 (use instancing aggressively)
- Max triangles: 200K
- Texture budget: 8MB total (current: ~6MB, safe)
- LOD: Hide node details when camera > 8 units
- Frustum cull: Only render nodes in camera view
- Point cap: 2000 visible nodes max (rest as region aggregate)

---

### 4.4 Models Page → `/#/models` (POLISH)

Keep current HuggingFace-inspired layout, but:
- Match `--surface-0` background
- Use `--accent` for model metrics
- Card hover: subtle `--accent-light` background
- Search bar: Match landing page search style
- Add model card tags/badges

### 4.5 Ontology Page → `/#/ontology` (POLISH)

Keep current research config form, but:
- Match card styling to holostudio.io
- Use `--accent` for primary actions
- Clean form inputs with `--surface-1` backgrounds

---

## 5. Component Redesign

### 5.1 NavBar (Unified)
```
┌──────────────────────────────────────────────────────┐
│ ◇ HOOT MAGNET  │ ✦ Dashboard  ⊞ Models  ◎ Ontology  ⊕ Network │ powered by holostudio  [Sign in] │
└──────────────────────────────────────────────────────┘
```
- Always visible, no hide on scroll
- Light mode: white bg, subtle bottom border
- Dark mode (Network view): transparent with backdrop-blur
- Active page: `--accent` underline + text color
- Logo: HOOT MAGNET with diamond icon in `--accent`

### 5.2 StatsBar (New)
```
● NETWORK LIVE  │  2,043 ACTIVE NODES  │  4x GPU CORES  │  3 WORKERS  │  2 ACTIVE JOBS  │  [View Network →]
```
- Horizontal strip below nav or above content
- Green dot for live status
- Monospace numbers for real-time updates
- `--surface-1` background with subtle border

### 5.3 JobCard (New)
```
┌────────────────────────────────────────┐
│ ⚡ Crypto Market Prediction            │
│ ██████████████░░░░░░ 72% training     │
│ 3 nodes · berlin-a100, seoul-4090      │
│ val_bpb: 1.823 → 1.791 ↓ (-0.032)    │
│ ─────────────────────────────────      │
│ Started 14m ago · ETA ~7m              │
└────────────────────────────────────────┘
```
- `--surface-1` card with `--accent` left border on active jobs
- Progress bar in `--viz-cyan`
- Node links clickable → focus globe to that region

### 5.4 MetricCard (Redesign)
```
┌──────────────┐
│  ⊕  2,043    │
│  Active Nodes │
└──────────────┘
```
- Clean icon + large number + label
- `--surface-1` bg, subtle border
- Number animates on change (CountUp)

---

## 6. Implementation Phases

### Phase 1: Design System Foundation (tokens, nav, color unification)
**Files:** `tokens.css`, `NavBar.svelte`, `App.svelte`

1. Rewrite `tokens.css` with full unified palette (light + dark)
2. Rebuild `NavBar.svelte` to match holostudio.io exactly
3. Update `App.svelte` routing to new page structure
4. Add theme context: `data-theme="light"` for dashboard pages, `data-theme="dark"` for network

### Phase 2: Landing Page Redesign
**Files:** `LandingPage.svelte`

1. Integrate mini-globe (280px, reuse GlobeCanvas with `compact` prop)
2. Search bar CTA with holostudio.io styling
3. Live stats bar component
4. Pipeline steps section (4 cards)
5. Light theme, `--surface-0` background

### Phase 3: Dashboard View (New)
**Files:** `DashboardView.svelte`, new `JobCard.svelte`, new `StatsBar.svelte`

1. 3-column layout: stats rail | job list | globe widget
2. Globe widget: GlobeCanvas at 320px with `widget` mode
3. Job cards with live progress
4. Experiment tape at bottom
5. Light theme

### Phase 4: Network View (Major Upgrade)
**Files:** `NetworkView.svelte`, `GlobeCanvas.tsx`, `globeScene.ts`

1. **Globe sizing**: Default camera distance 9.5 → globe occupies ~55% viewport
2. **Semantic zoom**: Implement LOD system with 3 zoom levels
3. **Visual upgrades**:
   - Custom atmosphere shader (two-pass Fresnel)
   - Enhanced bloom parameters
   - Vignette post-processing pass
   - Instanced node beams (InstancedMesh)
   - TubeGeometry connection arcs with animated UVs
   - Region heat sprites
4. **Sidebar panel**: Glass-morphism panel with Jobs/Nodes/Tape tabs
5. **Smooth zoom**: Scroll wheel with momentum, min/max clamp
6. **Dark theme** with transparent nav

### Phase 5: Models & Ontology Polish
**Files:** `ModelsPage.svelte`, `OntologyPage.svelte`

1. Apply unified tokens
2. Card styling consistency
3. Search bar consistency
4. Typography cleanup

### Phase 6: Performance Optimization
1. Implement frustum culling for nodes
2. LOD transitions (fade, not pop)
3. Instanced rendering audit
4. Texture compression check
5. requestAnimationFrame throttling on hidden tabs
6. Test on Chrome, Safari, Firefox

---

## 7. Globe Widget vs Full Globe (Key Architecture Decision)

The GlobeCanvas.tsx needs two rendering modes:

### `compact` mode (Landing + Dashboard)
- Fixed camera, no user interaction (or limited)
- Reduced geometry: 64x64 sphere, no clouds, no wireframe
- No post-processing (no bloom pass)
- Simplified star field (500 stars)
- No node labels, no stems — just glowing dots
- Target: <5ms per frame

### `full` mode (Network view)
- Full interaction (drag, zoom, click)
- Full geometry and post-processing
- All data layers (nodes, arcs, flows, labels)
- Semantic zoom LOD system
- Target: <16ms per frame (60fps)

This is controlled by a `mode: "compact" | "full"` prop passed to GlobeCanvas.

---

## 8. Key Interactions

| Action | Behavior |
|--------|----------|
| Scroll on Network | Zoom in/out (3.5 → 12 camera distance) |
| Drag on Network | Rotate globe |
| Click region | Smooth fly-to, zoom to Level 2 |
| Click node | Zoom to Level 3, show detail popup |
| Double-click empty | Reset to default view |
| Click globe widget (Dashboard) | Navigate to `/#/network` |
| Idle 3s | Gentle auto-rotation resumes |
| Pinch (mobile) | Zoom in/out |

---

## 9. Typography

```
--font-display:  'Playfair Display', Georgia, serif     // Headlines only
--font-body:     'Inter', -apple-system, sans-serif      // Everything else
--font-mono:     'JetBrains Mono', 'SF Mono', monospace  // Metrics, code

Font scale (based on 16px base):
--text-xs:    0.75rem / 1rem        // 12px - labels
--text-sm:    0.875rem / 1.25rem    // 14px - body small
--text-base:  1rem / 1.5rem         // 16px - body
--text-lg:    1.125rem / 1.75rem    // 18px - body large
--text-xl:    1.25rem / 1.75rem     // 20px - subheadings
--text-2xl:   1.5rem / 2rem         // 24px - section titles
--text-3xl:   2rem / 2.5rem         // 32px - page titles
--text-hero:  3rem / 3.5rem         // 48px - hero headline
```

---

## 10. Summary of Deliverables

| # | Deliverable | Effort |
|---|-------------|--------|
| 1 | Unified `tokens.css` design system | Small |
| 2 | Rebuilt `NavBar.svelte` matching holostudio.io | Small |
| 3 | Redesigned `LandingPage.svelte` with mini-globe | Medium |
| 4 | New Dashboard layout with globe widget + job cards | Large |
| 5 | Network view with semantic zoom + visual upgrades | Large |
| 6 | Globe `compact`/`full` mode architecture in GlobeCanvas.tsx | Medium |
| 7 | `ModelsPage.svelte` + `OntologyPage.svelte` polish | Small |
| 8 | Performance optimization pass | Medium |

Estimated total: ~2500-3500 lines of changes across 12-15 files.
