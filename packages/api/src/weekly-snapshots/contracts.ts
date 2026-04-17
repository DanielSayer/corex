export type WeeklyWrappedGoalSnapshot = {
  goalId: string;
  goalType: "event_goal" | "volume_goal";
  goalStatus: "active" | "completed";
  title: string;
  currentValue: number | null;
  targetValue: number | null;
  remainingValue: number | null;
  completionRatio: number | null;
  readinessScore: number | null;
  unit: string | null;
  periodLabel: string;
};

export type WeeklyWrappedData = {
  shouldShow: boolean;
  generatedAt: string;
  period: {
    weekStart: string;
    weekEnd: string;
    timezone: string;
  } | null;
  totals: {
    distanceMeters: number;
    runCount: number;
    elapsedTimeSeconds: number;
    movingTimeSeconds: number;
    avgPaceSecPerKm: number | null;
  } | null;
  comparisonVsPriorWeek: {
    distanceMetersDelta: number;
    runCountDelta: number;
    avgPaceSecPerKmDelta: number | null;
  } | null;
  goals: WeeklyWrappedGoalSnapshot[];
  highlights: {
    bestDistanceDayMeters: number | null;
    longestRunMeters: number | null;
    fastestRunPaceSecPerKm: number | null;
  } | null;
};

export type WeeklySnapshotSummary = {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  generatedAt: string;
  totals: WeeklyWrappedData["totals"];
};
