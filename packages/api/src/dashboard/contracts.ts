import type { RecentActivityPreview } from "../activity-history/recent-activity";

export type DashboardSyncSummary = {
  status: "in_progress" | "success" | "failure";
  historyCoverage: "initial_30d_window" | "incremental_from_cursor" | null;
  coveredDateRange: {
    start: string | null;
    end: string | null;
  };
  runsProcessed: number;
  newRuns: number;
  updatedRuns: number;
  unsupportedCount: number;
  invalidCount: number;
  fetchIssueCount: number;
  warningCount: number;
  lastAttemptedAt: string;
  lastCompletedAt: string | null;
  failureSummary: string | null;
} | null;

export type DashboardTodaySummary = {
  localDate: string;
  state: "rest" | "planned";
  title: string;
  subtitle: string;
  sessionType: "rest" | "easy_run" | "long_run" | "workout";
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
};

export type DashboardSeriesPoint = {
  weekStart: string;
  label: string;
  value: number | null;
};

export type DashboardWeeklySummary = {
  weekToDate: {
    startDate: string;
    endDate: string;
  };
  distance: {
    thisWeekMeters: number;
    vsLastWeekMeters: number;
    avgWeekMeters: number;
    series: DashboardSeriesPoint[];
  };
  pace: {
    thisWeekSecPerKm: number | null;
    vsLastWeekSecPerKm: number | null;
    avgWeekSecPerKm: number | null;
    series: DashboardSeriesPoint[];
  };
};

export type DashboardGoalRow = {
  goalId: string;
  goalType: "event_goal" | "volume_goal";
  title: string;
  label: string;
  progressLabel: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progressRatio: number;
};

export type DashboardView = {
  timezone: string;
  sync: DashboardSyncSummary;
  today: DashboardTodaySummary;
  weekly: DashboardWeeklySummary;
  goals: DashboardGoalRow[];
  recentActivities: RecentActivityPreview[];
};
