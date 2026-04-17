import { describe, expect, it } from "bun:test";

import {
  createPlannerFormState,
  formatLongRunDayLabel,
  formatPlanGoalLabel,
  formatPlanGoalValueLabel,
  formatRaceDistanceLabel,
  formatUserPerceivedAbilityLabel,
  parseRaceTimeToSeconds,
} from "./planner";

describe("planner helpers", () => {
  it("creates a form state from planner defaults", () => {
    const state = createPlannerFormState({
      planGoalOptions: [
        {
          value: "general_training",
          label: "General training",
          description: "General training plan",
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
        planGoal: "general_training",
        userPerceivedAbility: "intermediate",
        raceBenchmark: {
          estimatedRaceDistance: "10k",
          estimatedRaceTimeSeconds: 3000,
        },
        longRunDay: "saturday",
        startDate: "2026-04-06",
        planDurationWeeks: 4,
      },
      activeDraft: null,
      currentFinalizedPlan: null,
      currentFinalizedPlanAdherence: null,
    });

    expect(state).toEqual({
      planGoal: "general_training",
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
      formatPlanGoalLabel({
        value: "race",
        label: "Race",
        description: "Booked in a race and want this plan shaped around it.",
      }),
    ).toBe("Race");
  });

  it("formats selected planner values for display", () => {
    expect(formatPlanGoalValueLabel("start_running")).toBe("Start running");
    expect(formatLongRunDayLabel("sunday")).toBe("Sunday");
    expect(formatUserPerceivedAbilityLabel("beginner")).toBe("Beginner");
    expect(formatRaceDistanceLabel("half_marathon")).toBe("Half marathon");
  });
});
