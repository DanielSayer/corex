# Plan: Goal Tracking and Weekly Snapshots

## Goal

Add meaningful goal tracking to the app without corrupting the current sync model. Live goal progress should be computed from current goals plus imported activity facts. Historical weekly review should be captured through persisted snapshots rather than by storing goal-progress rows during activity ingestion.

This plan intentionally separates:

- **live current-state tracking**
- **historical weekly snapshots**

That separation keeps sync write paths simple, preserves flexibility when goals are edited, and gives the product a stable place to freeze retrospective data for a future "weekly wrapped" experience.

---

## Architectural decisions

Durable decisions that apply across all phases:

- **Live progress model**: Calculate goal progress on read from current goal definitions plus imported activity facts. Do not persist goal-progress rows during activity sync.
- **Snapshot model**: Persist a weekly snapshot as a separate historical artifact. Snapshots freeze a weekly summary and per-goal state for retrospective views.
- **Goal scope**: Keep the existing goal taxonomy for now: `event_goal` and `volume_goal`.
- **Multi-goal support**: Live goal progress must support multiple active goals at once rather than selecting a single active goal.
- **Timezone rule**: Weekly and monthly progress windows must use the user's local timezone rather than UTC boundaries.
- **Event scoring**: Event goals should expose a single readiness score with supporting signals. Finish-time prediction is out of scope for v1.
- **Completed goals**: Completed event goals should still show their final computed progress on goal surfaces.
- **Sync responsibility**: Activity sync continues to persist canonical facts only: imported activities, derived best efforts, and sync metadata.
- **Frontend responsibility**: UI labels and presentation variants should be derived from backend domain contracts rather than shaping the stored schema around current card designs.
- **Testing direction**: Backend behavior should be verified primarily through domain and integration tests. UI work should rely on focused component tests where behavior is non-trivial.

---

## Current state summary

The current codebase already contains a partial goal-progress backend, but it does not yet satisfy the product requirements.

### What already exists

- Goal CRUD supports multiple goals.
- A `goal-progress` service exists and computes:
  - volume goal completion from imported runs
  - event goal readiness from recent training and best efforts
- Imported activity persistence already stores the canonical facts required to compute progress:
  - imported runs
  - derived all-time PRs
  - derived monthly bests
  - sync summaries

### Gaps to close

- The current goal-progress service picks only the first active goal.
- Goal periods are currently UTC-based rather than user-local.
- The dashboard still renders lightweight goal summaries instead of true progress cards.
- Completed event goals are not yet modeled as a first-class computed display state.
- No weekly snapshot schema or generation path exists yet.

---

## Target system shape

The desired end state is two read models built from the same underlying activity facts.

### 1. Live goal progress

This is the source for dashboard cards and active goal tracking.

- returns all active goals
- computes current progress using current goal definitions
- reflects edits immediately
- uses local week/month boundaries
- computes a single readiness score for event goals

### 2. Weekly snapshots

This is the source for historical weekly review and future "wrapped" features.

- generated once per local week
- freezes weekly totals and comparisons
- freezes goal state as it looked that week
- never recomputes based on later goal edits
- powers retrospective UI, not live cards

---

## Shared contract design

These contracts should be treated as the stable design target for the implementation.

### Live goal progress response

