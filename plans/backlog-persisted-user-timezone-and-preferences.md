# Backlog: Persisted User Timezone and Training Preferences

## Audit classification

Planned but incomplete.

## Source

- `plans/goal-tracking-and-weekly-snapshots.md` Phase 2 open design note and risks
- `docs/interval-icu-api/athlete-profile.md`

## Current evidence

- Goal progress, analytics, training calendar, and weekly snapshots accept a timezone input.
- The frontend currently sends `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- The database does not persist a user timezone or broader training preferences.
- Intervals athlete profiles can include `timezone`, `locale`, and measurement preference data.

## Problem

Local-time behavior is implemented, but the source of truth is still the current browser. That is fragile for travel, multiple devices, server-side jobs, and scheduled snapshot generation.

## User value

Users get stable weekly/monthly boundaries, consistent snapshots, and predictable plan timing regardless of device or browser settings.

## Scope

- Add a persisted user preferences/settings table or extend the existing training settings surface.
- Store timezone as an IANA timezone string.
- Optionally store preferred distance unit and locale when the schema is introduced.
- Populate a first default from the browser and/or Intervals athlete profile.
- Let users update timezone from settings.
- Route goal progress, analytics, calendar, planner defaults, and snapshot generation through the persisted timezone where appropriate.

## Non-goals

- Full internationalization.
- Multi-timezone training weeks.
- Rewriting historical snapshots when timezone changes.

## Acceptance criteria

- [ ] A user has one persisted timezone used by backend training calculations.
- [ ] The app validates timezone values before persistence.
- [ ] Browser timezone becomes a default suggestion, not the durable source of truth.
- [ ] Scheduled or server-triggered jobs can generate local-week data without a browser request.
- [ ] Existing timezone-aware tests are extended to cover persisted timezone loading.
- [ ] The UI makes the active timezone visible on settings or account surfaces.

## Implementation notes

- The existing `goal-progress/timezones.ts` helpers can remain the shared calculation layer.
- Avoid storing timezone only in weekly snapshot payloads; the value needs to be user-level configuration.
- Decide whether Intervals profile timezone should auto-fill only on first sync or update automatically when upstream changes.

