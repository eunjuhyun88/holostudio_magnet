# Agent Branching Guide

This document is the canonical operating guide for concurrent agents in this repository.

## Non-Negotiables

1. One active agent = one branch.
2. One active branch = one worktree.
3. One active branch = one coordination claim.
4. One active claim must declare one surface and explicit path boundaries.
5. No agent may continue work on another agent's dirty branch or uncommitted worktree.

If any of those are false, parallel work is not safe.

## Required Pattern

Use this shape for every non-trivial task:

- branch: `codex/<agent>-<work-id>-<slug>`
- worktree: dedicated path created with `npm run safe:worktree -- <slug> [base-branch]`
- work ID: `W-YYYYMMDD-<slug>`
- claim: one active `coord:claim` covering only the owned paths

Examples:

- `codex/claude-W-20260315-runtime-control`
- `codex/codex-W-20260315-web-cutover`

## Start Sequence

1. Inspect the current repo state.
2. Create a fresh worktree.
3. Create a checkpoint.
4. Create a coordination claim.

```bash
npm run safe:status
npm run safe:worktree -- runtime-control main
npm run ctx:checkpoint -- --work-id "W-20260315-runtime-control" --surface "runtime-api" --objective "unify runtime control path"
npm run coord:claim -- --work-id "W-20260315-runtime-control" --agent "claude" --surface "runtime-api" --summary "runtime control path" --path "apps/runtime-api" --path "scripts" --path "packages"
```

## Scope Rules

- Split work by path prefix first, then by surface.
- If two agents need the same file family, split the task into sequential handoffs instead of concurrent edits.
- Generated docs and local runtime logs are the only acceptable shared low-risk paths.
- A second task on the same surface still needs a different branch if the path boundaries differ.

## Work-In-Progress Rules

- Keep incomplete work inside the agent's own branch only.
- Do not stack two unrelated tasks in one dirty branch.
- Do not ask another agent to "continue from here" unless the current branch is checkpointed and the claim is handed off.
- If another agent already has uncommitted work on the needed path, stop and re-partition the task.

## Handoff Rules

Before another agent takes over:

1. save a checkpoint
2. compact context
3. release or hand off the claim
4. give the next agent the branch, work ID, owned paths, and blocking risks

```bash
npm run ctx:save -- --title "runtime control handoff"
npm run ctx:compact
npm run coord:release -- --work-id "W-20260315-runtime-control" --status handoff --handoff-to "codex"
```

## Merge Rules

- Integration happens by commit, not by shared dirty state.
- Merge or cherry-pick only validated commits.
- Run these before push or merge:

```bash
npm run docs:check
npm run ctx:check -- --strict
npm run coord:check
npm run build
```

## What To Reject

Reject the workflow if any of these appear:

- "keep working in my current dirty branch and just avoid conflicts"
- "two agents can both edit the same store and sort it out later"
- "continue from another agent's uncommitted workspace"
- "skip the claim because this is small"

Those patterns create merge debt and broken context lineage.
