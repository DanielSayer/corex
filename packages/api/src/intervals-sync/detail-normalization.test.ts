import { describe, expect, it } from "bun:test";

import { normalizeActivityDetailForStorage } from "./detail-normalization";

describe("activity detail normalization", () => {
  it("extracts scalar fields, zones, and intervals from a validated detail payload", () => {
    const normalized = normalizeActivityDetailForStorage({
      id: "run-1",
      type: "Run",
      name: "Morning workout",
      start_date_local: "2026-03-20T10:00:00.000+10:00",
      max_speed: 5.2,
      max_heartrate: 182,
      average_cadence: 86,
      calories: 640,
      device_name: "Forerunner",
      total_elevation_loss: 28,
      icu_training_load: 73,
      hr_load: 81,
      icu_intensity: 0.84,
      athlete_max_hr: 196,
      icu_hr_zones: [120, 140, 155, 170, 182],
      icu_hr_zone_times: [240, 600, 900, 420, 60],
      icu_intervals: [
        {
          id: 1,
          type: "WARMUP",
          zone: 2,
          intensity: 1,
          distance: 1000,
          moving_time: 300,
          elapsed_time: 305,
          start_time: 0,
          end_time: 300,
          average_speed: 3.33,
          max_speed: 4.8,
          average_heartrate: 132,
          max_heartrate: 145,
          average_cadence: 82,
          average_stride: 1.03,
          total_elevation_gain: 5,
        },
      ],
    });

    expect(normalized.scalars).toMatchObject({
      name: "Morning workout",
      deviceName: "Forerunner",
      maxSpeedMetersPerSecond: 5.2,
      averageCadence: 172,
      trainingLoad: 73,
      athleteMaxHr: 196,
    });
    expect(normalized.scalars.startDateLocal).toBeInstanceOf(Date);
    expect(normalized.heartRateZones).toEqual([
      { zoneIndex: 0, lowerBpm: 120, durationSeconds: 240 },
      { zoneIndex: 1, lowerBpm: 140, durationSeconds: 600 },
      { zoneIndex: 2, lowerBpm: 155, durationSeconds: 900 },
      { zoneIndex: 3, lowerBpm: 170, durationSeconds: 420 },
      { zoneIndex: 4, lowerBpm: 182, durationSeconds: 60 },
    ]);
    expect(normalized.intervals).toEqual([
      {
        intervalIndex: 0,
        intervalType: "WARMUP",
        zone: 2,
        intensity: 1,
        distanceMeters: 1000,
        movingTimeSeconds: 300,
        elapsedTimeSeconds: 305,
        startTimeSeconds: 0,
        endTimeSeconds: 300,
        averageSpeedMetersPerSecond: 3.33,
        maxSpeedMetersPerSecond: 4.8,
        averageHeartrate: 132,
        maxHeartrate: 145,
        averageCadence: 164,
        averageStride: 1.03,
        totalElevationGainMeters: 5,
      },
    ]);
  });

  it("drops incomplete zone pairs and defaults missing optional arrays to empty", () => {
    const normalized = normalizeActivityDetailForStorage({
      id: "run-2",
      type: "Run",
      icu_hr_zones: [120, 140],
      icu_hr_zone_times: [240],
    });

    expect(normalized.heartRateZones).toEqual([
      { zoneIndex: 0, lowerBpm: 120, durationSeconds: 240 },
    ]);
    expect(normalized.intervals).toEqual([]);
    expect(normalized.scalars).toMatchObject({
      name: null,
      startDateLocal: null,
      athleteMaxHr: null,
    });
  });
});
