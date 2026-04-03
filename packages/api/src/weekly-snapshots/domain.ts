import type {
  EventGoalProgressCard,
  GoalProgressCard,
} from "../goal-progress/contracts";
import type { WeeklyWrappedData, WeeklyWrappedGoalSnapshot } from "./contracts";

export type WeeklySnapshotRun = {
  startAt: Date;
  distanceMeters: number;
  elapsedTimeSeconds: number | null;
  movingTimeSeconds: number;
};

type WeeklySnapshotTotals = NonNullable<WeeklyWrappedData["totals"]>;

function round(value: number, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function getAveragePaceSecPerKm(
  run: Pick<WeeklySnapshotRun, "distanceMeters" | "movingTimeSeconds">,
) {
  if (run.distanceMeters <= 0 || run.movingTimeSeconds <= 0) {
    return null;
  }

  return round(run.movingTimeSeconds / (run.distanceMeters / 1000), 1);
}

function getDistanceDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildWeeklySnapshotTotals(
  runs: WeeklySnapshotRun[],
): WeeklySnapshotTotals | null {
  if (runs.length === 0) {
    return null;
  }

  const totals = runs.reduce(
    (acc, run) => ({
      distanceMeters: acc.distanceMeters + run.distanceMeters,
      runCount: acc.runCount + 1,
      elapsedTimeSeconds:
        acc.elapsedTimeSeconds + (run.elapsedTimeSeconds ?? 0),
      movingTimeSeconds: acc.movingTimeSeconds + run.movingTimeSeconds,
    }),
    {
      distanceMeters: 0,
      runCount: 0,
      elapsedTimeSeconds: 0,
      movingTimeSeconds: 0,
    },
  );

  return {
    ...totals,
    avgPaceSecPerKm:
      totals.distanceMeters > 0
        ? round(totals.movingTimeSeconds / (totals.distanceMeters / 1000), 1)
        : null,
  };
}

export function buildWeeklySnapshotComparison(input: {
  current: WeeklySnapshotTotals | null;
  prior: WeeklySnapshotTotals | null;
}): WeeklyWrappedData["comparisonVsPriorWeek"] {
  if (!input.current || !input.prior) {
    return null;
  }

  return {
    distanceMetersDelta: round(
      input.current.distanceMeters - input.prior.distanceMeters,
      1,
    ),
    runCountDelta: input.current.runCount - input.prior.runCount,
    avgPaceSecPerKmDelta:
      input.current.avgPaceSecPerKm == null ||
      input.prior.avgPaceSecPerKm == null
        ? null
        : round(input.current.avgPaceSecPerKm - input.prior.avgPaceSecPerKm, 1),
  };
}

export function buildWeeklySnapshotHighlights(
  runs: WeeklySnapshotRun[],
): WeeklyWrappedData["highlights"] {
  if (runs.length === 0) {
    return null;
  }

  const dailyDistance = new Map<string, number>();

  for (const run of runs) {
    const key = getDistanceDayKey(run.startAt);
    dailyDistance.set(key, (dailyDistance.get(key) ?? 0) + run.distanceMeters);
  }

  const bestDistanceDayMeters = [...dailyDistance.values()].reduce(
    (best, value) => (value > best ? value : best),
    0,
  );
  const longestRunMeters = runs.reduce(
    (best, run) => (run.distanceMeters > best ? run.distanceMeters : best),
    0,
  );
  const fastestRunPaceSecPerKm = runs.reduce<number | null>((best, run) => {
    const pace = getAveragePaceSecPerKm(run);

    if (pace == null) {
      return best;
    }

    if (best == null || pace < best) {
      return pace;
    }

    return best;
  }, null);

  return {
    bestDistanceDayMeters: bestDistanceDayMeters || null,
    longestRunMeters: longestRunMeters || null,
    fastestRunPaceSecPerKm,
  };
}

function mapEventGoalProgressCard(
  card: EventGoalProgressCard,
): WeeklyWrappedGoalSnapshot {
  const unit = card.goal.targetDistance.unit;
  const divisor = unit === "mi" ? 1609.344 : 1000;
  const currentValue =
    card.progress?.longestRecentRun != null
      ? round(card.progress.longestRecentRun.distanceMeters / divisor, 4)
      : null;
  const targetValue = round(card.goal.targetDistance.value, 4);
  const remainingValue =
    currentValue == null
      ? null
      : round(Math.max(targetValue - currentValue, 0), 4);
  const completionRatio =
    currentValue == null || targetValue <= 0
      ? null
      : round(Math.min(currentValue / targetValue, 1), 4);

  return {
    goalId: card.goalId,
    goalType: card.goalType,
    goalStatus: card.status,
    title: card.title,
    currentValue,
    targetValue,
    remainingValue,
    completionRatio,
    readinessScore: card.readinessScore,
    unit,
    periodLabel: "Event goal",
  };
}

export function mapGoalProgressCardToWeeklySnapshot(
  card: GoalProgressCard | EventGoalProgressCard,
): WeeklyWrappedGoalSnapshot {
  if (card.goalType === "event_goal") {
    return mapEventGoalProgressCard(card);
  }

  return {
    goalId: card.goalId,
    goalType: card.goalType,
    goalStatus: card.status,
    title: card.title,
    currentValue: card.progress?.completedValue ?? null,
    targetValue: card.progress?.targetValue ?? card.goal.targetValue,
    remainingValue: card.progress?.remainingValue ?? null,
    completionRatio:
      card.progress?.percentComplete == null
        ? null
        : round(card.progress.percentComplete / 100, 4),
    readinessScore: null,
    unit: card.progress?.unit ?? card.goal.unit,
    periodLabel: card.title,
  };
}

export function buildWeeklyWrappedData(input: {
  generatedAt: Date;
  timezone: string;
  weekStart: Date;
  weekEnd: Date;
  currentWeekRuns: WeeklySnapshotRun[];
  priorWeekRuns: WeeklySnapshotRun[];
  goalCards: Array<GoalProgressCard | EventGoalProgressCard>;
}): WeeklyWrappedData {
  const totals = buildWeeklySnapshotTotals(input.currentWeekRuns);
  const priorTotals = buildWeeklySnapshotTotals(input.priorWeekRuns);

  return {
    shouldShow: input.currentWeekRuns.length > 0 || input.goalCards.length > 0,
    generatedAt: toIsoString(input.generatedAt),
    period: {
      weekStart: toIsoString(input.weekStart),
      weekEnd: toIsoString(input.weekEnd),
      timezone: input.timezone,
    },
    totals,
    comparisonVsPriorWeek: buildWeeklySnapshotComparison({
      current: totals,
      prior: priorTotals,
    }),
    goals: input.goalCards.map(mapGoalProgressCardToWeeklySnapshot),
    highlights: buildWeeklySnapshotHighlights(input.currentWeekRuns),
  };
}
