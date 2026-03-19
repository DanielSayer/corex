import { defineConfig } from "vitest/config";

import { serverTestEnv } from "./tests/config/test-env";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["apps/*/src/**/*.integration.test.ts", "packages/*/src/**/*.integration.test.ts"],
    exclude: ["tests/e2e/**"],
    env: serverTestEnv,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
