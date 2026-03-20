import { randomUUID } from "node:crypto";

import type { Database } from "@corex/db";
import { user } from "@corex/db/schema/auth";

type CreateUserInput = {
  email: string;
  name: string;
};

export async function createUser(db: Database, input: CreateUserInput) {
  const [createdUser] = await db
    .insert(user)
    .values({
      id: randomUUID(),
      email: input.email,
      name: input.name,
    })
    .returning();

  if (!createdUser) {
    throw new Error("User insert returned no row");
  }

  return createdUser;
}
