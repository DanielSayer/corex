import { describe, expect, it } from "bun:test";

import type { GoalProgressCard } from "../goal-progress/contracts";
import type { WeeklyPlanFinalized } from "../weekly-planning/contracts";
import {
  buildDashboardGoalRows,
  buildDashboardTodaySummary,
  buildDashboardWeeklySummary,
} from "./domain";

describe("dashboard domain", () => {
  it("builds same-weekday week-to-date comparisons in timezone", () => {
    const summary = buildDashboardWeeklySummary({
      now: new Date("2026-04-15T01:00:00.000Z"),
      timezone: "Australia/Brisbane",
      runs: [
        {
          startAt: new Date("2026-04-13T06:00:00.000Z"),
          distanceMeters: 5000,
          elapsedTimeSeconds: 1500,
        },
        {
          startAt: new Date("2026-04-15T00:30:00.000Z"),
          distanceMeters: 8000,
          elapsedTimeSeconds: 2480,
        },
        {
          startAt: new Date("2026-04-06T06:00:00.000Z"),
          distanceMeters: 4000,
          elapsedTimeSeconds: 1280,
        },
        {
          startAt: new Date("2026-04-07T06:00:00.000Z"),
          distanceMeters: 3000,
          elapsedTimeSeconds: 900,
        },
        {
          startAt: new Date("2026-04-08T07:00:00.000Z"),
          distanceMeters: 2000,
          elapsedTimeSeconds: 600,
        },
        {
          startAt: new Date("2026-04-09T06:00:00.000Z"),
          distanceMeters: 10000,
          elapsedTimeSeconds: 3000,
        },
      ],
    });

    expect(summary.weekToDate).toEqual({
      startDate: "2026-04-13",
      endDate: "2026-04-15",
    });
    expect(summary.distance.thisWeekMeters).toBe(13000);
    expect(summary.distance.vsLastWeekMeters).toBe(6000);
    expect(summary.pace.thisWeekSecPerKm).toBe(306.2);
    expect(summary.pace.vsLastWeekSecPerKm).toBe(-5.2);
    expect(summary.distance.series).toHaveLength(8);
    expect(summary.distance.series.at(-1)?.weekStart).toBe("2026-04-13");
    expect(
      summary.distance.series.find((point) => point.weekStart === "2026-04-06")
        ?.value,
    ).toBe(19000);
  });

  it("buckets linked runs by planned summary date for the weekly graph", () => {
    const summary = buildDashboardWeeklySummary({
      now: new Date("2026-04-15T01:00:00.000Z"),
      timezone: "Australia/Brisbane",
      runs: [
        {
          startAt: new Date("2026-04-05T05:00:00.000Z"),
          summaryDate: "2026-04-06",
          distanceMeters: 10000,
          elapsedTimeSeconds: 3000,
        },
        {
          startAt: new Date("2026-04-07T00:30:00.000Z"),
          distanceMeters: 5000,
          elapsedTimeSeconds: 1500,
        },
        {
          startAt: new Date("2026-03-31T00:30:00.000Z"),
          distanceMeters: 9000,
          elapsedTimeSeconds: 2700,
        },
      ],
    });

    expect(summary.distance.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekStart: "2026-03-30",
          value: 9000,
        }),
        expect.objectContaining({
          weekStart: "2026-04-06",
          value: 15000,
        }),
      ]),
    );
    expect(summary.distance.vsLastWeekMeters).toBe(-15000);
  });

  it("truncates to top three active goals and maps compact progress rows", () => {
    const goals = buildDashboardGoalRows([
      {
        goalId: "goal-1",
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
          periodStart: "2026-04-13",
          periodEnd: "2026-04-20",
          targetValue: 40,
          completedValue: 22,
          remainingValue: 18,
          percentComplete: 55,
          recentPeriods: [],
        },
      },
      {
        goalId: "goal-2",
        goalType: "event_goal",
        status: "active",
        title: "City Half",
        goal: {
          type: "event_goal",
          eventName: "City Half",
          targetDate: "2026-05-10",
          targetDistance: {
            value: 21.1,
            unit: "km",
          },
        },
        progress: {
          eventDate: "2026-05-10",
          daysRemaining: 25,
          targetDistance: {
            value: 21.1,
            unit: "km",
            meters: 21100,
          },
          recentWeeklyLoad: {
            currentWeekDistanceMeters: 20000,
            currentWeekDurationSeconds: 6000,
            trailingFourWeekAverageDistanceMeters: 18000,
            trailingFourWeekAverageDurationSeconds: 5400,
          },
          longestRecentRun: null,
          bestMatchingEffort: null,
          readiness: {
            score: 73,
            level: "building",
            summary: "Building",
            signals: [],
          },
        },
        readinessScore: 73,
      },
      {
        goalId: "goal-3",
        goalType: "volume_goal",
        status: "active",
        title: "Monthly time goal",
        goal: {
          type: "volume_goal",
          metric: "time",
          period: "month",
          targetValue: 300,
          unit: "minutes",
        },
        progress: null,
      },
      {
        goalId: "goal-4",
        goalType: "volume_goal",
        status: "active",
        title: "Overflow goal",
        goal: {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 30,
          unit: "km",
        },
        progress: null,
      },
    ] satisfies GoalProgressCard[]);

    expect(goals).toHaveLength(3);
    expect(goals.map((goal) => goal.goalId)).toEqual([
      "goal-1",
      "goal-2",
      "goal-3",
    ]);
    expect(goals[0]).toMatchObject({
      progressLabel: "18 km remaining",
      progressRatio: 0.55,
    });
    expect(goals[1]).toMatchObject({
      currentValue: 73,
      targetValue: 100,
      unit: "score",
    });
  });

  it("prefers finalized plan sessions for the today summary", () => {
    const summary = buildDashboardTodaySummary({
      now: new Date("2026-04-18T01:00:00.000Z"),
      timezone: "Australia/Brisbane",
      plan: {
        id: "plan-1",
        userId: "user-1",
        goalId: null,
        parentWeeklyPlanId: null,
        status: "finalized",
        startDate: "2026-04-13",
        endDate: "2026-04-19",
        generationContext: {} as WeeklyPlanFinalized["generationContext"],
        payload: {
          days: [
            {
              date: "2026-04-18",
              session: {
                sessionType: "workout",
                title: "Track session",
                summary: "5 x 1km",
                coachingNotes: null,
                estimatedDurationSeconds: 3600,
                estimatedDistanceMeters: 12000,
                intervalBlocks: [],
              },
            },
            ...Array.from({ length: 6 }, (_, index) => ({
              date: `2026-04-${String(13 + index).padStart(2, "0")}`,
              session: null,
            })),
          ],
        },
        qualityReport: null,
        createdAt: "2026-04-13T00:00:00.000Z",
        updatedAt: "2026-04-13T00:00:00.000Z",
      },
    });

    expect(summary).toMatchObject({
      localDate: "2026-04-18",
      state: "planned",
      title: "Track session",
      sessionType: "workout",
      estimatedDistanceMeters: 12000,
      estimatedDurationSeconds: 3600,
    });
  });
});
