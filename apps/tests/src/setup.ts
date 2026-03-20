import { afterAll } from "bun:test";

import { stopIntegrationHarness } from "./harness";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://postgres:password@127.0.0.1:5432/corex_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-value-with-32-characters";
process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:3000";
process.env.CORS_ORIGIN ??= "http://127.0.0.1:3001";

afterAll(async () => {
  await stopIntegrationHarness();
});
