import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createGoalRepository } from "@corex/api/goals/repository";
import { createGoalsApi } from "@corex/api/goals/service";
import { createLiveGoalProgressService } from "@corex/api/goal-progress/live";
import type { TrainingGoal } from "@corex/api/training-settings/contracts";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";
import {
  importedActivity,
  syncEvent,
  userAllTimePr,
} from "@corex/db/schema/intervals-sync";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

async function saveTrainingSettings(input: {
  userId: string;
  goal: TrainingGoal;
}) {
  const { db } = await getIntegrationHarness();
  const trainingRepo = createTrainingSettingsRepository(db);
  const service = createTrainingSettingsService({
    repo: trainingRepo,
    crypto: createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    }),
  });

  await Effect.runPromise(
    service.upsertForUser(input.userId, {
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: true, maxDurationMinutes: 45 },
        wednesday: { available: true, maxDurationMinutes: 45 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 45 },
        saturday: { available: true, maxDurationMinutes: 90 },
        sunday: { available: false, maxDurationMinutes: null },
      },
      intervalsUsername: "runner@example.com",
      intervalsApiKey: "intervals-secret-key",
    }),
  );

  await Effect.runPromise(
    createGoalsApi({
      repo: createGoalRepository(db),
      trainingSettingsRepo: trainingRepo,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    }).createForUser(input.userId, input.goal),
  );
}

async function insertSuccessfulSync(userId: string, completedAt: string) {
  const { db } = await getIntegrationHarness();

  await db.insert(syncEvent).values({
    id: `sync-${userId}-${completedAt}`,
    userId,
    status: "success",
    startedAt: new Date(completedAt),
    completedAt: new Date(completedAt),
    unknownActivityTypes: [],
    warnings: [],
    failedDetails: [],
  });
}

