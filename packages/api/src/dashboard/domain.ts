import type { GoalProgressCard } from "../goal-progress/contracts";
import {
  addDaysToDateKey,
  getDateKeyDiffInDays,
  getLocalDateKey,
  startOfWeekKey,
} from "../goal-progress/timezones";
import type { WeeklyPlanFinalized } from "../weekly-planning/contracts";
import type {
  DashboardGoalRow,
  DashboardSeriesPoint,
  DashboardTodaySummary,
  DashboardWeeklySummary,
} from "./contracts";

type RunRecord = {
  startAt: Date;
  summaryDate?: string | null;
  distanceMeters: number;
  elapsedTimeSeconds: number | null;
};

type AggregatedRunMetrics = {
  distanceMeters: number;
  paceDistanceMeters: number;
  paceElapsedTimeSeconds: number;
};

export const DASHBOARD_SERIES_WEEKS = 8;
const AVG_WEEKS = 4;
const FALLBACK_TODAY: DashboardTodaySummary = {
  localDate: "",
  state: "rest",
  title: "No workouts scheduled for today",
  subtitle: "Today is a rest day. Enjoy your day off.",
  sessionType: "rest",
  estimatedDistanceMeters: null,
  estimatedDurationSeconds: null,
};

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function summarizeRuns(runs: RunRecord[]): AggregatedRunMetrics {
  return runs.reduce<AggregatedRunMetrics>(
    (summary, run) => {
      const nextSummary: AggregatedRunMetrics = {
        distanceMeters: summary.distanceMeters + run.distanceMeters,
        paceDistanceMeters: summary.paceDistanceMeters,
        paceElapsedTimeSeconds: summary.paceElapsedTimeSeconds,
      };

      if (run.elapsedTimeSeconds != null && run.elapsedTimeSeconds > 0) {
        nextSummary.paceDistanceMeters += run.distanceMeters;
        nextSummary.paceElapsedTimeSeconds += run.elapsedTimeSeconds;
      }

      return nextSummary;
    },
    {
      distanceMeters: 0,
      paceDistanceMeters: 0,
      paceElapsedTimeSeconds: 0,
    },
  );
}

function derivePaceSecPerKm(summary: AggregatedRunMetrics) {
  if (summary.paceDistanceMeters <= 0 || summary.paceElapsedTimeSeconds <= 0) {
    return null;
  }

  return round(
    summary.paceElapsedTimeSeconds / (summary.paceDistanceMeters / 1000),
    1,
  );
}

