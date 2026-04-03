import type { GoalProgressRouterOutputs } from "@/utils/types";

type GoalProgressCard = GoalProgressRouterOutputs["get"]["activeGoals"][number];
type CompletedGoalProgressCard =
  GoalProgressRouterOutputs["get"]["completedGoals"][number];

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatGoalCardValue(
  value: number | null,
  unit: string | null,
  goalType:
    | GoalProgressCard["goalType"]
    | CompletedGoalProgressCard["goalType"],
) {
  if (value == null) {
    return "0";
  }

  if (goalType === "event_goal") {
    return String(value);
  }

  if (unit === "minutes") {
    return String(Math.round(value));
  }

  return value.toFixed(value >= 100 ? 0 : 1).replace(/\.0$/, "");
}

export function formatProgressPercent(value: number | null) {
  return Math.round(value ?? 0);
}

export function formatGoalStatusText(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    const daysRemaining = card.progress?.daysRemaining ?? null;

    if (card.status === "completed") {
      return "Completed";
    }

    if (daysRemaining == null) {
      return "Event goal";
    }

    if (daysRemaining <= 0) {
      return "Event day";
    }

    return `${daysRemaining} days left`;
  }

  return card.goal.period === "week" ? "Weekly" : "Monthly";
}

export function formatGoalSubtext(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return (
      card.progress?.readiness.summary ?? "Sync history to score readiness."
    );
  }

  return card.goal.metric === "distance"
    ? "Recurring volume target"
    : "Recurring time target";
}

export function formatRemainingLabel(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (!card.progress) {
    return "Sync history to calculate progress";
  }

  if (card.goalType === "event_goal") {
    return `${formatProgressPercent(card.readinessScore)} readiness`;
  }

  const remaining = card.progress.remainingValue;
  return `${formatGoalCardValue(remaining, card.progress.unit, card.goalType)} ${card.progress.unit} remaining`;
}

export function getProgressPercent(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return formatProgressPercent(card.readinessScore);
  }

  return formatProgressPercent(card.progress?.percentComplete ?? 0);
}

export function getCurrentValue(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return formatProgressPercent(card.readinessScore);
  }

  return formatGoalCardValue(
    card.progress?.completedValue ?? null,
    card.progress?.unit ?? null,
    card.goalType,
  );
}

export function getTargetValue(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return "100";
  }

  return formatGoalCardValue(
    card.progress?.targetValue ?? card.goal.targetValue,
    card.progress?.unit ?? card.goal.unit,
    card.goalType,
  );
}

export function getUnitLabel(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return "score";
  }

  return card.progress?.unit ?? card.goal.unit;
}

export function getGoalLabel(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType === "event_goal") {
    return "Event";
  }

  return card.goal.metric === "distance" ? "Distance" : "Time";
}

export function getSignalSummary(
  card: GoalProgressCard | CompletedGoalProgressCard,
) {
  if (card.goalType !== "event_goal") {
    return null;
  }

  return card.progress?.readiness.signals.slice(0, 2) ?? [];
}
