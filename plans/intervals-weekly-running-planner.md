# Plan: Intervals-Backed Weekly Running Planner Rewrite

> Source PRD: Intervals-Backed Weekly Running Planner Rewrite

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: Authenticated onboarding/settings flow for goal, availability, and Intervals API key; authenticated dashboard flow for sync, history review, weekly planning, draft editing, finalization, and plan history.
- **Schema**: User training settings, encrypted Intervals credential storage, imported running activities, sync events, weekly plan drafts/finalized plans, and generation events.
- **Key models**: `TrainingSettings`, `ImportedActivity`, `WeeklyPlan`, `WeeklySession`, `IntervalBlock`, `SyncEvent`, and `GenerationEvent`.
- **Authentication**: Better Auth session-based authentication with per-user ownership checks on all training data.
- **Third-party boundaries**: Intervals client behind an internal sync adapter; AI SDK model access behind an internal planning adapter.
- **Technology direction**: Keep Hono, tRPC, Drizzle, and the current monorepo shape. Introduce Effect in backend and domain layers first. Keep the frontend conventional in v1.
- **Product scope**: Single self-coaching athlete, running only, Intervals as a read-only activity source, manual sync only, one-week draft planning, explicit finalization, no deterministic fallback when generation fails.

---

## Phase 1: Foundation and Test Harness

**User stories**: 33, 34, 35, 36, 37, 38, 40

### What to build

Establish the rewrite foundation so later slices can be added without re-deciding the architecture. Introduce Effect-oriented backend service boundaries, shared domain schemas for settings, imported activities, and weekly plans, database support for training data, and a test harness that supports TDD across unit, integration, and end-to-end layers.

### Acceptance criteria

- [ ] The project has an agreed testing setup that can run unit, integration, and critical end-to-end tests.
- [ ] Core domain contracts exist for settings, imported activities, weekly plans, sessions, interval blocks, sync events, and generation events.
- [ ] Database support exists for user training settings, imported activities, plan storage, and operational events.
- [ ] Backend architecture has stable internal boundaries for sync, planning, plan lifecycle, and observability.

---

## Phase 2: Onboarding and Secure Settings

**User stories**: 1, 2, 3, 4, 5, 6

### What to build

Deliver the first user-facing vertical slice: a signed-in user can complete onboarding by entering a goal, weekly availability, and an Intervals API key. The app validates and persists settings end to end, and stores the Intervals key encrypted at rest for later sync operations.

### Acceptance criteria

- [ ] A signed-in user can view and update their training goal and weekly availability.
- [ ] A signed-in user can enter an Intervals API key and have it stored securely.
- [ ] Settings are persisted per user and returned correctly on subsequent sessions.
- [ ] Invalid settings input is rejected with clear user-facing validation.

---

## Phase 3: Manual Intervals Sync

**User stories**: 7, 8, 9, 10, 11, 12, 13, 14, 31, 34, 38

### What to build

Add the first external integration slice. A user can manually trigger sync, the backend decrypts the stored Intervals API key, imports recent running activities, normalizes and stores them locally, records the sync attempt, and returns a summary showing what was imported and the latest sync state.

### Acceptance criteria

- [ ] A signed-in user can manually trigger an Intervals sync from the app.
- [ ] The first sync imports approximately the last month of running activities.
- [ ] Subsequent syncs import only activities since the last successful sync.
- [ ] Imported activities are normalized into the app's internal running activity model and stored locally.
- [ ] The user sees a sync summary including imported count, covered date range, and any notable partial-history limitations.
- [ ] Sync success and failure attempts are recorded per user.

---

## Phase 4: History Review and Planning Readiness

**User stories**: 11, 12, 13, 14, 40

### What to build

Make imported history visible and trustworthy before planning begins. The user can review recent imported activity history and understand whether the available data is sufficient or partial, giving the planner a clear local source of truth and reducing ambiguity before generation.

### Acceptance criteria

- [ ] A user can view their recent imported running history in the app.
- [ ] The app distinguishes between having usable recent history and having insufficient or partial history.
- [ ] The history view is based on normalized local data rather than live reads from Intervals.
- [ ] The planning flow can rely on this local history model as its source input.

---

## Phase 5: Weekly Draft Generation

**User stories**: 15, 16, 17, 18, 19, 20, 21, 22, 23, 35, 36, 37, 38

### What to build

Deliver the core product value: generate a one-week running plan draft from recent history, goal, and availability. The planner uses the AI SDK behind an internal adapter, requires strict structured output, validates the result against the weekly plan schema, persists the draft, and renders it as structured sessions with typed interval blocks.

### Acceptance criteria

- [ ] A user with valid settings and synced history can request a weekly draft plan.
- [ ] Generation uses local imported history plus stored user settings as input.
- [ ] The generated plan is a structured weekly draft composed of sessions and interval blocks, not prose only.
- [ ] Invalid or malformed model output is rejected rather than silently coerced.
- [ ] Generation failures are surfaced as retryable user-facing errors.
- [ ] Successful generation creates a persisted draft week tied to the user.

---

## Phase 6: Draft Editing and Regeneration

**User stories**: 24, 25, 26, 27, 28, 39

### What to build

Complete the mutable draft workflow. A user can review the generated week, edit draft sessions, and regenerate the entire week using the latest constraints. Regeneration replaces the current draft rather than merging unpredictably, and the week remains mutable until explicitly finalized.

### Acceptance criteria

- [ ] A user can manually edit draft session details before finalization.
- [ ] A user can regenerate the entire draft week from current inputs.
- [ ] Regeneration replaces the existing draft week rather than partially merging with it.
- [ ] The plan remains in draft state after edits and regeneration until the user explicitly finalizes it.

---

## Phase 7: Finalization and Plan History

**User stories**: 29, 30, 39, 40

### What to build

Separate mutable planning from committed plans. A user can explicitly finalize the active draft week and later review previously finalized plans, establishing a stable saved training record without losing the distinction between draft and committed states.

### Acceptance criteria

- [ ] A user can explicitly finalize the current draft week.
- [ ] Finalized weeks are persisted as stable saved plans.
- [ ] A user can view previously finalized weekly plans.
- [ ] Finalization respects per-user ownership and valid draft-to-finalized state transitions.

---

## Phase 8: Operational Visibility and Hardening

**User stories**: 31, 32, 38, 39

### What to build

Harden the critical path and make failures diagnosable. Expose basic user-scoped sync and generation logs, tighten failure handling across upstream sync and plan generation, and ensure the core journey is protected by reliable automated coverage.

### Acceptance criteria

- [ ] A user can view recent sync and generation outcomes relevant to their account.
- [ ] Sync and generation failures expose enough context to diagnose expected operational issues.
- [ ] Critical product paths are covered by automated tests across domain, integration, and end-to-end layers.
- [ ] The app can be demonstrated end to end from signup through sync, draft generation, editing/regeneration, and finalization.
