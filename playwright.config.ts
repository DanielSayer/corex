import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { serverTestEnv, webTestEnv } from "./tests/config/test-env";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.join(rootDir, "tests/e2e"),
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "bun run --cwd apps/server dev",
      url: "http://127.0.0.1:3000",
      env: serverTestEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd apps/web dev -- --host 127.0.0.1 --port 3001",
      url: "http://127.0.0.1:3001",
      env: webTestEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
