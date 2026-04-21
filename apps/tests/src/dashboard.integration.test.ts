import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveActivityHistoryApi } from "@corex/api/activity-history/live";
import { createDashboardService } from "@corex/api/dashboard/service";
import { createLiveGoalProgressService } from "@corex/api/goal-progress/live";
import { createGoalRepository } from "@corex/api/goals/repository";
import { createGoalsApi } from "@corex/api/goals/service";
import { createLiveIntervalsSyncApi } from "@corex/api/intervals-sync/live";
import { createPlanningDataRepository } from "@corex/api/planning-data/repository";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";
import {
  syncEvent,
  importedActivity,
  importedActivityMap,
} from "@corex/db/schema/intervals-sync";
import {
  weeklyPlan,
  weeklyPlanActivityLink,
} from "@corex/db/schema/weekly-planning";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

describe("dashboard integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns week-to-date comparisons, compact goals, sync summary, and recent activities", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "dashboard@example.com",
      name: "Dashboard User",
    });
    const trainingSettingsRepo = createTrainingSettingsRepository(db);
    const trainingSettingsService = createTrainingSettingsService({
      repo: trainingSettingsRepo,
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
    });

    await Effect.runPromise(
      trainingSettingsService.upsertForUser(user.id, {
        goal: {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 40,
          unit: "km",
        },
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
        intervalsApiKey: "intervals-secret",
        timezone: "Australia/Brisbane",
      }),
    );

    const goalsService = createGoalsApi({
      repo: createGoalRepository(db),
      trainingSettingsRepo,
      clock: { now: () => new Date("2026-04-15T01:00:00.000Z") },
    });

    await Effect.runPromise(
      goalsService.createForUser(user.id, {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      }),
    );
    await Effect.runPromise(
      goalsService.createForUser(user.id, {
        type: "event_goal",
        eventName: "City Half",
        targetDate: "2026-05-10",
        targetDistance: {
          value: 21.1,
          unit: "km",
        },
      }),
    );
    await Effect.runPromise(
      goalsService.createForUser(user.id, {
        type: "volume_goal",
        metric: "time",
        period: "month",
        targetValue: 320,
        unit: "minutes",
      }),
    );
    await Effect.runPromise(
      goalsService.createForUser(user.id, {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 25,
        unit: "km",
      }),
    );

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Morning Run",
        startAt: new Date("2026-04-13T00:30:00.000Z"),
        movingTimeSeconds: 1480,
        elapsedTimeSeconds: 1500,
        distanceMeters: 5000,
        averageHeartrate: 151,
        rawDetail: {
          id: "run-1",
          type: "Run",
          start_date: "2026-04-13T00:30:00.000Z",
          moving_time: 1480,
          elapsed_time: 1500,
          distance: 5000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Tempo",
        startAt: new Date("2026-04-14T00:30:00.000Z"),
        movingTimeSeconds: 2080,
        elapsedTimeSeconds: 2100,
        distanceMeters: 7000,
        averageHeartrate: 158,
        rawDetail: {
          id: "run-2",
          type: "Run",
          start_date: "2026-04-14T00:30:00.000Z",
          moving_time: 2080,
          elapsed_time: 2100,
          distance: 7000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-3",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Lunch Run",
        startAt: new Date("2026-04-15T00:30:00.000Z"),
        movingTimeSeconds: 890,
        elapsedTimeSeconds: 900,
        distanceMeters: 3000,
        averageHeartrate: 149,
        rawDetail: {
          id: "run-3",
          type: "Run",
          start_date: "2026-04-15T00:30:00.000Z",
          moving_time: 890,
          elapsed_time: 900,
          distance: 3000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-4",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Last week easy",
        startAt: new Date("2026-04-06T00:30:00.000Z"),
        movingTimeSeconds: 1180,
        elapsedTimeSeconds: 1200,
        distanceMeters: 4000,
        averageHeartrate: 145,
        rawDetail: {
          id: "run-4",
          type: "Run",
          start_date: "2026-04-06T00:30:00.000Z",
          moving_time: 1180,
          elapsed_time: 1200,
          distance: 4000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-5",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Last week tempo",
        startAt: new Date("2026-04-07T00:30:00.000Z"),
        movingTimeSeconds: 1840,
        elapsedTimeSeconds: 1860,
        distanceMeters: 6000,
        averageHeartrate: 154,
        rawDetail: {
          id: "run-5",
          type: "Run",
          start_date: "2026-04-07T00:30:00.000Z",
          moving_time: 1840,
          elapsed_time: 1860,
          distance: 6000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-6",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Last week long",
        startAt: new Date("2026-04-09T00:30:00.000Z"),
        movingTimeSeconds: 2980,
        elapsedTimeSeconds: 3000,
        distanceMeters: 10000,
        averageHeartrate: 156,
        rawDetail: {
          id: "run-6",
          type: "Run",
          start_date: "2026-04-09T00:30:00.000Z",
          moving_time: 2980,
          elapsed_time: 3000,
          distance: 10000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-7",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Linked early completion",
        startAt: new Date("2026-04-05T00:30:00.000Z"),
        movingTimeSeconds: 2980,
        elapsedTimeSeconds: 3000,
        distanceMeters: 10000,
        averageHeartrate: 156,
        rawDetail: {
          id: "run-7",
          type: "Run",
          start_date: "2026-04-05T00:30:00.000Z",
          moving_time: 2980,
          elapsed_time: 3000,
          distance: 10000,
        },
      },
    ]);

    await db.insert(weeklyPlan).values({
      id: "dashboard-plan-1",
      userId: user.id,
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {},
      payload: {
        days: [],
      },
      qualityReport: null,
    });

    await db.insert(weeklyPlanActivityLink).values({
      userId: user.id,
      weeklyPlanId: "dashboard-plan-1",
      plannedDate: "2026-04-06",
      activityId: "run-7",
    });

    await db.insert(importedActivityMap).values({
      userId: user.id,
      upstreamActivityId: "run-3",
      hasRoute: true,
      hasWeather: false,
      rawMap: {
        latlngs: [
          [-27.4748, 153.0192],
          [-27.4734, 153.0211],
        ],
      },
    });

    await db.insert(syncEvent).values({
      id: "sync-1",
      userId: user.id,
      status: "success",
      historyCoverage: "incremental_from_cursor",
      startedAt: new Date("2026-04-15T00:00:00.000Z"),
      completedAt: new Date("2026-04-15T00:03:00.000Z"),
      coveredRangeStart: new Date("2026-04-06T00:00:00.000Z"),
      coveredRangeEnd: new Date("2026-04-15T00:00:00.000Z"),
      insertedCount: 2,
      updatedCount: 1,
      skippedNonRunningCount: 1,
      skippedInvalidCount: 0,
      failedDetailCount: 0,
      failedMapCount: 0,
      failedStreamCount: 0,
      storedMapCount: 1,
      storedStreamCount: 5,
      unknownActivityTypes: [],
      warnings: ["unsupported activity skipped"],
      failedDetails: [],
    });

    const service = createDashboardService({
      trainingSettingsService,
      planningRepo: createPlanningDataRepository(db),
      weeklyPlanningRepo: {
        getFinalizedPlanForDate: () => Effect.succeed(null),
      },
      goalProgressService: createLiveGoalProgressService({
        db,
        clock: { now: () => new Date("2026-04-15T01:00:00.000Z") },
      }),
      intervalsSyncService: createLiveIntervalsSyncApi({ db }),
      activityHistoryService: createLiveActivityHistoryApi({ db }),
      clock: { now: () => new Date("2026-04-15T01:00:00.000Z") },
    });

    const result = await Effect.runPromise(service.getForUser(user.id));

    expect(result.timezone).toBe("Australia/Brisbane");
    expect(result.weekly.weekToDate).toEqual({
      startDate: "2026-04-13",
      endDate: "2026-04-15",
    });
    expect(result.weekly.distance.thisWeekMeters).toBe(15000);
    expect(result.weekly.distance.vsLastWeekMeters).toBe(-5000);
    expect(
      result.weekly.distance.series.find(
        (point) => point.weekStart === "2026-04-06",
      )?.value,
    ).toBe(30000);
    expect(result.weekly.pace.thisWeekSecPerKm).toBe(300);
    expect(result.weekly.pace.vsLastWeekSecPerKm).toBe(-3);
    expect(result.sync).toMatchObject({
      runsProcessed: 3,
      newRuns: 2,
      updatedRuns: 1,
      warningCount: 1,
      status: "success",
    });
    expect(result.goals).toHaveLength(3);
    expect(result.recentActivities).toHaveLength(5);
    expect(result.recentActivities[0]).toMatchObject({
      id: "run-3",
      name: "Lunch Run",
    });
  });
});
