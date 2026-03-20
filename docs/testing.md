# Testing Architecture

The repo uses `bun test` as the single runner for every supported automated test.

There are two active test layers:

- `bun run test:unit` runs colocated unit tests for app-owned logic.
- `bun run test:integration` runs the dedicated backend integration workspace in `apps/tests`.

`bun run test` runs both layers and is the default supported suite.

## Frontend Policy

Frontend tests default to "do not write one."

Write a frontend test only when all of the following are true:

- the logic is app-owned
- it has meaningful branching or policy
- it can be extracted into a framework-light module
- the test validates your behavior rather than a library contract

Allowed examples:

- app-specific transforms
- derived state helpers
- route policy helpers you own

Disallowed examples:

- DOM/render assertions
- UI primitive rendering checks
- tests that mainly restate React, TanStack Router, TanStack Form, Zod, or browser behavior

## Backend Policy

Backend tests use two complementary layers:

- Unit tests stay colocated and cover isolated logic, helpers, and application-layer branching.
- Integration tests live in `apps/tests` and provide the main confidence layer for DB-backed behavior.

The integration workspace is responsible for:

- starting an ephemeral Postgres instance through Testcontainers
- applying real Drizzle migrations
- resetting database state between tests
- running command/query integration tests against real persistence
- running a thin HTTP transport suite for server wiring concerns

## Integration Strategy

The preferred backend testing target is the application layer below transport.

That means:

- commands and queries should contain app-owned behavior
- Hono and tRPC should stay thin adapters
- most backend behavior should be verified by invoking application handlers and asserting persisted state

HTTP integration tests should stay narrow and cover:

- routing and server composition
- auth/session wiring
- middleware behavior
- transport-to-application handoff

## Compatibility Gate

The Bun-only integration strategy depends on Bun being sufficient for the Testcontainers-based harness.

That assumption is validated by a tracer-bullet integration spec in `apps/tests` which:

- starts Postgres with Testcontainers
- applies real migrations
- executes an application-layer write and read
- verifies persisted state
- tears the container down cleanly

If that tracer bullet fails, the backend testing architecture still stands, but the Bun-only runner decision needs to be revisited.

## Conventions

- Unit tests live next to code as `*.test.ts`.
- Backend integration tests live under `apps/tests/src` as `*.integration.test.ts`.
- Docker is required for `bun run test:integration`.
- Shared test env defaults live in `@corex/env/test`.
- Integration-test env scaffolding lives in `apps/tests/.env.example`.
