import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveActivityHistoryApi } from "@corex/api/activity-history/live";
import {
  MAX_ACTIVITY_ANALYSIS_POINTS,
  MAX_ACTIVITY_MAP_PREVIEW_POINTS,
} from "@corex/api/activity-history/activity-details";
import {
  importedActivity,
  importedActivityHeartRateZone,
  importedActivityInterval,
  importedActivityMap,
  importedActivityStream,
  runBestEffort,
} from "@corex/db/schema/intervals-sync";

import { getIntegrationHarness, resetDatabase } from "./harness";

describe("activity history integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  }, 15_000);

  it("returns the last 5 recent activities with validated detail and map fallbacks", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const otherUser = await createUser(db, {
      email: "other@example.com",
      name: "Runner Two",
    });

    const baseDate = new Date("2026-03-20T00:00:00.000Z");

    for (let index = 0; index < 6; index += 1) {
      const startAt = new Date(baseDate);
      startAt.setUTCDate(baseDate.getUTCDate() - index);

      await db.insert(importedActivity).values({
        userId: user.id,
        upstreamActivityId: `run-${index + 1}`,
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: index === 1 || index === 2 ? null : `Run ${index + 1}`,
        startAt,
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810 + index,
        distanceMeters: 5000 + index,
        averageHeartrate: 150 + index,
        rawDetail:
          index === 2
            ? { invalid: true }
            : {
                id: `run-${index + 1}`,
                type: "Run",
                name: index === 1 ? null : `Run ${index + 1}`,
                start_date: startAt.toISOString(),
                moving_time: 1800,
                elapsed_time: 1810 + index,
                distance: 5000 + index,
                average_heartrate: 150 + index,
              },
      });
    }

    await db.insert(importedActivity).values({
      userId: otherUser.id,
      upstreamActivityId: "other-run-1",
      athleteId: "i509216",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Other run",
      startAt: new Date("2026-03-25T00:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1800,
      distanceMeters: 5000,
      averageHeartrate: 160,
      rawDetail: {
        id: "other-run-1",
        type: "Run",
        name: "Other run",
        start_date: "2026-03-25T00:00:00.000Z",
        moving_time: 1800,
        elapsed_time: 1800,
        distance: 5000,
        average_heartrate: 160,
      },
    });

    await db.insert(importedActivityMap).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        hasRoute: true,
        hasWeather: false,
        rawMap: {
          latlngs: [
            [-27.4748, 153.0192],
            [-27.4734, 153.0211],
          ],
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        hasRoute: true,
        hasWeather: false,
        rawMap: { latlngs: "invalid" },
      },
    ]);

    const service = createLiveActivityHistoryApi({ db });
    const result = await Effect.runPromise(service.recentActivities(user.id));

    expect(result).toHaveLength(5);
    expect(result.map((activity) => activity.id)).toEqual([
      "run-1",
      "run-2",
      "run-3",
      "run-4",
      "run-5",
    ]);
    expect(result[0]).toMatchObject({
      id: "run-1",
      name: "Run 1",
      routePreview: {
        latlngs: [
          [-27.4748, 153.0192],
          [-27.4734, 153.0211],
        ],
      },
    });
    expect(result[1]).toMatchObject({
      id: "run-2",
      name: "Untitled run",
      routePreview: null,
    });
    expect(result[2]).toMatchObject({
      id: "run-3",
      name: "Untitled run",
      routePreview: null,
    });
    expect(result.some((activity) => activity.id === "run-6")).toBe(false);
    expect(result.some((activity) => activity.id === "other-run-1")).toBe(
      false,
    );
  });

  it("returns timezone-aware calendar activities and monday-based weekly summaries", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "calendar@example.com",
      name: "Calendar User",
    });

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Morning run",
        startAt: new Date("2026-03-30T22:30:00.000Z"),
        movingTimeSeconds: 1490,
        elapsedTimeSeconds: 1500,
        distanceMeters: 5000,
        averageHeartrate: 150,
        trainingLoad: 42,
        totalElevationGainMeters: 30,
        rawDetail: {
          id: "run-1",
          type: "Run",
          name: "Morning run",
          start_date: "2026-03-30T22:30:00.000Z",
          moving_time: 1490,
          elapsed_time: 1500,
          distance: 5000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-2",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: null,
        startAt: new Date("2026-04-05T23:30:00.000Z"),
        movingTimeSeconds: 1700,
        elapsedTimeSeconds: null,
        distanceMeters: 4000,
        averageHeartrate: null,
        trainingLoad: null,
        totalElevationGainMeters: 15,
        rawDetail: {
          id: "run-2",
          type: "Run",
          start_date: "2026-04-05T23:30:00.000Z",
          moving_time: 1700,
          distance: 4000,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-3",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Excluded upper boundary",
        startAt: new Date("2026-04-13T00:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1800,
        distanceMeters: 6000,
        averageHeartrate: 155,
        trainingLoad: 55,
        totalElevationGainMeters: 45,
        rawDetail: {
          id: "run-3",
          type: "Run",
          name: "Excluded upper boundary",
          start_date: "2026-04-13T00:00:00.000Z",
          moving_time: 1800,
          elapsed_time: 1800,
          distance: 6000,
        },
      },
    ]);

    const service = createLiveActivityHistoryApi({ db });
    const result = await Effect.runPromise(
      service.calendar(user.id, {
        from: "2026-03-30T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    );

    expect(result.activities).toEqual([
      {
        id: "run-1",
        name: "Morning run",
        startDate: "2026-03-30T22:30:00.000Z",
        elapsedTime: 1500,
        distance: 5000,
        averagePaceSecondsPerKm: 300,
        averageHeartrate: 150,
        trainingLoad: 42,
        totalElevationGain: 30,
      },
      {
        id: "run-2",
        name: "Untitled run",
        startDate: "2026-04-05T23:30:00.000Z",
        elapsedTime: null,
        distance: 4000,
        averagePaceSecondsPerKm: null,
        averageHeartrate: null,
        trainingLoad: null,
        totalElevationGain: 15,
      },
    ]);
    expect(result.weeks).toEqual([
      {
        weekStart: "2026-03-30",
        weekEnd: "2026-04-05",
        time: 1500,
        distance: 5000,
        totalElevationGain: 30,
        averagePaceSecondsPerKm: 300,
      },
      {
        weekStart: "2026-04-06",
        weekEnd: "2026-04-12",
        time: 0,
        distance: 4000,
        totalElevationGain: 15,
        averagePaceSecondsPerKm: null,
      },
      {
        weekStart: "2026-04-13",
        weekEnd: "2026-04-19",
        time: 0,
        distance: 0,
        totalElevationGain: 0,
        averagePaceSecondsPerKm: null,
      },
    ]);
  });

  it("returns split activity summary and chart-ready analysis without exposing raw streams", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "details@example.com",
      name: "Details User",
    });
    const mapLatLngs: Array<[number, number]> = Array.from(
      { length: 2505 },
      (_, index) => [-27.4748 + index / 100000, 153.0192 + index / 100000],
    );
    const heartrateSamples = Array.from(
      { length: 2505 },
      (_, index) => 120 + (index % 25),
    );
    const cadenceSamples = Array.from(
      { length: 2505 },
      (_, index) => 164 + (index % 8),
    );
    const velocitySamples = Array.from(
      { length: 2505 },
      (_, index) => 3.3 + (index % 12) / 10,
    );
    const altitudeSamples = Array.from(
      { length: 2505 },
      (_, index) => 10 + (index % 30),
    );

    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      athleteId: "i509216",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Morning run",
      startAt: new Date("2026-03-20T00:00:00.000Z"),
      startDateLocal: new Date("2026-03-20T10:00:00.000Z"),
      deviceName: "Forerunner 265",
      movingTimeSeconds: 2400,
      elapsedTimeSeconds: 2450,
      distanceMeters: 8000,
      totalElevationGainMeters: 42,
      totalElevationLossMeters: 39,
      averageSpeedMetersPerSecond: 3.5,
      maxSpeedMetersPerSecond: 5.1,
      averageHeartrate: 152,
      maxHeartrate: 180,
      averageCadence: 168,
      calories: 640,
      trainingLoad: 77,
      hrLoad: 88,
      intensity: 0.83,
      athleteMaxHr: 196,
      rawDetail: { malformed: true },
    });
    await db.insert(importedActivityMap).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      hasRoute: true,
      hasWeather: false,
      rawMap: {
        bounds: [
          [-27.48, 153.01],
          [-27.47, 153.03],
        ],
        latlngs: mapLatLngs,
      },
    });
    await db.insert(importedActivityHeartRateZone).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        zoneIndex: 0,
        lowerBpm: 120,
        durationSeconds: 120,
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        zoneIndex: 1,
        lowerBpm: 140,
        durationSeconds: 360,
      },
    ]);
    await db.insert(importedActivityInterval).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      intervalIndex: 0,
      intervalType: "WARMUP",
      zone: 2,
      intensity: 1,
      distanceMeters: 1000,
      movingTimeSeconds: 300,
      elapsedTimeSeconds: 305,
      startTimeSeconds: 0,
      endTimeSeconds: 300,
      averageSpeedMetersPerSecond: 3.33,
      maxSpeedMetersPerSecond: 4.4,
      averageHeartrate: 132,
      maxHeartrate: 145,
      averageCadence: 164,
      averageStride: 1.03,
      totalElevationGainMeters: 5,
    });
    await db.insert(importedActivityStream).values([
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "distance",
        rawStream: {
          type: "distance",
          data: [0, 500, 1000, 1500, 2000],
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "heartrate",
        rawStream: {
          type: "heartrate",
          data: heartrateSamples,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "cadence",
        rawStream: {
          type: "cadence",
          data: cadenceSamples,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "velocity_smooth",
        rawStream: {
          type: "velocity_smooth",
          data: velocitySamples,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "fixed_altitude",
        rawStream: {
          type: "fixed_altitude",
          data: altitudeSamples,
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-1",
        streamType: "invalid",
        rawStream: {
          type: "invalid",
          data: "nope",
        },
      },
    ]);
    await db.insert(runBestEffort).values({
      userId: user.id,
      upstreamActivityId: "run-1",
      distanceMeters: 1000,
      durationSeconds: 240,
      startSampleIndex: 0,
      endSampleIndex: 2,
    });

    const service = createLiveActivityHistoryApi({ db });
    const summary = await Effect.runPromise(
      service.activitySummary(user.id, "run-1"),
    );
    const analysis = await Effect.runPromise(
      service.activityAnalysis(user.id, "run-1"),
    );

    expect(summary).toMatchObject({
      name: "Morning run",
      type: "Run",
      deviceName: "Forerunner 265",
      distance: 8000,
      movingTime: 2400,
      elapsedTime: 2450,
      averageSpeed: 3.5,
      maxSpeed: 5.1,
      averageHeartrate: 152,
      maxHeartrate: 180,
      averageCadence: 168,
      calories: 640,
      totalElevationGain: 42,
      totalElevationLoss: 39,
      trainingLoad: 77,
      hrLoad: 88,
      intensity: 0.83,
      athleteMaxHr: 196,
      heartRateZonesBpm: [120, 140],
      heartRateZoneDurationsSeconds: [120, 360],
      bestEfforts: [{ targetDistanceMeters: 1000, durationSeconds: 240 }],
    });
    expect(summary?.intervals).toEqual([
      expect.objectContaining({
        intervalType: "WARMUP",
        zone: "2",
        intensity: "1",
        averageCadence: 164,
      }),
    ]);
    expect(summary?.oneKmSplitTimesSeconds).toEqual([
      {
        splitNumber: 1,
        splitDistanceMeters: 1000,
        durationSeconds: 2,
      },
      {
        splitNumber: 2,
        splitDistanceMeters: 2000,
        durationSeconds: 2,
      },
    ]);
    expect(summary?.mapPreview?.latlngs).toHaveLength(
      MAX_ACTIVITY_MAP_PREVIEW_POINTS,
    );
    expect(summary?.mapPreview?.latlngs[0]).toEqual(mapLatLngs[0]);
    expect(summary?.mapPreview?.latlngs.at(-1)).toEqual(mapLatLngs.at(-1));
    expect(analysis?.heartrate).toEqual(expect.any(Array));
    expect(analysis?.cadence).toEqual(expect.any(Array));
    expect(analysis?.velocity_smooth).toEqual(expect.any(Array));
    expect(analysis?.fixed_altitude).toEqual(expect.any(Array));
    expect(analysis?.heartrate).toHaveLength(MAX_ACTIVITY_ANALYSIS_POINTS);
    expect(analysis?.cadence).toHaveLength(MAX_ACTIVITY_ANALYSIS_POINTS);
    expect(analysis?.velocity_smooth).toHaveLength(
      MAX_ACTIVITY_ANALYSIS_POINTS,
    );
    expect(analysis?.fixed_altitude).toHaveLength(MAX_ACTIVITY_ANALYSIS_POINTS);
    expect(analysis?.heartrate[0]).toEqual({ second: 0, value: 120 });
    expect(analysis?.heartrate.at(-1)?.value).toBe(heartrateSamples.at(-1));
  });
});
