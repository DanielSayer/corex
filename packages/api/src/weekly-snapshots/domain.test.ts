import { describe, expect, it } from "bun:test";

import type {
  EventGoalProgressCard,
  GoalProgressCard,
} from "../goal-progress/contracts";
import {
  buildWeeklySnapshotComparison,
  buildWeeklySnapshotHighlights,
  buildWeeklySnapshotTotals,
  buildWeeklyWrappedData,
  mapGoalProgressCardToWeeklySnapshot,
} from "./domain";

const volumeGoalCard: GoalProgressCard = {
  goalId: "goal-volume-1",
  goalType: "volume_goal",
  status: "active",
  title: "Weekly distance goal",
  goal: {
    type: "volume_goal",
    metric: "distance",
    period: "week",
    targetValue: 40,
    unit: "km",
  },
  progress: {
    metric: "distance",
    unit: "km",
    period: "week",
    periodStart: "2026-03-30T00:00:00.000Z",
    periodEnd: "2026-04-06T00:00:00.000Z",
    targetValue: 40,
    completedValue: 25,
    remainingValue: 15,
    percentComplete: 62.5,
    recentPeriods: [],
  },
};

const completedEventGoalCard: EventGoalProgressCard = {
  goalId: "goal-event-1",
  goalType: "event_goal",
  status: "completed",
  title: "City Half",
  goal: {
    type: "event_goal",
    targetDistance: {
      value: 21.1,
      unit: "km",
    },
    targetDate: "2026-04-05",
    eventName: "City Half",
  },
  progress: {
    eventDate: "2026-04-05",
    daysRemaining: -1,
    targetDistance: {
      value: 21.1,
      unit: "km",
      meters: 21097.5,
    },
    recentWeeklyLoad: {
      currentWeekDistanceMeters: 38000,
      currentWeekDurationSeconds: 12000,
      trailingFourWeekAverageDistanceMeters: 32000,
      trailingFourWeekAverageDurationSeconds: 10800,
    },
    longestRecentRun: {
      distanceMeters: 18000,
      startAt: "2026-04-01T06:00:00.000Z",
    },
    bestMatchingEffort: {
      distanceMeters: 21097.5,
      distanceLabel: "half marathon",
      durationSeconds: 5900,
      activityId: "run-pr",
      startAt: "2026-03-20T06:00:00.000Z",
      source: "exact",
    },
    readiness: {
      score: 74,
      level: "building",
      summary: "The block is taking shape.",
      signals: [
        {
          key: "countdown",
          label: "Countdown",
          value: "Event day has arrived",
          tone: "warning",
        },
      ],
    },
  },
  readinessScore: 74,
};

