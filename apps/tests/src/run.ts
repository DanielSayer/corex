import path from "node:path";
import { fileURLToPath } from "node:url";

import { getServerTestEnv, installServerTestEnv } from "@corex/env/test";

const testsCwd = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function findIntegrationTestFiles() {
  const testFiles: string[] = [];

  for await (const file of new Bun.Glob("src/**/*.integration.test.ts").scan({
    cwd: testsCwd,
    absolute: false,
  })) {
    testFiles.push(file);
  }

  testFiles.sort((left, right) => left.localeCompare(right));

  if (testFiles.length === 0) {
    throw new Error("No integration test files were found in apps/tests/src.");
  }

  return testFiles;
}

async function main() {
  installServerTestEnv();
  const { startIntegrationHarness, stopIntegrationHarness } =
    await import("./harness");
  const harness = await startIntegrationHarness();
  const testEnv = getServerTestEnv();
  const testFiles = await findIntegrationTestFiles();

  try {
    const child = Bun.spawn(
      ["bun", "test", "--preload", "./src/setup.ts", ...testFiles],
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

if (import.meta.main) {
  await main();
}
