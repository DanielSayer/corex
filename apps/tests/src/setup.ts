import { afterAll, beforeAll, setDefaultTimeout } from "bun:test";
import { installServerTestEnv } from "@corex/env/test";

import { startIntegrationHarness, stopIntegrationHarness } from "./harness";

installServerTestEnv();
setDefaultTimeout(60_000);

beforeAll(async () => {
  await startIntegrationHarness();
});

afterAll(async () => {
  await stopIntegrationHarness();
});
