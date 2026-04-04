import { describe, expect, it } from "bun:test";

import {
  createPlannerFormState,
  formatGoalLabel,
  parseRaceTimeToSeconds,
} from "./planner";

describe("planner helpers", () => {
  it("creates a form state from planner defaults", () => {
    const state = createPlannerFormState({
      goalCandidates: [
        {
          id: "goal-1",
          status: "active",
          goal: {
            type: "volume_goal",
            metric: "distance",
            period: "week",
            targetValue: 40,
            unit: "km",
          },
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      availability: null,
      historySnapshot: {
        generatedAt: "2026-04-01T00:00:00.000Z",
        detailedRuns: [],
        weeklyRollups: [],
      },
      historyQuality: {
        hasAnyHistory: false,
        meetsSnapshotThreshold: false,
        hasRecentSync: false,
        latestSyncWarnings: [],
        availableDateRange: { start: null, end: null },
      },
      performanceSnapshot: {
        allTimePrs: [],
        recentPrs: [],
        processingWarnings: [],
      },
      defaults: {
        userPerceivedAbility: "intermediate",
        estimatedRaceDistance: "10k",
        estimatedRaceTimeSeconds: 3000,
        longRunDay: "saturday",
        startDate: "2026-04-06",
        planDurationWeeks: 4,
      },
      activeDraft: null,
    });

    expect(state).toEqual({
      goalId: "goal-1",
      startDate: "2026-04-06",
      longRunDay: "saturday",
      planDurationWeeks: "4",
      userPerceivedAbility: "intermediate",
      estimatedRaceDistance: "10k",
      estimatedRaceTime: "50:00",
    });
  });

  it("parses mm:ss and hh:mm:ss race times", () => {
    expect(parseRaceTimeToSeconds("50:00")).toBe(3000);
    expect(parseRaceTimeToSeconds("1:35:30")).toBe(5730);
    expect(parseRaceTimeToSeconds("bad")).toBeNull();
  });

  it("formats goal labels for display", () => {
    expect(
      formatGoalLabel({
        id: "goal-1",
        status: "active",
        goal: {
          type: "event_goal",
          targetDistance: {
            value: 21.1,
            unit: "km",
          },
          targetDate: "2026-08-01",
          eventName: "Half race",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }),
    ).toBe("Half race (21.1km)");
  });
});
