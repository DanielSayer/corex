# Backlog Expected Order

## Purpose

This is the recommended implementation order for the feature-audit backlog files. It prioritizes dependency order, core product completion, and user-visible value.

## Recommended sequence

### 1. Persisted User Timezone and Training Preferences

File: `plans/backlog-persisted-user-timezone-and-preferences.md`

Why first:

- Several existing features currently depend on browser timezone input.
- Scheduled snapshots and automatic renewal need a backend-owned timezone source.
- It stabilizes goal progress, analytics, calendar, planner, and snapshot behavior.

### 2. Planner Draft Editing and Regeneration

File: `plans/backlog-planner-draft-editing-and-regeneration.md`

Why next:

- This completes the mutable draft workflow from the original planner PRD.
- Users need a way to correct generated drafts before any finalization flow is meaningful.
- It keeps plan generation useful even when the model output is close but not perfect.

### 3. Plan Quality Review and Safety Guardrails

File: `plans/backlog-plan-quality-review-and-safety-guardrails.md`

Why here:

- It should land before finalization so unsafe or unreasonable drafts are less likely to become committed plans.
- It strengthens both initial generation and regeneration.
- It gives the UI meaningful warnings to show while drafts are still editable.

### 4. Planner Finalization and Plan History

File: `plans/backlog-planner-finalization-and-plan-history.md`

Why here:

- Editing and guardrails should exist before users commit a plan.
- This completes the draft-to-committed lifecycle described in the PRD.
- It creates a stable historical record for later adherence and review features.

### 5. User-Facing Sync and Generation History

File: `plans/backlog-user-facing-sync-and-generation-history.md`

Why here:

- Sync and generation events already exist, so this is mostly exposing existing operational data.
- It improves debuggability before adding more automated background behavior.
- It helps users understand failures from generation, regeneration, finalization-adjacent workflows, and sync.

### 6. Scheduled Weekly Snapshot Generation

File: `plans/backlog-scheduled-weekly-snapshot-generation.md`

Why here:

- It depends on persisted timezone.
- It turns weekly snapshots from opportunistic UI-generated data into reliable historical artifacts.
- Operational event visibility should exist before adding scheduled jobs.

### 7. Weekly Review History Browser

File: `plans/backlog-weekly-review-history-browser.md`

Why here:

- It becomes more useful once snapshots are generated reliably in the background.
- It builds on the existing latest weekly wrapped experience.
- It does not need to block planner lifecycle completion.

### 8. Plan Adherence Insights

File: `plans/backlog-plan-adherence-insights.md`

Why here:

- It benefits from finalized plan history and existing calendar activity links.
- It gives the next-week planner better feedback about whether prior plans were followed.
- It is a strong bridge from simple planning to adaptive coaching.

### 9. Automatic Weekly Plan Renewal

File: `plans/backlog-automatic-weekly-plan-renewal.md`

Why here:

- It depends on persisted timezone and background job patterns.
- It should use adherence insights once available, otherwise automatic renewal risks blindly continuing a plan that was not followed.
- Keeping it later preserves user control until draft editing, finalization, and observability are solid.

### 10. Route and Terrain Aware Planning

File: `plans/backlog-route-terrain-aware-planning.md`

Why last:

- It is useful, but less central than completing the planner lifecycle.
- It adds new derived-data concepts and should not distract from finishing the existing product promise.
- It can improve planning quality after adherence and renewal are already in place.

## Dependency summary

- Persisted timezone should precede scheduled snapshots and automatic renewal.
- Draft editing should precede finalization.
- Safety guardrails should precede finalization and automatic renewal.
- Finalized plan history should precede adherence insights.
- Adherence insights should precede automatic renewal.
- Scheduled snapshots should precede a deeper weekly review browser.

## Practical delivery groups

### Core completion

1. Persisted timezone and preferences
2. Draft editing and regeneration
3. Plan quality guardrails
4. Finalization and plan history

### Reliability and retrospectives

5. Sync and generation history
6. Scheduled weekly snapshots
7. Weekly review history browser

### Adaptive coaching

8. Plan adherence insights
9. Automatic weekly plan renewal
10. Route and terrain aware planning

