import { afterAll, beforeAll, setDefaultTimeout } from "bun:test";
import { installServerTestEnv } from "@corex/env/test";

installServerTestEnv();
setDefaultTimeout(60_000);

beforeAll(async () => {
  const { startIntegrationHarness } = await import("./harness");

  await startIntegrationHarness();
});

afterAll(async () => {
  const { stopIntegrationHarness } = await import("./harness");

  await stopIntegrationHarness();
});
