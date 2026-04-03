import type { PlanningPrRow } from "../planning-data/repository";
import { getDistanceLabel } from "../planning-data/domain";
import type { TrainingGoal } from "../training-settings/contracts";
import type {
  EventGoalBestEffort,
  EventGoalProgress,
  EventGoalReadinessLevel,
  EventGoalSignal,
  GoalProgressStatus,
  GoalProgressSyncState,
  GoalProgressTrendPoint,
  VolumeGoalProgress,
} from "./contracts";

type ComparableRun = {
  startAt: Date;
  distanceMeters: number;
  movingTimeSeconds: number;
};

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getStartOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function getUtcWeekRange(now: Date) {
  const dayStart = getStartOfUtcDay(now);
  const day = dayStart.getUTCDay();
  const offset = (day + 6) % 7;
  const start = addUtcDays(dayStart, -offset);

  return {
    start,
    end: addUtcDays(start, 7),
  };
}

export function getUtcMonthRange(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );

  return {
    start,
    end: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    ),
  };
}

function getVolumeUnitDivisor(unit: "km" | "mi" | "minutes") {
  if (unit === "km") {
    return METERS_PER_KM;
  }

  if (unit === "mi") {
    return METERS_PER_MILE;
  }

  return 60;
}

function getVolumeValue(
  run: ComparableRun,
  goal: Extract<TrainingGoal, { type: "volume_goal" }>,
) {
  if (goal.metric === "distance") {
    return run.distanceMeters / getVolumeUnitDivisor(goal.unit);
  }

  return run.movingTimeSeconds / getVolumeUnitDivisor(goal.unit);
}

function sumPeriodValue(
  runs: ComparableRun[],
  goal: Extract<TrainingGoal, { type: "volume_goal" }>,
  start: Date,
  end: Date,
) {
  return roundMetric(
    runs
      .filter((run) => run.startAt >= start && run.startAt < end)
      .reduce((sum, run) => sum + getVolumeValue(run, goal), 0),
  );
}

function buildRecentVolumePeriods(input: {
  now: Date;
  goal: Extract<TrainingGoal, { type: "volume_goal" }>;
  runs: ComparableRun[];
}) {
  const ranges: Array<{ start: Date; end: Date }> = [];

  if (input.goal.period === "week") {
    const current = getUtcWeekRange(input.now);

    for (let index = 3; index >= 0; index -= 1) {
      const start = addUtcDays(current.start, -index * 7);
      ranges.push({
        start,
        end: addUtcDays(start, 7),
      });
    }
  } else {
    const current = getUtcMonthRange(input.now);

    for (let index = 3; index >= 0; index -= 1) {
      const start = new Date(
        Date.UTC(
          current.start.getUTCFullYear(),
          current.start.getUTCMonth() - index,
          1,
          0,
          0,
          0,
          0,
        ),
      );
      ranges.push({
        start,
        end: new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth() + 1,
            1,
            0,
            0,
            0,
            0,
          ),
        ),
      });
    }
  }

  return ranges.map(
    (range): GoalProgressTrendPoint => ({
      periodStart: toIsoString(range.start),
      periodEnd: toIsoString(range.end),
      completedValue: sumPeriodValue(
        input.runs,
        input.goal,
        range.start,
        range.end,
      ),
    }),
  );
}

export function buildVolumeGoalProgress(input: {
  now: Date;
  goal: Extract<TrainingGoal, { type: "volume_goal" }>;
  runs: ComparableRun[];
}): VolumeGoalProgress {
  const range =
    input.goal.period === "week"
      ? getUtcWeekRange(input.now)
      : getUtcMonthRange(input.now);
  const completedValue = sumPeriodValue(
    input.runs,
    input.goal,
    range.start,
    range.end,
  );
  const remainingValue = roundMetric(
    Math.max(input.goal.targetValue - completedValue, 0),
  );

  return {
    metric: input.goal.metric,
    unit: input.goal.unit,
    period: input.goal.period,
    periodStart: toIsoString(range.start),
    periodEnd: toIsoString(range.end),
    targetValue: input.goal.targetValue,
    completedValue,
    remainingValue,
    percentComplete: clampPercent(
      (completedValue / input.goal.targetValue) * 100,
    ),
    recentPeriods: buildRecentVolumePeriods(input),
  };
}

function toMeters(distance: { value: number; unit: "km" | "mi" }) {
  return (
    distance.value * (distance.unit === "km" ? METERS_PER_KM : METERS_PER_MILE)
  );
}

