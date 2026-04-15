# Backlog: Weekly Review History Browser

## Audit classification

Planned but incomplete.

## Source

- `plans/goal-tracking-and-weekly-snapshots.md` Phase 6

## Current evidence

- `weeklySnapshots.getLatest` and `weeklySnapshots.getByWeek` exist.
- The weekly wrapped route shows the latest snapshot.
- There is no UI for browsing older weekly snapshots or selecting a week.

## Problem

Weekly wrapped currently behaves like a latest-only retrospective. The persisted snapshot model supports history, but users cannot browse that history.

## User value

Users can revisit prior weeks, compare training blocks over time, and use historical context when deciding whether the current plan is working.

## Scope

- Add a list API for available weekly snapshots with period, timezone, generatedAt, and headline totals.
- Add a weekly review history UI with week selection.
- Load a selected snapshot without recomputing live progress.
- Make empty, missing, and timezone-mismatch states explicit.

## Non-goals

- Cross-week trend analytics beyond simple snapshot navigation.
- Editing historical snapshots.
- Sharing/exporting weekly wrapped.

## Acceptance criteria

- [ ] A user can see a list of available weekly snapshots.
- [ ] A user can open an older weekly wrapped snapshot.
- [ ] Snapshot history reads persisted payloads only.
- [ ] Empty state explains when no snapshots exist.
- [ ] The API is user-scoped and ordered by week descending.
- [ ] Integration tests cover list ordering, ownership, and selected-week retrieval.

## Implementation notes

- `getByWeek` is useful for direct selection, but a list endpoint is needed for navigation.
- Keep latest snapshot behavior as the default landing state.
- Persisted `timezone` should be displayed because the same calendar date can map differently after a timezone change.

