import path from "node:path";

import { defineConfig } from "vitest/config";

import { webTestEnv } from "./tests/config/test-env";

const rootDir = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "apps/web/src"),
    },
  },
  test: {
    name: "web-unit",
    environment: "jsdom",
    include: ["apps/web/src/**/*.test.ts?(x)", "packages/ui/src/**/*.test.ts?(x)"],
    exclude: ["**/*.integration.test.ts", "tests/e2e/**"],
    setupFiles: [path.resolve(rootDir, "tests/setup/web.ts")],
    env: webTestEnv,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
