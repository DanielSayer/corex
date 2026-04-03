import type { TrainingGoal } from "../training-settings/contracts";

export type GoalStatus = "active" | "completed";

export function getGoalStatus(goal: TrainingGoal, today: string): GoalStatus {
  if (goal.type === "volume_goal") {
    return "active";
  }

  return goal.targetDate < today ? "completed" : "active";
}