function formatWeekLabel(weekStartKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${weekStartKey}T00:00:00.000Z`));
}

function getRunSummaryDateKey(run: RunRecord, timezone: string) {
  return run.summaryDate ?? getLocalDateKey(run.startAt, timezone);
}

function getRunsInWindow(input: {
  runs: RunRecord[];
  weekStartKey: string;
  daysIntoWeek: number;
  timezone: string;
}) {
  const lastIncludedDateKey = addDaysToDateKey(
    input.weekStartKey,
    input.daysIntoWeek,
  );

  return input.runs.filter((run) => {
    const dateKey = getRunSummaryDateKey(run, input.timezone);
    return dateKey >= input.weekStartKey && dateKey <= lastIncludedDateKey;
  });
}

function getRunsInFullWeek(input: {
  runs: RunRecord[];
  weekStartKey: string;
  timezone: string;
}) {
  const lastIncludedDateKey = addDaysToDateKey(input.weekStartKey, 6);

  return input.runs.filter((run) => {
    const dateKey = getRunSummaryDateKey(run, input.timezone);
    return dateKey >= input.weekStartKey && dateKey <= lastIncludedDateKey;
  });
}

export function buildDashboardWeeklySummary(input: {
  now: Date;
  timezone: string;
  runs: RunRecord[];
}): DashboardWeeklySummary {
  const todayKey = getLocalDateKey(input.now, input.timezone);
  const currentWeekStartKey = startOfWeekKey(todayKey);
  const daysIntoWeek = getDateKeyDiffInDays(currentWeekStartKey, todayKey);
  const previousWeekStartKey = addDaysToDateKey(currentWeekStartKey, -7);
  const points: Array<{
    weekStart: string;
    distanceMeters: number;
    paceSecPerKm: number | null;
  }> = [];

  for (
    let weekOffset = DASHBOARD_SERIES_WEEKS - 1;
    weekOffset >= 0;
    weekOffset -= 1
  ) {
    const weekStartKey = addDaysToDateKey(currentWeekStartKey, -7 * weekOffset);
    const summary = summarizeRuns(
      getRunsInFullWeek({
        runs: input.runs,
        weekStartKey,
        timezone: input.timezone,
      }),
    );

    points.push({
      weekStart: weekStartKey,
      distanceMeters: round(summary.distanceMeters, 1),
      paceSecPerKm: derivePaceSecPerKm(summary),
    });
  }

  const currentWeekToDateSummary = summarizeRuns(
    getRunsInWindow({
      runs: input.runs,
      weekStartKey: currentWeekStartKey,
      daysIntoWeek,
      timezone: input.timezone,
    }),
  );
  const previousWeekToDateSummary = summarizeRuns(
    getRunsInWindow({
      runs: input.runs,
      weekStartKey: previousWeekStartKey,
      daysIntoWeek,
      timezone: input.timezone,
    }),
  );
  const currentWeekToDatePace = derivePaceSecPerKm(currentWeekToDateSummary);
  const previousWeekToDatePace = derivePaceSecPerKm(previousWeekToDateSummary);
  const trailingPoints = points.slice(
    Math.max(points.length - 1 - AVG_WEEKS, 0),
    -1,
  );
  const avgDistanceMeters =
    trailingPoints.length > 0
      ? round(
          trailingPoints.reduce((sum, point) => sum + point.distanceMeters, 0) /
            trailingPoints.length,
          1,
        )
      : 0;
  const paceValues = trailingPoints
    .map((point) => point.paceSecPerKm)
    .filter((value): value is number => value != null);
  const avgPaceSecPerKm =
    paceValues.length > 0
      ? round(
          paceValues.reduce((sum, value) => sum + value, 0) / paceValues.length,
          1,
        )
      : null;
  const distanceSeries: DashboardSeriesPoint[] = points.map((point) => ({
    weekStart: point.weekStart,
    label: formatWeekLabel(point.weekStart),
    value: point.distanceMeters,
  }));
  const paceSeries: DashboardSeriesPoint[] = points.map((point) => ({
    weekStart: point.weekStart,
    label: formatWeekLabel(point.weekStart),
    value: point.paceSecPerKm,
  }));

  return {
    weekToDate: {
      startDate: currentWeekStartKey,
      endDate: todayKey,
    },
    distance: {
      thisWeekMeters: round(currentWeekToDateSummary.distanceMeters, 1),
      vsLastWeekMeters: round(
        currentWeekToDateSummary.distanceMeters -
          previousWeekToDateSummary.distanceMeters,
        1,
      ),
      avgWeekMeters: avgDistanceMeters,
      series: distanceSeries,
    },
    pace: {
      thisWeekSecPerKm: currentWeekToDatePace,
      vsLastWeekSecPerKm:
        currentWeekToDatePace == null || previousWeekToDatePace == null
          ? null
          : round(currentWeekToDatePace - previousWeekToDatePace, 1),
      avgWeekSecPerKm: avgPaceSecPerKm,
      series: paceSeries,
    },
  };
}

function formatVolumeValue(value: number, unit: string) {
  if (unit === "minutes") {
    return Math.round(value);
  }

  return round(value, value >= 100 ? 0 : 1);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildVolumeGoalRow(
  card: Extract<GoalProgressCard, { goalType: "volume_goal" }>,
) {
  const unit = card.progress?.unit ?? card.goal.unit;
  const currentRaw = card.progress?.completedValue ?? 0;
  const targetRaw = card.progress?.targetValue ?? card.goal.targetValue;
  const current = formatVolumeValue(currentRaw, unit);
  const target = formatVolumeValue(targetRaw, unit);
  const ratio = target > 0 ? clampRatio(current / target) : 0;
  const periodLabel = card.goal.period === "week" ? "Weekly" : "Monthly";
  const metricLabel = card.goal.metric === "distance" ? "distance" : "time";
  const remaining =
    card.progress?.remainingValue != null
      ? formatVolumeValue(Math.max(card.progress.remainingValue, 0), unit)
      : null;

  return {
    goalId: card.goalId,
    goalType: card.goalType,
    title: card.title,
    label: `${periodLabel} ${metricLabel}`,
    progressLabel:
      remaining == null
        ? "Sync history to calculate progress"
        : `${formatNumber(remaining)} ${unit} remaining`,
    currentValue: current,
    targetValue: target,
    unit,
    progressRatio: ratio,
  } satisfies DashboardGoalRow;
}

function buildEventGoalRow(
  card: Extract<GoalProgressCard, { goalType: "event_goal" }>,
) {
  const readiness = Math.max(
    0,
    Math.min(100, Math.round(card.readinessScore ?? 0)),
  );

  return {
    goalId: card.goalId,
    goalType: card.goalType,
    title: card.title,
    label: "Event readiness",
    progressLabel:
      card.progress?.daysRemaining == null
        ? "Sync history to score readiness"
        : card.progress.daysRemaining <= 0
          ? "Event day"
          : `${card.progress.daysRemaining} days remaining`,
    currentValue: readiness,
    targetValue: 100,
    unit: "score",
    progressRatio: clampRatio(readiness / 100),
  } satisfies DashboardGoalRow;
}

export function buildDashboardGoalRows(goalCards: GoalProgressCard[]) {
  return goalCards.slice(0, 3).map((card) => {
    if (card.goalType === "event_goal") {
      return buildEventGoalRow(card);
    }

    return buildVolumeGoalRow(card);
  });
}

export function buildDashboardTodaySummary(input: {
  now: Date;
  timezone: string;
  plan: WeeklyPlanFinalized | null;
}): DashboardTodaySummary {
  const localDate = getLocalDateKey(input.now, input.timezone);
  const fallback = {
    ...FALLBACK_TODAY,
    localDate,
  };

  if (!input.plan) {
    return fallback;
  }

  const day = input.plan.payload.days.find((entry) => entry.date === localDate);

  if (!day?.session || day.session.sessionType === "rest") {
    return fallback;
  }

  return {
    localDate,
    state: "planned",
    title: day.session.title,
    subtitle: day.session.summary,
    sessionType: day.session.sessionType,
    estimatedDistanceMeters: day.session.estimatedDistanceMeters,
    estimatedDurationSeconds: day.session.estimatedDurationSeconds,
  };
}
