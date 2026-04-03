import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createGoalRepository } from "@corex/api/goals/repository";
import { createGoalsApi } from "@corex/api/goals/service";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";
import { createLiveWeeklySnapshotService } from "@corex/api/weekly-snapshots/live";
import type { TrainingGoal } from "@corex/api/training-settings/contracts";
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
      clock: { now: () => new Date("2026-04-13T01:00:00.000Z") },
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

describe("weekly snapshot generation integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("generates a snapshot for the prior local week using only persisted data", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "weekly-generation@example.com",
      name: "Weekly Generator",
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
    await Effect.runPromise(
      createGoalsApi({
        repo: createGoalRepository(db),
        trainingSettingsRepo: createTrainingSettingsRepository(db),
        clock: { now: () => new Date("2026-04-13T01:00:00.000Z") },
      }).createForUser(user.id, {
        type: "event_goal",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
        targetDate: "2026-05-10",
        eventName: "City Half",
      }),
    );

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "comparison-run-1",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-31T20:00:00.000Z"),
        movingTimeSeconds: 3300,
        elapsedTimeSeconds: 3400,
        distanceMeters: 10000,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "comparison-run-2",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-02T21:00:00.000Z"),
        movingTimeSeconds: 2500,
        elapsedTimeSeconds: 2550,
        distanceMeters: 8000,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "target-run-1",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-07T20:00:00.000Z"),
        movingTimeSeconds: 3600,
        elapsedTimeSeconds: 3700,
        distanceMeters: 12000,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "target-run-2",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-11T21:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "future-run",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-14T20:00:00.000Z"),
        movingTimeSeconds: 2400,
        elapsedTimeSeconds: 2450,
        distanceMeters: 6000,
        rawDetail: {},
      },
    ]);
    await db.insert(userAllTimePr).values({
      userId: user.id,
      distanceMeters: 21097.5,
      upstreamActivityId: "target-run-2",
      monthStart: new Date("2026-04-01T00:00:00.000Z"),
      durationSeconds: 5900,
      startSampleIndex: 0,
      endSampleIndex: 5900,
    });
    await insertSuccessfulSync(user.id, "2026-04-13T00:30:00.000Z");

    const service = createLiveWeeklySnapshotService({
      db,
      clock: { now: () => new Date("2026-04-13T01:00:00.000Z") },
    });

    const snapshot = await Effect.runPromise(
      service.generateWeeklySnapshotForUser(user.id, "Australia/Brisbane"),
    );

    expect(snapshot.timezone).toBe("Australia/Brisbane");
    expect(snapshot.weekStart).toEqual(new Date("2026-04-05T14:00:00.000Z"));
    expect(snapshot.weekEnd).toEqual(new Date("2026-04-12T14:00:00.000Z"));
    expect(snapshot.sourceSyncCompletedAt).toEqual(
      new Date("2026-04-13T00:30:00.000Z"),
    );
    expect(snapshot.payload.period).toEqual({
      weekStart: "2026-04-05T14:00:00.000Z",
      weekEnd: "2026-04-12T14:00:00.000Z",
      timezone: "Australia/Brisbane",
    });
    expect(snapshot.payload.totals).toEqual({
      distanceMeters: 30000,
      runCount: 2,
      elapsedTimeSeconds: 9250,
      movingTimeSeconds: 9000,
      avgPaceSecPerKm: 300,
    });
    expect(snapshot.payload.comparisonVsPriorWeek).toEqual({
      distanceMetersDelta: 12000,
      runCountDelta: 0,
      avgPaceSecPerKmDelta: -22.2,
    });
    expect(snapshot.payload.highlights).toEqual({
      bestDistanceDayMeters: 18000,
      longestRunMeters: 18000,
      fastestRunPaceSecPerKm: 300,
    });
    expect(snapshot.payload.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: expect.any(String),
          goalType: "volume_goal",
          currentValue: 30,
          targetValue: 40,
          remainingValue: 10,
        }),
        expect.objectContaining({
          goalType: "event_goal",
          readinessScore: expect.any(Number),
          targetValue: 21.1,
          currentValue: 18,
        }),
      ]),
    );
  });

  it("is idempotent for the same user and local week", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "weekly-generation-idempotent@example.com",
      name: "Weekly Idempotent",
    });

    await saveTrainingSettings({
      userId: user.id,
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 20,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "target-run-1",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-04-08T20:00:00.000Z"),
      movingTimeSeconds: 3600,
      elapsedTimeSeconds: 3700,
      distanceMeters: 10000,
      rawDetail: {},
    });
    await insertSuccessfulSync(user.id, "2026-04-13T00:30:00.000Z");

    const service = createLiveWeeklySnapshotService({
      db,
      clock: { now: () => new Date("2026-04-13T01:00:00.000Z") },
    });

    const [first, second] = await Promise.all([
      Effect.runPromise(
        service.generateWeeklySnapshotForUser(user.id, "Australia/Brisbane"),
      ),
      Effect.runPromise(
        service.generateWeeklySnapshotForUser(user.id, "Australia/Brisbane"),
      ),
    ]);

    const rows = await db.query.weeklySnapshot.findMany();

    expect(rows).toHaveLength(1);
    expect(first.id).toBe(second.id);
    expect(second.payload.totals?.distanceMeters).toBe(10000);
  });
});
