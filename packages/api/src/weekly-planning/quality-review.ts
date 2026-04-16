import type {
  DraftGenerationContext,
  PlanQualityItem,
  PlanQualityReport,
  PlannedSession,
  WeeklyPlanPayload,
} from "./contracts";

type ReviewMode = PlanQualityReport["mode"];

type QualityThresholds = {
  loadWarningMultiplier: number;
  loadBlockingMultiplier: number;
  longRunShareWarning: number;
  longRunShareBlocking: number;
  longRunJumpWarningMultiplier: number;
  longRunJumpBlockingMultiplier: number;
  hardSessionWarningCount: number;
  hardSessionBlockingCount: number;
};

const standardThresholds: QualityThresholds = {
  loadWarningMultiplier: 1.25,
  loadBlockingMultiplier: 1.5,
  longRunShareWarning: 0.35,
  longRunShareBlocking: 0.45,
  longRunJumpWarningMultiplier: 1.25,
  longRunJumpBlockingMultiplier: 1.5,
  hardSessionWarningCount: 2,
  hardSessionBlockingCount: 3,
};

const lowHistoryThresholds: QualityThresholds = {
  loadWarningMultiplier: 1.1,
  loadBlockingMultiplier: 1.35,
  longRunShareWarning: 0.3,
  longRunShareBlocking: 0.4,
  longRunJumpWarningMultiplier: 1.1,
  longRunJumpBlockingMultiplier: 1.25,
  hardSessionWarningCount: 1,
  hardSessionBlockingCount: 2,
};

type WeeklyBaseline = {
  distanceMeters: number | null;
  durationSeconds: number | null;
  longestRunDistanceMeters: number | null;
};

type PlannedMetrics = {
  totalDistanceMeters: number | null;
  totalDurationSeconds: number;
  longRunDistanceMeters: number | null;
  longRunDurationSeconds: number | null;
  longRunDistanceShare: number | null;
  longRunDurationShare: number | null;
  hardSessionCount: number;
  hasConsecutiveHardSessions: boolean;
};

