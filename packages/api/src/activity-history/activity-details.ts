export const MAX_ACTIVITY_ANALYSIS_POINTS = 1200;
export const MAX_ACTIVITY_MAP_PREVIEW_POINTS = 2000;

export type ActivityMapPreviewData = {
  bounds: number[][];
  latlngs: Array<[number, number] | null>;
} | null;

export type ActivityIntervalSummary = {
  intervalType: string | null;
  zone: string | null;
  intensity: string | null;
  distance: number | null;
  movingTime: number | null;
  elapsedTime: number | null;
  startTime: number | null;
  endTime: number | null;
  averageSpeed: number | null;
  maxSpeed: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  averageStride: number | null;
  totalElevationGain: number | null;
};

export type ActivityMetricKey =
  | "heartrate"
  | "cadence"
  | "velocity_smooth"
  | "fixed_altitude";

export type ActivityMetricPoint = {
  second: number;
  value: number;
};

export type ActivitySummaryPageData = {
  name: string | null;
  startDateLocal: Date | string | null;
  type: string | null;
  deviceName: string | null;
  mapPreview: ActivityMapPreviewData;
  distance: number | null;
  movingTime: number | null;
  elapsedTime: number | null;
  averageSpeed: number | null;
  maxSpeed: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  calories: number | null;
  totalElevationGain: number | null;
  totalElevationLoss: number | null;
  trainingLoad: number | null;
  hrLoad: number | null;
  intensity: number | null;
  athleteMaxHr: number | null;
  heartRateZonesBpm: number[] | null;
  heartRateZoneDurationsSeconds: number[] | null;
  oneKmSplitTimesSeconds: Array<{
    splitNumber: number;
    splitDistanceMeters: number;
    durationSeconds: number;
  }> | null;
  intervals: ActivityIntervalSummary[];
  bestEfforts: Array<{
    targetDistanceMeters: number;
    durationSeconds: number;
  }>;
};

export type ActivityAnalysisData = Record<
  ActivityMetricKey,
  ActivityMetricPoint[]
>;