```ts
type GoalProgressPeriod = {
  timezone: string;
  periodType: "week" | "month" | "event";
  start: string | null;
  end: string | null;
  label: string;
};

type GoalProgressMetric = {
  currentValue: number | null;
  targetValue: number | null;
  remainingValue: number | null;
  percentComplete: number | null;
  unit: string | null;
};

type EventGoalSignalTone = "positive" | "neutral" | "warning";

type EventGoalSignal = {
  key: "countdown" | "weekly_load" | "long_run" | "best_effort";
  label: string;
  value: string;
  tone: EventGoalSignalTone;
};

type EventGoalReadiness = {
  score: number;
  level: "on_track" | "building" | "needs_attention";
  summary: string;
  signals: EventGoalSignal[];
};

type VolumeGoalProgressCard = {
  goalId: string;
  goalType: "volume_goal";
  status: "active";
  title: string;
  period: GoalProgressPeriod;
  metric: GoalProgressMetric;
  trend: Array<{
    periodStart: string;
    periodEnd: string;
    completedValue: number;
  }>;
  goal: {
    type: "volume_goal";
    metric: "distance" | "time";
    period: "week" | "month";
    targetValue: number;
    unit: "km" | "mi" | "minutes";
    notes?: string | undefined;
  };
};

type EventGoalProgressCard = {
  goalId: string;
  goalType: "event_goal";
  status: "active" | "completed";
  title: string;
  period: GoalProgressPeriod;
  metric: GoalProgressMetric;
  readiness: EventGoalReadiness;
  event: {
    eventDate: string;
    daysRemaining: number;
    targetDistanceMeters: number;
    longestRecentRunMeters: number | null;
    bestMatchingEffortActivityId: string | null;
  };
  goal: {
    type: "event_goal";
    targetDistance: {
      value: number;
      unit: "km" | "mi";
    };
    targetDate: string;
    eventName?: string | undefined;
    targetTimeSeconds?: number | undefined;
    notes?: string | undefined;
  };
};

type GoalProgressCard = VolumeGoalProgressCard | EventGoalProgressCard;

type GoalProgressView = {
  timezone: string;
  sync: {
    hasAnyHistory: boolean;
    hasRecentSync: boolean;
    latestSyncWarnings: string[];
    availableDateRange: {
      start: string | null;
      end: string | null;
    };
    recommendedAction: "none" | "create_goal" | "sync_history";
  };
  activeGoals: GoalProgressCard[];
  completedGoals: EventGoalProgressCard[];
};
```

### Weekly snapshot contract

```ts
type WeeklyWrappedGoalSnapshot = {
  goalId: string;
  goalType: "event_goal" | "volume_goal";
  goalStatus: "active" | "completed";
  title: string;
  currentValue: number | null;
  targetValue: number | null;
  remainingValue: number | null;
  completionRatio: number | null;
  readinessScore: number | null;
  unit: string | null;
  periodLabel: string;
};

type WeeklyWrappedData = {
  shouldShow: boolean;
  generatedAt: string;
  period: {
    weekStart: string;
    weekEnd: string;
    timezone: string;
  } | null;
  totals: {
    distanceMeters: number;
    runCount: number;
    elapsedTimeSeconds: number;
    movingTimeSeconds: number;
    avgPaceSecPerKm: number | null;
  } | null;
  comparisonVsPriorWeek: {
    distanceMetersDelta: number;
    runCountDelta: number;
    avgPaceSecPerKmDelta: number | null;
  } | null;
  goals: WeeklyWrappedGoalSnapshot[];
  highlights: {
    bestDistanceDayMeters: number | null;
    longestRunMeters: number | null;
    fastestRunPaceSecPerKm: number | null;
  } | null;
};
```

### Database schema direction for weekly snapshots

This should likely be implemented as a durable parent row plus JSON payload rather than aggressively normalized child tables in v1.

Suggested shape:

```ts
weeklySnapshot {
  id: text pk
  userId: text fk
  timezone: text
  weekStart: timestamp
  weekEnd: timestamp
  generatedAt: timestamp
  sourceSyncCompletedAt: timestamp | null
  payload: jsonb
  createdAt: timestamp
  updatedAt: timestamp
}
```

Suggested uniqueness rule:

- unique on `(userId, weekStart, weekEnd, timezone)`

Why JSON payload first:

- the wrapped UI is likely to iterate quickly
- snapshot contents are inherently presentation-oriented summaries
- the write frequency is low
- the primary read pattern is full-snapshot retrieval, not relational querying

---

## Phase 1: Multi-Goal Live Progress Backend

### What to build

Refactor the current goal-progress backend from a single-goal read model into a multi-goal read model. Define explicit backend contracts for multi-goal progress cards, return progress for all active goals, and support computed progress for completed event goals where needed by the UI.

