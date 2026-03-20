import { db, type Database } from "@corex/db";
import * as schema from "@corex/db/schema/auth";
import { env } from "@corex/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

type AuthEnv = Pick<typeof env, "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "CORS_ORIGIN">;

type CreateAuthOptions = {
  db?: Database;
  env?: AuthEnv;
};

export function createAuth(options: CreateAuthOptions = {}) {
  const authDb = options.db ?? db;
  const authEnv = options.env ?? env;

  return betterAuth({
    database: drizzleAdapter(authDb, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [authEnv.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: authEnv.BETTER_AUTH_SECRET,
    baseURL: authEnv.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth();
