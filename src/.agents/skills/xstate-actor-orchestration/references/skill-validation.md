# Skill Validation Without Python

Use this checklist when Python-based validation tooling is unavailable or undesired.

## Command

Run the shell validator from the skill root:

```bash
./scripts/validate-skill.sh .
```

## What the shell validator checks

1. `SKILL.md` exists and has valid frontmatter delimiters.
2. Frontmatter contains only `name` and `description`.
3. `name` follows skill naming constraints (`[a-z0-9-]`, max 64 chars).
4. Skill folder name matches frontmatter `name`.
5. `agents/openai.yaml` exists.
6. `default_prompt` exists and mentions `$<skill-name>`.
7. `assets/statecharts/` exists for Mermaid artifacts.
8. `scripts/create-statechart-artifact.sh` exists and is executable.
9. No unresolved TODO placeholders remain in checked files.
10. Every local `references/*.md` link in `SKILL.md` points to an existing file.

## Additional manual checks

1. Confirm `description` includes clear trigger contexts.
2. Confirm workflow steps are imperative and actionable.
3. Confirm references stay one level deep from `SKILL.md`.
4. Confirm examples reflect XState v5 APIs used by your codebase.
5. Confirm each proposed/updated machine includes a `.mmd` diagram and `.signoff.md` record.
6. Confirm sign-off status advances by workflow phase (`DRAFT` -> `PLANNED` -> `APPROVED`).
