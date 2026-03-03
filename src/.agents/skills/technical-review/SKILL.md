---
name: technical-review
description: Use when a feature approach or plan doc has passed document review and must be checked for technical correctness before build. Triggers on "technical review", "tech review", or as next step after document review in pre-build gate.
---

# Technical Review

Review a feature approach or plan document for technical alignment with architecture, code standards, and quality. Keep a running summary of findings, then review findings one at a time through user-driven dialogue (`next`). For each finding, output intent, options, and a recommendation. Do not approve for build until the plan is updated via a second document review.

Primary execution model: run an independent planning-phase pass first using `planning-technical-reviewer` (when available), then synthesize final technical review verdict.

## When to Use

- After **document review** on a feature approach doc (pre-build gate flow).
- When the user asks for "technical review" or "tech review" of a plan.
- Input: document path if provided; otherwise discover latest in `docs/brainstorms/` or `docs/plans/`.

## Step 1: Get the Document

**If a document path is provided:** Read it, then proceed to Step 2.

**If no document is specified:** Use the doc just reviewed in document review, or look for the most recent feature approach/plan in `docs/brainstorms/` or `docs/plans/` (e.g. by date prefix).

## Step 1.5: Independent Fresh-Context Pass (Required)

- If `planning-technical-reviewer` exists under `.agents/agents/review/`, run it on the plan first.
- Treat its blocking findings as pre-build blockers.
- If the agent is not available, explicitly state: "planning-technical-reviewer unavailable; running direct technical review (degraded bias resistance)".

## Step 1.6: Build Findings Queue (Required)

- Consolidate all blocking and non-blocking findings into an ordered queue.
- Keep a persistent `Findings Summary` visible throughout the review with status per finding:
  - `pending`
  - `aligned`
  - `deferred`
- Do not process findings in bulk. Process one finding at a time.

## Step 2: Assess Against Technical Criteria

Evaluate the plan against:

| Criterion               | What to Check                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**        | Alignment with repo architecture and patterns: layers, controllers, routing, encapsulation; no conflicting or missing patterns.            |
| **Code standards**      | Conventions, file layout (`app/`), naming, patterns used in the repo; no conflicting patterns.                                              |
| **Quality**             | Testability, observability, error handling, dependencies; feasibility and scope realism.                                                    |
| **Stack and libraries** | Expo, React Native, expo-router; existing deps and APIs used correctly; no unsupported or conflicting choices.                                |

Note findings. Do not fix the doc in this skill—output options and recommendation.

## Step 3: Categorize Risk Level

Assign one **overall** risk level for the plan:

| Level      | Definition                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| **Low**    | Aligned with architecture and standards; no material unknowns; can build as described.                        |
| **Medium** | Minor gaps or deviations; fixable in the doc or during implementation with small adjustments.                 |
| **High**   | Material misalignment, missing patterns, or feasibility concerns; doc or approach should change before build. |

State the risk level and one-line rationale.

## Step 4: One-Finding Dialogue Loop (Required)

For each queued finding, present:

- `Finding:` concise summary
- `Intent:` why this matters technically
- `Options:` 2-3 viable paths with tradeoffs
- `Recommendation:` preferred option with rationale
- `Outcome:` leave as `pending` until user aligns

After each finding, stop and prompt exactly:

- `Say "next" to continue to the next finding.`

Supported user controls in this loop:

- `next` -> advance to the next pending finding
- `accept` -> mark current finding as `aligned`, record chosen outcome
- `revise: <note>` -> update current finding framing/options/recommendation before moving on

Do not skip ahead automatically while findings remain pending.

## Step 5: Three Options with Justifications (Overall Verdict)

For each option, provide 2–3 sentences justification:

- **Option A — Proceed as-is** — When risk is low. Justify why no changes are needed.
- **Option B — Proceed with changes** — When risk is medium. List specific doc or code changes; justify why this is sufficient.
- **Option C — Rework or spike** — When risk is high or uncertain. Say what to rework or spike; justify why build should wait.

## Step 6: Recommendation (Overall Verdict)

State the **preferred option** and clear rationale (e.g. "Recommend Option B because …"). Tie to the risk level and findings.

## Step 7: Output and Handoff

- **If pass (Option A or B with changes agreed):** Say "Approved for build" and optional notes. **Handoff:** Run **document review again** to update the plan with all aligned technical review findings (recommendation, agreed changes, per-finding outcomes). Then build.
- **If issues (Option C or B with open changes):** List issues to fix in the doc; do not approve for build until addressed. Handoff: update the plan (or re-run document review to incorporate fixes), then optionally re-run technical review.

## Required Output

End every technical review with:

- `Findings summary:` full list with status `pending|aligned|deferred`
- `Per-finding outcomes:` one line each for every aligned finding
- `Risk level:` low | medium | high (plus one-line rationale)
- `Fresh-context pass:` ran | unavailable (degraded)
- `Options A/B/C:` 2–3 sentences each
- `Recommendation:` preferred option and rationale
- `Approved for build:` yes | no
- `Handoff:` re-run document review to update the plan with related findings and outcomes before build (when approved), or list issues to fix (when not approved)

## What NOT to Do

- Do not rewrite the plan in this skill.
- Do not add scope or new requirements.
- Do not approve for build when risk is high and no rework is agreed.
- Do not skip the second document review—the plan must be updated with technical review findings before build.
- Do not collapse multiple findings into one response when interactive finding review is active.

## Integration

- **Repo:** Reference stack (Expo, React Native, expo-router) and `app/` layout from AGENTS.md when checking code standards and stack.
