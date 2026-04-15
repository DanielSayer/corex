# Backlog: Planner Finalization and Plan History

## Audit classification

Planned but missing.

## Source

- `plans/intervals-weekly-running-planner.md` Phase 7
- `docs/prds/Intervals-Backed Weekly Running Planner Rewrite.md` user stories 28-30 and 39
- `docs/training-plan-feature.md` current missing pieces

## Current evidence

- The database enum already supports `weekly_plan.status = draft | finalized`.
- The repository can load plans by date/range and prefers drafts when multiple plans overlap.
- No service or router method finalizes a draft.
- No UI route or component lists finalized plan history.

## Problem

The app has a durable draft model, but no committed plan lifecycle. Users can continue generating weekly drafts, yet they cannot mark a week as the version they intended to follow or browse the history of committed weeks.

## User value

Finalization gives the user a stable training record and a clearer difference between "what Corex suggested" and "what I committed to."

## Scope

- Add a finalize-draft use case that transitions one owned draft to `finalized`.
- Define conflict rules for overlapping finalized weeks.
- Add a finalized plan history API with pagination or date-range filtering.
- Add a UI surface for current finalized plan and historical finalized weeks.
- Update training calendar behavior so finalized plans are visible and draft precedence remains intentional.
- Add lifecycle tests for valid and invalid status transitions.

## Non-goals

- Editing finalized plans.
- Exporting finalized plans to Intervals.
- Multi-week program phases.
- Archiving or deleting historical plans.

## Acceptance criteria

- [ ] A user can finalize an owned draft week.
- [ ] Finalization changes the stored status from `draft` to `finalized`.
- [ ] A finalized plan remains visible after newer drafts are generated.
- [ ] A user can browse finalized weekly plans.
- [ ] A user cannot finalize another user's draft.
- [ ] Conflicting finalized weeks are rejected or resolved by an explicit documented rule.
- [ ] Integration tests cover draft-to-finalized transitions, ownership, conflicts, and history reads.

## Implementation notes

- Add repository methods such as `finalizeDraft`, `listFinalizedPlans`, and `getPlanById`.
- Decide whether multiple draft rows may exist for the same finalized week after finalization.
- Keep calendar selection deterministic when both draft and finalized plans overlap the same date.

