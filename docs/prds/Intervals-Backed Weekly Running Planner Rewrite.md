# PRD: Intervals-Backed Weekly Running Planner Rewrite

## Problem Statement

I want to build a training app that uses Intervals.icu as the source of imported activity history so I do not need direct integrations with each watch platform. I already have a prototype, but I want to rewrite the app around Effect TS and develop it using a strict TDD workflow.

The current repo is mostly application scaffolding. It has authentication, a web frontend, a Hono server, tRPC, and Drizzle/Postgres, but it does not yet contain a training domain, an Intervals integration, a planning engine, or Effect-based backend modules. The problem is not adding one missing feature to an existing product. The problem is defining and building the first real version of the product on a sound architecture.

For v1, the app needs to solve a specific job better than Intervals itself: help a self-coaching runner generate and manage a useful upcoming training week based on recent imported history, an explicit goal, and weekly availability. The app should behave like a coach-like assistant rather than a fully autonomous authority, but it should still be capable of producing a complete weekly draft plan.

## Solution

Build a running-only, single-athlete training planner that keeps the current stack shape while introducing Effect TS into the backend and domain layers. The app will let a user sign up, enter a goal, weekly availability, and an Intervals API key, manually sync recent running history from Intervals, and then generate a structured draft training week using an LLM through the AI SDK.

The generated week will be machine-readable, composed of typed workouts and interval blocks rather than free-form prose. The user can review, edit, or regenerate the entire draft week. The week is only persisted as finalized when the user explicitly confirms it. Intervals acts only as a read-only history source in v1. The app stores the Intervals API key encrypted at rest and uses it only during manual sync operations.

The rewrite should favor a small number of deep backend modules with stable interfaces. The most important deep modules are training settings, Intervals sync, recent-history summarization, weekly plan generation, plan validation, and draft/finalized plan lifecycle management. These modules should be developed test-first, with strong unit coverage around domain behavior, integration coverage around external boundaries, and a small set of end-to-end tests for the critical product path.

## User Stories

