#!/usr/bin/env bash
set -euo pipefail

# ── Cleanup stale branches and worktrees ──
# Automatically distinguishes:
#   🟢 ACTIVE  — has uncommitted changes (dirty) or unique unmerged commits
#   🔴 STALE   — clean, no unique work, safe to remove
#   🟡 PENDING — clean but has unmerged commits (needs merge first)
#
# Usage:
#   npm run safe:cleanup            # dry-run (show what would be deleted)
#   npm run safe:cleanup -- --force  # actually delete stale items

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

MAIN_BRANCH="main"
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    *) echo "[cleanup] unknown arg: $arg"; exit 1 ;;
  esac
done

echo "══════════════════════════════════════"
echo "  Smart Branch & Worktree Cleanup"
echo "══════════════════════════════════════"
echo ""

# ── 1. Analyze all worktrees ──
echo "── Worktree Analysis ──"

STALE_WORKTREES=()
STALE_BRANCHES=()
ACTIVE_COUNT=0
PENDING_COUNT=0

while IFS= read -r line; do
  wt_path="$(echo "$line" | awk '{print $1}')"
  wt_branch="$(echo "$line" | sed -n 's/.*\[\(.*\)\].*/\1/p' || true)"

  # Skip main worktree
  [[ "$wt_path" == "$ROOT_DIR" ]] && continue
  [[ -z "$wt_path" ]] && continue
  [[ -z "$wt_branch" ]] && continue

  # Check 1: dirty files (uncommitted changes)
  dirty_count=0
  if [ -d "$wt_path" ]; then
    dirty_count=$(git -C "$wt_path" status --short 2>/dev/null | wc -l | tr -d ' ')
  fi

  # Check 2: unique commits not in main
  ahead_count=$(git rev-list --count "$MAIN_BRANCH".."$wt_branch" 2>/dev/null || echo "0")

  # Check 3: is branch fully merged into main?
  is_merged=false
  if git branch --merged "$MAIN_BRANCH" 2>/dev/null | sed 's/^[* +]*//' | grep -qx "$wt_branch"; then
    is_merged=true
  fi

  # Classify
  if [ "$dirty_count" -gt 0 ]; then
    # Has uncommitted work → ACTIVE
    echo "  🟢 ACTIVE: $wt_branch"
    echo "       path: $wt_path"
    echo "       dirty: $dirty_count files, ahead: $ahead_count commits"
    ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
  elif [ "$ahead_count" -gt 0 ] && ! $is_merged; then
    # Has unique unmerged commits but clean → PENDING MERGE
    echo "  🟡 PENDING: $wt_branch"
    echo "       path: $wt_path"
    echo "       ahead: $ahead_count commits (need merge or discard)"
    PENDING_COUNT=$((PENDING_COUNT + 1))
  else
    # Clean and merged (or no unique work) → STALE
    echo "  🔴 STALE: $wt_branch"
    echo "       path: $wt_path"
    STALE_WORKTREES+=("$wt_path")
    STALE_BRANCHES+=("$wt_branch")
  fi
  echo ""
done < <(git worktree list 2>/dev/null)

# ── 2. Find merged branches without worktrees ──
echo "── Orphan Merged Branches (no worktree) ──"
ORPHAN_BRANCHES=()
while IFS= read -r branch; do
  branch="$(echo "$branch" | sed 's/^[* +]*//' | xargs)"
  [[ "$branch" == "$MAIN_BRANCH" ]] && continue
  [[ -z "$branch" ]] && continue

  # Check if this branch is already tracked by a worktree
  has_worktree=false
  while IFS= read -r wt_line; do
    wt_branch="$(echo "$wt_line" | sed -n 's/.*\[\(.*\)\].*/\1/p' || true)"
    if [[ "$wt_branch" == "$branch" ]]; then
      has_worktree=true
      break
    fi
  done < <(git worktree list 2>/dev/null)

  if ! $has_worktree; then
    # Check if branch is dirty (has stashed or uncommitted changes)
    # For branches without worktrees, we can only check commit status
    ORPHAN_BRANCHES+=("$branch")
    echo "  🔴 $branch (merged, no worktree)"
  fi
done < <(git branch --merged "$MAIN_BRANCH" 2>/dev/null)

if [ ${#ORPHAN_BRANCHES[@]} -eq 0 ]; then
  echo "  (none)"
fi
echo ""

# ── 3. Stale remotes ──
echo "── Stale remote tracking branches ──"
PRUNE_OUTPUT="$(git remote prune origin --dry-run 2>/dev/null || true)"
if [ -n "$PRUNE_OUTPUT" ]; then
  echo "$PRUNE_OUTPUT"
else
  echo "  (none)"
fi
echo ""

# ── 4. Summary ──
TOTAL_STALE=$((${#STALE_WORKTREES[@]} + ${#ORPHAN_BRANCHES[@]}))
echo "── Summary ──"
echo "  🟢 Active (keep):  $ACTIVE_COUNT"
echo "  🟡 Pending merge:  $PENDING_COUNT"
echo "  🔴 Stale (remove): $TOTAL_STALE"
echo ""

if [ "$TOTAL_STALE" -eq 0 ]; then
  echo "[cleanup] Nothing to clean up."
  exit 0
fi

# ── 5. Execute or dry-run ──
if ! $FORCE; then
  echo "══════════════════════════════════════"
  echo "  DRY RUN — no changes made"
  echo "  Run with --force to delete stale items"
  echo "  (🟢 ACTIVE and 🟡 PENDING are never deleted)"
  echo "══════════════════════════════════════"
  exit 0
fi

echo "══════════════════════════════════════"
echo "  EXECUTING CLEANUP (stale only)"
echo "══════════════════════════════════════"
echo ""

# Remove stale worktrees first
for wt in "${STALE_WORKTREES[@]+"${STALE_WORKTREES[@]}"}"; do
  echo "[cleanup] Removing worktree: $wt"
  git worktree remove "$wt" --force 2>/dev/null || echo "  (already removed or locked)"
done

# Combine stale worktree branches + orphan branches
ALL_DELETE_BRANCHES=("${STALE_BRANCHES[@]+"${STALE_BRANCHES[@]}"}" "${ORPHAN_BRANCHES[@]+"${ORPHAN_BRANCHES[@]}"}")

# Delete local branches
for branch in "${ALL_DELETE_BRANCHES[@]+"${ALL_DELETE_BRANCHES[@]}"}"; do
  echo "[cleanup] Deleting local branch: $branch"
  git branch -d "$branch" 2>/dev/null || echo "  (already deleted)"
done

# Delete remote branches (only recognized prefixes)
for branch in "${ALL_DELETE_BRANCHES[@]+"${ALL_DELETE_BRANCHES[@]}"}"; do
  if [[ "$branch" == codex/* ]] || [[ "$branch" == claude/* ]] || [[ "$branch" == feat/* ]]; then
    if git ls-remote --heads origin "$branch" 2>/dev/null | grep -q .; then
      echo "[cleanup] Deleting remote branch: origin/$branch"
      git push origin --delete "$branch" 2>/dev/null || echo "  (already deleted on remote)"
    fi
  fi
done

# Prune stale remote refs + worktree metadata
echo "[cleanup] Pruning stale refs..."
git remote prune origin 2>/dev/null || true
git worktree prune 2>/dev/null || true

echo ""
echo "[cleanup] Done. Removed $TOTAL_STALE stale items."
echo "[cleanup] 🟢 $ACTIVE_COUNT active + 🟡 $PENDING_COUNT pending kept safe."
