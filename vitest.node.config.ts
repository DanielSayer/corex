import { defineConfig } from "vitest/config";

import { serverTestEnv } from "./tests/config/test-env";

export default defineConfig({
  test: {
    name: "node-unit",
    environment: "node",
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "packages/ui/**/*.test.tsx", "tests/e2e/**"],
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