describe("goal progress integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns no_goal when the user has not configured training settings", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "nogoal@example.com",
      name: "No Goal",
    });
    const service = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    });

    const result = await Effect.runPromise(service.getForUser(user.id));

    expect(result).toEqual({
      timezone: "UTC",
      sync: {
        hasAnyHistory: false,
        hasRecentSync: false,
        latestSyncWarnings: [],
        availableDateRange: {
          start: null,
          end: null,
        },
        recommendedAction: "create_goal",
      },
      activeGoals: [],
      completedGoals: [],
    });
  });

  it("returns missing_history when a goal exists but no imported runs exist", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "missing@example.com",
      name: "Missing History",
    });
    await saveTrainingSettings({
      userId: user.id,
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    const service = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    });

    const result = await Effect.runPromise(service.getForUser(user.id));

    expect(result.timezone).toBe("UTC");
    expect(result.sync.recommendedAction).toBe("sync_history");
    expect(result.activeGoals).toHaveLength(1);
    expect(result.activeGoals[0]).toMatchObject({
      goalType: "volume_goal",
      status: "active",
      progress: null,
    });
  });

  it("returns stale_history when local runs exist but the latest successful sync is too old", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "stale@example.com",
      name: "Stale History",
    });
    await saveTrainingSettings({
      userId: user.id,
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-20T06:00:00.000Z"),
      movingTimeSeconds: 3600,
      elapsedTimeSeconds: 3600,
      distanceMeters: 10000,
      rawDetail: {
        id: "run-1",
        type: "Run",
        start_date: "2026-03-20T06:00:00.000Z",
        moving_time: 3600,
        elapsed_time: 3600,
        distance: 10000,
      },
    });
    await insertSuccessfulSync(user.id, "2026-03-20T12:00:00.000Z");
    const service = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    });

    const result = await Effect.runPromise(service.getForUser(user.id));

    expect(result.timezone).toBe("UTC");
    expect(result.sync.latestSyncWarnings).toContain("sync_stale");
    expect(result.activeGoals).toHaveLength(1);
    expect(result.activeGoals[0]).toMatchObject({
      goalType: "volume_goal",
      progress: null,
    });
  });

  it("computes live progress for multiple active goals from real imported runs", async () => {
    const { db } = await getIntegrationHarness();
    const weekUser = await createUser(db, {
      email: "weekly@example.com",
      name: "Weekly Runner",
    });
    const monthUser = await createUser(db, {
      email: "monthly@example.com",
      name: "Monthly Runner",
    });
    await saveTrainingSettings({
      userId: weekUser.id,
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await Effect.runPromise(
      createGoalsApi({
        repo: createGoalRepository(db),
        trainingSettingsRepo: createTrainingSettingsRepository(db),
        clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
      }).createForUser(weekUser.id, {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-05-10",
        eventName: "City Half",
      }),
    );
    await saveTrainingSettings({
      userId: monthUser.id,
      goal: {
        type: "volume_goal",
        metric: "time",
        period: "month",
        targetValue: 300,
        unit: "minutes",
      },
    });

    await db.insert(importedActivity).values([
      {
        userId: weekUser.id,
        upstreamActivityId: "week-run-1",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-30T06:00:00.000Z"),
        movingTimeSeconds: 3600,
        elapsedTimeSeconds: 3600,
        distanceMeters: 12000,
        rawDetail: {
          id: "week-run-1",
          type: "Run",
          start_date: "2026-03-30T06:00:00.000Z",
          moving_time: 3600,
          elapsed_time: 3600,
          distance: 12000,
        },
      },
      {
        userId: weekUser.id,
        upstreamActivityId: "week-run-2",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-01T06:00:00.000Z"),
        movingTimeSeconds: 3200,
        elapsedTimeSeconds: 3200,
        distanceMeters: 10000,
        rawDetail: {
          id: "week-run-2",
          type: "Run",
          start_date: "2026-04-01T06:00:00.000Z",
          moving_time: 3200,
          elapsed_time: 3200,
          distance: 10000,
        },
      },
      {
        userId: weekUser.id,
        upstreamActivityId: "week-run-3",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-26T06:00:00.000Z"),
        movingTimeSeconds: 3600,
        elapsedTimeSeconds: 3600,
        distanceMeters: 18000,
        rawDetail: {
          id: "week-run-3",
          type: "Run",
          start_date: "2026-03-26T06:00:00.000Z",
          moving_time: 3600,
          elapsed_time: 3600,
          distance: 18000,
        },
      },
      {
        userId: monthUser.id,
        upstreamActivityId: "month-run-1",
        athleteId: "athlete-2",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-02T06:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5400,
        distanceMeters: 10000,
        rawDetail: {
          id: "month-run-1",
          type: "Run",
          start_date: "2026-04-02T06:00:00.000Z",
          moving_time: 5400,
          elapsed_time: 5400,
          distance: 10000,
        },
      },
      {
        userId: monthUser.id,
        upstreamActivityId: "month-run-2",
        athleteId: "athlete-2",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-10T06:00:00.000Z"),
        movingTimeSeconds: 3600,
        elapsedTimeSeconds: 3600,
        distanceMeters: 16000,
        rawDetail: {
          id: "month-run-2",
          type: "Run",
          start_date: "2026-04-10T06:00:00.000Z",
          moving_time: 3600,
          elapsed_time: 3600,
          distance: 16000,
        },
      },
    ]);
    await db.insert(userAllTimePr).values({
      userId: weekUser.id,
      distanceMeters: 21097.5,
      upstreamActivityId: "week-run-3",
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      durationSeconds: 5900,
      startSampleIndex: 0,
      endSampleIndex: 5900,
    });
    await insertSuccessfulSync(weekUser.id, "2026-04-02T12:00:00.000Z");
    await insertSuccessfulSync(monthUser.id, "2026-04-12T12:00:00.000Z");

    const weeklyService = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    });
    const monthlyService = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-18T12:00:00.000Z") },
    });

    const [weekly, monthly] = await Promise.all([
      Effect.runPromise(
        weeklyService.getForUser(weekUser.id, "Australia/Brisbane"),
      ),
      Effect.runPromise(monthlyService.getForUser(monthUser.id)),
    ]);

    expect(weekly.timezone).toBe("Australia/Brisbane");
    expect(weekly.sync.recommendedAction).toBe("none");
    expect(weekly.activeGoals).toHaveLength(2);
    expect(weekly.activeGoals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalType: "volume_goal",
          status: "active",
          progress: expect.objectContaining({
            completedValue: 22,
            remainingValue: 18,
            percentComplete: 55,
            period: "week",
          }),
        }),
        expect.objectContaining({
          goalType: "event_goal",
          status: "active",
          readinessScore: expect.any(Number),
          progress: expect.objectContaining({
            eventDate: "2026-05-10",
            bestMatchingEffort: expect.objectContaining({
              distanceMeters: 21097.5,
              source: "exact",
            }),
          }),
        }),
      ]),
    );
    expect(monthly.activeGoals).toHaveLength(1);
    expect(monthly.activeGoals[0]).toMatchObject({
      goalType: "volume_goal",
      progress: {
        completedValue: 150,
        remainingValue: 150,
        percentComplete: 50,
        period: "month",
        unit: "minutes",
      },
    });
  });

  it("returns completed event goals separately with computed final progress", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "event@example.com",
      name: "Event Runner",
    });
    await saveTrainingSettings({
      userId: user.id,
      goal: {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-03-01",
        eventName: "City Half",
      },
    });
    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "event-run-1",
        athleteId: "athlete-3",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-31T06:00:00.000Z"),
        movingTimeSeconds: 6200,
        elapsedTimeSeconds: 6200,
        distanceMeters: 18000,
        rawDetail: {
          id: "event-run-1",
          type: "Run",
          start_date: "2026-03-31T06:00:00.000Z",
          moving_time: 6200,
          elapsed_time: 6200,
          distance: 18000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "event-run-2",
        athleteId: "athlete-3",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-26T06:00:00.000Z"),
        movingTimeSeconds: 3600,
        elapsedTimeSeconds: 3600,
        distanceMeters: 10000,
        rawDetail: {
          id: "event-run-2",
          type: "Run",
          start_date: "2026-03-26T06:00:00.000Z",
          moving_time: 3600,
          elapsed_time: 3600,
          distance: 10000,
        },
      },
    ]);
    await db.insert(userAllTimePr).values({
      userId: user.id,
      distanceMeters: 21097.5,
      upstreamActivityId: "event-run-1",
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      durationSeconds: 5900,
      startSampleIndex: 0,
      endSampleIndex: 5900,
    });
    await insertSuccessfulSync(user.id, "2026-04-02T12:00:00.000Z");
    const service = createLiveGoalProgressService({
      db,
      clock: { now: () => new Date("2026-04-03T12:00:00.000Z") },
    });

    const result = await Effect.runPromise(
      service.getForUser(user.id, "Australia/Brisbane"),
    );

    expect(result.timezone).toBe("Australia/Brisbane");
    expect(result.activeGoals).toHaveLength(0);
    expect(result.completedGoals).toHaveLength(1);
    expect(result.completedGoals[0]).toMatchObject({
      goalType: "event_goal",
      status: "completed",
      readinessScore: expect.any(Number),
      progress: {
        eventDate: "2026-03-01",
        longestRecentRun: {
          distanceMeters: 18000,
        },
        bestMatchingEffort: {
          distanceMeters: 21097.5,
          source: "exact",
        },
      },
    });
    expect(result.completedGoals[0]?.progress?.readiness.signals).toHaveLength(
      4,
    );
  });
});
