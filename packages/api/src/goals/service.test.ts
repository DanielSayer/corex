import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type {
  StoredTrainingSettings,
  TrainingSettingsRepository,
} from "../training-settings/repository";
import { createGoalsApi } from "./service";

function createStoredSettings(): StoredTrainingSettings {
  return {
    userId: "user-1",
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
    intervalsCredential: {
      username: "runner@example.com",
      athleteId: null,
      athleteResolvedAt: null,
      ciphertext: "ciphertext",
      iv: "iv",
      tag: "tag",
      keyVersion: 1,
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    },
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
  };
}

function createRepo(
  overrides: Partial<TrainingSettingsRepository> = {},
): TrainingSettingsRepository {
  return {
    findByUserId: () => Effect.succeed(null),
    upsert: () => Effect.die("not used"),
    saveIntervalsAthleteIdentity: () => Effect.void,
    ...overrides,
  };
}

describe("goals api", () => {
  it("returns an empty list when the user has no stored goal", async () => {
    const api = createGoalsApi({
      repo: createRepo({
        findByUserId: () => Effect.succeed(null),
      }),
    });

    await expect(Effect.runPromise(api.getForUser("user-1"))).resolves.toEqual(
      [],
    );
  });

  it("returns the persisted training goal as an active goal item", async () => {
    const stored = createStoredSettings();
    const api = createGoalsApi({
      repo: createRepo({
        findByUserId: () => Effect.succeed(stored),
      }),
    });

    await expect(Effect.runPromise(api.getForUser("user-1"))).resolves.toEqual([
      {
        id: "user-1:2026-03-20T00:00:00.000Z",
        status: "active",
        goal: stored.goal,
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-21T00:00:00.000Z",
      },
    ]);
  });
});
