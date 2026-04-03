import { describe, expect, it } from "bun:test";

import type { GoalProgressRouterOutputs } from "@/utils/types";

import {
  formatGoalStatusText,
  formatProgressPercent,
  getProgressPercent,
  getTargetValue,
} from "./goal-progress-presenter";

type ActiveGoal = GoalProgressRouterOutputs["get"]["activeGoals"][number];

const volumeCard: ActiveGoal = {
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
    periodStart: "2026-03-29T14:00:00.000Z",
    periodEnd: "2026-04-05T14:00:00.000Z",
    targetValue: 40,
    completedValue: 22,
    remainingValue: 18,
    percentComplete: 55,
    recentPeriods: [],
  },
};

const eventCard: ActiveGoal = {
  goalId: "goal-2",
  goalType: "event_goal",
  status: "active",
  title: "City Half",
  goal: {
    type: "event_goal",
    targetDistance: {
      value: 21.1,
      unit: "km",
    },
    targetDate: "2026-05-10",
    eventName: "City Half",
  },
  readinessScore: 74,
  progress: {
    eventDate: "2026-05-10",
    daysRemaining: 12,
    targetDistance: {
      value: 21.1,
      unit: "km",
      meters: 21097.5,
    },
    recentWeeklyLoad: {
      currentWeekDistanceMeters: 22000,
      currentWeekDurationSeconds: 6800,
      trailingFourWeekAverageDistanceMeters: 18000,
      trailingFourWeekAverageDurationSeconds: 5400,
    },
    longestRecentRun: null,
    bestMatchingEffort: null,
    readiness: {
      score: 74,
      level: "building",
      summary: "The block is taking shape.",
      signals: [],
    },
  },
};

describe("goal progress presenter", () => {
  it("formats volume goal labels and target values", () => {
    expect(formatGoalStatusText(volumeCard)).toBe("Weekly");
    expect(getTargetValue(volumeCard)).toBe("40");
  });

  it("formats event progress from readiness score", () => {
    expect(getProgressPercent(eventCard)).toBe(74);
    expect(formatGoalStatusText(eventCard)).toBe("12 days left");
    expect(getTargetValue(eventCard)).toBe("100");
  });

  it("rounds progress percentages safely", () => {
    expect(formatProgressPercent(55.4)).toBe(55);
    expect(formatProgressPercent(null)).toBe(0);
  });
});
