import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityHeartRateZone,
  importedActivityInterval,
  importedActivityMap,
  importedActivityStream,
  runBestEffort,
} from "@corex/db/schema/intervals-sync";

import {
  intervalsActivityMapSchema,
  intervalsActivityStreamSchema,
} from "../intervals-sync/schemas";
import {
  MAX_ACTIVITY_ANALYSIS_POINTS,
  MAX_ACTIVITY_MAP_PREVIEW_POINTS,
  type ActivityAnalysisData,
  type ActivityIntervalSummary,
  type ActivityMapPreviewData,
  type ActivityMetricKey,
  type ActivitySummaryPageData,
} from "./activity-details";
import {
  buildActivityMetricSeries,
  downsampleMapLatLngs,
} from "./activity-series";
import {
  buildActivityCalendar,
  type ActivityCalendarQueryInput,
} from "./activity-calendar";
import { ActivityHistoryPersistenceFailure } from "./errors";
import type { RecentActivityPreview } from "./recent-activity";
import type { ActivityHistoryApi } from "./service";

const ANALYSIS_STREAM_TYPES = [
  "heartrate",
  "cadence",
  "velocity_smooth",
  "fixed_altitude",
] as const satisfies readonly ActivityMetricKey[];

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

function getActivityDurationSeconds(activity: {
  elapsedTimeSeconds: number | null;
  movingTimeSeconds: number | null;
}) {
  return activity.elapsedTimeSeconds ?? activity.movingTimeSeconds;
}

function parseMapPreview(rawMap: unknown): ActivityMapPreviewData {
  const parsedMap = intervalsActivityMapSchema.safeParse(rawMap);

  if (
    !parsedMap.success ||
    !parsedMap.data?.bounds ||
    !parsedMap.data?.latlngs ||
    !Array.isArray(parsedMap.data.bounds) ||
    !Array.isArray(parsedMap.data.latlngs)
  ) {
    return null;
  }

  return {
    bounds: parsedMap.data.bounds,
    latlngs: downsampleMapLatLngs(
      parsedMap.data.latlngs.map((latlng) =>
        Array.isArray(latlng) &&
        latlng.length >= 2 &&
        typeof latlng[0] === "number" &&
        typeof latlng[1] === "number"
          ? ([latlng[0], latlng[1]] as [number, number])
          : null,
      ),
      MAX_ACTIVITY_MAP_PREVIEW_POINTS,
    ),
  };
}

function mapIntervals(
  intervalRows: Array<{
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
  }>,
): ActivityIntervalSummary[] {
  return intervalRows.map((row) => ({
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
  }));
}

async function loadActivityBaseRow(
  db: Database,
  userId: string,
  activityId: string,
) {
  return db.query.importedActivity.findFirst({
    where: and(
      eq(importedActivity.userId, userId),
      eq(importedActivity.upstreamActivityId, activityId),
    ),
  });
}

async function loadRecentActivities(
  db: Database,
  userId: string,
): Promise<RecentActivityPreview[]> {
  const activityRows = await db.query.importedActivity.findMany({
    where: eq(importedActivity.userId, userId),
    orderBy: desc(importedActivity.startAt),
    limit: 5,
  });

  if (activityRows.length === 0) {
    return [];
  }

  const mapRows = await db.query.importedActivityMap.findMany({
    where: and(
      eq(importedActivityMap.userId, userId),
      inArray(
        importedActivityMap.upstreamActivityId,
        activityRows.map((row) => row.upstreamActivityId),
      ),
    ),
  });

  const mapByActivityId = new Map(
    mapRows.map((row) => [row.upstreamActivityId, row]),
  );

  return activityRows.map((row) => {
    const mapRow = mapByActivityId.get(row.upstreamActivityId);
    const mapResult = mapRow
      ? intervalsActivityMapSchema.safeParse(mapRow.rawMap)
      : null;
    const map = mapResult?.success ? mapResult.data : null;

    return {
      id: row.upstreamActivityId,
      name:
        typeof row.name === "string" && row.name.trim().length > 0
          ? row.name
          : "Untitled run",
      startDate: row.startAt.toISOString(),
      distance: row.distanceMeters,
      elapsedTime: row.elapsedTimeSeconds,
      averageHeartrate: row.averageHeartrate,
      routePreview:
        map?.latlngs && Array.isArray(map.latlngs)
          ? { latlngs: map.latlngs }
          : null,
    };
  });
}

