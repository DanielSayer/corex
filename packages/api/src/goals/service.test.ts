import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { GoalRepository, StoredGoal } from "./repository";
import { createGoalsApi } from "./service";
import type { TrainingSettingsRepository } from "../training-settings/repository";

function createStoredGoal(overrides: Partial<StoredGoal> = {}): StoredGoal {
  return {
    id: "goal-1",
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
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    ...overrides,
  };
}

function createGoalRepo(
  overrides: Partial<GoalRepository> = {},
): GoalRepository {
  return {
    listByUserId: () => Effect.succeed([]),
    create: () => Effect.die("not used"),
    update: () => Effect.die("not used"),
    ...overrides,
  };
}

function createTrainingSettingsRepo(
  exists = true,
): Pick<TrainingSettingsRepository, "findByUserId"> {
  return {
    findByUserId: () =>
      Effect.succeed(
        exists
          ? {
              userId: "user-1",
              availability: {
                monday: { available: true, maxDurationMinutes: 45 },
                tuesday: { available: false, maxDurationMinutes: null },
                wednesday: { available: true, maxDurationMinutes: 60 },
                thursday: { available: false, maxDurationMinutes: null },
                friday: { available: true, maxDurationMinutes: null },
                saturday: { available: true, maxDurationMinutes: 90 },
                sunday: { available: false, maxDurationMinutes: null },
              },
              preferences: {
                timezone: "Australia/Brisbane",
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
              updatedAt: new Date("2026-03-21T00:00:00.000Z"),
            }
          : null,
      ),
  };
}

describe("goals api", () => {
  it("returns an empty list when the user has no stored goal", async () => {
    const api = createGoalsApi({
      repo: createGoalRepo(),
      trainingSettingsRepo: createTrainingSettingsRepo(),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    await expect(Effect.runPromise(api.getForUser("user-1"))).resolves.toEqual(
      [],
    );
  });

  it("returns stored goals with derived statuses", async () => {
    const api = createGoalsApi({
      repo: createGoalRepo({
        listByUserId: () =>
          Effect.succeed([
            createStoredGoal(),
            createStoredGoal({
              id: "goal-2",
              goal: {
                type: "event_goal",
                targetDistance: {
                  value: 10,
                  unit: "km",
                },
                targetDate: "2026-03-01",
              },
            }),
          ]),
      }),
      trainingSettingsRepo: createTrainingSettingsRepo(),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    await expect(Effect.runPromise(api.getForUser("user-1"))).resolves.toEqual([
      {
        id: "goal-1",
        status: "active",
        goal: createStoredGoal().goal,
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-21T00:00:00.000Z",
      },
      {
        id: "goal-2",
        status: "completed",
        goal: {
          type: "event_goal",
          targetDistance: {
            value: 10,
            unit: "km",
          },
          targetDate: "2026-03-01",
        },
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-21T00:00:00.000Z",
      },
    ]);
  });

  it("creates a goal when training settings exist", async () => {
    let createdRecord: Parameters<GoalRepository["create"]>[0] | undefined;
    const api = createGoalsApi({
      repo: createGoalRepo({
        create: (record) => {
          createdRecord = record;
          return Effect.succeed(
            createStoredGoal({
              id: record.id,
              goal: record.goal,
            }),
          );
        },
      }),
      trainingSettingsRepo: createTrainingSettingsRepo(),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    await expect(
      Effect.runPromise(
        api.createForUser("user-1", {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 50,
          unit: "km",
        }),
      ),
    ).resolves.toMatchObject({
      status: "active",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 50,
        unit: "km",
      },
    });

    expect(createdRecord).toMatchObject({
      userId: "user-1",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 50,
        unit: "km",
      },
    });
  });

  it("updates a goal by id when training settings exist", async () => {
    let updatedRecord: Parameters<GoalRepository["update"]>[0] | undefined;
    const api = createGoalsApi({
      repo: createGoalRepo({
        update: (record) => {
          updatedRecord = record;
          return Effect.succeed(
            createStoredGoal({
              id: record.id,
              goal: record.goal,
              updatedAt: new Date("2026-03-22T00:00:00.000Z"),
            }),
          );
        },
      }),
      trainingSettingsRepo: createTrainingSettingsRepo(),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    await expect(
      Effect.runPromise(
        api.updateForUser("user-1", "goal-9", {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 50,
          unit: "km",
        }),
      ),
    ).resolves.toMatchObject({
      id: "goal-9",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 50,
        unit: "km",
      },
    });

    expect(updatedRecord).toEqual({
      id: "goal-9",
      userId: "user-1",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 50,
        unit: "km",
      },
    });
  });

  it("rejects goal writes when training settings do not exist yet", async () => {
    const api = createGoalsApi({
      repo: createGoalRepo(),
      trainingSettingsRepo: createTrainingSettingsRepo(false),
      clock: { now: () => new Date("2026-04-03T00:00:00.000Z") },
    });

    await expect(
      Effect.runPromise(
        api.createForUser("user-1", {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 50,
          unit: "km",
        }),
      ),
    ).rejects.toThrow(
      "Training settings must exist before a goal can be created or updated",
    );
  });
});
