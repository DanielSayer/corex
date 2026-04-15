# Backlog: User-Facing Sync and Generation History

## Audit classification

Planned but missing.

## Source

- `plans/intervals-weekly-running-planner.md` Phase 8
- `docs/prds/Intervals-Backed Weekly Running Planner Rewrite.md` user stories 31-32
- `docs/rfcs/intervals-sync-deep-module.md`

## Current evidence

- Sync events and generation events are persisted.
- The dashboard exposes only the latest sync summary.
- Generation events are written during weekly planning, but there is no user-facing API or UI for recent generation attempts.
- There is no operational log surface that lets a user compare recent failures, warnings, retries, and successful outcomes.

## Problem

The app records useful operational data, but most of it is invisible. When sync or generation fails, the user cannot inspect recent attempts, see whether failures are repeated, or understand which warning affected which run or draft.

## User value

Users get a clear audit trail for the parts of the app that depend on external providers and AI model output. This reduces confusion and makes support/debugging easier.

## Scope

- Add user-scoped list APIs for sync events and generation events.
- Show recent sync attempts with status, time, imported counts, skipped counts, failed fetch counts, and warning summaries.
- Show recent generation attempts with status, start date, model/provider metadata, failure category, and linked draft when available.
- Add a detail drawer or page for an individual event.
- Keep sensitive values out of responses, especially Intervals credentials and raw model context.

## Non-goals

- Admin-wide support tooling.
- Exposing raw Intervals payloads.
- Exposing full raw model prompts or private user context.
- Alerting/notification workflows.

## Acceptance criteria

- [ ] A user can view recent sync attempts for their account.
- [ ] A user can view recent generation attempts for their account.
- [ ] Each event shows enough context to distinguish provider failures, validation failures, stale history, partial syncs, and user-correctable setup problems.
- [ ] Event data is scoped to the authenticated user.
- [ ] API tests cover event listing, redaction, ordering, and ownership.
- [ ] UI distinguishes latest status from historical events.

## Implementation notes

- Add repository list methods rather than overloading the existing `latest` calls.
- For generation events, consider a response contract that includes `weeklyPlanId`, `startDate`, `status`, `failureCategory`, `failureMessage`, `createdAt`, and no raw model output by default.
- For sync events, expose typed warning and failure summaries before exposing raw diagnostic JSON.

