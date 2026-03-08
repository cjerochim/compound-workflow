---
date: 2026-03-09
topic: work-stuck-guard
---

# Work Stuck Guard — Auto-Research on Blocked Execution

## What We're Building

A stuck detection guard inside `/workflow:work` that fires when the agent hits either of two signals: it doesn't know how to proceed (unknown territory), or it has attempted an approach and it isn't working (repeated failures). When triggered, the guard automatically launches research sub-agents in parallel to investigate the problem before surfacing options to the user. The user still makes the final decision, but they receive research-backed options rather than options formed from the agent's current (limited) context.

This is a pre-step inside the existing Blocker Protocol—not a replacement. The current Blocker Protocol already pauses execution and produces options, but does so without targeted research. The stuck guard enriches that flow by inserting an autonomous investigation pass between "stuck detected" and "options presented."

## Why This Approach

The existing Blocker Protocol is human-gated: it surfaces 3 options and asks the user to decide before doing any investigation. When the agent is stuck due to genuine unknowns or persistent failures, this means the user receives options that may be poorly informed. The stuck guard fills this gap by doing bounded research first, so the Blocker Protocol output is already grounded in findings when the user sees it.

This fits naturally into the existing Spike Protocol sub-agent pattern (`repo-research-analyst`, `learnings-researcher`, etc.) and avoids introducing new workflow machinery—it's a trigger condition + research pass bolted onto the front of an existing protocol.

## Key Decisions

- **Two stuck triggers:** (1) unknown territory — agent lacks the knowledge to proceed; (2) repeated failures — tried approaches are not working. Both trigger the guard identically.
- **Pre-step inside Blocker Protocol:** The guard fires before the 3-option output, not instead of it. User still gets the Blocker decision prompt; options are now research-backed.
- **Sub-agents run in parallel:** Baseline always runs `repo-research-analyst` + `learnings-researcher`. Contextual additions: `framework-docs-researcher` (library/API unknowns), `best-practices-researcher` (approach/pattern unknowns), `git-history-analyzer` (when touching existing behavior). Selection is contextual, not all-or-nothing.
- **Transparent to user:** When the guard fires, the agent announces "pausing to investigate..." before launching sub-agents. Research findings are summarized visibly before options are presented.
- **Output contract:** Sub-agents return findings; the main agent synthesizes those findings into the Blocker Protocol options format (>=3 options with pros/cons/risks/effort + recommendation). The research is the input, not the output.
- **Single-pass, not recursive:** Research runs once per stuck event. Sub-agents do not themselves trigger further stuck guards. This prevents recursive investigation loops.
- **Timebox:** Research is a single parallel dispatch—sub-agents run to completion and return. No iterative back-and-forth. If sub-agent findings are insufficient, that itself becomes context in the Blocker output.

## Open Questions

- **Attempt threshold:** Should the guard fire immediately on first stuck signal, or after N failed attempts (e.g. 2)? Immediate avoids wasted effort; threshold avoids over-researching trivial hiccups. Non-blocking—can be decided during planning (default: fire on first clear stuck signal, not after N attempts, since "stuck" is already a judgment call by the agent).
- **Sub-agent selection heuristics:** What exact signals map to which contextual sub-agents? This needs concrete trigger rules in the plan (e.g. "error message references an external library → include framework-docs-researcher"). Non-blocking—can be defined during planning.

## Resolved Questions

- **Both triggers:** Unknown territory and repeated failures both fire the guard. ✓
- **Human decision preserved:** User still gets the final Blocker decision prompt. Research just enriches it. ✓
- **Transparency:** Guard fires visibly, not silently. ✓
- **Fits existing protocols:** Enhancement to Blocker Protocol, not a new protocol. ✓

## Next Steps

→ `/workflow:plan` to define the exact trigger conditions, sub-agent selection heuristics, output contract format, and the precise insertion point within `workflow-work.md`
