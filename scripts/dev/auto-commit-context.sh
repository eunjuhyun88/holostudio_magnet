#!/usr/bin/env bash
set -euo pipefail

usage() {
	echo "Usage: bash scripts/dev/auto-commit-context.sh --stage <stage> [--work-id <id>]"
}

STAGE=""
WORK_ID=""

while [ "$#" -gt 0 ]; do
	case "$1" in
		--stage)
			STAGE="${2:-}"
			shift 2
			;;
		--work-id)
			WORK_ID="${2:-}"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1"
			usage
			exit 1
			;;
	esac
done

if [ -z "$STAGE" ]; then
	usage
	exit 1
fi

if [ "${CTX_AUTO_COMMIT_DISABLED:-0}" = "1" ]; then
	echo "[ctx:autocommit] disabled by CTX_AUTO_COMMIT_DISABLED=1"
	exit 0
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || echo HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
	echo "[ctx:autocommit] detached HEAD; skipping."
	exit 0
fi

MAIN_BRANCH="${CTX_MAIN_BRANCH:-$(node scripts/dev/context-config.mjs get-string git.mainBranch 2>/dev/null || true)}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
if [ "$BRANCH" = "$MAIN_BRANCH" ] && [ "${CTX_AUTO_COMMIT_ALLOW_MAIN:-0}" != "1" ]; then
	echo "[ctx:autocommit] on main branch; skipping."
	exit 0
fi

MESSAGE_PREFIX="$(node - <<'NODE'
const fs = require('fs');
try {
  const config = JSON.parse(fs.readFileSync('context-kit.json', 'utf8'));
  process.stdout.write(config.autopilot?.autoCommitMessagePrefix || 'chore(context): autosave');
} catch {
  process.stdout.write('chore(context): autosave');
}
NODE
)"

declare -a PATHS=(
	"README.md"
	"AGENTS.md"
	"CLAUDE.md"
	"ARCHITECTURE.md"
	"context-kit.json"
	"package.json"
	"docs"
	"agents"
	"tools"
	"prompts"
	"scripts/dev"
	"memory"
	".claude"
	".githooks"
)

for target in "${PATHS[@]}"; do
	if [ -e "$target" ]; then
		git add -- "$target"
	fi
done

if git diff --cached --quiet --ignore-submodules --; then
	echo "[ctx:autocommit] no context changes to commit."
	exit 0
fi

STAGE_SAFE="$(printf '%s' "$STAGE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')"
MESSAGE="$MESSAGE_PREFIX $STAGE_SAFE"
if [ -n "$WORK_ID" ]; then
	MESSAGE="$MESSAGE [$WORK_ID]"
fi

git commit -m "$MESSAGE"
echo "[ctx:autocommit] committed: $MESSAGE"
