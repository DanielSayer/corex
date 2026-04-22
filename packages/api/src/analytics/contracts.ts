import type { TerrainSummary } from "../terrain/domain";

export type AnalyticsDistanceTrendBucket = {
  key: string;
  label: string;
  distanceMeters: number;
};

export type AnalyticsPrTrendMonth = {
  monthKey: string;
  label: string;
  durationSeconds: number | null;
};

export type AnalyticsPrTrend = {
  distanceMeters: number;
  months: AnalyticsPrTrendMonth[];
};

export type AnalyticsOverallPr = {
  distanceMeters: number;
  durationSeconds: number;
  activityId: string;
  monthKey: string;
  achievedAt: string;
};

export type AnalyticsLongestRun = {
  activityId: string;
  activityName: string;
  distanceMeters: number;
  startAt: string;
} | null;

export type AnalyticsOverview = {
  totalDistance: {
    distanceMeters: number;
    comparisonYear: number;
    comparisonDistanceMeters: number;
    deltaPercent: number | null;
    cutoffDateKey: string;
    isPartialYear: boolean;
  };
  longestRunInYear: AnalyticsLongestRun;
  trackedPrDistanceCount: number;
  allTimePrCount: number;
  activeMonths: {
    count: number;
    elapsedCount: number;
    rangeLabel: string | null;
  };
};

export type AnalyticsTrainingMixBucket = {
  key: "easy" | "long_run" | "tempo" | "intervals";
  distanceMeters: number;
  runCount: number;
  sharePercent: number;
};

export type AnalyticsTrainingMix = {
  totalDistanceMeters: number;
  buckets: AnalyticsTrainingMixBucket[];
};

export type AnalyticsConsistencyMonth = {
  key: string;
  label: string;
  isElapsed: boolean;
  isActive: boolean;
};

export type AnalyticsConsistency = {
  activeMonthCount: number;
  elapsedMonthCount: number;
  ratio: number;
  percent: number;
  months: AnalyticsConsistencyMonth[];
};

export type AnalyticsView = {
  availableYears: number[];
  selectedYear: number;
  distanceTrends: {
    month: AnalyticsDistanceTrendBucket[];
    week: AnalyticsDistanceTrendBucket[];
  };
  prTrends: {
    distances: number[];
    series: AnalyticsPrTrend[];
  };
  overview: AnalyticsOverview;
  trainingMix: AnalyticsTrainingMix;
  consistency: AnalyticsConsistency;
  terrainSummary: TerrainSummary;
  overallPrs: AnalyticsOverallPr[];
  longestRun: AnalyticsLongestRun;
};
