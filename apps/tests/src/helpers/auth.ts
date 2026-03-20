import { createAuth } from "@corex/auth";
import type { Database } from "@corex/db";

export function createIntegrationAuth(db: Database) {
  return createAuth({
    db,
    env: {
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-secret-value-with-32-characters",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://127.0.0.1:3001",
    },
  });
}