1. As a self-coaching runner, I want to create an account, so that my training data and plans are tied to me.
2. As a self-coaching runner, I want to sign in securely, so that I can return to my settings and plans.
3. As a self-coaching runner, I want to enter my training goal, so that the generated week reflects what I am working toward.
4. As a self-coaching runner, I want to enter my weekly availability, so that the system only schedules training on days and times I can actually train.
5. As a self-coaching runner, I want to provide my Intervals API key, so that the app can import my recent activity history without requiring vendor-specific watch integrations.
6. As a self-coaching runner, I want that API key stored securely, so that sensitive credentials are not exposed in plain text.
7. As a self-coaching runner, I want to manually trigger a sync, so that I stay in control of when the app pulls new activity data.
8. As a self-coaching runner, I want the first sync to import roughly my last month of activity history, so that the app has enough recent context to generate an initial week.
9. As a self-coaching runner, I want later syncs to pull only data since the last successful sync, so that repeated imports are efficient and predictable.
10. As a self-coaching runner, I want the app to normalize imported running activities, so that planning logic can work from a consistent internal model.
11. As a self-coaching runner, I want the app to store imported activity history locally, so that planning does not depend on live reads from Intervals every time.
12. As a self-coaching runner, I want the app to tell me what was imported during sync, so that I understand what history the planner is using.
13. As a self-coaching runner, I want the app to continue working even if only partial history is available, so that missing upstream data does not block me completely.
14. As a self-coaching runner, I want the system to make it clear when history is incomplete, so that I can judge plan quality appropriately.
15. As a self-coaching runner, I want to generate a weekly draft plan from my recent history, goal, and availability, so that I get actionable training guidance.
16. As a self-coaching runner, I want the generated week to be structured by day, so that I can understand the overall training pattern.
17. As a self-coaching runner, I want each workout to include machine-readable interval blocks, so that the plan is precise and not just motivational prose.
18. As a self-coaching runner, I want workouts to use pace, HR, and RPE targeting where appropriate, so that prescriptions can reflect different kinds of sessions and available data.
19. As a self-coaching runner, I want the planner to act like a coach-like assistant, so that I get useful recommendations without giving up control.
20. As a self-coaching runner, I want the app to generate a complete week in one shot, so that I can evaluate the load and balance across the whole week.
21. As a self-coaching runner, I want the app to validate generated workouts strictly, so that malformed or unsafe outputs are rejected instead of silently accepted.
22. As a self-coaching runner, I want generation failures to be explicit, so that I know whether to retry rather than trusting a hidden partial result.
23. As a self-coaching runner, I want to retry generation if the model fails, so that temporary model issues do not block me forever.
24. As a self-coaching runner, I want to view the generated draft before it becomes final, so that I can sanity check the recommendation.
25. As a self-coaching runner, I want to edit individual sessions in the draft, so that I can tailor the week to real-life constraints and preferences.
26. As a self-coaching runner, I want to regenerate the entire week from the latest constraints, so that I can get a fresh coherent draft after changing my inputs.
27. As a self-coaching runner, I want regeneration to replace the current draft rather than merging unpredictably, so that the app stays understandable.
28. As a self-coaching runner, I want my week to stay in draft state until I explicitly finalize it, so that I can iterate safely.
29. As a self-coaching runner, I want to explicitly finalize a week, so that I have a stable saved plan I can refer back to.
30. As a self-coaching runner, I want finalized weeks to remain accessible in history, so that I can review what I committed to previously.
31. As a self-coaching runner, I want sync attempts to be logged, so that I can understand failures and support debugging.
32. As a self-coaching runner, I want generation attempts to be logged, so that model or validation failures can be diagnosed.
33. As a developer, I want the training domain implemented in deep modules, so that the core behavior is isolated behind stable interfaces.
34. As a developer, I want Intervals integration hidden behind an adapter boundary, so that upstream API details do not leak throughout the codebase.
35. As a developer, I want LLM generation hidden behind an internal model interface, so that provider-specific code does not infect domain logic.
36. As a developer, I want Effect used in backend service composition and external integrations, so that dependency injection, failure handling, and orchestration stay explicit.
37. As a developer, I want domain logic tested independently of UI and transport concerns, so that behavior remains stable during iteration.
38. As a developer, I want integration tests around sync and generation services, so that external boundaries can evolve without breaking the product path.
39. As a developer, I want a small number of key end-to-end tests, so that the signup-to-sync-to-generate-to-finalize flow is continuously verified.
40. As a future maintainer, I want stable plan and activity schemas, so that the system can support later features such as more sports or richer planning horizons without a rewrite.

## Implementation Decisions

- Preserve the existing stack shape: React frontend, Hono server, tRPC API layer, Drizzle/Postgres persistence, Better Auth for authentication.
- Introduce Effect TS in backend and domain-facing code first, not as an end-to-end frontend architecture rewrite.
- Build the product for a single self-coaching athlete in v1.
- Support running only in v1.
- Use Intervals.icu only as a read-only source of recent training history in v1.
- Use Intervals API key-based access for v1. Do not use OAuth in the first version.
- Store the Intervals API key encrypted at rest and decrypt it only when needed for manual sync.
- Require manual sync only. Do not build background sync jobs in v1.
- Import approximately the last month of activities on initial sync, then import from the last successful sync forward.
- Accept partial history and surface that limitation rather than blocking the user.
- Collect only the minimum onboarding inputs needed for v1: user goal, weekly availability, and Intervals API key.
- Build the planner around LLM-assisted whole-week generation through the AI SDK.
- Place the LLM behind an internal adapter interface so the domain does not depend directly on provider-specific APIs.
- Require structured outputs from the LLM. The generated plan must match a strict schema for the week, sessions, and interval blocks.
- Reject invalid or unsafe generated output rather than trying to coerce it into shape silently.
- When generation fails or structured output validation fails, prompt the user to retry. Do not implement a deterministic rules-based fallback in v1.
- Persist generated plans as drafts first. Only persist a finalized week when the user explicitly finalizes it.
- Allow manual edits to draft sessions.
- Allow regeneration of the entire draft week from the latest constraints. Do not support per-session AI regeneration in v1.
- Include basic per-user sync and generation logs for operational visibility.
- Prefer deep modules with simple, stable interfaces over many shallow feature-specific helpers.

### Intended deep modules

