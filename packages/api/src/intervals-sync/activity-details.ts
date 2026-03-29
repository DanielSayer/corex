export type ActivityDetailsPageData = {
  name: string | null;
  startDateLocal: Date | string | null;
  type: string | null;
  deviceName: string | null;
  mapData: {
    bounds: number[][];
    latlngs: Array<[number, number] | null>;
  } | null;
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
  intervals: Array<{
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
  }>;
  streams: Array<{
    streamType: string;
    data: unknown[];
  }>;
  bestEfforts: Array<{
    targetDistanceMeters: number;
    durationSeconds: number;
  }>;
};
