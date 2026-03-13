# Mesh Autoresearch Visualizer Spec

## Goal

Build a dual-panel visualization that shows:

1. many autoresearch workers running experiments in parallel
2. those workers being backed by globally distributed browser-provided compute
3. keep/discard decisions being made from measured results, not canned animation

## Core Message

The product must communicate three truths:

1. browser-opened users become available compute nodes
2. multiple GPU workers can run autonomous experiment loops at the same time
3. jobs are scheduled, evaluated, and either kept or discarded based on metrics

## Layout

The screen has three fixed regions:

1. `Research Swarm` on the left
2. `Global Compute Mesh` on the right
3. `Experiment Tape` across the bottom

## Panel Requirements

### 1. Research Swarm

Purpose:
- prove that real experiments are happening right now

Must show:
- worker id
- gpu label
- region
- experiment id
- worker state
- progress
- metric delta when available

Worker states:
- `idle`
- `patching`
- `training`
- `evaluating`
- `keep`
- `discard`
- `crash`

Behavior:
- `training` workers should visibly animate progress
- `evaluating` workers should highlight metric inspection
- `keep` should pulse green briefly
- `discard` should fade red briefly
- `crash` should flash magenta or red and remain obvious

### 2. Global Compute Mesh

Purpose:
- show geographic scale and resource distribution

Must show:
- globe base
- browser nodes
- active job hubs
- active assignment arcs
- packet flow while training

Rules:
- do not draw full node-to-node pairwise meshes
- connect nodes to a job hub instead
- show only the most important active arcs strongly
- aggregate or hide low-priority activity

Node states:
- `online`
- `available`
- `assigned`
- `training`
- `cooldown`

Node behavior:
- `online` is dim
- `available` slowly pulses
- `assigned` brightens and creates an arc to a hub
- `training` emits packet flow
- `cooldown` fades back toward idle

### 3. Experiment Tape

Purpose:
- provide an audit trail of recent decisions

Must show:
- timestamp
- experiment id
- worker id
- result
- metric delta when available

Behavior:
- newest entries appear first
- `keep` uses green accent
- `discard` uses red accent
- `crash` uses magenta or red accent

## Truth Rules

The UI must prefer telemetry truth over decorative animation.

If telemetry is present:
- render real worker states
- render real job membership
- render real keep/discard events

If telemetry is absent:
- fallback fixtures may be used

The UI must not:
- fake all nodes as active at once
- show arbitrary arcs unrelated to running jobs
- imply full peer-to-peer training if the scheduler is hub-oriented

## Privacy Rules

- do not render exact home locations
- use city, region, or H3-cell jittered coordinates
- avoid persistent display of personally identifying labels

## Non-Goals

- exact home-address mapping
- full pairwise node meshes
- on-chain truth as the primary render source
- cinematic-only hero animation with no state meaning

## Acceptance Criteria

The MVP is acceptable when:

1. a viewer can tell multiple experiments are running in parallel
2. a viewer can tell those experiments are backed by globally distributed nodes
3. a viewer can distinguish `keep` from `discard` without reading copy
4. the same event changes both the left panel and the globe panel
5. the UI remains readable under moderate event volume

## Phase Plan

### Phase 1: Worker Board

Success means:
- worker cards render correctly
- all worker states are distinguishable
- the experiment tape updates from telemetry

### Phase 2: Globe Node Layer

Success means:
- nodes render from telemetry or fixtures
- node states are visually distinct
- active nodes are easy to identify

### Phase 3: Job Hubs and Arcs

Success means:
- assigned and training nodes connect to job hubs
- arc count remains visually controlled
- job activity is understandable at a glance

### Phase 4: Packet Flow

Success means:
- moving packet flow is visible during training
- packet direction matches job activity
- the motion helps reading instead of adding noise

### Phase 5: Polish and Performance

Success means:
- visual hierarchy is stable
- clutter is reduced
- performance remains acceptable on desktop

