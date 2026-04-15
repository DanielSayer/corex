# Backlog: Planner Draft Editing and Regeneration

## Audit classification

Planned but missing.

## Source

- `plans/intervals-weekly-running-planner.md` Phase 6
- `docs/prds/Intervals-Backed Weekly Running Planner Rewrite.md` user stories 24-28
- `docs/training-plan-feature.md` current missing pieces

## Current evidence

- `weeklyPlanning.generateDraft` and `weeklyPlanning.generateNextWeek` exist.
- Drafts are rendered read-only in `PlannerDraftView`.
- The UI copy says editing and regeneration are out of scope until Phase 6.
- No API procedures exist for editing a draft session or regenerating a specific existing draft in place.

## Problem

The planner can create draft weeks, but the user cannot correct a single session, move work around real-life constraints, or regenerate the existing draft after changing inputs. That makes the draft lifecycle brittle: a generated week is either accepted as-is or effectively stuck.

## User value

Users can treat the generated week as a coach-like starting point rather than a locked recommendation. This preserves control while keeping the structured plan model intact.

## Scope

- Add a draft update API for changing session title, summary, notes, duration, distance, and interval blocks.
- Add a draft day move/swap flow that preserves the seven-day plan window.
- Add a regenerate-current-draft API that replaces the selected draft payload using the latest settings, history, and planner inputs.
- Record regeneration attempts in generation events.
- Keep regenerated drafts in `draft` status.
- Keep per-user ownership checks at the service and repository boundaries.

## Non-goals

- Per-session AI regeneration.
- Finalizing plans.
- Editing already finalized plans.
- Multi-week program editing.

## Acceptance criteria

- [ ] A user can edit an existing draft session without creating a new weekly plan row.
- [ ] A user can move a planned session to another available day in the same week.
- [ ] A user can regenerate a specific draft week in place.
- [ ] Regeneration replaces the selected draft payload predictably rather than merging individual sessions.
- [ ] Generation events distinguish initial generation, renewal generation, and in-place regeneration.
- [ ] Invalid edits are rejected with contract-level errors.
- [ ] Integration tests cover ownership, edit persistence, unavailable-day rejection, and regeneration replacement.

## Implementation notes

- Extend the weekly planning repository with `getDraftById`, `updateDraftPayload`, and possibly `updateDraftGenerationContext`.
- Keep the existing `weeklyPlanPayloadSchema` as the validation boundary.
- Consider a dedicated `draftRevision` value or generation event metadata if edit history becomes useful, but do not add a full revision table unless there is a concrete UI need.

