import { env } from "@corex/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb(databaseUrl = env.DATABASE_URL) {
  return drizzle(databaseUrl, { schema });
}

export type Database = ReturnType<typeof createDb>;

export const db = createDb();
