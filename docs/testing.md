# Testing Architecture

Phase one uses three explicit test layers:

- `bun run test:unit` runs fast specification tests in `vitest` for node code and jsdom-rendered UI code.
- `bun run test:integration` runs HTTP-level integration tests against the Hono app without requiring the browser.
- `bun run test:e2e` runs Playwright smoke coverage against the real web and server dev processes.

## Conventions

- Unit tests live next to the code as `*.test.ts` or `*.test.tsx`.
- Integration tests use `*.integration.test.ts`.
- End-to-end tests live in `tests/e2e`.
- Shared test environment defaults live in `tests/config/test-env.ts`.

## Current smoke coverage

- API router behavior through `appRouter.createCaller(...)`
- Hono server composition through `createApp().request(...)`
- Landing page and auth-route shell behavior through Playwright

## Next phase guidance

- Add database-backed integration fixtures before introducing persistence-heavy features.
- Keep tests behavior-focused: public tRPC procedures, HTTP endpoints, and user-visible UI flows.
