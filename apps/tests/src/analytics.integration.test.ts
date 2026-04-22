import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveAnalyticsService } from "@corex/api/analytics/live";
import {
  importedActivity,
  importedActivityInterval,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";
import { userTrainingPreference } from "@corex/db/schema/training-settings";

import { getIntegrationHarness, resetDatabase } from "./harness";

describe("analytics integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  }, 15_000);

  it("returns enriched year-scoped analytics for the dashboard", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "analytics@example.com",
      name: "Analytics User",
    });
    const otherUser = await createUser(db, {
      email: "other-analytics@example.com",
      name: "Other Analytics",
    });
    await db.insert(userTrainingPreference).values({
      userId: user.id,
      timezone: "Australia/Brisbane",
    });

    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "run-jan",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "January progression",
        startAt: new Date("2026-01-15T06:00:00.000Z"),
        movingTimeSeconds: 1500,
        elapsedTimeSeconds: 1510,
        distanceMeters: 5000,
        totalElevationGainMeters: 20,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-feb",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "February long run",
        startAt: new Date("2026-02-20T06:00:00.000Z"),
        movingTimeSeconds: 3200,
        elapsedTimeSeconds: 3210,
        distanceMeters: 16000,
        totalElevationGainMeters: 160,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-mar",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "March tempo session",
        startAt: new Date("2026-03-02T06:00:00.000Z"),
        movingTimeSeconds: 2100,
        elapsedTimeSeconds: 2110,
        distanceMeters: 7000,
        totalElevationGainMeters: 100,
        rawDetail: {
          interval_summary: ["tempo session"],
        },
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-intervals",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "April track workout",
        startAt: new Date("2026-04-02T06:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810,
        distanceMeters: 6000,
        totalElevationGainMeters: 60,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-jan-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous January run",
        startAt: new Date("2025-01-10T06:00:00.000Z"),
        movingTimeSeconds: 1200,
        elapsedTimeSeconds: 1210,
        distanceMeters: 4000,
        totalElevationGainMeters: 40,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-feb-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous February run",
        startAt: new Date("2025-02-15T06:00:00.000Z"),
        movingTimeSeconds: 2900,
        elapsedTimeSeconds: 2910,
        distanceMeters: 12000,
        totalElevationGainMeters: 120,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-mar-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous March run",
        startAt: new Date("2025-03-02T06:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810,
        distanceMeters: 6000,
        totalElevationGainMeters: 80,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-before-cutoff-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous April early run",
        startAt: new Date("2025-04-10T06:00:00.000Z"),
        movingTimeSeconds: 1000,
        elapsedTimeSeconds: 1010,
        distanceMeters: 3000,
        totalElevationGainMeters: 30,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-after-cutoff-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous April late run",
        startAt: new Date("2025-04-30T06:00:00.000Z"),
        movingTimeSeconds: 3300,
        elapsedTimeSeconds: 3310,
        distanceMeters: 10000,
        totalElevationGainMeters: 140,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-dec-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous December run",
        startAt: new Date("2025-12-10T06:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810,
        distanceMeters: 8000,
        totalElevationGainMeters: 200,
        rawDetail: {},
      },
      {
        userId: otherUser.id,
        upstreamActivityId: "other-user-hilly",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Other user hilly",
        startAt: new Date("2026-01-20T06:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810,
        distanceMeters: 5000,
        totalElevationGainMeters: 200,
        rawDetail: {},
      },
    ]);

    await db.insert(importedActivityInterval).values([
      {
        userId: user.id,
        upstreamActivityId: "run-apr-intervals",
        intervalIndex: 0,
        intervalType: "WORK",
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-intervals",
        intervalIndex: 1,
        intervalType: "RECOVERY",
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-intervals",
        intervalIndex: 2,
        intervalType: "WORK",
      },
    ]);

    await db.insert(userMonthlyBest).values([
      {
        userId: user.id,
        monthStart: new Date("2026-01-01T00:00:00.000Z"),
        distanceMeters: 5000,
        upstreamActivityId: "run-jan",
        durationSeconds: 1500,
        startSampleIndex: 0,
        endSampleIndex: 1,
      },
      {
        userId: user.id,
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        distanceMeters: 5000,
        upstreamActivityId: "run-mar",
        durationSeconds: 1440,
        startSampleIndex: 0,
        endSampleIndex: 1,
      },
      {
        userId: user.id,
        monthStart: new Date("2026-02-01T00:00:00.000Z"),
        distanceMeters: 10000,
        upstreamActivityId: "run-feb",
        durationSeconds: 3050,
        startSampleIndex: 0,
        endSampleIndex: 1,
      },
    ]);

    await db.insert(userAllTimePr).values([
      {
        userId: user.id,
        distanceMeters: 5000,
        upstreamActivityId: "run-mar",
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        durationSeconds: 1440,
        startSampleIndex: 0,
        endSampleIndex: 1,
      },
      {
        userId: user.id,
        distanceMeters: 10000,
        upstreamActivityId: "run-feb",
        monthStart: new Date("2026-02-01T00:00:00.000Z"),
        durationSeconds: 3050,
        startSampleIndex: 0,
        endSampleIndex: 1,
      },
    ]);

    const service = createLiveAnalyticsService({
      db,
      clock: {
        now: () => new Date("2026-04-22T05:30:00.000Z"),
      },
    });
    const result = await Effect.runPromise(
      service.getForUser(user.id, {
        year: 2026,
      }),
    );

    expect(result.availableYears).toEqual([2025, 2026]);
    expect(result.selectedYear).toBe(2026);
    expect(result.overview).toEqual({
      totalDistance: {
        distanceMeters: 34000,
        comparisonYear: 2025,
        comparisonDistanceMeters: 25000,
        deltaPercent: 36,
        cutoffDateKey: "2026-04-22",
        isPartialYear: true,
      },
      longestRunInYear: {
        activityId: "run-feb",
        activityName: "February long run",
        distanceMeters: 16000,
        startAt: "2026-02-20T06:00:00.000Z",
      },
      trackedPrDistanceCount: 2,
      allTimePrCount: 2,
      activeMonths: {
        count: 4,
        elapsedCount: 4,
        rangeLabel: "Jan - Apr",
      },
    });
    expect(result.distanceTrends.month.slice(0, 3)).toEqual([
      expect.objectContaining({
        key: "2026-01",
        label: "Jan",
        distanceMeters: 5000,
      }),
      expect.objectContaining({
        key: "2026-02",
        label: "Feb",
        distanceMeters: 16000,
      }),
      expect.objectContaining({
        key: "2026-03",
        label: "Mar",
        distanceMeters: 7000,
      }),
    ]);
    expect(
      result.distanceTrends.week.some(
        (bucket) => bucket.distanceMeters === 16000,
      ),
    ).toBe(true);
    expect(result.prTrends.distances).toEqual([5000, 10000]);
    expect(result.prTrends.series[0]).toEqual({
      distanceMeters: 5000,
      months: [
        {
          monthKey: "2026-01-01",
          label: "Jan",
          durationSeconds: 1500,
        },
        {
          monthKey: "2026-02-01",
          label: "Feb",
          durationSeconds: null,
        },
        {
          monthKey: "2026-03-01",
          label: "Mar",
          durationSeconds: 1440,
        },
        ...Array.from({ length: 9 }, (_, index) => ({
          monthKey: `2026-${String(index + 4).padStart(2, "0")}-01`,
          label: new Date(
            `2026-${String(index + 4).padStart(2, "0")}-01T00:00:00.000Z`,
          ).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
          durationSeconds: null,
        })),
      ],
    });
    expect(result.overallPrs).toEqual([
      {
        distanceMeters: 5000,
        durationSeconds: 1440,
        activityId: "run-mar",
        monthKey: "2026-03",
        achievedAt: "2026-03-02T06:00:00.000Z",
      },
      {
        distanceMeters: 10000,
        durationSeconds: 3050,
        activityId: "run-feb",
        monthKey: "2026-02",
        achievedAt: "2026-02-20T06:00:00.000Z",
      },
    ]);
    expect(result.trainingMix.totalDistanceMeters).toBe(34000);
    expect(result.trainingMix.buckets.map((bucket) => bucket.key)).toEqual([
      "easy",
      "long_run",
      "tempo",
      "intervals",
    ]);
    expect(result.trainingMix.buckets).toEqual([
      expect.objectContaining({
        key: "easy",
        distanceMeters: 5000,
        runCount: 1,
      }),
      expect.objectContaining({
        key: "long_run",
        distanceMeters: 16000,
        runCount: 1,
      }),
      expect.objectContaining({
        key: "tempo",
        distanceMeters: 7000,
        runCount: 1,
      }),
      expect.objectContaining({
        key: "intervals",
        distanceMeters: 6000,
        runCount: 1,
      }),
    ]);
    expect(
      result.trainingMix.buckets.find((bucket) => bucket.key === "easy")
        ?.sharePercent,
    ).toBeCloseTo(14.705882, 5);
    expect(
      result.trainingMix.buckets.find((bucket) => bucket.key === "long_run")
        ?.sharePercent,
    ).toBeCloseTo(47.058823, 5);
    expect(
      result.trainingMix.buckets.find((bucket) => bucket.key === "tempo")
        ?.sharePercent,
    ).toBeCloseTo(20.588235, 5);
    expect(
      result.trainingMix.buckets.find((bucket) => bucket.key === "intervals")
        ?.sharePercent,
    ).toBeCloseTo(17.647058, 5);
    expect(result.consistency).toEqual({
      activeMonthCount: 4,
      elapsedMonthCount: 4,
      ratio: 1,
      percent: 100,
      months: [
        { key: "2026-01", label: "Jan", isElapsed: true, isActive: true },
        { key: "2026-02", label: "Feb", isElapsed: true, isActive: true },
        { key: "2026-03", label: "Mar", isElapsed: true, isActive: true },
        { key: "2026-04", label: "Apr", isElapsed: true, isActive: true },
        { key: "2026-05", label: "May", isElapsed: false, isActive: false },
        { key: "2026-06", label: "Jun", isElapsed: false, isActive: false },
        { key: "2026-07", label: "Jul", isElapsed: false, isActive: false },
        { key: "2026-08", label: "Aug", isElapsed: false, isActive: false },
        { key: "2026-09", label: "Sep", isElapsed: false, isActive: false },
        { key: "2026-10", label: "Oct", isElapsed: false, isActive: false },
        { key: "2026-11", label: "Nov", isElapsed: false, isActive: false },
        { key: "2026-12", label: "Dec", isElapsed: false, isActive: false },
      ],
    });
    expect(result.terrainSummary).toMatchObject({
      totalRunCount: 4,
      classifiedRunCount: 4,
      unclassifiedRunCount: 0,
      classifiedDistanceMeters: 34000,
      classifiedElevationGainMeters: 340,
      dominantClass: "rolling",
    });
    expect(result.longestRun).toEqual({
      activityId: "run-feb",
      activityName: "February long run",
      distanceMeters: 16000,
      startAt: "2026-02-20T06:00:00.000Z",
    });
  });
});
