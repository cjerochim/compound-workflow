#!/usr/bin/env bash

set -euo pipefail

skill_dir="${1:-.}"
machine_name_raw="${2:-}"
timestamp="${3:-$(date '+%Y%m%d-%H%M%S')}"
phase="${4:-DRAFT}"

if [[ -z "$machine_name_raw" ]]; then
  echo "Usage: $0 <skill-dir> <machine-name> [timestamp] [phase]" >&2
  exit 1
fi

machine_name="$(echo "$machine_name_raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
if [[ -z "$machine_name" ]]; then
  echo "ERROR: machine-name must contain at least one alphanumeric character" >&2
  exit 1
fi

artifact_dir="$skill_dir/assets/statecharts"
mkdir -p "$artifact_dir"

artifact_base="${machine_name}-${timestamp}"
diagram_file="$artifact_dir/${artifact_base}.mmd"
signoff_file="$artifact_dir/${artifact_base}.signoff.md"

if [[ -e "$diagram_file" || -e "$signoff_file" ]]; then
  echo "ERROR: Artifact already exists for ${artifact_base}" >&2
  exit 1
fi

cat > "$diagram_file" <<EOF
stateDiagram-v2
  [*] --> "TODO: initial"
  "TODO: initial" --> "TODO: next": "TODO: event"
  "TODO: next" --> [*]
EOF

cat > "$signoff_file" <<EOF
# Statechart Sign-Off

- Machine: ${machine_name_raw}
- Artifact: ${artifact_base}
- Diagram: ./$(basename "$diagram_file")
- Source machine file: TODO:

## Change summary

TODO:

## Review discussion points

1. Scope and event visibility:
2. Parallel vs sequential structure:
3. Wildcard routing behavior:
4. Retry/cancel/recovery paths:
5. Tags used by UI selectors:
6. Emitted imperative events:

## Sign-off

- Status: ${phase}
- Reviewer:
- Date:
- Notes:
EOF

echo "Created:"
echo "- $diagram_file"
echo "- $signoff_file"
