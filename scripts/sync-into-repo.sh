#!/usr/bin/env bash
# Copy src/.agents and src/AGENTS.md from this compound-workflow repo into a host repo.
# Does not update opencode.json; run /sync in Cursor or /setup in the host for that.
set -e
CLONE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=0
FORCE=0
TARGET=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/sync-into-repo.sh [--dry-run] [--force] [target_dir]

Copies:
  - src/.agents  -> <target_dir>/.agents
  - src/AGENTS.md -> <target_dir>/AGENTS.md (only if missing)

Notes:
  - Replaces <target_dir>/.agents (prevents .agents/.agents nesting)
  - Prints absolute paths before writing
  - Refuses non-git targets unless --force
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$1"
        shift
      else
        echo "Error: unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

TARGET="${TARGET:-$(dirname "$CLONE_ROOT")}"
if [[ ! -d "$CLONE_ROOT/src/.agents" || ! -f "$CLONE_ROOT/src/AGENTS.md" ]]; then
  echo "Error: $CLONE_ROOT is not a compound-workflow clone (missing src/.agents or src/AGENTS.md)" >&2
  exit 1
fi
if [[ ! -d "$TARGET" ]]; then
  echo "Error: target is not a directory: $TARGET" >&2
  exit 1
fi
TARGET_ABS="$(cd "$TARGET" && pwd)"
# Host marker validation (escape hatch: --force)
if [[ "$FORCE" -ne 1 && ! -d "$TARGET_ABS/.git" ]]; then
  echo "Error: target does not look like a git repo (missing .git): $TARGET_ABS" >&2
  echo "Hint: pass --force if you really want to sync into a non-git directory." >&2
  exit 1
fi
# Refuse obvious template targets (escape hatch: --force)
if [[ "$FORCE" -ne 1 && -d "$TARGET_ABS/src/.agents" && -f "$TARGET_ABS/src/AGENTS.md" ]]; then
  echo "Error: target looks like a compound-workflow template repo (has src/.agents + src/AGENTS.md): $TARGET_ABS" >&2
  echo "Refusing to sync into a template repo. Pass --force to override." >&2
  exit 1
fi
# Avoid copying into our own src
if [[ "$TARGET_ABS" == "$(cd "$CLONE_ROOT/src" 2>/dev/null && pwd)" ]] || [[ "$TARGET_ABS" == "$CLONE_ROOT/src" ]]; then
  echo "Error: target must not be the clone's src directory" >&2
  exit 1
fi
echo "Resolved target: $TARGET_ABS"
echo "Planned writes:"
echo "  - $TARGET_ABS/.agents (replace)"
if [[ ! -f "$TARGET_ABS/AGENTS.md" ]]; then
  echo "  - $TARGET_ABS/AGENTS.md (create)"
else
  echo "  - $TARGET_ABS/AGENTS.md (skip; already exists)"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run: no changes made."
  exit 0
fi

echo "Copying into $TARGET_ABS ..."
rm -rf "$TARGET_ABS/.agents"
cp -R "$CLONE_ROOT/src/.agents" "$TARGET_ABS/.agents"
if [[ ! -f "$TARGET_ABS/AGENTS.md" ]]; then
  cp "$CLONE_ROOT/src/AGENTS.md" "$TARGET_ABS/AGENTS.md"
else
  echo "AGENTS.md already exists; skipped copy. Run /sync in Cursor to merge template with host AGENTS.md."
fi
echo "Done. Run /setup in the host repo to configure repo defaults and sync opencode.json if needed."
