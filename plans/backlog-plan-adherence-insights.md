# Backlog: Plan Adherence Insights

## Audit classification

Recommended new feature not covered by the current plans.

## Source

- Current implementation has training calendar plan/activity links.
- Existing plans cover generation, calendar comparison, goal progress, and weekly snapshots, but not adherence scoring or coach feedback from completed-vs-planned data.

## Current evidence

- `weekly_plan_activity_link` records a completed activity against a planned date.
- The training calendar can show planned sessions alongside completed activities and create links.
- Weekly snapshots summarize activity and goals, but not planned-vs-completed adherence.

## Problem

Corex can compare planned sessions and activities visually, but it does not yet turn that comparison into product feedback. The planner cannot learn whether the previous draft was followed, missed, overloaded, or too easy.

## User value

Users can understand whether they are following the plan closely enough and why the next week should progress, hold steady, or back off.

## Scope

- Add a plan adherence read model over weekly plans, linked activities, and imported activity facts.
- Compare planned and completed distance, duration, session type, and date.
- Classify sessions as completed, missed, moved, partial, or unplanned extra.
- Summarize weekly adherence for dashboard, calendar, weekly wrapped, and planner renewal context.
- Feed adherence summary into next-week planning context.

## Non-goals

- Penalizing users with a single opaque score as the only output.
- Automatic plan edits.
- Direct wearable integration beyond imported Intervals facts.

## Acceptance criteria

- [ ] The backend can summarize adherence for a weekly plan.
- [ ] Linked activity facts are compared against planned session targets.
- [ ] The calendar or dashboard shows clear planned-vs-completed status.
- [ ] The next-week planner context includes the prior week's adherence summary.
- [ ] Extra unplanned runs are represented without requiring a planned-session link.
- [ ] Integration tests cover completed, missed, moved, partial, and extra-session cases.

## Implementation notes

- Start with deterministic rules before adding any model-generated coaching text.
- Keep adherence separate from goal progress: adherence is "did the plan happen," while goal progress is "is the goal advancing."
- This can eventually improve weekly wrapped by adding a "plan followed" retrospective section.