### Scope

- replace the single-goal response shape with a multi-goal response shape
- compute progress for every active goal
- separately return completed event goals for display contexts that need them
- keep current sync-state reporting but lift it to the top-level response
- keep the implementation grounded in imported activity tables and derived performance tables

### Suggested implementation slice

- Replace the current `GoalProgressView` contract with:
  - `timezone`
  - `sync`
  - `activeGoals`
  - `completedGoals`
- Refactor the service so goal selection becomes:
  - `activeGoals = all active goals`
  - `completedEventGoals = event goals whose target date has passed`
- Introduce card builders:
  - `buildVolumeGoalProgressCard`
  - `buildEventGoalProgressCard`
- Keep shared sync-state logic at the request level instead of attaching it separately to each card.
- Preserve separation between:
  - goal CRUD models
  - planning-history repositories
  - goal-progress read models

### Backend design notes

- Volume goals should still be blocked by missing/stale history in the same way as today, but that state should be reflected consistently at the response level.
- Event goals should expose a single readiness score in addition to the existing explanatory signals.
- Completed event goals should still be computed using the same logic as active event goals, but their `daysRemaining` will be `0` or negative and their UI label can derive from status.
- If there is no history:
  - active goals should still return enough metadata for the UI to render goal cards
  - the response-level sync action should guide the user to sync history

### Testing focus

- Unit tests:
  - multiple active goals are all included
  - completed event goals are separated correctly
  - readiness score mapping is stable across representative signal combinations
- Integration tests:
  - a user with two active goals gets two progress cards
  - a user with one completed event goal gets it in the completed collection
  - missing-history and stale-history cases still return deterministic contracts

### Acceptance criteria

- [ ] A typed goal-progress schema exists for a multi-goal response shape.
- [ ] The goal-progress service no longer selects only the first active goal.
- [ ] The backend returns progress cards for all active goals.
- [ ] Volume goals return current value, target value, percent complete, remaining value, and local period bounds.
- [ ] Event goals return a single readiness score plus supporting signals.
- [ ] Completed event goals can still be computed and returned for display surfaces that need them.

---

## Phase 2: Local-Time Goal Calculations

### What to build

Replace UTC-based week and month goal windows with user-local time calculations so progress reflects the athlete's actual calendar boundaries. Define the timezone-aware period schema and boundary rules used by both live progress and weekly snapshots.

### Scope

- add user-local week boundary helpers
- add user-local month boundary helpers
- make event date comparisons local-date aware
- ensure all goal-progress period labels and date ranges are derived from the same timezone-aware utilities

### Suggested implementation slice

- Introduce a shared period module with helpers such as:
  - `getLocalWeekRange(now, timezone)`
  - `getLocalMonthRange(now, timezone)`
  - `getLocalDateString(now, timezone)`
- Pass a timezone into the goal-progress service.
- Source the timezone from a stable user-level configuration. If no user timezone is stored yet, define a temporary fallback and record that follow-on work is required.
- Replace direct UTC date slicing inside goal-progress domain logic.

### Open design note

The current schema does not obviously expose a persisted user timezone. That must be resolved explicitly during implementation.

Preferred direction:

- persist a user timezone in a stable settings surface

Fallback direction if needed for an initial slice:

- infer a default server/application timezone and treat user-specific timezone persistence as a follow-up task

The preferred direction is strongly better because weekly boundaries are a user-facing product behavior, not an infrastructure detail.

### Testing focus

- Unit tests:
  - weekly boundaries around Sunday/Monday transitions
  - month boundaries around month rollover
  - event countdown behavior near local midnight
- Integration tests:
  - a run near UTC day rollover lands in the correct local week
  - monthly totals do not drift because of UTC conversion artifacts

### Acceptance criteria

- [ ] A shared timezone-aware period contract exists for weekly and monthly goal windows.
- [ ] Weekly and monthly volume progress uses local timezone boundaries.
- [ ] Event countdown and related date logic is evaluated consistently against the user's local date.
- [ ] Backend tests cover week and month boundary behavior across representative timezone cases.

