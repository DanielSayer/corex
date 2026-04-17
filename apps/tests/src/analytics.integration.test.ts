import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveAnalyticsService } from "@corex/api/analytics/live";
import {
  importedActivity,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";
import { userTrainingPreference } from "@corex/db/schema/training-settings";

import { getIntegrationHarness, resetDatabase } from "./harness";

describe("analytics integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  }, 15_000);

  it("returns year-scoped distance trends, pr trends, overall prs, and longest run", async () => {
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
        name: "March progression",
        startAt: new Date("2026-03-02T06:00:00.000Z"),
        movingTimeSeconds: 1440,
        elapsedTimeSeconds: 1450,
        distanceMeters: 5000,
        totalElevationGainMeters: 100,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-apr-unclassified",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "April unclassified",
        startAt: new Date("2026-04-02T06:00:00.000Z"),
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1810,
        distanceMeters: 6000,
        totalElevationGainMeters: null,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "run-last-year",
        athleteId: "i509216",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        name: "Previous year run",
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

    const service = createLiveAnalyticsService({ db });
    const result = await Effect.runPromise(
      service.getForUser(user.id, {
        year: 2026,
      }),
    );

    expect(result.availableYears).toEqual([2025, 2026]);
    expect(result.selectedYear).toBe(2026);
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
        distanceMeters: 5000,
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
      },
      {
        distanceMeters: 10000,
        durationSeconds: 3050,
        activityId: "run-feb",
        monthKey: "2026-02",
      },
    ]);
    expect(result.terrainSummary).toMatchObject({
      totalRunCount: 4,
      classifiedRunCount: 3,
      unclassifiedRunCount: 1,
      classifiedDistanceMeters: 26000,
      classifiedElevationGainMeters: 280,
      dominantClass: "rolling",
    });
    expect(result.terrainSummary.classes).toEqual([
      expect.objectContaining({
        terrainClass: "flat",
        runCount: 1,
        distanceMeters: 5000,
      }),
      expect.objectContaining({
        terrainClass: "rolling",
        runCount: 1,
        distanceMeters: 16000,
      }),
      expect.objectContaining({
        terrainClass: "hilly",
        runCount: 1,
        distanceMeters: 5000,
      }),
    ]);
    expect(result.longestRun).toEqual({
      activityId: "run-feb",
      activityName: "February long run",
      distanceMeters: 16000,
      startAt: "2026-02-20T06:00:00.000Z",
    });
  });
});
