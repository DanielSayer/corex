import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityHeartRateZone,
  importedActivityInterval,
  importedActivityMap,
  importedActivityStream,
  runBestEffort,
} from "@corex/db/schema/intervals-sync";

import type { ActivityDetailsPageData } from "./activity-details";
import {
  intervalsActivityMapSchema,
  intervalsActivityStreamSchema,
} from "./schemas";

function normalizeNumericArray(data: unknown): number[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const values: number[] = [];

  for (const value of data) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    values.push(value);
  }

  return values;
}

function deriveOneKmSplitTimesSeconds(distanceSamples: number[] | null) {
  if (!distanceSamples || distanceSamples.length <= 1) {
    return null;
  }

  const splits: Array<{
    splitNumber: number;
    splitDistanceMeters: number;
    durationSeconds: number;
  }> = [];
  let previousSplitCrossingTime = 0;

  for (let splitNumber = 1; ; splitNumber += 1) {
    const targetDistance = splitNumber * 1000;

    if (distanceSamples[distanceSamples.length - 1]! < targetDistance) {
      break;
    }

    let crossingIndex = -1;

    for (let index = 1; index < distanceSamples.length; index += 1) {
      if (distanceSamples[index]! >= targetDistance) {
        crossingIndex = index;
        break;
      }
    }

    if (crossingIndex === -1) {
      break;
    }

    const previousIndex = crossingIndex - 1;
    const previousDistance = distanceSamples[previousIndex]!;
    const currentDistance = distanceSamples[crossingIndex]!;
    const crossingTime =
      currentDistance === previousDistance
        ? crossingIndex
        : previousIndex +
          (targetDistance - previousDistance) /
            (currentDistance - previousDistance);

    splits.push({
      splitNumber,
      splitDistanceMeters: targetDistance,
      durationSeconds: crossingTime - previousSplitCrossingTime,
    });
    previousSplitCrossingTime = crossingTime;
  }

  return splits.length > 0 ? splits : null;
}

function formatNullableNumber(value: number | null) {
  return value == null ? null : String(value);
}

export async function loadActivityDetails(
  db: Database,
  userId: string,
  activityId: string,
): Promise<ActivityDetailsPageData | null> {
  const activityRow = await db.query.importedActivity.findFirst({
    where: and(
      eq(importedActivity.userId, userId),
      eq(importedActivity.upstreamActivityId, activityId),
    ),
  });

  if (!activityRow) {
    return null;
  }

  const [mapRow, streamRows, bestEffortRows, heartRateZoneRows, intervalRows] =
    await Promise.all([
      db.query.importedActivityMap.findFirst({
        where: and(
          eq(importedActivityMap.userId, userId),
          eq(importedActivityMap.upstreamActivityId, activityId),
        ),
      }),
      db.query.importedActivityStream.findMany({
        where: and(
          eq(importedActivityStream.userId, userId),
          eq(importedActivityStream.upstreamActivityId, activityId),
        ),
        orderBy: asc(importedActivityStream.streamType),
      }),
      db.query.runBestEffort.findMany({
        where: and(
          eq(runBestEffort.userId, userId),
          eq(runBestEffort.upstreamActivityId, activityId),
        ),
        orderBy: asc(runBestEffort.distanceMeters),
      }),
      db.query.importedActivityHeartRateZone.findMany({
        where: and(
          eq(importedActivityHeartRateZone.userId, userId),
          eq(importedActivityHeartRateZone.upstreamActivityId, activityId),
        ),
        orderBy: asc(importedActivityHeartRateZone.zoneIndex),
      }),
      db.query.importedActivityInterval.findMany({
        where: and(
          eq(importedActivityInterval.userId, userId),
          eq(importedActivityInterval.upstreamActivityId, activityId),
        ),
        orderBy: asc(importedActivityInterval.intervalIndex),
      }),
    ]);

  const parsedMap = mapRow
    ? intervalsActivityMapSchema.safeParse(mapRow.rawMap)
    : null;
  const mapData =
    parsedMap?.success &&
    parsedMap.data?.bounds &&
    parsedMap.data?.latlngs &&
    Array.isArray(parsedMap.data.bounds) &&
    Array.isArray(parsedMap.data.latlngs)
      ? {
          bounds: parsedMap.data.bounds,
          latlngs: parsedMap.data.latlngs.map((latlng) =>
            Array.isArray(latlng) &&
            latlng.length >= 2 &&
            typeof latlng[0] === "number" &&
            typeof latlng[1] === "number"
              ? ([latlng[0], latlng[1]] as [number, number])
              : null,
          ),
        }
      : null;

  const streams = streamRows.flatMap((row) => {
    const parsed = intervalsActivityStreamSchema.safeParse(row.rawStream);

    if (!parsed.success || !Array.isArray(parsed.data.data)) {
      return [];
    }

    return {
      streamType: row.streamType,
      data: parsed.data.data,
    };
  });

  const distanceStream = streams.find(
    (stream) => stream.streamType === "distance",
  );
  const oneKmSplitTimesSeconds = deriveOneKmSplitTimesSeconds(
    normalizeNumericArray(distanceStream?.data),
  );

  return {
    name: activityRow.name,
    startDateLocal: activityRow.startDateLocal?.toISOString() ?? null,
    type: activityRow.upstreamActivityType,
    deviceName: activityRow.deviceName,
    mapData,
    distance: activityRow.distanceMeters,
    movingTime: activityRow.movingTimeSeconds,
    elapsedTime: activityRow.elapsedTimeSeconds,
    averageSpeed: activityRow.averageSpeedMetersPerSecond,
    maxSpeed: activityRow.maxSpeedMetersPerSecond,
    averageHeartrate: activityRow.averageHeartrate,
    maxHeartrate: activityRow.maxHeartrate,
    averageCadence: activityRow.averageCadence,
    calories: activityRow.calories,
    totalElevationGain: activityRow.totalElevationGainMeters,
    totalElevationLoss: activityRow.totalElevationLossMeters,
    trainingLoad: activityRow.trainingLoad,
    hrLoad: activityRow.hrLoad,
    intensity: activityRow.intensity,
    athleteMaxHr: activityRow.athleteMaxHr,
    heartRateZonesBpm:
      heartRateZoneRows.length > 0
        ? heartRateZoneRows.map((row) => row.lowerBpm)
        : null,
    heartRateZoneDurationsSeconds:
      heartRateZoneRows.length > 0
        ? heartRateZoneRows.map((row) => row.durationSeconds)
        : null,
    oneKmSplitTimesSeconds,
    intervals: intervalRows.map((row) => ({
      intervalType: row.intervalType,
      zone: formatNullableNumber(row.zone),
      intensity: formatNullableNumber(row.intensity),
      distance: row.distanceMeters,
      movingTime: row.movingTimeSeconds,
      elapsedTime: row.elapsedTimeSeconds,
      startTime: row.startTimeSeconds,
      endTime: row.endTimeSeconds,
      averageSpeed: row.averageSpeedMetersPerSecond,
      maxSpeed: row.maxSpeedMetersPerSecond,
      averageHeartrate: row.averageHeartrate,
      maxHeartrate: row.maxHeartrate,
      averageCadence: row.averageCadence,
      averageStride: row.averageStride,
      totalElevationGain: row.totalElevationGainMeters,
    })),
    streams,
    bestEfforts: bestEffortRows.map((row) => ({
      targetDistanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
    })),
  };
}
