import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { TARGET_EFFORT_DISTANCES_METERS } from "@corex/api/intervals-sync/derived-performance";
import {
  importedActivity,
  importedActivityStream,
  runProcessingWarning,
  syncEvent,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";

import { getIntegrationHarness, resetDatabase } from "./harness";

describe("planning data integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns the last 4 weeks as detailed runs and weeks 5-8 as rollups", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "planner@example.com",
      name: "Planner User",
    });
    const otherUser = await createUser(db, {
      email: "other-planner@example.com",
      name: "Other User",
    });
    const now = new Date("2026-03-25T12:00:00.000Z");

    const runDates = [
      "2026-03-22T12:00:00.000Z",
      "2026-03-10T12:00:00.000Z",
      "2026-02-28T12:00:00.000Z",
      "2026-02-26T12:00:00.000Z",
      "2026-02-23T12:00:00.000Z",
      "2026-02-14T12:00:00.000Z",
      "2026-02-07T12:00:00.000Z",
      "2026-01-30T12:00:00.000Z",
      "2025-12-20T12:00:00.000Z",
    ];

    await db.insert(importedActivity).values(
      runDates.map((startDate, index) => ({
        userId: user.id,
        upstreamActivityId: `run-${index + 1}`,
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date(startDate),
        movingTimeSeconds: 5,
        elapsedTimeSeconds: 6,
        distanceMeters: 1000 + index,
        totalElevationGainMeters: 20 + index,
        averageSpeedMetersPerSecond: 3.5,
        averageHeartrate: 150,
        rawDetail: {
          id: `run-${index + 1}`,
          type: "Run",
          start_date: startDate,
          moving_time: 5,
          elapsed_time: 6,
          distance: 1000 + index,
          total_elevation_gain: 20 + index,
          average_speed: 3.5,
          average_heartrate: 150,
          athlete_max_hr: 200,
        },
      })),
    );

    await db.insert(importedActivity).values({
      userId: otherUser.id,
      upstreamActivityId: "other-run-1",
      athleteId: "i509216",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-24T12:00:00.000Z"),
      movingTimeSeconds: 5,
      elapsedTimeSeconds: 5,
      distanceMeters: 5000,
      totalElevationGainMeters: 50,
      averageSpeedMetersPerSecond: 3.8,
      averageHeartrate: 155,
      rawDetail: {
        id: "other-run-1",
        type: "Run",
        start_date: "2026-03-24T12:00:00.000Z",
        moving_time: 5,
        elapsed_time: 5,
        distance: 5000,
      },
    });

    await db.insert(importedActivityStream).values(
      runDates.map((_, index) => ({
        userId: user.id,
        upstreamActivityId: `run-${index + 1}`,
        streamType: "heartrate",
        rawStream: {
          type: "heartrate",
          data: [100, 125, 145, 165, 185],
        },
      })),
    );

    const service = createLivePlanningDataService({
      db,
      clock: { now: () => now },
    });

    const snapshot = await Effect.runPromise(
      service.getPlanningHistorySnapshot(user.id),
    );

    expect(snapshot.detailedRuns).toHaveLength(4);
    expect(snapshot.detailedRuns.map((run) => run.startAt)).toEqual([
      "2026-03-22T12:00:00.000Z",
      "2026-03-10T12:00:00.000Z",
      "2026-02-28T12:00:00.000Z",
      "2026-02-26T12:00:00.000Z",
    ]);
    expect(snapshot.detailedRuns[0]?.heartRateZoneTimes).toEqual({
      z1Seconds: 1,
      z2Seconds: 1,
      z3Seconds: 1,
      z4Seconds: 1,
      z5Seconds: 1,
    });
    expect(snapshot.weeklyRollups).toHaveLength(4);
    expect(snapshot.weeklyRollups[0]).toMatchObject({
      runCount: 1,
      totalDistanceMeters: 1004,
      longestRunDistanceMeters: 1004,
    });
    expect(
      snapshot.detailedRuns.some(
        (run) => run.startAt === "2025-12-20T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("returns null HR zone fields when derivation is not possible", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "zones@example.com",
      name: "Zone User",
    });

    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      athleteId: "i509216",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-24T12:00:00.000Z"),
      movingTimeSeconds: 300,
      elapsedTimeSeconds: 310,
      distanceMeters: 5000,
      totalElevationGainMeters: 32,
      averageSpeedMetersPerSecond: 4,
      averageHeartrate: 150,
      rawDetail: {
        id: "run-1",
        type: "Run",
        start_date: "2026-03-24T12:00:00.000Z",
        moving_time: 300,
        elapsed_time: 310,
        distance: 5000,
      },
    });

    await db.insert(importedActivityStream).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      streamType: "heartrate",
      rawStream: {
        type: "heartrate",
        data: [120, 130, 140],
      },
    });

    const service = createLivePlanningDataService({
      db,
      clock: { now: () => new Date("2026-03-25T12:00:00.000Z") },
    });

    const snapshot = await Effect.runPromise(
      service.getPlanningHistorySnapshot(user.id),
    );

    expect(snapshot.detailedRuns[0]?.heartRateZoneTimes).toEqual({
      z1Seconds: null,
      z2Seconds: null,
      z3Seconds: null,
      z4Seconds: null,
      z5Seconds: null,
    });
  });

  it("reports history quality correctly when the latest sync failed but older local history exists", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "quality@example.com",
      name: "Quality User",
    });
    const now = new Date("2026-03-25T12:00:00.000Z");

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-10T12:00:00.000Z"),
        movingTimeSeconds: 1200,
        elapsedTimeSeconds: 1210,
        distanceMeters: 5000,
        rawDetail: {
          id: "run-1",
          type: "Run",
          start_date: "2026-03-10T12:00:00.000Z",
          moving_time: 1200,
          elapsed_time: 1210,
          distance: 5000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-24T12:00:00.000Z"),
        movingTimeSeconds: 1300,
        elapsedTimeSeconds: 1310,
        distanceMeters: 6000,
        rawDetail: {
          id: "run-2",
          type: "Run",
          start_date: "2026-03-24T12:00:00.000Z",
          moving_time: 1300,
          elapsed_time: 1310,
          distance: 6000,
        },
      },
    ]);

    await db.insert(syncEvent).values([
      {
        id: "sync-success",
        userId: user.id,
        status: "success",
        startedAt: new Date("2026-03-20T00:00:00.000Z"),
        completedAt: new Date("2026-03-20T00:05:00.000Z"),
        cursorStartUsed: new Date("2026-02-18T00:00:00.000Z"),
        coveredRangeStart: new Date("2026-03-10T12:00:00.000Z"),
        coveredRangeEnd: new Date("2026-03-24T12:00:00.000Z"),
        newestImportedActivityStart: new Date("2026-03-24T12:00:00.000Z"),
        insertedCount: 2,
        updatedCount: 0,
        skippedNonRunningCount: 1,
        skippedInvalidCount: 1,
        failedDetailCount: 1,
        failedMapCount: 0,
        failedStreamCount: 2,
        storedMapCount: 0,
        storedStreamCount: 0,
        unknownActivityTypes: ["Ride"],
        warnings: [],
        failedDetails: [],
      },
      {
        id: "sync-failure",
        userId: user.id,
        status: "failure",
        startedAt: new Date("2026-03-24T00:00:00.000Z"),
        completedAt: new Date("2026-03-24T00:05:00.000Z"),
        unknownActivityTypes: [],
        warnings: [],
        failedDetails: [],
        failureCategory: "upstream_request_failure",
        failureMessage: "Failed",
      },
    ]);

    const service = createLivePlanningDataService({
      db,
      clock: { now: () => now },
    });

    const quality = await Effect.runPromise(service.getHistoryQuality(user.id));

    expect(quality).toEqual({
      hasAnyHistory: true,
      meetsSnapshotThreshold: true,
      hasRecentSync: true,
      latestSyncWarnings: ["latest_sync_failed"],
      availableDateRange: {
        start: "2026-03-10T12:00:00.000Z",
        end: "2026-03-24T12:00:00.000Z",
      },
    });
  });

  it("returns planner-consumable all-time PRs, recent PRs, and processing warnings", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "prs@example.com",
      name: "PR User",
    });
    const now = new Date("2026-03-25T12:00:00.000Z");

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-03-05T00:00:00.000Z"),
        movingTimeSeconds: 1200,
        elapsedTimeSeconds: 1200,
        distanceMeters: 5000,
        rawDetail: {
          id: "run-1",
          type: "Run",
          start_date: "2026-03-05T00:00:00.000Z",
          moving_time: 1200,
          elapsed_time: 1200,
          distance: 5000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-01-15T00:00:00.000Z"),
        movingTimeSeconds: 2500,
        elapsedTimeSeconds: 2500,
        distanceMeters: 10000,
        rawDetail: {
          id: "run-2",
          type: "Run",
          start_date: "2026-01-15T00:00:00.000Z",
          moving_time: 2500,
          elapsed_time: 2500,
          distance: 10000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-3",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2025-12-20T00:00:00.000Z"),
        movingTimeSeconds: 80,
        elapsedTimeSeconds: 80,
        distanceMeters: 400,
        rawDetail: {
          id: "run-3",
          type: "Run",
          start_date: "2025-12-20T00:00:00.000Z",
          moving_time: 80,
          elapsed_time: 80,
          distance: 400,
        },
      },
    ]);

    await db.insert(userAllTimePr).values(
      TARGET_EFFORT_DISTANCES_METERS.map((distanceMeters, index) => ({
        userId: user.id,
        distanceMeters,
        upstreamActivityId:
          index === 0 ? "run-3" : index === 4 ? "run-2" : "run-1",
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        durationSeconds: 60 + index,
        startSampleIndex: 0,
        endSampleIndex: 60 + index,
      })),
    );

    await db.insert(userMonthlyBest).values([
      {
        userId: user.id,
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        distanceMeters: 5000,
        upstreamActivityId: "run-1",
        durationSeconds: 1200,
        startSampleIndex: 0,
        endSampleIndex: 1200,
      },
      {
        userId: user.id,
        monthStart: new Date("2026-01-01T00:00:00.000Z"),
        distanceMeters: 10000,
        upstreamActivityId: "run-2",
        durationSeconds: 2500,
        startSampleIndex: 0,
        endSampleIndex: 2500,
      },
      {
        userId: user.id,
        monthStart: new Date("2025-12-01T00:00:00.000Z"),
        distanceMeters: 400,
        upstreamActivityId: "run-3",
        durationSeconds: 80,
        startSampleIndex: 0,
        endSampleIndex: 80,
      },
    ]);

    await db.insert(runProcessingWarning).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        code: "missing_distance_stream",
        message: "Missing distance stream",
        metadata: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        code: "missing_distance_stream",
        message: "Missing distance stream",
        metadata: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-3",
        code: "invalid_distance_stream",
        message: "Invalid distance stream",
        metadata: {},
      },
    ]);

    const service = createLivePlanningDataService({
      db,
      clock: { now: () => now },
    });

    const snapshot = await Effect.runPromise(
      service.getPlanningPerformanceSnapshot(user.id),
    );

    expect(snapshot.allTimePrs).toHaveLength(7);
    expect(snapshot.allTimePrs[0]).toMatchObject({
      distanceMeters: 400,
      distanceLabel: "400m",
    });
    expect(snapshot.recentPrs.map((entry) => entry.activityId)).toEqual([
      "run-1",
      "run-2",
    ]);
    expect(snapshot.processingWarnings).toEqual([
      {
        code: "invalid_distance_stream",
        count: 1,
        affectedActivityIds: ["run-3"],
      },
      {
        code: "missing_distance_stream",
        count: 2,
        affectedActivityIds: ["run-1", "run-2"],
      },
    ]);
  });

  it("returns empty planner data for a user with no local history", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "empty@example.com",
      name: "Empty User",
    });

    const service = createLivePlanningDataService({
      db,
      clock: { now: () => new Date("2026-03-25T12:00:00.000Z") },
    });

    const [history, quality, performance] = await Promise.all([
      Effect.runPromise(service.getPlanningHistorySnapshot(user.id)),
      Effect.runPromise(service.getHistoryQuality(user.id)),
      Effect.runPromise(service.getPlanningPerformanceSnapshot(user.id)),
    ]);

    expect(history.detailedRuns).toEqual([]);
    expect(history.weeklyRollups).toEqual([]);
    expect(quality).toEqual({
      hasAnyHistory: false,
      meetsSnapshotThreshold: false,
      hasRecentSync: false,
      latestSyncWarnings: [],
      availableDateRange: {
        start: null,
        end: null,
      },
    });
    expect(performance).toEqual({
      allTimePrs: [],
      recentPrs: [],
      processingWarnings: [],
    });
  });
});
