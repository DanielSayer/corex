import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createGoalsApi } from "@corex/api/goals/service";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

describe("goals integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns an empty list for a user with no persisted goal", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const goalsApi = createGoalsApi({
      repo: createTrainingSettingsRepository(db),
    });

    const result = await Effect.runPromise(goalsApi.getForUser(createdUser.id));

    expect(result).toEqual([]);
  });

  it("returns the persisted training goal for a configured user", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const trainingSettingsRepo = createTrainingSettingsRepository(db);
    const trainingSettingsService = createTrainingSettingsService({
      repo: trainingSettingsRepo,
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
    });
    const goalsApi = createGoalsApi({
      repo: trainingSettingsRepo,
    });

    await Effect.runPromise(
      trainingSettingsService.upsertForUser(createdUser.id, {
        goal: {
          type: "event_goal",
          targetDistance: {
            value: 21.1,
            unit: "km",
          },
          targetDate: "2026-08-01",
          eventName: "City Half",
          notes: "Primary race for this block.",
        },
        availability: {
          monday: { available: true, maxDurationMinutes: 45 },
          tuesday: { available: false, maxDurationMinutes: null },
          wednesday: { available: true, maxDurationMinutes: 60 },
          thursday: { available: false, maxDurationMinutes: null },
          friday: { available: true, maxDurationMinutes: null },
          saturday: { available: true, maxDurationMinutes: 90 },
          sunday: { available: false, maxDurationMinutes: null },
        },
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret-key",
      }),
    );

    const result = await Effect.runPromise(goalsApi.getForUser(createdUser.id));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: expect.stringContaining(createdUser.id),
      status: "active",
      goal: {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-08-01",
        eventName: "City Half",
        notes: "Primary race for this block.",
      },
    });
  });
});
