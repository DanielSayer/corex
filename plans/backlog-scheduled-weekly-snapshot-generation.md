# Backlog: Scheduled Weekly Snapshot Generation

## Audit classification

Planned but incomplete.

## Source

- `plans/goal-tracking-and-weekly-snapshots.md` Phase 5
- `docs/training-plan-feature.md`

## Current evidence

- Weekly snapshot schema, repository, service, and wrapped UI exist.
- The UI calls `ensureLatest` when the weekly wrapped page loads.
- There is no scheduled backend generation mechanism.
- Persisted user timezone is not available yet, which blocks reliable server-side local scheduling.

## Problem

Weekly snapshots are durable once created, but they are generated opportunistically from the UI. A user who never opens the wrapped page may not get a frozen snapshot at the intended Monday-morning point.

## User value

Weekly reviews become reliable historical artifacts instead of on-demand summaries. The app can preserve what the week looked like at the correct time.

## Scope

- Add a backend scheduled job or worker entry point that generates prior-week snapshots for eligible users.
- Run after each user's local Monday boundary.
- Make generation idempotent for `(userId, weekStart, weekEnd, timezone)`.
- Record job outcome metrics or events.
- Keep `ensureLatest` as a manual/on-demand fallback, not the primary generation path.

## Non-goals

- Push notifications.
- Social sharing.
- Recomputing all historical snapshots.
- Generating snapshots for users without enough setup/history unless the product explicitly wants empty snapshots.

## Acceptance criteria

- [ ] A backend job can generate the prior local-week snapshot without a web request.
- [ ] Re-running the job for the same user/week is deterministic and idempotent.
- [ ] Job logic uses persisted user timezone.
- [ ] Snapshot generation uses only local persisted activity and goal data.
- [ ] Integration tests cover idempotency, local week boundaries, and no-live-upstream behavior.
- [ ] Failures are logged in a supportable way without exposing private payloads.

## Implementation notes

- This likely depends on `backlog-persisted-user-timezone-and-preferences.md`.
- A simple command-style entry point is enough before introducing a full job queue.
- Consider processing users in batches so the design does not assume one global timezone.

