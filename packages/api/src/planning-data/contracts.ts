import type { TerrainSummary } from "../terrain/domain";

export type HeartRateZoneTimes = {
  z1Seconds: number | null;
  z2Seconds: number | null;
  z3Seconds: number | null;
  z4Seconds: number | null;
  z5Seconds: number | null;
};

export type PlanningDetailedRun = {
  startAt: string;
  distanceMeters: number | null;
  elapsedTimeSeconds: number | null;
  movingTimeSeconds: number | null;
  elevationGainMeters: number | null;
  heartRateZoneTimes: HeartRateZoneTimes;
  averageHeartrate: number | null;
  averageSpeedMetersPerSecond: number | null;
  normalizedActivityType: string | null;
};

export type PlanningWeeklyRollup = {
  weekStart: string;
  weekEnd: string;
  runCount: number;
  totalDistanceMeters: number | null;
  totalDurationSeconds: number | null;
  longestRunDistanceMeters: number | null;
  totalElevationGainMeters: number | null;
  heartRateZoneTimes: HeartRateZoneTimes;
};

export type PlanningHistorySnapshot = {
  generatedAt: string;
  detailedRuns: PlanningDetailedRun[];
  weeklyRollups: PlanningWeeklyRollup[];
  terrainSummary: TerrainSummary;
};

export type PlanningHistoryQuality = {
  hasAnyHistory: boolean;
  meetsSnapshotThreshold: boolean;
  hasRecentSync: boolean;
  latestSyncWarnings: string[];
  availableDateRange: {
    start: string | null;
    end: string | null;
  };
};

export type PlanningPr = {
  distanceMeters: number;
  distanceLabel: string;
  durationSeconds: number;
  activityId: string;
  startAt: string;
  startSampleIndex: number;
  endSampleIndex: number;
};

export type PlanningProcessingWarning = {
  code: string;
  count: number;
  affectedActivityIds: string[];
};

export type PlanningPerformanceSnapshot = {
  allTimePrs: PlanningPr[];
  recentPrs: PlanningPr[];
  processingWarnings: PlanningProcessingWarning[];
};
