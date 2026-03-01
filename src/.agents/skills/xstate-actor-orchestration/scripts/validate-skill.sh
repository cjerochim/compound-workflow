#!/usr/bin/env bash

set -euo pipefail

skill_dir="${1:-.}"
skill_md="$skill_dir/SKILL.md"
openai_yaml="$skill_dir/agents/openai.yaml"
statecharts_dir="$skill_dir/assets/statecharts"
statechart_script="$skill_dir/scripts/create-statechart-artifact.sh"

fail=0

ok() {
  echo "OK: $1"
}

err() {
  echo "ERROR: $1" >&2
  fail=1
}

if [[ ! -f "$skill_md" ]]; then
  err "Missing SKILL.md at $skill_md"
fi

if [[ ! -f "$openai_yaml" ]]; then
  err "Missing agents/openai.yaml at $openai_yaml"
fi

if [[ ! -d "$statecharts_dir" ]]; then
  err "Missing statechart asset directory at $statecharts_dir"
else
  ok "Statechart asset directory exists"
fi

if [[ ! -f "$statechart_script" ]]; then
  err "Missing statechart artifact script at $statechart_script"
elif [[ ! -x "$statechart_script" ]]; then
  err "Statechart artifact script is not executable: $statechart_script"
else
  ok "Statechart artifact script exists and is executable"
fi

if [[ -f "$skill_md" ]]; then
  first_line="$(head -n 1 "$skill_md" || true)"
  if [[ "$first_line" != "---" ]]; then
    err "SKILL.md must start with frontmatter delimiter '---'"
  fi

  fm_end_line="$(awk 'NR > 1 && $0 == "---" { print NR; exit }' "$skill_md")"
  if [[ -z "${fm_end_line:-}" ]]; then
    err "SKILL.md is missing closing frontmatter delimiter '---'"
  else
    ok "Frontmatter delimiters found"

    frontmatter="$(sed -n "2,$((fm_end_line - 1))p" "$skill_md")"

    if ! grep -qE '^name:[[:space:]]*[^[:space:]].*$' <<<"$frontmatter"; then
      err "Frontmatter must include non-empty 'name'"
    fi

    if ! grep -qE '^description:[[:space:]]*[^[:space:]].*$' <<<"$frontmatter"; then
      err "Frontmatter must include non-empty 'description'"
    fi

    extra_keys="$(sed '/^[[:space:]]*$/d' <<<"$frontmatter" | sed 's/:.*$//' | grep -Ev '^(name|description)$' || true)"
    if [[ -n "$extra_keys" ]]; then
      err "Frontmatter contains unsupported key(s): $(tr '\n' ',' <<<"$extra_keys" | sed 's/,$//')"
    else
      ok "Frontmatter keys are limited to name and description"
    fi

    skill_name="$(sed -n 's/^name:[[:space:]]*//p' <<<"$frontmatter" | head -n 1)"
    if [[ ! "$skill_name" =~ ^[a-z0-9-]{1,64}$ ]]; then
      err "name must match ^[a-z0-9-]{1,64}$ (found '$skill_name')"
    else
      ok "Skill name format is valid"
    fi

    skill_dir_basename="$(basename "$skill_dir")"
    if [[ "$skill_name" != "$skill_dir_basename" ]]; then
      err "Folder name '$skill_dir_basename' must match frontmatter name '$skill_name'"
    else
      ok "Folder name matches frontmatter name"
    fi
  fi
fi

if [[ -f "$openai_yaml" ]]; then
  if ! grep -qE '^[[:space:]]*default_prompt:[[:space:]]*".*"$' "$openai_yaml"; then
    err "agents/openai.yaml must include quoted default_prompt"
  else
    ok "default_prompt exists"
  fi

  if [[ -n "${skill_name:-}" ]] && ! grep -q '\$'"${skill_name}" "$openai_yaml"; then
    err "default_prompt must mention \$${skill_name}"
  elif [[ -n "${skill_name:-}" ]]; then
    ok "default_prompt mentions $skill_name"
  fi
fi

if command -v rg >/dev/null 2>&1; then
  set +e
  rg -n '\[TODO|TODO:' \
    "$skill_dir/SKILL.md" \
    "$skill_dir/agents/openai.yaml" \
    "$skill_dir/references" >/dev/null
  todo_rc=$?
  set -e
  if [[ "$todo_rc" -eq 0 ]]; then
    err "Unresolved TODO placeholders found in skill files"
  elif [[ "$todo_rc" -eq 1 ]]; then
    ok "No TODO markers found"
  else
    err "Failed to run TODO marker check with ripgrep"
  fi

  if [[ -f "$skill_md" ]]; then
    while IFS= read -r rel_path; do
      clean_path="${rel_path#references/}"
      full_path="$skill_dir/references/$clean_path"
      if [[ ! -f "$full_path" ]]; then
        err "Missing reference file linked from SKILL.md: $rel_path"
      fi
    done < <(rg -o '\]\((references/[^)]+)\)' "$skill_md" | sed -E 's/.*\((references\/[^)]+)\).*/\1/' | sort -u)
    ok "Reference links resolved"
  fi
else
  err "ripgrep (rg) is required for TODO and reference-link checks"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Validation failed." >&2
  exit 1
fi

echo "Validation passed."