type BaselineMetrics = {
  averageDistanceMeters: number | null;
  averageDurationSeconds: number | null;
  longestRunDistanceMeters: number | null;
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function weekStartForIsoDateTime(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function buildHistoryBaselines(
  context: DraftGenerationContext,
): BaselineMetrics {
  const weeks = new Map<string, WeeklyBaseline>();

  for (const rollup of context.historySnapshot.weeklyRollups) {
    weeks.set(rollup.weekStart, {
      distanceMeters: rollup.totalDistanceMeters,
      durationSeconds: rollup.totalDurationSeconds,
      longestRunDistanceMeters: rollup.longestRunDistanceMeters,
    });
  }

  for (const run of context.historySnapshot.detailedRuns) {
    const weekStart = weekStartForIsoDateTime(run.startAt);
    const existing = weeks.get(weekStart) ?? {
      distanceMeters: 0,
      durationSeconds: 0,
      longestRunDistanceMeters: null,
    };
    const distanceMeters = run.distanceMeters ?? 0;
    const durationSeconds =
      run.movingTimeSeconds ?? run.elapsedTimeSeconds ?? 0;

    weeks.set(weekStart, {
      distanceMeters: (existing.distanceMeters ?? 0) + distanceMeters,
      durationSeconds: (existing.durationSeconds ?? 0) + durationSeconds,
      longestRunDistanceMeters: Math.max(
        existing.longestRunDistanceMeters ?? 0,
        distanceMeters,
      ),
    });
  }

  const recentWeeks = [...weeks.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 8)
    .map(([, week]) => week);
  const weeklyDistances = recentWeeks
    .map((week) => week.distanceMeters)
    .filter((value): value is number => value != null && value > 0);
  const weeklyDurations = recentWeeks
    .map((week) => week.durationSeconds)
    .filter((value): value is number => value != null && value > 0);
  const longestRuns = recentWeeks
    .map((week) => week.longestRunDistanceMeters)
    .filter((value): value is number => value != null && value > 0);

  return {
    averageDistanceMeters: average(weeklyDistances),
    averageDurationSeconds: average(weeklyDurations),
    longestRunDistanceMeters: max(longestRuns),
  };
}

function getMaxBlockRpe(session: PlannedSession) {
  return max(
    session.intervalBlocks
      .map((block) => block.target.rpe)
      .filter((value): value is number => value != null),
  );
}

function hasHardHeartRateTarget(session: PlannedSession) {
  return session.intervalBlocks.some((block) => {
    const heartRate = block.target.heartRate?.toLowerCase() ?? "";

    return (
      heartRate.includes("z4") ||
      heartRate.includes("z5") ||
      heartRate.includes("threshold") ||
      heartRate.includes("tempo") ||
      heartRate.includes("interval")
    );
  });
}

function isHardSession(session: PlannedSession) {
  return (
    session.sessionType === "workout" ||
    (getMaxBlockRpe(session) ?? 0) >= 7 ||
    hasHardHeartRateTarget(session)
  );
}

function buildPlannedMetrics(payload: WeeklyPlanPayload): PlannedMetrics {
  const sessions = payload.days.map((day) => day.session);
  const distanceValues = sessions
    .map((session) => session?.estimatedDistanceMeters)
    .filter((value): value is number => value != null);
  const totalDistanceMeters =
    distanceValues.length > 0
      ? distanceValues.reduce((sum, value) => sum + value, 0)
      : null;
  const totalDurationSeconds = sessions.reduce(
    (sum, session) => sum + (session?.estimatedDurationSeconds ?? 0),
    0,
  );
  const longRun = sessions.find(
    (session) => session?.sessionType === "long_run",
  );
  const hardSessionFlags = sessions.map((session) =>
    session ? isHardSession(session) : false,
  );

  return {
    totalDistanceMeters,
    totalDurationSeconds,
    longRunDistanceMeters: longRun?.estimatedDistanceMeters ?? null,
    longRunDurationSeconds: longRun?.estimatedDurationSeconds ?? null,
    longRunDistanceShare:
      totalDistanceMeters != null &&
      totalDistanceMeters > 0 &&
      longRun?.estimatedDistanceMeters != null
        ? longRun.estimatedDistanceMeters / totalDistanceMeters
        : null,
    longRunDurationShare:
      totalDurationSeconds > 0 && longRun
        ? longRun.estimatedDurationSeconds / totalDurationSeconds
        : null,
    hardSessionCount: hardSessionFlags.filter(Boolean).length,
    hasConsecutiveHardSessions: hardSessionFlags.some(
      (isHard, index) => isHard && hardSessionFlags[index + 1] === true,
    ),
  };
}

function buildItem(input: {
  code: string;
  severity: PlanQualityItem["severity"];
  message: string;
  metricValue: number | null;
  thresholdValue: number | null;
}): PlanQualityItem {
  return input;
}

function addRatioCheck(input: {
  items: PlanQualityItem[];
  code: string;
  label: string;
  metricValue: number | null;
  baselineValue: number | null;
  warningMultiplier: number;
  blockingMultiplier: number;
}) {
  if (
    input.metricValue == null ||
    input.baselineValue == null ||
    input.baselineValue <= 0
  ) {
    return;
  }

  const warningThreshold = input.baselineValue * input.warningMultiplier;
  const blockingThreshold = input.baselineValue * input.blockingMultiplier;

  if (input.metricValue > blockingThreshold) {
    input.items.push(
      buildItem({
        code: `${input.code}_blocking`,
        severity: "blocking",
        message: `${input.label} is much higher than recent training history.`,
        metricValue: input.metricValue,
        thresholdValue: blockingThreshold,
      }),
    );
    return;
  }

  if (input.metricValue > warningThreshold) {
    input.items.push(
      buildItem({
        code: `${input.code}_warning`,
        severity: "warning",
        message: `${input.label} is higher than recent training history.`,
        metricValue: input.metricValue,
        thresholdValue: warningThreshold,
      }),
    );
  }
}

function addShareCheck(input: {
  items: PlanQualityItem[];
  code: string;
  label: string;
  share: number | null;
  warningThreshold: number;
  blockingThreshold: number;
}) {
  if (input.share == null) {
    return;
  }

  if (input.share > input.blockingThreshold) {
    input.items.push(
      buildItem({
        code: `${input.code}_blocking`,
        severity: "blocking",
        message: `${input.label} takes too much of the weekly plan.`,
        metricValue: input.share,
        thresholdValue: input.blockingThreshold,
      }),
    );
    return;
  }

  if (input.share > input.warningThreshold) {
    input.items.push(
      buildItem({
        code: `${input.code}_warning`,
        severity: "warning",
        message: `${input.label} is a large share of the weekly plan.`,
        metricValue: input.share,
        thresholdValue: input.warningThreshold,
      }),
    );
  }
}

function summarizeReport(items: PlanQualityItem[]) {
  if (items.some((item) => item.severity === "blocking")) {
    return "Plan quality review found blocking training-load risks.";
  }

  if (items.length > 0) {
    return "Plan quality review found training-load warnings.";
  }

  return "Plan quality review passed.";
}

export function reviewPlanQuality(input: {
  payload: WeeklyPlanPayload;
  generationContext: DraftGenerationContext;
  mode: ReviewMode;
  generatedAt: string;
}): PlanQualityReport {
  const lowHistory =
    !input.generationContext.historyQuality.meetsSnapshotThreshold;
  const thresholds = lowHistory ? lowHistoryThresholds : standardThresholds;
  const baselines = buildHistoryBaselines(input.generationContext);
  const planned = buildPlannedMetrics(input.payload);
  const items: PlanQualityItem[] = [];

  addRatioCheck({
    items,
    code: "weekly_distance",
    label: "Planned weekly distance",
    metricValue: planned.totalDistanceMeters,
    baselineValue: baselines.averageDistanceMeters,
    warningMultiplier: thresholds.loadWarningMultiplier,
    blockingMultiplier: thresholds.loadBlockingMultiplier,
  });
  addRatioCheck({
    items,
    code: "weekly_duration",
    label: "Planned weekly duration",
    metricValue: planned.totalDurationSeconds,
    baselineValue: baselines.averageDurationSeconds,
    warningMultiplier: thresholds.loadWarningMultiplier,
    blockingMultiplier: thresholds.loadBlockingMultiplier,
  });
  addShareCheck({
    items,
    code: "long_run_distance_share",
    label: "Long run distance",
    share: planned.longRunDistanceShare,
    warningThreshold: thresholds.longRunShareWarning,
    blockingThreshold: thresholds.longRunShareBlocking,
  });
  addShareCheck({
    items,
    code: "long_run_duration_share",
    label: "Long run duration",
    share: planned.longRunDurationShare,
    warningThreshold: thresholds.longRunShareWarning,
    blockingThreshold: thresholds.longRunShareBlocking,
  });
  addRatioCheck({
    items,
    code: "long_run_distance_jump",
    label: "Planned long-run distance",
    metricValue: planned.longRunDistanceMeters,
    baselineValue: baselines.longestRunDistanceMeters,
    warningMultiplier: thresholds.longRunJumpWarningMultiplier,
    blockingMultiplier: thresholds.longRunJumpBlockingMultiplier,
  });

  if (planned.hardSessionCount > thresholds.hardSessionBlockingCount) {
    items.push(
      buildItem({
        code: "hard_session_count_blocking",
        severity: "blocking",
        message:
          "Plan includes too many hard sessions for the available history.",
        metricValue: planned.hardSessionCount,
        thresholdValue: thresholds.hardSessionBlockingCount,
      }),
    );
  } else if (planned.hardSessionCount > thresholds.hardSessionWarningCount) {
    items.push(
      buildItem({
        code: "hard_session_count_warning",
        severity: "warning",
        message: "Plan includes a high number of hard sessions.",
        metricValue: planned.hardSessionCount,
        thresholdValue: thresholds.hardSessionWarningCount,
      }),
    );
  }

  if (input.mode === "enforced" && planned.hasConsecutiveHardSessions) {
    items.push(
      buildItem({
        code: "consecutive_hard_sessions_blocking",
        severity: "blocking",
        message: "Plan schedules hard sessions on consecutive days.",
        metricValue: null,
        thresholdValue: null,
      }),
    );
  }

  const hasBlockingItems = items.some((item) => item.severity === "blocking");

  return {
    status: hasBlockingItems
      ? "blocked"
      : items.length > 0
        ? "warning"
        : "pass",
    mode: input.mode,
    summary: summarizeReport(items),
    items,
    generatedAt: input.generatedAt,
  };
}
