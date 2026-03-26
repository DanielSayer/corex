import { describe, expect, it } from "bun:test";

import {
  buildTrailingWeekBuckets,
  deriveHeartRateZoneTimes,
  getDistanceLabel,
  normalizeLatestSyncWarnings,
  trimRecentPrs,
  type PlanningPrSource,
} from "./domain";

describe("planning data domain", () => {
  it("builds trailing 7-day buckets anchored to now", () => {
    const now = new Date("2026-03-25T12:00:00.000Z");

    const buckets = buildTrailingWeekBuckets(now, 8);

    expect(buckets).toHaveLength(8);
    expect(buckets[0]).toEqual({
      weekIndex: 1,
      start: new Date("2026-03-18T12:00:00.000Z"),
      end: new Date("2026-03-25T12:00:00.000Z"),
    });
    expect(buckets[4]).toEqual({
      weekIndex: 5,
      start: new Date("2026-02-18T12:00:00.000Z"),
      end: new Date("2026-02-25T12:00:00.000Z"),
    });
  });

  it("derives heart-rate zone times from a stream and athlete max heart rate", () => {
    const zones = deriveHeartRateZoneTimes({
      heartRateSamples: [100, 125, 145, 165, 185],
      athleteMaxHeartRate: 200,
      movingTimeSeconds: 5,
    });

    expect(zones).toEqual({
      z1Seconds: 1,
      z2Seconds: 1,
      z3Seconds: 1,
      z4Seconds: 1,
      z5Seconds: 1,
    });
  });

  it("returns null zone fields when athlete max heart rate is unavailable", () => {
    expect(
      deriveHeartRateZoneTimes({
        heartRateSamples: [120, 130, 140],
        athleteMaxHeartRate: null,
        movingTimeSeconds: 3,
      }),
    ).toEqual({
      z1Seconds: null,
      z2Seconds: null,
      z3Seconds: null,
      z4Seconds: null,
      z5Seconds: null,
    });
  });

  it("normalizes sync warnings into planner-safe codes", () => {
    const warnings = normalizeLatestSyncWarnings({
      hasRecentSync: false,
      hasAnyHistory: true,
      latestSync: {
        status: "failure",
        failedDetailCount: 2,
        failedMapCount: 1,
        failedStreamCount: 3,
        skippedInvalidCount: 1,
        skippedNonRunningCount: 2,
        unknownActivityTypes: ["Ride"],
      },
    });

    expect(warnings).toEqual([
      "latest_sync_failed",
      "partial_detail_failures",
      "partial_map_failures",
      "partial_stream_failures",
      "invalid_runs_skipped",
      "unsupported_activity_types_skipped",
      "sync_stale",
    ]);
  });

  it("trims recent PRs to a trailing three-month window based on activity date", () => {
    const recentPrs: PlanningPrSource[] = [
      {
        distanceMeters: 5000,
        durationSeconds: 1200,
        activityId: "run-1",
        startAt: new Date("2026-03-01T00:00:00.000Z"),
        startSampleIndex: 0,
        endSampleIndex: 1200,
      },
      {
        distanceMeters: 10000,
        durationSeconds: 2500,
        activityId: "run-2",
        startAt: new Date("2026-01-10T00:00:00.000Z"),
        startSampleIndex: 0,
        endSampleIndex: 2500,
      },
      {
        distanceMeters: 400,
        durationSeconds: 78,
        activityId: "run-3",
        startAt: new Date("2025-12-20T00:00:00.000Z"),
        startSampleIndex: 0,
        endSampleIndex: 78,
      },
    ];

    const trimmed = trimRecentPrs(
      recentPrs,
      new Date("2026-03-25T00:00:00.000Z"),
    );

    expect(trimmed.map((entry) => entry.activityId)).toEqual([
      "run-1",
      "run-2",
    ]);
  });

  it("maps benchmark distances to planner labels", () => {
    expect(getDistanceLabel(400)).toBe("400m");
    expect(getDistanceLabel(1000)).toBe("1km");
    expect(getDistanceLabel(1609.344)).toBe("1 mile");
    expect(getDistanceLabel(5000)).toBe("5k");
    expect(getDistanceLabel(10000)).toBe("10k");
    expect(getDistanceLabel(21097.5)).toBe("half marathon");
    expect(getDistanceLabel(42195)).toBe("marathon");
  });
});
