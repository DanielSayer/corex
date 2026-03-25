# Phase 4 Spec: History Review and Planning Readiness

## Goal

Phase 4 is an architecture slice, not a UI slice. Its purpose is to establish a planner-facing local history boundary so phase 5 can consume stable, processed training history without reading sync tables or review-preview models directly.

This phase should introduce a dedicated backend history module that exposes:

- `getPlanningHistorySnapshot(userId)`
- `getHistoryQuality(userId)`

These APIs must use only local persisted data from previous syncs. They must not make live Intervals calls.

## Planner History Snapshot

`getPlanningHistorySnapshot(userId)` should return a strict planner-facing schema, separate from the current dashboard preview contract.

### Snapshot rules

- Anchor the snapshot window to `now`.
- Use at most the most recent 8 weeks of local running history.
- If enough data exists, return:
  - last 4 weeks as detailed individual runs
  - prior 4 weeks as weekly rollups
- If less data exists, return the best available subset.
- If the user is below the "decent data" threshold, still return available runs, but weekly rollups may be absent.

### Detailed run fields

Detailed runs should include:

- start date/time
- distance
- elapsed duration
- moving duration
- elevation gain
- heart-rate zone time breakdown
- any other normalized run fields already required to support these values

Route preview is explicitly not part of the planner snapshot.

Detailed run fields that cannot be derived should still be present as `null` so the object shape stays strict.

### Weekly rollups for weeks 5-8

Weekly rollups should include:

- run count
- total distance
- total duration
- longest run
- cumulative HR zone time
- total elevation gain

Weekly rollup fields should also stay strict-shape with `null` for unavailable values.

## History Quality Contract

`getHistoryQuality(userId)` should return:

- `hasAnyHistory`
- `meetsSnapshotThreshold`
- `hasRecentSync`
- `latestSyncWarnings`
- `availableDateRange`

### Quality rules

- `hasRecentSync` means there is a successful sync within the last 7 days.
- If the latest sync failed but older local history from a previous successful sync exists, history remains usable.
- Old sync data should encourage the user to resync, but must not block planning.
- Incomplete upstream coverage inside the 8-week window does not need explicit detection in v1.

## Threshold Rule

`meetsSnapshotThreshold` is true when either of these is true:

- at least 5 runs exist
- available runs span at least 14 days

This threshold does not block planning. It exists so phase 5 can decide whether to streamline the planning flow and rely more heavily on imported history instead of asking the full extra questionnaire.

### Phase 5 implication

- above threshold: use local history snapshot as the main context path
- below threshold: use available local runs plus extra user questions

## Testing Requirements

Verification should be done through integration tests, not frontend tests.

Required integration coverage:

- snapshot returns last 4 weeks as detailed runs and weeks 5-8 as rollups when sufficient history exists
- snapshot uses only local persisted data
- snapshot still returns usable history when the latest sync failed but an older successful sync exists
- `getHistoryQuality()` reports `hasAnyHistory`, `meetsSnapshotThreshold`, `hasRecentSync`, `latestSyncWarnings`, and `availableDateRange` correctly
- all snapshot and quality results are user-scoped

## Future Notes For Phase 5

These are out of scope for phase 4, but should be recorded as follow-on requirements:

- always ask plan goal
- ask running ability
- ask estimated current race time with selectable distance: `5k`, `10k`, `half marathon`, `marathon`
- use existing availability and goals
- ask preferred long-run day
- ask plan start date
- ask plan duration
- if below history threshold, ask the fuller questionnaire before generation

## Missing Items To Resolve Before Implementation

These still need explicit spec decisions:

- exact planner snapshot schema shape and field names
- exact HR zone model and zone definitions
- how per-run HR zone time is derived from imported streams
- whether elevation gain comes from normalized activity detail only or can be stream-derived
- exact week-boundary definition for rollups
- whether rollups are calendar-week based or trailing 7-day buckets
- whether detailed runs need additional fields like workout label/type, average HR, or pace summaries
- exact `latestSyncWarnings` format: raw strings vs typed codes
- whether `availableDateRange` should reflect all local history or just the 8-week planning window

## Missing Features Needed For Later Implementation

These are not part of phase 4 implementation, but the planner path will eventually need them:

- PR processing from imported distance streams
- interpolation-based benchmark detection from cumulative distance streams
- a separate persisted PR table
- support for all-time PR plus recent 3-month PR history
- tracked benchmark distances:
  - `400m`
  - `1km`
  - `1 mile`
  - `5k`
  - `10k`
  - `half marathon`
  - `marathon`
