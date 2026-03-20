import { createAuth } from "@corex/auth";
import type { Database } from "@corex/db";
import { getServerTestEnv } from "@corex/env/test";

export function createIntegrationAuth(db: Database) {
  const env = getServerTestEnv();

  return createAuth({
    db,
    env: {
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      CORS_ORIGIN: env.CORS_ORIGIN,
    },
  });
}
