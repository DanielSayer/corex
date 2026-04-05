import type { PlannerRouterOutputs } from "@/utils/types";

export type PlannerFormState = {
  planGoal: string;
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
    planGoal: state.defaults?.planGoal ?? "general_training",
    startDate: state.defaults?.startDate ?? "",
    longRunDay: state.defaults?.longRunDay ?? "saturday",
    planDurationWeeks: String(state.defaults?.planDurationWeeks ?? 4),
    userPerceivedAbility: state.defaults?.userPerceivedAbility ?? "beginner",
    estimatedRaceDistance:
      state.defaults?.raceBenchmark?.estimatedRaceDistance ?? "10k",
    estimatedRaceTime: formatSecondsToRaceTime(
      state.defaults?.raceBenchmark?.estimatedRaceTimeSeconds ?? null,
    ),
  };
}

export function formatPlanGoalLabel(
  goal: PlannerRouterOutputs["getState"]["planGoalOptions"][number],
) {
  return goal.label;
}

export function formatPlanGoalValueLabel(value: string) {
  switch (value) {
    case "race":
      return "Race";
    case "run_specific_distance":
      return "Run a specific distance";
    case "start_running":
      return "Start running";
    case "get_back_into_running":
      return "Get back into running";
    case "5k_improvement":
      return "5k improvement";
    case "general_training":
      return "General training";
    case "parkrun_improvement":
      return "parkrun improvement";
    default:
      return value;
  }
}

export function formatLongRunDayLabel(value: string) {
  if (value.length === 0) {
    return value;
  }

  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

export function formatUserPerceivedAbilityLabel(value: string) {
  if (value.length === 0) {
    return value;
  }

  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

export function formatRaceDistanceLabel(value: string) {
  switch (value) {
    case "5k":
      return "5k";
    case "10k":
      return "10k";
    case "half_marathon":
      return "Half marathon";
    case "marathon":
      return "Marathon";
    default:
      return value;
  }
}
