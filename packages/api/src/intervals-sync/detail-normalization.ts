import type { IntervalsActivityDetail } from "./schemas";

export type NormalizedActivityScalars = {
  name: string | null;
  startDateLocal: Date | null;
  deviceName: string | null;
  maxSpeedMetersPerSecond: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  calories: number | null;
  totalElevationLossMeters: number | null;
  trainingLoad: number | null;
  hrLoad: number | null;
  intensity: number | null;
  athleteMaxHr: number | null;
};

export type NormalizedHeartRateZoneRow = {
  zoneIndex: number;
  lowerBpm: number;
  durationSeconds: number;
};

export type NormalizedIntervalRow = {
  intervalIndex: number;
  intervalType: string | null;
  zone: number | null;
  intensity: number | null;
  distanceMeters: number | null;
  movingTimeSeconds: number | null;
  elapsedTimeSeconds: number | null;
  startTimeSeconds: number | null;
  endTimeSeconds: number | null;
  averageSpeedMetersPerSecond: number | null;
  maxSpeedMetersPerSecond: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  averageStride: number | null;
  totalElevationGainMeters: number | null;
};

export type NormalizedActivityDetail = {
  scalars: NormalizedActivityScalars;
  heartRateZones: NormalizedHeartRateZoneRow[];
  intervals: NormalizedIntervalRow[];
};

function parseNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeActivityDetailForStorage(
  detail: IntervalsActivityDetail,
): NormalizedActivityDetail {
  return {
    scalars: {
      name: detail.name ?? null,
      startDateLocal: parseNullableDate(detail.start_date_local),
      deviceName: detail.device_name ?? null,
      maxSpeedMetersPerSecond: detail.max_speed ?? null,
      maxHeartrate: detail.max_heartrate ?? null,
      averageCadence: detail.average_cadence ?? null,
      calories: detail.calories ?? null,
      totalElevationLossMeters: detail.total_elevation_loss ?? null,
      trainingLoad: detail.icu_training_load ?? null,
      hrLoad: detail.hr_load ?? null,
      intensity: detail.icu_intensity ?? null,
      athleteMaxHr: detail.athlete_max_hr ?? null,
    },
    heartRateZones:
      detail.icu_hr_zones?.flatMap((lowerBpm, zoneIndex) => {
        const durationSeconds = detail.icu_hr_zone_times?.[zoneIndex];

        if (
          typeof lowerBpm !== "number" ||
          !Number.isFinite(lowerBpm) ||
          typeof durationSeconds !== "number" ||
          !Number.isFinite(durationSeconds)
        ) {
          return [];
        }

        return {
          zoneIndex,
          lowerBpm,
          durationSeconds,
        };
      }) ?? [],
    intervals:
      detail.icu_intervals?.map((interval, intervalIndex) => ({
        intervalIndex,
        intervalType: interval.type ?? null,
        zone: interval.zone ?? null,
        intensity: interval.intensity ?? null,
        distanceMeters: interval.distance ?? null,
        movingTimeSeconds: interval.moving_time ?? null,
        elapsedTimeSeconds: interval.elapsed_time ?? null,
        startTimeSeconds: interval.start_time ?? null,
        endTimeSeconds: interval.end_time ?? null,
        averageSpeedMetersPerSecond: interval.average_speed ?? null,
        maxSpeedMetersPerSecond: interval.max_speed ?? null,
        averageHeartrate: interval.average_heartrate ?? null,
        maxHeartrate: interval.max_heartrate ?? null,
        averageCadence: interval.average_cadence ?? null,
        averageStride: interval.average_stride ?? null,
        totalElevationGainMeters: interval.total_elevation_gain ?? null,
      })) ?? [],
  };
}
