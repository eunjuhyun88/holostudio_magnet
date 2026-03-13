# Mesh Visualizer Program

## Objective

Build a dual-panel visualization that combines:

- a real-time autoresearch worker swarm
- a globe-based browser compute mesh
- an experiment tape showing keep and discard outcomes

## Editable Scope

Only edit:

- `src/Visualizer.tsx`

Do not edit:

- `spec.md`
- anything under `fixtures/`
- anything under `eval/`

## Ground Rules

1. one idea per iteration
2. keep only if the current phase score improves
3. if the score ties, prefer simpler code
4. if build fails, the iteration fails
5. if console errors appear, the iteration fails
6. preserve telemetry truth over decorative animation
7. do not replace real states with fake looping motion when fixtures or live events exist

## Product Truth

The UI must communicate:

1. multiple experiment workers are running in parallel
2. those workers are backed by globally distributed browser-provided compute
3. experiments are measured and either kept or discarded

## Visual Truth

The left side proves:
- real worker activity
- real experiment states
- real keep and discard decisions

The right side proves:
- geographic scale
- distributed nodes
- active jobs and flows

The bottom proves:
- recent decision history

## Phase Order

### Phase 1: worker-board

Focus:
- worker card hierarchy
- state color system
- experiment tape sync

Do not spend time on:
- globe polish
- packet effects

### Phase 2: globe-node-layer

Focus:
- node placement
- node state styling
- stable panel composition

Do not spend time on:
- dense arc systems
- visual flourishes with no state meaning

### Phase 3: job-hub-arc-layer

Focus:
- node to hub connection logic
- active job emphasis
- clutter control

Do not:
- draw every possible connection

### Phase 4: packet-flow

Focus:
- directional flow
- training-only motion
- restrained animation

### Phase 5: perf-polish

Focus:
- hierarchy
- visual clarity
- readability under event load

## Preferred Decisions

- use job hubs instead of all-to-all connections
- use dimmed inactive nodes
- use green for keep, red for discard, amber for evaluating, cyan for training
- keep labels minimal until interaction or selection

## Failure Modes To Avoid

- globe looks impressive but worker truth is unclear
- all nodes look equally active
- arcs become spaghetti
- keep and discard are distinguishable only by text
- the bottom tape desynchronizes from the worker or globe panels

## Current Working Definition

The iteration is good if a first-time viewer can answer:

1. how many workers are active right now
2. where the active compute appears to be distributed
3. which experiments were kept and which were discarded

