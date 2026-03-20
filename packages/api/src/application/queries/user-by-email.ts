import { eq } from "drizzle-orm";

import type { Database } from "@corex/db";
import { user } from "@corex/db/schema/auth";

export async function getUserByEmail(db: Database, email: string) {
  return db.query.user.findFirst({
    where: eq(user.email, email),
  });
}