function getBestMatchingEffort(
  prs: PlanningPrRow[],
  targetDistanceMeters: number,
): EventGoalBestEffort | null {
  if (prs.length === 0) {
    return null;
  }

  const exact = prs.find(
    (candidate) =>
      Math.abs(candidate.distanceMeters - targetDistanceMeters) <= 25,
  );

  const selected =
    exact ??
    [...prs].sort((left, right) => {
      const leftDelta = Math.abs(left.distanceMeters - targetDistanceMeters);
      const rightDelta = Math.abs(right.distanceMeters - targetDistanceMeters);

      if (leftDelta !== rightDelta) {
        return leftDelta - rightDelta;
      }

      return left.durationSeconds - right.durationSeconds;
    })[0]!;

  return {
    distanceMeters: selected.distanceMeters,
    distanceLabel: getDistanceLabel(selected.distanceMeters),
    durationSeconds: selected.durationSeconds,
    activityId: selected.activityId,
    startAt: toIsoString(selected.startAt),
    source: exact ? "exact" : "nearest",
  };
}

function formatDaysRemaining(daysRemaining: number) {
  if (daysRemaining <= 0) {
    return "Event day has arrived";
  }

  if (daysRemaining === 1) {
    return "1 day to go";
  }

  return `${daysRemaining} days to go`;
}

function getSignalTone(input: {
  daysRemaining: number;
  targetDistanceMeters: number;
  longestRecentRunMeters: number | null;
  currentWeekDistanceMeters: number;
  trailingAverageDistanceMeters: number;
  bestMatchingEffort: EventGoalBestEffort | null;
}): EventGoalSignal[] {
  const longestRatio =
    input.longestRecentRunMeters != null
      ? input.longestRecentRunMeters / input.targetDistanceMeters
      : 0;
  const loadRatio =
    input.trailingAverageDistanceMeters > 0
      ? input.currentWeekDistanceMeters / input.trailingAverageDistanceMeters
      : input.currentWeekDistanceMeters > 0
        ? 1
        : 0;

  const longRunTone =
    longestRatio >= 0.6
      ? "positive"
      : longestRatio >= 0.35
        ? "neutral"
        : "warning";
  const loadTone =
    loadRatio >= 0.8 ? "positive" : loadRatio >= 0.5 ? "neutral" : "warning";
  const bestEffortTone = input.bestMatchingEffort
    ? input.bestMatchingEffort.source === "exact"
      ? "positive"
      : "neutral"
    : "warning";

  return [
    {
      key: "countdown",
      label: "Countdown",
      value: formatDaysRemaining(input.daysRemaining),
      tone: input.daysRemaining > 0 ? "neutral" : "warning",
    },
    {
      key: "weekly_load",
      label: "Weekly load",
      value:
        input.trailingAverageDistanceMeters > 0
          ? `${roundMetric(input.currentWeekDistanceMeters / METERS_PER_KM)} km this week vs ${roundMetric(input.trailingAverageDistanceMeters / METERS_PER_KM)} km avg`
          : `${roundMetric(input.currentWeekDistanceMeters / METERS_PER_KM)} km this week`,
      tone: loadTone,
    },
    {
      key: "long_run",
      label: "Longest recent run",
      value:
        input.longestRecentRunMeters != null
          ? `${roundMetric(input.longestRecentRunMeters / METERS_PER_KM)} km`
          : "No recent long run found",
      tone: longRunTone,
    },
    {
      key: "best_effort",
      label: "Matching effort",
      value: input.bestMatchingEffort
        ? input.bestMatchingEffort.distanceLabel
        : "No matching effort found",
      tone: bestEffortTone,
    },
  ];
}

function getReadinessLevel(
  signals: EventGoalSignal[],
): EventGoalReadinessLevel {
  const positiveCount = signals.filter(
    (signal) => signal.tone === "positive",
  ).length;
  const warningCount = signals.filter(
    (signal) => signal.tone === "warning",
  ).length;

  if (warningCount >= 2) {
    return "needs_attention";
  }

  if (positiveCount >= 2) {
    return "on_track";
  }

  return "building";
}

function getReadinessSummary(level: EventGoalReadinessLevel) {
  if (level === "on_track") {
    return "Training is pointing in the right direction for this event.";
  }

  if (level === "needs_attention") {
    return "Recent training support is thin, so sync and consistency matter before reading too much into this goal.";
  }

  return "The block is taking shape, but there is still work to do before this goal looks well-supported.";
}

function getReadinessScore(signals: EventGoalSignal[]) {
  if (signals.length === 0) {
    return 0;
  }

  const total = signals.reduce((sum, signal) => {
    if (signal.tone === "positive") {
      return sum + 100;
    }

    if (signal.tone === "neutral") {
      return sum + 65;
    }

    return sum + 30;
  }, 0);

  return Math.round(total / signals.length);
}

