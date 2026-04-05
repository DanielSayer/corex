import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    SETTINGS_MASTER_KEY_BASE64: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    PLANNER_OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: Bun.env,
  emptyStringAsUndefined: true,
});