- Training settings module
  - Owns goal, availability, and credential reference behavior.
- Intervals sync module
  - Owns credential use, upstream fetch, normalization, upsert behavior, and sync event recording.
- Activity history module
  - Owns normalized activity access and recent-history summarization for planning.
- Weekly planning module
  - Owns generation input shaping, model invocation, validation, and draft creation.
- Plan lifecycle module
  - Owns draft retrieval, manual updates, regeneration replacement, and explicit finalization.
- Observability/logging module
  - Owns sync and generation event recording and user-visible diagnostics.

### Key interface expectations

- Authenticated API procedures are needed for settings, sync, recent activities, plan generation, draft retrieval and editing, regeneration, finalization, and basic user-scoped logs.
- Weekly plan contracts should be shared typed schemas that are valid for both persistence and UI rendering.
- Imported activity contracts should normalize Intervals-specific responses into an internal running activity model.
- Error handling should use stable categories for Intervals auth failure, Intervals upstream failure, no usable history, generation timeout/provider failure, invalid structured output, and plan lifecycle conflicts.

### Persistence decisions

- Persist imported activities in relational form for queryability.
- Persist weekly plan payloads in a form that preserves structured sessions and interval blocks. JSON-based payload storage is acceptable in v1 if protected by strict schema validation.
- Record sync events and generation events separately so failures and retries are traceable.

## Testing Decisions

- Tests should verify externally observable behavior and contractual outcomes, not implementation details such as internal helper composition or specific Effect wiring.
- Good tests should prove that a caller can trust a module boundary: given valid inputs, the correct domain result is produced; given invalid or failing conditions, the correct typed failure or user-visible outcome is produced.
- The rewrite should follow a TDD workflow with red-green-refactor discipline.
- Strong automated coverage should explicitly target domain modules, integration boundaries, and the key end-to-end user path.

### Modules and behaviors to test

- Training settings module
  - Validate onboarding/settings inputs and persistence behavior.
- Activity history module
  - Verify recent-history summarization and planning input shaping.
- Weekly planning module
  - Verify generation context assembly, structured-output validation, draft creation, and failure behavior.
- Plan lifecycle module
  - Verify editing, regeneration replacement, draft/finalized state transitions, and explicit finalization behavior.
- Intervals sync module
  - Verify encrypted credential usage, first sync behavior, incremental sync behavior, normalization, upsert behavior, and sync event logging.
- API layer
  - Verify auth guards, ownership boundaries, and API contract behavior for the critical procedures.
- End-to-end product path
  - Verify signup, onboarding, sync, generation, editing/regeneration, and finalization.

### Expected test mix

- Unit tests for pure domain behavior and state transitions.
- Integration tests for database-backed services and external adapters with controlled doubles or fixtures.
- A small number of critical end-to-end tests for the main user journey and key failure paths.

### Prior art in the current codebase

- The current repo does not contain meaningful training-domain or integration tests yet.
- Testing conventions therefore need to be established as part of the rewrite rather than borrowed from existing mature examples in this codebase.

## Out of Scope

- Multi-athlete or coach workflows
- OAuth-based Intervals authorization
- Direct integrations with watch vendors
- Push-back of plans or activities into Intervals
- Cycling, swimming, or triathlon planning
- Season planning or multi-week block planning
- Wellness or recovery data as core plan inputs
- Event calendar as a required planning input
- Full admin dashboard or advanced support tooling
- Per-session AI regeneration
- Deterministic non-LLM fallback planning in v1
- An Effect-first frontend rewrite
- Automatic background sync jobs

## Further Notes

- The current repository is essentially a scaffold, so this PRD assumes the first meaningful domain model will be introduced as part of the rewrite.
- The product is intentionally narrow in v1 to force clarity around the core value: imported running history plus user constraints should produce a useful weekly draft.
- The biggest product risk is LLM reliability. Because there is no deterministic fallback in v1, validation, failure handling, and retry UX are important parts of the product rather than edge cases.
- The biggest architecture risk is allowing provider-specific details from Intervals or the AI SDK to leak into the domain. The rewrite should resist this by keeping adapters thin and module boundaries explicit.
- If the app is later expanded into a true multi-user product, the Intervals authentication strategy will need to be revisited early.