export function buildEventGoalProgress(input: {
  now: Date;
  goal: Extract<TrainingGoal, { type: "event_goal" }>;
  runs: ComparableRun[];
  prs: PlanningPrRow[];
}): EventGoalProgress {
  const todayStart = getStartOfUtcDay(input.now);
  const eventDate = new Date(`${input.goal.targetDate}T00:00:00.000Z`);
  const daysRemaining = Math.ceil(
    (eventDate.getTime() - todayStart.getTime()) / MS_PER_DAY,
  );
  const targetDistanceMeters = toMeters(input.goal.targetDistance);
  const currentWeek = getUtcWeekRange(input.now);
  const trailingStart = addUtcDays(currentWeek.start, -28);
  const previousWeeks = [
    {
      start: addUtcDays(currentWeek.start, -28),
      end: addUtcDays(currentWeek.start, -21),
    },
    {
      start: addUtcDays(currentWeek.start, -21),
      end: addUtcDays(currentWeek.start, -14),
    },
    {
      start: addUtcDays(currentWeek.start, -14),
      end: addUtcDays(currentWeek.start, -7),
    },
    { start: addUtcDays(currentWeek.start, -7), end: currentWeek.start },
  ];
  const currentWeekDistanceMeters = input.runs
    .filter(
      (run) =>
        run.startAt >= currentWeek.start && run.startAt < currentWeek.end,
    )
    .reduce((sum, run) => sum + run.distanceMeters, 0);
  const currentWeekDurationSeconds = input.runs
    .filter(
      (run) =>
        run.startAt >= currentWeek.start && run.startAt < currentWeek.end,
    )
    .reduce((sum, run) => sum + run.movingTimeSeconds, 0);
  const trailingFourWeekAverageDistanceMeters =
    previousWeeks.reduce((sum, week) => {
      const weekDistance = input.runs
        .filter((run) => run.startAt >= week.start && run.startAt < week.end)
        .reduce((value, run) => value + run.distanceMeters, 0);

      return sum + weekDistance;
    }, 0) / previousWeeks.length;
  const trailingFourWeekAverageDurationSeconds =
    previousWeeks.reduce((sum, week) => {
      const weekDuration = input.runs
        .filter((run) => run.startAt >= week.start && run.startAt < week.end)
        .reduce((value, run) => value + run.movingTimeSeconds, 0);

      return sum + weekDuration;
    }, 0) / previousWeeks.length;
  const longestRecentRun =
    [...input.runs]
      .filter((run) => run.startAt >= trailingStart)
      .sort((left, right) => right.distanceMeters - left.distanceMeters)[0] ??
    null;
  const bestMatchingEffort = getBestMatchingEffort(
    input.prs,
    targetDistanceMeters,
  );
  const signals = getSignalTone({
    daysRemaining,
    targetDistanceMeters,
    longestRecentRunMeters: longestRecentRun?.distanceMeters ?? null,
    currentWeekDistanceMeters,
    trailingAverageDistanceMeters: trailingFourWeekAverageDistanceMeters,
    bestMatchingEffort,
  });
  const level = getReadinessLevel(signals);

  return {
    eventDate: input.goal.targetDate,
    daysRemaining,
    targetDistance: {
      value: input.goal.targetDistance.value,
      unit: input.goal.targetDistance.unit,
      meters: targetDistanceMeters,
    },
    recentWeeklyLoad: {
      currentWeekDistanceMeters,
      currentWeekDurationSeconds,
      trailingFourWeekAverageDistanceMeters: roundMetric(
        trailingFourWeekAverageDistanceMeters,
      ),
      trailingFourWeekAverageDurationSeconds: roundMetric(
        trailingFourWeekAverageDurationSeconds,
      ),
    },
    longestRecentRun: longestRecentRun
      ? {
          distanceMeters: longestRecentRun.distanceMeters,
          startAt: toIsoString(longestRecentRun.startAt),
        }
      : null,
    bestMatchingEffort,
    readiness: {
      score: getReadinessScore(signals),
      level,
      summary: getReadinessSummary(level),
      signals,
    },
  };
}

export function getGoalProgressStatus(input: {
  goal: TrainingGoal | null;
  hasAnyHistory: boolean;
  hasRecentSync: boolean;
}): GoalProgressStatus {
  if (!input.goal) {
    return "no_goal";
  }

  if (!input.hasAnyHistory) {
    return "missing_history";
  }

  if (!input.hasRecentSync) {
    return "stale_history";
  }

  return "ready";
}

export function buildGoalProgressSyncState(input: {
  status: GoalProgressStatus;
  hasAnyHistory: boolean;
  hasRecentSync: boolean;
  latestSyncWarnings: string[];
  availableDateRange: {
    start: string | null;
    end: string | null;
  };
}): GoalProgressSyncState {
  return {
    hasAnyHistory: input.hasAnyHistory,
    hasRecentSync: input.hasRecentSync,
    latestSyncWarnings: input.latestSyncWarnings,
    availableDateRange: input.availableDateRange,
    recommendedAction:
      input.status === "no_goal"
        ? "create_goal"
        : input.status === "ready"
          ? "none"
          : "sync_history",
  };
}
