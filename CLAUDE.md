# CLAUDE.md — Mesh Autoresearch Visualizer

## Project Overview

A dual-panel real-time visualization system (codename **HOOT**) showing autonomous research experiments running across a globally distributed browser-provided compute mesh. Built with **Svelte 5** (primary) and **React 19** (legacy), rendered with **Three.js** on a 3D globe.

Three panels:
- **Worker Board (left):** GPU workers running experiments in parallel
- **Globe Mesh (right):** Three.js globe showing distributed compute nodes and job arcs
- **Experiment Tape (bottom):** Audit trail of keep/discard decisions with metrics

Core principle: **"Prefer telemetry truth over decorative animation"** — render real state from telemetry, not fake motion.

## Quick Start

```bash
npm install
npm run dev              # Svelte dev server at http://localhost:5173
npm run telemetry:mock   # Mock SSE telemetry at http://localhost:8787/events
# Open http://localhost:5173/?telemetry=http://localhost:8787/events
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Svelte dev server (default) |
| `npm run dev:react` | Start React legacy dev server |
| `npm run build` | Production build (Svelte) |
| `npm run build:react` | Production build (React) |
| `npm run preview` | Preview Svelte production build |
| `npm run telemetry:mock` | Fixture-backed SSE stream |
| `npm run telemetry:from-autoresearch` | Convert autoresearch workspaces to NDJSON |
| `npm run controller:loop` | Integrated loop controller (simulate/watch) |
| `npm run swarm:supervisor` | Attach real codex workers to worktrees |
| `npm run eval:globe` | Run evaluation suite (appends to results.tsv) |
| `npm run eval:globe:json` | Eval suite with JSON output |
| `npm run migration:svelte:prepare` | Prepare Svelte migration runtime pack |

## Project Structure

```
├── src/core/              # Framework-agnostic simulation & rendering (READ-ONLY)
│   ├── meshSim.ts         # 70+ telemetry state management functions
│   └── globeScene.ts      # Three.js primitives (stars, arcs, labels, particles)
├── src/fixed/             # Telemetry helpers (READ-ONLY)
│   ├── types.ts           # Core type definitions (Worker, Node, Job, TapeEntry, VisualizerModel)
│   ├── telemetry.ts       # Event-to-model reducer
│   ├── fixturePlayer.ts   # NDJSON parser & fixture playback
│   └── liveTelemetry.ts   # SSE streaming via EventSource
├── src/react/             # React components (legacy)
│   └── GlobeCanvas.tsx
├── src/Visualizer.tsx     # React visualizer entry (EDITABLE)
├── src-svelte/            # Svelte implementation (primary, EDITABLE)
│   ├── App.svelte         # Shell entry point
│   ├── main.ts            # Svelte mount
│   └── lib/               # UI components
│       ├── WorkerBoard.svelte
│       ├── ExperimentTape.svelte
│       ├── ProtocolPipeline.svelte
│       ├── GlobeCanvasIsland.svelte
│       ├── StatePill.svelte
│       ├── MetricCard.svelte
│       └── ModeButton.svelte
├── eval/                  # Evaluation framework (READ-ONLY)
│   ├── run_eval.ts        # Orchestrator
│   ├── checks.ts          # Structural validation
│   └── score.ts           # Metrics & scoring (0-100 sceneScore)
├── fixtures/              # Sample telemetry data (NDJSON)
├── scripts/               # CLI tooling (controller, supervisor, migration)
├── migration/             # Svelte migration documentation
├── spec.md                # Product specification
├── program.md             # Development program & ground rules
├── vite.config.ts         # Svelte Vite config
├── vite.react.config.ts   # React Vite config
└── tsconfig.json          # TypeScript config (ES2022, strict, NodeNext)
```

## Editability Rules

**EDITABLE** — you may modify these:
- `src-svelte/App.svelte` and all files in `src-svelte/lib/`
- `src/Visualizer.tsx` (React legacy)

**READ-ONLY** — never modify:
- `src/core/*` (meshSim.ts, globeScene.ts)
- `src/fixed/*` (types.ts, telemetry.ts, fixturePlayer.ts, liveTelemetry.ts)
- `eval/*` (checks.ts, score.ts, run_eval.ts)

## Tech Stack

- **Language:** TypeScript 5.8 (ES2022 target, strict mode, NodeNext modules)
- **Primary UI:** Svelte 5.53
- **Legacy UI:** React 19.1
- **3D Rendering:** Three.js 0.176
- **Build:** Vite 6.3
- **No linter/formatter configured** — rely on TypeScript strict mode

## Key Types (from `src/fixed/types.ts`)

```typescript
// Worker states: idle | patching | training | evaluating | keep | discard | crash
// Node states:   online | available | assigned | training | cooldown
// Job states:    queued | training | evaluating | done

type VisualizerModel = { workers: Worker[], nodes: Node[], jobs: Job[], tape: TapeEntry[] }
```

13+ telemetry event types: `node.online`, `node.assigned`, `worker.started`, `worker.state`, `worker.result`, `job.created`, `job.state`, `experiment.result`, etc.

## Color Conventions

| State | Color |
|-------|-------|
| keep | Green (`#00ff00` range) |
| discard | Red (`#ff0000` range) |
| evaluating | Amber/Orange |
| training | Cyan |
| crash | Magenta/Red |

## Architecture Patterns

- **Event sourcing:** Telemetry events update a `VisualizerModel` via a reducer
- **Framework-agnostic core:** All simulation and rendering logic lives in `src/core/`, decoupled from UI framework
- **SSE streaming:** Live telemetry via `EventSource` API, falls back to fixture data
- **Query-param config:** `?telemetry=<url>` switches from fixture to live mode

## Evaluation & Testing

No traditional test framework. Quality is measured via the evaluation system:

```bash
npm run eval:globe        # Run checks, append results to results.tsv
```

Metrics: `buildPass`, `workerAccuracy`, `nodeAccuracy`, `arcAccuracy`, `visualMatch`, `perfScore`, `overlapPenalty`, `sceneScore` (composite 0-100).

## Code Style

- **camelCase** for functions, variables, local types
- **PascalCase** for components and exported types
- Prefer small, pure functions — `meshSim.ts` exports 70+ composable helpers
- Minimal dependencies — no utility libraries
- No emojis in code or commit messages unless requested
