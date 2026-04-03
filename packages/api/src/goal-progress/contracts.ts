import type { TrainingGoal } from "../training-settings/contracts";

export type GoalProgressStatus =
  | "ready"
  | "missing_history"
  | "stale_history"
  | "no_goal";

export type GoalProgressAction = "none" | "create_goal" | "sync_history";

export type GoalProgressSyncState = {
  hasAnyHistory: boolean;
  hasRecentSync: boolean;
  latestSyncWarnings: string[];
  availableDateRange: {
    start: string | null;
    end: string | null;
  };
  recommendedAction: GoalProgressAction;
};

export type GoalProgressTrendPoint = {
  periodStart: string;
  periodEnd: string;
  completedValue: number;
};

export type VolumeGoalProgress = {
  metric: "distance" | "time";
  unit: "km" | "mi" | "minutes";
  period: "week" | "month";
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  completedValue: number;
  remainingValue: number;
  percentComplete: number;
  recentPeriods: GoalProgressTrendPoint[];
};

export type EventGoalSignalTone = "positive" | "neutral" | "warning";

export type EventGoalSignal = {
  key: "countdown" | "weekly_load" | "long_run" | "best_effort";
  label: string;
  value: string;
  tone: EventGoalSignalTone;
};

export type EventGoalReadinessLevel =
  | "on_track"
  | "building"
  | "needs_attention";

export type EventGoalBestEffort = {
  distanceMeters: number;
  distanceLabel: string;
  durationSeconds: number;
  activityId: string;
  startAt: string;
  source: "exact" | "nearest";
};

export type EventGoalProgress = {
  eventDate: string;
  daysRemaining: number;
  targetDistance: {
    value: number;
    unit: "km" | "mi";
    meters: number;
  };
  recentWeeklyLoad: {
    currentWeekDistanceMeters: number;
    currentWeekDurationSeconds: number;
    trailingFourWeekAverageDistanceMeters: number;
    trailingFourWeekAverageDurationSeconds: number;
  };
  longestRecentRun: {
    distanceMeters: number;
    startAt: string;
  } | null;
  bestMatchingEffort: EventGoalBestEffort | null;
  readiness: {
    score: number;
    level: EventGoalReadinessLevel;
    summary: string;
    signals: EventGoalSignal[];
  };
};

export type VolumeGoalProgressCard = {
  goalId: string;
  goalType: "volume_goal";
  status: "active";
  title: string;
  goal: Extract<TrainingGoal, { type: "volume_goal" }>;
  progress: VolumeGoalProgress | null;
};

export type EventGoalProgressCard = {
  goalId: string;
  goalType: "event_goal";
  status: "active" | "completed";
  title: string;
  goal: Extract<TrainingGoal, { type: "event_goal" }>;
  progress: EventGoalProgress | null;
  readinessScore: number | null;
};

export type GoalProgressCard = VolumeGoalProgressCard | EventGoalProgressCard;

export type GoalProgressView = {
  sync: GoalProgressSyncState;
  activeGoals: GoalProgressCard[];
  completedGoals: EventGoalProgressCard[];
};
