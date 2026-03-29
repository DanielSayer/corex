import path from "node:path";
import { fileURLToPath } from "node:url";

import { getServerTestEnv, installServerTestEnv } from "@corex/env/test";

const testsCwd = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function main() {
  installServerTestEnv();
  const { startIntegrationHarness, stopIntegrationHarness } =
    await import("./harness");
  const harness = await startIntegrationHarness();
  const testEnv = getServerTestEnv();

  try {
    const child = Bun.spawn(
      ["bun", "test", "--preload", "./src/setup.ts", "./src"],
      {
        cwd: testsCwd,
        env: {
          ...Bun.env,
          ...testEnv,
          COREX_INTEGRATION_EXTERNAL_DATABASE: "1",
          DATABASE_URL: harness.databaseUrl,
          NODE_ENV: "test",
        },
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      },
    );

    const exitCode = await child.exited;

    if (exitCode !== 0) {
      throw new Error(`Integration tests failed with exit code ${exitCode}.`);
    }
  } finally {
    await stopIntegrationHarness();
  }
}

await main();
