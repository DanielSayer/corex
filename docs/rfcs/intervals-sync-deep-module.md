# RFC: Deepen the Intervals Sync Module

## Problem

The current Intervals sync flow is one use case split across several shallow modules: [service.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/service.ts), [repository.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/repository.ts), [router.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/router.ts), [account.ts](/Users/danie/Projects/corex/packages/api/src/intervals/account.ts), and [derived-performance-service.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/derived-performance-service.ts).

Architectural friction:

- The real behavior is "sync this user's Intervals data now," but the implementation is spread across account loading and decryption, athlete resolution, sync-window policy, upstream fetch choreography, persistence, failure finalization, and derived-performance recomputation.
- Understanding a single sync outcome requires bouncing between service helpers, repository contracts, adapter behavior, and router error mapping.
- The existing tests in [service.test.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/service.test.ts) mostly verify coordination and bookkeeping across seams rather than one stable boundary.

Integration risk in the seams:

- Partial-success behavior is hard to reason about because it is assembled from many small branches.
- Persistence and external-failure handling are intertwined, but not owned by a single boundary.
- Derived-performance recomputation is operationally coupled to activity import, but exposed as a separate collaborator rather than hidden inside a deeper module.

Why this makes the codebase harder to navigate:

- The interface is almost as complex as the implementation.
- Tests are forced toward injected seams instead of user-visible behavior.
- Future changes to sync policy or diagnostics will likely add more coordination code rather than simplify the boundary.

## Proposed Interface

Create a deep application-facing module for Intervals sync with a small public API and explicit ports behind it.

```ts
type IntervalsSyncApi = {
  syncNow(userId: string): Effect.Effect<SyncSummary, IntervalsSyncError>;
  latest(
    userId: string,
  ): Effect.Effect<SyncSummary | null, SyncPersistenceFailure>;
  recentActivities(
    userId: string,
  ): Effect.Effect<RecentActivityPreview[], SyncPersistenceFailure>;
};

type IntervalsAccountPort = {
  load(userId: string): Effect.Effect<
    { username: string; apiKey: string; athleteId: string | null },
    MissingIntervalsCredentials | SyncPersistenceFailure
  >;
  saveResolvedAthlete(
    userId: string,
    input: { athleteId: string; resolvedAt: Date },
  ): Effect.Effect<void, SyncPersistenceFailure>;
};

type IntervalsUpstreamPort = {
  getProfile(...): Effect.Effect<IntervalsAthleteProfile, ...>;
  listActivities(...): Effect.Effect<IntervalsActivityDiscovery[], ...>;
  getDetail(...): Effect.Effect<IntervalsActivityDetail, ...>;
  getMap(...): Effect.Effect<IntervalsActivityMap | null, ...>;
  getStreams(...): Effect.Effect<IntervalsActivityStream[], ...>;
};

type SyncLedgerPort = {
  hasInProgress(
    userId: string,
  ): Effect.Effect<boolean, SyncPersistenceFailure>;
  begin(
    userId: string,
    event: { eventId: string; startedAt: Date },
  ): Effect.Effect<void, SyncPersistenceFailure>;
  latest(
    userId: string,
  ): Effect.Effect<SyncSummary | null, SyncPersistenceFailure>;
  latestSuccessfulCursor(
    userId: string,
  ): Effect.Effect<Date | null, SyncPersistenceFailure>;
  completeSuccess(
    input: FinalizeSuccessInput,
  ): Effect.Effect<SyncSummary, SyncPersistenceFailure>;
  completeFailure(
    input: FinalizeFailureInput,
  ): Effect.Effect<SyncSummary, SyncPersistenceFailure>;
};

type ImportedActivityPort = {
  upsert(
    record: UpsertImportedActivityRecord,
  ): Effect.Effect<"inserted" | "updated", SyncPersistenceFailure>;
  recentActivities(
    userId: string,
  ): Effect.Effect<RecentActivityPreview[], SyncPersistenceFailure>;
};

type DerivedPerformancePort = {
  recompute(
    input: ImportedRunForDerivedPerformance,
  ): Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure>;
};

function createIntervalsSyncModule(deps: {
  accounts: IntervalsAccountPort;
  upstream: IntervalsUpstreamPort;
  ledger: SyncLedgerPort;
  activities: ImportedActivityPort;
  derived: DerivedPerformancePort;
  clock?: { now(): Date };
  idGenerator?: () => string;
  policy?: {
    initialWindowDays?: number;
    overlapHours?: number;
    detailConcurrency?: number;
    requestedStreamTypes?: readonly string[];
  };
}): IntervalsSyncApi;
```

