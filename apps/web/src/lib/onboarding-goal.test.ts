import { describe, expect, it } from "bun:test";

import type { GoalDraft } from "@/lib/onboarding";

import { getNextGoalDraft } from "./onboarding-goal";

describe("getNextGoalDraft", () => {
  it("keeps the same event goal draft when the selected type is clicked again", () => {
    const currentGoal: GoalDraft = {
      type: "event_goal",
      targetDistanceValue: "21.1",
      targetDistanceUnit: "km",
      targetDate: "2026-09-01",
      eventName: "Gold Coast Half",
      targetTimeHours: "1",
      targetTimeMinutes: "35",
      targetTimeSeconds: "0",
      notes: "Goal race",
    };

    expect(getNextGoalDraft(currentGoal, "event_goal")).toBe(currentGoal);
  });

  it("keeps the same volume goal draft when the selected type is clicked again", () => {
    const currentGoal: GoalDraft = {
      type: "volume_goal",
      metric: "distance",
      period: "month",
      targetValue: "180",
      unit: "mi",
      notes: "Base phase",
    };

    expect(getNextGoalDraft(currentGoal, "volume_goal")).toBe(currentGoal);
  });

  it("creates a fresh event goal when switching from volume goal", () => {
    const currentGoal: GoalDraft = {
      type: "volume_goal",
      metric: "time",
      period: "week",
      targetValue: "240",
      unit: "minutes",
      notes: "Steady build",
    };

    expect(getNextGoalDraft(currentGoal, "event_goal")).toEqual({
      type: "event_goal",
      targetDistanceValue: "10",
      targetDistanceUnit: "km",
      targetDate: "",
      eventName: "",
      targetTimeHours: "",
      targetTimeMinutes: "",
      targetTimeSeconds: "",
      notes: "",
    });
  });

  it("creates a fresh volume goal when switching from event goal", () => {
    const currentGoal: GoalDraft = {
      type: "event_goal",
      targetDistanceValue: "42.2",
      targetDistanceUnit: "km",
      targetDate: "2026-10-11",
      eventName: "Marathon",
      targetTimeHours: "3",
      targetTimeMinutes: "15",
      targetTimeSeconds: "0",
      notes: "A race",
    };

    expect(getNextGoalDraft(currentGoal, "volume_goal")).toEqual({
      type: "volume_goal",
      metric: "distance",
      period: "week",
      targetValue: "40",
      unit: "km",
      notes: "",
    });
  });
});