---

## Phase 3: Dashboard and Goals UI

### What to build

Replace the current lightweight dashboard goal summary with real progress cards. Show one card per active goal and expose completed event goals on the goals page with their final computed state.

### Scope

- swap dashboard data fetching from `goals.get` to `goal-progress.get`
- render one card per active goal
- render computed goal progress rather than simple goal metadata
- show completed event goals on the goals page with their final computed state

### Suggested UI behavior

For volume goals:

- title
- period badge
- current value
- target value
- progress bar
- percent complete
- remaining value

For event goals:

- title
- event date / days remaining or completed state
- readiness score
- readiness level label
- 2 to 4 supporting signals

### Suggested implementation slice

- Keep existing goal CRUD screens intact.
- Add a dedicated progress card component family:
  - `VolumeGoalProgressCard`
  - `EventGoalProgressCard`
- Keep the dashboard focused on active goals.
- Show completed event goals on the goals page, either:
  - by merging computed data into the existing list presentation
  - or by adding a secondary computed-progress section

### Testing focus

- Component tests:
  - volume cards render progress metrics correctly
  - event cards render readiness score and supporting signals
- Integration tests:
  - dashboard shows multiple active goal cards
  - completed event goals still appear on goals surfaces with final state

### Acceptance criteria

- [ ] The dashboard reads from the goal-progress API rather than only the goals list API.
- [ ] Active goals render as card-based progress UI with current vs target, completion, and remaining values.
- [ ] Event goal cards show a readiness score and concise supporting context.
- [ ] The goals page can show completed event goals with computed final progress state.

---

## Phase 4: Weekly Snapshot Schema and Persistence

### What to build

Introduce a persisted weekly snapshot model that freezes the prior local week into a durable summary. Define explicit database and API schemas for weekly wrapped data, and reuse the same core calculation logic used by live goal progress wherever possible.

### Scope

- add database support for weekly snapshots
- define snapshot domain contracts
- define repository interfaces for create/get/list operations
- define generation input/output contracts

### Suggested implementation slice

- Add a `weekly_snapshot` table with:
  - user id
  - timezone
  - week start
  - week end
  - generated at
  - payload JSON
  - optional source sync metadata
- Add a snapshot repository with:
  - `findByUserAndWeek`
  - `upsertForUserAndWeek`
  - `getLatestForUser`
- Add a snapshot domain module responsible for:
  - totals calculation
  - prior-week comparison calculation
  - highlights calculation
  - per-goal frozen snapshot mapping

### Schema notes

- Use UUID/text identifiers consistently with the existing goal model.
- Keep `payload` as the primary output contract to avoid premature table over-normalization.
- Keep snapshot goal entries domain-oriented:
  - `goalType: event_goal | volume_goal`
  - not UI-specific values like `distance | pace`

### Testing focus

- Unit tests:
  - weekly totals and delta calculations
  - highlight selection logic
  - per-goal snapshot mapping
- Integration tests:
  - snapshot persistence and uniqueness
  - latest snapshot retrieval

### Acceptance criteria

- [ ] A database schema exists for persisted weekly snapshots.
- [ ] A typed weekly snapshot contract exists for backend and frontend consumers.
- [ ] A weekly snapshot schema exists for totals, week-over-week deltas, highlights, and per-goal snapshot state.
- [ ] Snapshot records are user-scoped and tied to a local week range plus timezone.
- [ ] Snapshot goal entries store domain-safe identifiers and values rather than UI-only labels.
- [ ] Snapshot generation reuses shared live-progress calculation logic instead of duplicating business rules.

---

## Phase 5: Weekly Snapshot Generation

### What to build

Generate a weekly snapshot for the prior local week on a fixed weekly schedule. Freeze the summary for retrospective and "weekly wrapped" style experiences.

### Scope

- compute snapshot inputs from local imported activity facts only
- lock the prior local Monday-to-Monday week
- compute prior-week comparisons
- freeze goal state for that week
- make generation idempotent