describe("weekly snapshots domain", () => {
  it("computes weekly totals and pace from runs", () => {
    const totals = buildWeeklySnapshotTotals([
      {
        startAt: new Date("2026-03-31T06:00:00.000Z"),
        distanceMeters: 10000,
        elapsedTimeSeconds: 3700,
        movingTimeSeconds: 3600,
      },
      {
        startAt: new Date("2026-04-02T06:00:00.000Z"),
        distanceMeters: 15000,
        elapsedTimeSeconds: 5500,
        movingTimeSeconds: 5400,
      },
    ]);

    expect(totals).toEqual({
      distanceMeters: 25000,
      runCount: 2,
      elapsedTimeSeconds: 9200,
      movingTimeSeconds: 9000,
      avgPaceSecPerKm: 360,
    });
  });

  it("computes week-over-week deltas when both weeks have totals", () => {
    const comparison = buildWeeklySnapshotComparison({
      current: {
        distanceMeters: 25000,
        runCount: 2,
        elapsedTimeSeconds: 9200,
        movingTimeSeconds: 9000,
        avgPaceSecPerKm: 360,
      },
      prior: {
        distanceMeters: 18000,
        runCount: 3,
        elapsedTimeSeconds: 7000,
        movingTimeSeconds: 6900,
        avgPaceSecPerKm: 383.3,
      },
    });

    expect(comparison).toEqual({
      distanceMetersDelta: 7000,
      runCountDelta: -1,
      avgPaceSecPerKmDelta: -23.3,
    });
  });

  it("selects highlights from the target week runs", () => {
    const highlights = buildWeeklySnapshotHighlights([
      {
        startAt: new Date("2026-03-31T06:00:00.000Z"),
        distanceMeters: 10000,
        elapsedTimeSeconds: 3700,
        movingTimeSeconds: 3600,
      },
      {
        startAt: new Date("2026-03-31T17:00:00.000Z"),
        distanceMeters: 5000,
        elapsedTimeSeconds: 1900,
        movingTimeSeconds: 1800,
      },
      {
        startAt: new Date("2026-04-02T06:00:00.000Z"),
        distanceMeters: 15000,
        elapsedTimeSeconds: 5200,
        movingTimeSeconds: 5100,
      },
    ]);

    expect(highlights).toEqual({
      bestDistanceDayMeters: 15000,
      longestRunMeters: 15000,
      fastestRunPaceSecPerKm: 340,
    });
  });

  it("maps live goal progress cards into frozen weekly goal snapshots", () => {
    expect(mapGoalProgressCardToWeeklySnapshot(volumeGoalCard)).toEqual({
      goalId: "goal-volume-1",
      goalType: "volume_goal",
      goalStatus: "active",
      title: "Weekly distance goal",
      currentValue: 25,
      targetValue: 40,
      remainingValue: 15,
      completionRatio: 0.625,
      readinessScore: null,
      unit: "km",
      periodLabel: "Weekly distance goal",
    });

    expect(mapGoalProgressCardToWeeklySnapshot(completedEventGoalCard)).toEqual(
      {
        goalId: "goal-event-1",
        goalType: "event_goal",
        goalStatus: "completed",
        title: "City Half",
        currentValue: 18,
        targetValue: 21.1,
        remainingValue: 3.1,
        completionRatio: 0.8531,
        readinessScore: 74,
        unit: "km",
        periodLabel: "Event goal",
      },
    );
  });

  it("builds a complete weekly wrapped payload", () => {
    const payload = buildWeeklyWrappedData({
      generatedAt: new Date("2026-04-06T01:00:00.000Z"),
      timezone: "Australia/Brisbane",
      weekStart: new Date("2026-03-29T14:00:00.000Z"),
      weekEnd: new Date("2026-04-05T14:00:00.000Z"),
      currentWeekRuns: [
        {
          startAt: new Date("2026-03-31T06:00:00.000Z"),
          distanceMeters: 10000,
          elapsedTimeSeconds: 3700,
          movingTimeSeconds: 3600,
        },
      ],
      priorWeekRuns: [
        {
          startAt: new Date("2026-03-25T06:00:00.000Z"),
          distanceMeters: 8000,
          elapsedTimeSeconds: 3100,
          movingTimeSeconds: 3000,
        },
      ],
      goalCards: [volumeGoalCard, completedEventGoalCard],
    });

    expect(payload).toEqual({
      shouldShow: true,
      generatedAt: "2026-04-06T01:00:00.000Z",
      period: {
        weekStart: "2026-03-29T14:00:00.000Z",
        weekEnd: "2026-04-05T14:00:00.000Z",
        timezone: "Australia/Brisbane",
      },
      totals: {
        distanceMeters: 10000,
        runCount: 1,
        elapsedTimeSeconds: 3700,
        movingTimeSeconds: 3600,
        avgPaceSecPerKm: 360,
      },
      comparisonVsPriorWeek: {
        distanceMetersDelta: 2000,
        runCountDelta: 0,
        avgPaceSecPerKmDelta: -15,
      },
      goals: [
        {
          goalId: "goal-volume-1",
          goalType: "volume_goal",
          goalStatus: "active",
          title: "Weekly distance goal",
          currentValue: 25,
          targetValue: 40,
          remainingValue: 15,
          completionRatio: 0.625,
          readinessScore: null,
          unit: "km",
          periodLabel: "Weekly distance goal",
        },
        {
          goalId: "goal-event-1",
          goalType: "event_goal",
          goalStatus: "completed",
          title: "City Half",
          currentValue: 18,
          targetValue: 21.1,
          remainingValue: 3.1,
          completionRatio: 0.8531,
          readinessScore: 74,
          unit: "km",
          periodLabel: "Event goal",
        },
      ],
      highlights: {
        bestDistanceDayMeters: 10000,
        longestRunMeters: 10000,
        fastestRunPaceSecPerKm: 360,
      },
    });
  });
});
