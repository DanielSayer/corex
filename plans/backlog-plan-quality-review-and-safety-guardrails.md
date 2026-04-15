# Backlog: Plan Quality Review and Safety Guardrails

## Audit classification

Recommended new feature not covered by the current plans.

## Source

- The PRD requires strict structured output validation and explicit generation failures.
- Current plans do not define a second-pass quality review beyond schema and availability validation.

## Current evidence

- The weekly planning domain validates structure, week shape, unavailable days, and long-run constraints.
- The model prompt tells the planner to keep recommendations close to recent history.
- There is no dedicated plan-risk score, load-jump guardrail, or human-readable validation report.

## Problem

A generated plan can be schema-valid while still being a poor recommendation: too much weekly volume, too many hard sessions, an aggressive long-run jump, or an unsafe intensity mix for sparse history.

## User value

Users get clearer confidence signals and fewer risky drafts. Failures become explainable when the app rejects a plan that is technically well-formed but unreasonable.

## Scope

- Add deterministic quality checks after schema validation.
- Evaluate weekly distance, duration, long-run share, hard-session count, and progression from recent history.
- Return a quality report with warnings and blocking failures.
- Persist quality report metadata with generation events and weekly plans.
- Show important warnings on the draft view.

## Non-goals

- Medical advice.
- Injury prediction.
- Replacing user judgment.
- A deterministic fallback planner.

## Acceptance criteria

- [ ] Generated plans pass deterministic load and intensity guardrails before persistence.
- [ ] Blocking guardrail failures are recorded as generation failures.
- [ ] Non-blocking warnings are visible on the draft view.
- [ ] Guardrail thresholds account for low-history mode.
- [ ] Tests cover excessive volume, excessive long-run share, too many hard sessions, unavailable days, and acceptable plans.

## Implementation notes

- Build this as a pure domain module so it can be tested heavily.
- Keep thresholds conservative and configurable inside the module until product tuning is needed.
- Use existing history snapshot and performance snapshot data rather than new upstream calls.

