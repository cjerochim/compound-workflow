#!/usr/bin/env bash
# Copy src/.agents and src/AGENTS.md from this compound-workflow repo into a host repo.
# Does not update opencode.json; run /sync in Cursor or /setup in the host for that.
set -e
CLONE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$(dirname "$CLONE_ROOT")}"
if [[ ! -d "$CLONE_ROOT/src/.agents" || ! -f "$CLONE_ROOT/src/AGENTS.md" ]]; then
  echo "Error: $CLONE_ROOT is not a compound-workflow clone (missing src/.agents or src/AGENTS.md)" >&2
  exit 1
fi
if [[ ! -d "$TARGET" ]]; then
  echo "Error: target is not a directory: $TARGET" >&2
  exit 1
fi
# Avoid copying into our own src
if [[ "$(cd "$TARGET" && pwd)" == "$(cd "$CLONE_ROOT/src" 2>/dev/null && pwd)" ]] || [[ "$TARGET" == "$CLONE_ROOT/src" ]]; then
  echo "Error: target must not be the clone's src directory" >&2
  exit 1
fi
echo "Copying into $TARGET ..."
cp -R "$CLONE_ROOT/src/.agents" "$TARGET/.agents"
if [[ ! -f "$TARGET/AGENTS.md" ]]; then
  cp "$CLONE_ROOT/src/AGENTS.md" "$TARGET/AGENTS.md"
else
  echo "AGENTS.md already exists; skipped copy. Run /sync in Cursor to merge template with host AGENTS.md."
fi
echo "Done. Run /setup in the host repo to configure repo defaults and sync opencode.json if needed."
