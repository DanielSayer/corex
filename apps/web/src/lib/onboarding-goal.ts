import type { GoalDraft } from "@/lib/onboarding";

export function getNextGoalDraft(
  currentGoal: GoalDraft,
  nextType: GoalDraft["type"],
): GoalDraft {
  if (currentGoal.type === nextType) {
    return currentGoal;
  }

  if (nextType === "event_goal") {
    return {
      type: "event_goal",
      targetDistanceValue: "10",
      targetDistanceUnit: "km",
      targetDate: "",
      eventName: "",
      targetTimeHours: "",
      targetTimeMinutes: "",
      targetTimeSeconds: "",
      notes: "",
    };
  }

  return {
    type: "volume_goal",
    metric: "distance",
    period: "week",
    targetValue: "40",
    unit: "km",
    notes: "",
  };
}
