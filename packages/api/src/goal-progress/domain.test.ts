import { describe, expect, it } from "bun:test";

import type { TrainingGoal } from "../training-settings/contracts";
import {
  buildEventGoalProgress,
  buildGoalProgressSyncState,
  buildVolumeGoalProgress,
  getGoalProgressStatus,
} from "./domain";
import { getLocalMonthRange, getLocalWeekRange } from "./timezones";

const weeklyDistanceGoal: Extract<TrainingGoal, { type: "volume_goal" }> = {
  type: "volume_goal",
  metric: "distance",
  period: "week",
  targetValue: 40,
  unit: "km",
};

describe("goal progress domain", () => {
  it("computes weekly distance goal progress and remaining volume", () => {
    const progress = buildVolumeGoalProgress({
      now: new Date("2026-04-03T12:00:00.000Z"),
      timezone: "UTC",
      goal: weeklyDistanceGoal,
      runs: [
        {
          startAt: new Date("2026-03-30T06:00:00.000Z"),
          distanceMeters: 12000,
          movingTimeSeconds: 3600,
        },
        {
          startAt: new Date("2026-04-01T06:00:00.000Z"),
          distanceMeters: 10000,
          movingTimeSeconds: 3200,
        },
        {
          startAt: new Date("2026-04-04T06:00:00.000Z"),
          distanceMeters: 3000,
          movingTimeSeconds: 1200,
        },
      ],
    });

    expect(progress).toMatchObject({
      completedValue: 25,
      remainingValue: 15,
      percentComplete: 62.5,
      period: "week",
      unit: "km",
    });
    expect(progress.recentPeriods).toHaveLength(4);
  });

  it("computes monthly time goal progress from current-month runs only", () => {
    const progress = buildVolumeGoalProgress({
      now: new Date("2026-04-18T12:00:00.000Z"),
      timezone: "UTC",
      goal: {
        type: "volume_goal",
        metric: "time",
        period: "month",
        targetValue: 300,
        unit: "minutes",
      },
      runs: [
        {
          startAt: new Date("2026-04-02T06:00:00.000Z"),
          distanceMeters: 10000,
          movingTimeSeconds: 5400,
        },
        {
          startAt: new Date("2026-04-10T06:00:00.000Z"),
          distanceMeters: 16000,
          movingTimeSeconds: 3600,
        },
        {
          startAt: new Date("2026-03-30T06:00:00.000Z"),
          distanceMeters: 5000,
          movingTimeSeconds: 1800,
        },
      ],
    });

    expect(progress.completedValue).toBe(150);
    expect(progress.remainingValue).toBe(150);
    expect(progress.percentComplete).toBe(50);
  });

  it("uses monday-start weeks and local month boundaries", () => {
    expect(
      getLocalWeekRange(new Date("2026-04-05T10:00:00.000Z"), "UTC"),
    ).toMatchObject({
      start: new Date("2026-03-30T00:00:00.000Z"),
      end: new Date("2026-04-06T00:00:00.000Z"),
    });
    expect(
      getLocalMonthRange(new Date("2026-04-18T10:00:00.000Z"), "UTC"),
    ).toMatchObject({
      start: new Date("2026-04-01T00:00:00.000Z"),
      end: new Date("2026-05-01T00:00:00.000Z"),
    });
  });

  it("uses timezone-aware week boundaries for volume goals", () => {
    const progress = buildVolumeGoalProgress({
      now: new Date("2026-04-03T12:00:00.000Z"),
      timezone: "Australia/Brisbane",
      goal: weeklyDistanceGoal,
      runs: [
        {
          startAt: new Date("2026-03-29T15:30:00.000Z"),
          distanceMeters: 7000,
          movingTimeSeconds: 2400,
        },
        {
          startAt: new Date("2026-03-29T13:30:00.000Z"),
          distanceMeters: 5000,
          movingTimeSeconds: 1800,
        },
      ],
    });

    expect(progress.completedValue).toBe(7);
    expect(progress.periodStart).toBe("2026-03-29T14:00:00.000Z");
    expect(progress.periodEnd).toBe("2026-04-05T14:00:00.000Z");
  });

  it("maps no-goal, missing-history, stale-history, and ready states", () => {
    expect(
      getGoalProgressStatus({
        goal: null,
        hasAnyHistory: false,
        hasRecentSync: false,
      }),
    ).toBe("no_goal");
    expect(
      getGoalProgressStatus({
        goal: weeklyDistanceGoal,
        hasAnyHistory: false,
        hasRecentSync: false,
      }),
    ).toBe("missing_history");
    expect(
      getGoalProgressStatus({
        goal: weeklyDistanceGoal,
        hasAnyHistory: true,
        hasRecentSync: false,
      }),
    ).toBe("stale_history");
    expect(
      getGoalProgressStatus({
        goal: weeklyDistanceGoal,
        hasAnyHistory: true,
        hasRecentSync: true,
      }),
    ).toBe("ready");
    expect(
      buildGoalProgressSyncState({
        status: "stale_history",
        hasAnyHistory: true,
        hasRecentSync: false,
        latestSyncWarnings: ["sync_stale"],
        availableDateRange: {
          start: "2026-03-01T00:00:00.000Z",
          end: "2026-04-01T00:00:00.000Z",
        },
      }).recommendedAction,
    ).toBe("sync_history");
  });

  it("builds event readiness with nearest best effort fallback", () => {
    const progress = buildEventGoalProgress({
      now: new Date("2026-04-03T12:00:00.000Z"),
      timezone: "UTC",
      goal: {
        type: "event_goal",
        targetDistance: {
          value: 15,
          unit: "km",
        },
        targetDate: "2026-05-10",
        eventName: "River Run",
      },
      runs: [
        {
          startAt: new Date("2026-03-31T06:00:00.000Z"),
          distanceMeters: 14000,
          movingTimeSeconds: 4800,
        },
        {
          startAt: new Date("2026-03-26T06:00:00.000Z"),
          distanceMeters: 10000,
          movingTimeSeconds: 3400,
        },
      ],
      prs: [
        {
          distanceMeters: 10000,
          durationSeconds: 2500,
          activityId: "run-10k",
          startAt: new Date("2026-03-15T06:00:00.000Z"),
          startSampleIndex: 0,
          endSampleIndex: 2500,
        },
      ],
    });

    expect(progress.daysRemaining).toBeGreaterThan(0);
    expect(progress.longestRecentRun).toMatchObject({
      distanceMeters: 14000,
    });
    expect(progress.bestMatchingEffort).toMatchObject({
      distanceMeters: 10000,
      source: "nearest",
    });
    expect(progress.readiness.signals.map((signal) => signal.key)).toEqual([
      "countdown",
      "weekly_load",
      "long_run",
      "best_effort",
    ]);
  });

  it("uses timezone-aware local dates for event countdown", () => {
    const progress = buildEventGoalProgress({
      now: new Date("2026-04-03T14:30:00.000Z"),
      timezone: "Australia/Brisbane",
      goal: {
        type: "event_goal",
        targetDistance: {
          value: 10,
          unit: "km",
        },
        targetDate: "2026-04-04",
        eventName: "Local 10k",
      },
      runs: [],
      prs: [],
    });

    expect(progress.daysRemaining).toBe(0);
  });
});