async function loadActivitySummary(
  db: Database,
  userId: string,
  activityId: string,
): Promise<ActivitySummaryPageData | null> {
  const activityRow = await loadActivityBaseRow(db, userId, activityId);

  if (!activityRow) {
    return null;
  }

  const [
    mapRow,
    distanceStreamRow,
    bestEffortRows,
    heartRateZoneRows,
    intervalRows,
  ] = await Promise.all([
    db.query.importedActivityMap.findFirst({
      where: and(
        eq(importedActivityMap.userId, userId),
        eq(importedActivityMap.upstreamActivityId, activityId),
      ),
    }),
    db.query.importedActivityStream.findFirst({
      where: and(
        eq(importedActivityStream.userId, userId),
        eq(importedActivityStream.upstreamActivityId, activityId),
        eq(importedActivityStream.streamType, "distance"),
      ),
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

  const parsedDistanceStream = distanceStreamRow
    ? intervalsActivityStreamSchema.safeParse(distanceStreamRow.rawStream)
    : null;
  const oneKmSplitTimesSeconds = deriveOneKmSplitTimesSeconds(
    normalizeNumericArray(
      parsedDistanceStream?.success ? parsedDistanceStream.data.data : null,
    ),
  );

  return {
    name: activityRow.name,
    startDateLocal: activityRow.startDateLocal?.toISOString() ?? null,
    type: activityRow.upstreamActivityType,
    deviceName: activityRow.deviceName,
    mapPreview: mapRow ? parseMapPreview(mapRow.rawMap) : null,
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
    intervals: mapIntervals(intervalRows),
    bestEfforts: bestEffortRows.map((row) => ({
      targetDistanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
    })),
  };
}

async function loadActivityAnalysis(
  db: Database,
  userId: string,
  activityId: string,
): Promise<ActivityAnalysisData | null> {
  const activityRow = await loadActivityBaseRow(db, userId, activityId);

  if (!activityRow) {
    return null;
  }

  const streamRows = await db.query.importedActivityStream.findMany({
    where: and(
      eq(importedActivityStream.userId, userId),
      eq(importedActivityStream.upstreamActivityId, activityId),
      inArray(importedActivityStream.streamType, [...ANALYSIS_STREAM_TYPES]),
    ),
    orderBy: asc(importedActivityStream.streamType),
  });

  const analysis: ActivityAnalysisData = {
    heartrate: [],
    cadence: [],
    velocity_smooth: [],
    fixed_altitude: [],
  };
  const durationSeconds = getActivityDurationSeconds(activityRow);

  for (const row of streamRows) {
    if (!ANALYSIS_STREAM_TYPES.includes(row.streamType as ActivityMetricKey)) {
      continue;
    }

    const parsed = intervalsActivityStreamSchema.safeParse(row.rawStream);

    if (!parsed.success || !Array.isArray(parsed.data.data)) {
      continue;
    }

    const metric = row.streamType as ActivityMetricKey;
    analysis[metric] = buildActivityMetricSeries({
      durationSeconds,
      metric,
      rawData: parsed.data.data,
      maxPoints: MAX_ACTIVITY_ANALYSIS_POINTS,
    });
  }

  return analysis;
}

async function loadActivityCalendar(
  db: Database,
  userId: string,
  input: ActivityCalendarQueryInput,
) {
  const activityRows = await db.query.importedActivity.findMany({
    where: and(
      eq(importedActivity.userId, userId),
      gte(importedActivity.startAt, new Date(input.from)),
      lt(importedActivity.startAt, new Date(input.to)),
    ),
    orderBy: asc(importedActivity.startAt),
  });

  return buildActivityCalendar(input, [
    ...activityRows.map((row) => ({
      id: row.upstreamActivityId,
      name: row.name,
      startDate: row.startAt,
      elapsedTime: row.elapsedTimeSeconds,
      distance: row.distanceMeters,
      averageHeartrate: row.averageHeartrate,
      trainingLoad: row.trainingLoad,
      totalElevationGain: row.totalElevationGainMeters,
    })),
  ]);
}

export function createActivityHistoryRepository(
  db: Database,
): ActivityHistoryApi {
  return {
    recentActivities(userId) {
      return Effect.tryPromise({
        try: () => loadRecentActivities(db, userId),
        catch: (cause) =>
          new ActivityHistoryPersistenceFailure({
            message: "Failed to load recent activities",
            cause,
          }),
      });
    },
    activitySummary(userId, activityId) {
      return Effect.tryPromise({
        try: () => loadActivitySummary(db, userId, activityId),
        catch: (cause) =>
          new ActivityHistoryPersistenceFailure({
            message: "Failed to load activity summary",
            cause,
          }),
      });
    },
    activityAnalysis(userId, activityId) {
      return Effect.tryPromise({
        try: () => loadActivityAnalysis(db, userId, activityId),
        catch: (cause) =>
          new ActivityHistoryPersistenceFailure({
            message: "Failed to load activity analysis",
            cause,
          }),
      });
    },
    calendar(userId, input) {
      return Effect.tryPromise({
        try: () => loadActivityCalendar(db, userId, input),
        catch: (cause) =>
          new ActivityHistoryPersistenceFailure({
            message: "Failed to load activity calendar",
            cause,
          }),
      });
    },
  };
}
