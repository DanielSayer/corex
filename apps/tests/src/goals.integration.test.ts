import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createGoalRepository } from "@corex/api/goals/repository";
import { createGoalsApi } from "@corex/api/goals/service";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

async function saveTrainingSettings(userId: string) {
  const { db } = await getIntegrationHarness();
  const trainingSettingsService = createTrainingSettingsService({
    repo: createTrainingSettingsRepository(db),
    crypto: createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    }),
  });

  await Effect.runPromise(
    trainingSettingsService.upsertForUser(userId, {
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
      timezone: "Australia/Brisbane",
    }),
  );
}

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
      repo: createGoalRepository(db),
      trainingSettingsRepo: createTrainingSettingsRepository(db),
    });

    const result = await Effect.runPromise(goalsApi.getForUser(createdUser.id));

    expect(result).toEqual([]);
  });

  it("creates, lists, and updates multiple goals for a configured user", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    await saveTrainingSettings(createdUser.id);

    const goalsApi = createGoalsApi({
      repo: createGoalRepository(db),
      trainingSettingsRepo: createTrainingSettingsRepository(db),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    const firstGoal = await Effect.runPromise(
      goalsApi.createForUser(createdUser.id, {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-08-01",
        eventName: "City Half",
        notes: "Primary race for this block.",
      }),
    );
    const secondGoal = await Effect.runPromise(
      goalsApi.createForUser(createdUser.id, {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 60,
        unit: "km",
      }),
    );

    const listed = await Effect.runPromise(goalsApi.getForUser(createdUser.id));

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe(secondGoal.id);
    expect(listed[1]?.id).toBe(firstGoal.id);
    expect(listed[0]?.status).toBe("active");
    expect(listed[1]?.status).toBe("active");

    const updated = await Effect.runPromise(
      goalsApi.updateForUser(createdUser.id, firstGoal.id, {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-03-01",
        eventName: "Completed half",
      }),
    );

    expect(updated.status).toBe("completed");
    expect(updated.goal).toMatchObject({
      type: "event_goal",
      targetDate: "2026-03-01",
      eventName: "Completed half",
    });
  });
});
