import type { PlannerRouterOutputs } from "@/utils/types";

export type PlannerFormState = {
  goalId: string;
  startDate: string;
  longRunDay: string;
  planDurationWeeks: string;
  userPerceivedAbility: string;
  estimatedRaceDistance: string;
  estimatedRaceTime: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatSecondsToRaceTime(totalSeconds: number | null) {
  if (totalSeconds == null || totalSeconds <= 0) {
    return "";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${minutes}:${pad(seconds)}`;
}

export function parseRaceTimeToSeconds(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split(":").map((part) => Number.parseInt(part, 10));

  if (
    parts.some((part) => Number.isNaN(part) || part < 0) ||
    parts.length < 2 ||
    parts.length > 3
  ) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!;
  }

  return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
}

export function createPlannerFormState(
  state: PlannerRouterOutputs["getState"],
): PlannerFormState {
  return {
    goalId: state.goalCandidates[0]?.id ?? "",
    startDate: state.defaults?.startDate ?? "",
    longRunDay: state.defaults?.longRunDay ?? "saturday",
    planDurationWeeks: String(state.defaults?.planDurationWeeks ?? 4),
    userPerceivedAbility: state.defaults?.userPerceivedAbility ?? "beginner",
    estimatedRaceDistance: state.defaults?.estimatedRaceDistance ?? "10k",
    estimatedRaceTime: formatSecondsToRaceTime(
      state.defaults?.estimatedRaceTimeSeconds ?? null,
    ),
  };
}

export function formatGoalLabel(
  goal: PlannerRouterOutputs["getState"]["goalCandidates"][number],
) {
  if (goal.goal.type === "event_goal") {
    const distance = `${goal.goal.targetDistance.value}${goal.goal.targetDistance.unit}`;
    return goal.goal.eventName?.trim()
      ? `${goal.goal.eventName} (${distance})`
      : `Event goal (${distance})`;
  }

  const unit = goal.goal.metric === "time" ? "minutes" : goal.goal.unit;
  return `${goal.goal.targetValue} ${unit} per ${goal.goal.period}`;
}