### Suggested generation rules

- schedule runs Monday morning in the user's local timezone
- snapshot period is:
  - Monday 00:00 local time
  - to next Monday 00:00 local time
- comparisons should use the immediately preceding local week
- generation should be idempotent for the same user/week combination
- snapshot generation should not call live upstream providers

### Suggested implementation slice

- Add a generation service:
  - `generateWeeklySnapshotForUser(userId, weekStart, timezone)`
- Build snapshot facts from:
  - imported activities in the target week
  - imported activities in the comparison week
  - current goal definitions evaluated for snapshot output
- Store the completed payload through the snapshot repository.

### Important product note

Snapshots are historical artifacts. They should freeze the weekly interpretation at generation time. If a user edits a goal later, the historical snapshot must not change.

### Testing focus

- Integration tests:
  - snapshot generation uses only local persisted data
  - repeated generation for the same week updates or no-ops deterministically
  - prior-week comparisons are correct
  - goal entries are frozen into the stored snapshot payload

### Acceptance criteria

- [ ] Snapshot generation targets the prior local Monday-to-Monday week.
- [ ] Snapshot generation stores totals, comparisons vs prior week, highlights, and per-goal frozen progress/readiness.
- [ ] Snapshot generation is idempotent for a given user and week.
- [ ] Integration tests verify snapshot generation from local persisted activity facts only.

---

## Phase 6: Weekly Wrapped Experience

### What to build

Add a weekly review surface that presents the persisted snapshot as a compact retrospective experience, separate from live progress cards.

### Scope

- retrieve latest or selected weekly snapshot
- render totals, deltas, highlights, and per-goal summaries
- clearly separate retrospective views from live goal tracking

### Suggested implementation slice

- Add a `weeklySnapshots` API surface for:
  - `getLatest`
  - `getByWeek`
- Build a wrapped UI that:
  - reads only persisted snapshot payloads
  - does not recompute live data in the view layer
- Keep the wrapped experience intentionally distinct from live goal cards so users can tell whether they are looking at:
  - current live state
  - frozen prior-week state

### Testing focus

- Component tests:
  - wrapped totals and delta rendering
  - per-goal frozen snapshot rendering
- Integration tests:
  - latest snapshot retrieval
  - missing snapshot empty state

### Acceptance criteria

- [ ] A user can view their latest weekly snapshot when one exists.
- [ ] The wrapped experience uses persisted snapshot data rather than recomputing live state.
- [ ] The UI clearly distinguishes weekly retrospective data from live current-goal progress.

---

## Recommended implementation order

The most practical delivery order is:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6

Why:

- phases 1 to 3 unlock immediate user value with the least schema risk
- phases 4 to 6 depend on stable live-progress rules and period logic
- snapshot generation should reuse the already-proven goal-progress calculations rather than inventing them separately

---

## Risks and open questions

These should be resolved explicitly during implementation rather than left implicit.

### User timezone persistence

The plan assumes a per-user timezone is available. If the app does not yet persist this, implementation must add a stable timezone source before local-time tracking can be considered correct.

### Event readiness score calibration

The plan calls for a single readiness score, but the weightings still need to be codified. The implementation should keep the score explainable by preserving the underlying signals.

### Completed recurring goals

The current product decision only requires completed event goals. Recurring volume goals remain active unless future product work introduces manual archive/completion behavior.

### Snapshot scheduling mechanism

This plan assumes the app will gain a weekly generation trigger. The exact scheduling mechanism is not specified here and can be implemented separately as long as it generates the prior local week deterministically.

### Historical goal identity

Snapshots should store the goal id and frozen title/values in payload so historical views remain stable even if goal metadata changes later.

---

## Non-goals for this plan

The following items are intentionally out of scope:

- target-time prediction for event goals
- new goal types such as frequency goals
- social/sharing features for weekly wrapped
- storing per-activity goal-progress rows at sync time
- rebuilding sync ingestion around snapshot generation