Usage:

```ts
const summary = yield* intervalsSync.syncNow(ctx.session.user.id);
const latest = yield* intervalsSync.latest(ctx.session.user.id);
const recent = yield* intervalsSync.recentActivities(ctx.session.user.id);
```

What this hides internally:

- Credential loading and decryption
- Athlete identity resolution
- Initial vs incremental sync-window selection
- Discovery, detail, map, and stream fetch choreography
- Partial-failure accounting and diagnostics
- Imported-activity upserts
- Derived-performance recomputation
- Sync event begin and finalize lifecycle

## Dependency Strategy

- `IntervalsUpstreamPort`: `True external (Mock)`
  - Production: HTTP adapter over Intervals
  - Tests: fake adapter with canned payloads and failures

- `IntervalsAccountPort`, `SyncLedgerPort`, `ImportedActivityPort`, `DerivedPerformancePort`: `Local-substitutable`
  - Production: Drizzle-backed adapters and current crypto-backed account loading
  - Tests: in-memory adapters or fakes

- Core orchestration module: `In-process`
  - The new deep module owns the workflow and becomes the main test boundary.

## Testing Strategy

New boundary tests to write:

- `syncNow` returns a success summary for a user with valid credentials and importable running activities
- `syncNow` fails with `SyncAlreadyInProgress` when a sync is already running
- `syncNow` resolves athlete identity on first sync and persists it
- `syncNow` tolerates map failures or missing optional map data while still importing activities
- `syncNow` records stream and detail failures as partial failures and finalizes a successful sync summary when appropriate
- `syncNow` returns missing and invalid credential failures distinctly
- `latest` returns the latest sync summary unchanged
- `recentActivities` returns recent imported activity previews unchanged

Old tests to delete or shrink:

- Coordination-heavy cases in [service.test.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/service.test.ts) that only exist to verify collaboration among shallow modules
- Router tests that mainly assert user-id pass-through and error translation for sync internals once boundary coverage exists

Test environment needs:

- Fake `IntervalsUpstreamPort`
- In-memory `SyncLedgerPort`
- In-memory `ImportedActivityPort`
- Spy or fake `DerivedPerformancePort`
- Fake `IntervalsAccountPort`
- Deterministic clock and id generator

This aligns with the repo's backend testing architecture in [testing.md](/Users/danie/Projects/corex/docs/testing.md): boundary-heavy backend tests, narrow transport coverage, and Bun-driven test execution.

## Implementation Recommendations

- The new module should own the full sync use case, not just wrap the existing service.
- Keep the public interface small: `syncNow`, `latest`, `recentActivities`.
- Split persistence by concept behind ports:
  - sync ledger and event lifecycle
  - imported activity storage
  - derived-performance writes
- Keep policy and config internal by default; do not expose backfill or dry-run controls yet unless a real caller appears.
- Move router code toward thin transport adapters that call the deep module directly.
- Prefer testing the module boundary over helper functions or collaborator call counts.
- Keep current `SyncSummary` as the main observable output so callers and UI behavior stay stable during migration.

## Migration Outline

1. Introduce `createIntervalsSyncModule` alongside the current service.
2. Extract adapter-backed ports from the current account, repository, and derived-performance modules.
3. Re-point [router.ts](/Users/danie/Projects/corex/packages/api/src/intervals-sync/router.ts) to the new module API.
4. Add boundary tests for the new module using fakes and deterministic clocks.
5. Delete or shrink shallow coordination tests that become redundant.
6. Remove the old orchestration service once callers and tests have migrated.
