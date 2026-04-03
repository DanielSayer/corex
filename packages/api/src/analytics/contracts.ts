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
};

export type AnalyticsLongestRun = {
  activityId: string;
  activityName: string;
  distanceMeters: number;
  startAt: string;
} | null;

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
  overallPrs: AnalyticsOverallPr[];
  longestRun: AnalyticsLongestRun;
};
