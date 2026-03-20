import { beforeEach, describe, expect, it } from "bun:test";

import { createUser } from "@corex/api/application/commands/create-user";
import { getUserByEmail } from "@corex/api/application/queries/user-by-email";

import { getIntegrationHarness, resetDatabase } from "./harness";

describe("bun test integration tracer bullet", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("starts postgres, applies migrations, writes through the app layer, and reads persisted state", async () => {
    const { db } = await getIntegrationHarness();

    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });

    if (!createdUser) {
      throw new Error("createUser returned null");
    }

    expect(createdUser.email).toBe("runner@example.com");

    const persistedUser = await getUserByEmail(db, "runner@example.com");

    expect(persistedUser).not.toBeNull();
    expect(persistedUser).toMatchObject({
      id: createdUser.id,
      email: "runner@example.com",
      name: "Runner One",
    });
  });
});
