# Backlog: Automatic Weekly Plan Renewal

## Audit classification

Planned-adjacent missing feature.

## Source

- `docs/training-plan-feature.md` lists automatic background weekly renewal as not yet part of the current experience.
- Existing code supports manual next-week generation through `weeklyPlanning.generateNextWeek`.

## Current evidence

- The planner can generate the next chronological week from the latest stored plan.
- Renewal is plan-led and uses the previous plan's intent.
- There is no background or scheduled renewal path.
- There is no user preference for opting into automatic renewal.

## Problem

Renewal exists as an explicit action, but users must remember to trigger it. The app cannot maintain a rolling upcoming week automatically.

## User value

Users who want a low-friction coaching assistant can always have the next draft ready for review, while still keeping control because generated weeks remain drafts.

## Scope

- Add a user preference for automatic weekly draft renewal.
- Add a renewal job that calls the existing next-week generation path when a user is eligible.
- Define eligibility rules: completed settings, local history exists, no draft already exists for the next week, and latest plan window has ended or is close to ending.
- Record generation events with mode `renewal`.
- Notify or surface the new draft in the planner/dashboard.

## Non-goals

- Automatically finalizing generated drafts.
- Multi-week committed training blocks.
- Renewing plans for users who have opted out.
- Generating multiple future weeks at once.

## Acceptance criteria

- [ ] A user can opt in or out of automatic weekly renewal.
- [ ] The system can generate the next chronological draft without a browser request.
- [ ] Renewal does not create duplicate drafts for the same start date.
- [ ] Renewal preserves prior plan intent unless current settings make that impossible.
- [ ] Generation events identify automatic renewal attempts.
- [ ] Integration tests cover eligibility, duplicates, missing settings, and failure recording.

## Implementation notes

- This likely depends on persisted timezone and a background job entry point.
- Reuse `generateNextWeek` rather than introducing a separate planner path.
- Keep the generated week as a draft so the user remains in control.

