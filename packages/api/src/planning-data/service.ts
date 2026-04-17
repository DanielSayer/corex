import { Effect } from "effect";

import { intervalsActivityStreamSchema } from "../intervals-sync/schemas";
import { TARGET_EFFORT_DISTANCES_METERS } from "../intervals-sync/derived-performance";
import { aggregateTerrainSummary } from "../terrain/domain";
import type {
  PlanningHistoryQuality,
  PlanningHistorySnapshot,
  PlanningPerformanceSnapshot,
  PlanningProcessingWarning,
  PlanningWeeklyRollup,
} from "./contracts";
import {
  buildTrailingWeekBuckets,
  deriveHeartRateZoneTimes,
  getDistanceLabel,
  meetsHistoryThreshold,
  normalizeLatestSyncWarnings,
  normalizeNumericArray,
  sumHeartRateZoneTimes,
  trimRecentPrs,
  type PlanningPrSource,
} from "./domain";
import type {
  PlanningDataRepository,
  PlanningHistorySourceRow,
  PlanningProcessingWarningRow,
} from "./repository";

type Clock = {
  now: () => Date;
};

export type PlanningDataService = ReturnType<typeof createPlanningDataService>;

function toIsoString(value: Date) {
  return value.toISOString();
}

function mapDetailedRun(row: PlanningHistorySourceRow) {
  const streamResult = row.rawHeartrateStream
    ? intervalsActivityStreamSchema.safeParse(row.rawHeartrateStream)
    : null;
  const heartRateStream = streamResult?.success
    ? normalizeNumericArray(streamResult.data.data)
    : null;
  const zoneTimes = deriveHeartRateZoneTimes({
    heartRateSamples: heartRateStream,
    athleteMaxHeartRate: row.athleteMaxHr,
    movingTimeSeconds: row.movingTimeSeconds,
  });

  return {
    startAt: toIsoString(row.startAt),
    distanceMeters: row.distanceMeters ?? null,
    elapsedTimeSeconds: row.elapsedTimeSeconds,
    movingTimeSeconds: row.movingTimeSeconds,
    elevationGainMeters: row.elevationGainMeters,
    heartRateZoneTimes: zoneTimes,
    averageHeartrate: row.averageHeartrate,
    averageSpeedMetersPerSecond: row.averageSpeedMetersPerSecond,
    normalizedActivityType: row.normalizedActivityType ?? null,
  };
}

function buildWeeklyRollup(
  rows: PlanningHistorySourceRow[],
  weekStart: Date,
  weekEnd: Date,
): PlanningWeeklyRollup | null {
  if (rows.length === 0) {
    return null;
  }

  const detailedRuns = rows.map(mapDetailedRun);

  return {
    weekStart: toIsoString(weekStart),
    weekEnd: toIsoString(weekEnd),
    runCount: rows.length,
    totalDistanceMeters: rows.reduce((sum, row) => sum + row.distanceMeters, 0),
    totalDurationSeconds: rows.reduce(
      (sum, row) => sum + (row.movingTimeSeconds ?? 0),
      0,
    ),
    longestRunDistanceMeters: Math.max(
      ...rows.map((row) => row.distanceMeters),
    ),
    totalElevationGainMeters: rows.reduce(
      (sum, row) => sum + (row.elevationGainMeters ?? 0),
      0,
    ),
    heartRateZoneTimes: sumHeartRateZoneTimes(
      detailedRuns.map((run) => run.heartRateZoneTimes),
    ),
  };
}

function mapPr(source: PlanningPrSource) {
  return {
    distanceMeters: source.distanceMeters,
    distanceLabel: getDistanceLabel(source.distanceMeters),
    durationSeconds: source.durationSeconds,
    activityId: source.activityId,
    startAt: toIsoString(source.startAt),
    startSampleIndex: source.startSampleIndex,
    endSampleIndex: source.endSampleIndex,
  };
}

function summarizeProcessingWarnings(
  warnings: PlanningProcessingWarningRow[],
): PlanningProcessingWarning[] {
  const grouped = new Map<string, string[]>();

  for (const warning of warnings) {
    const existing = grouped.get(warning.code) ?? [];
    existing.push(warning.activityId);
    grouped.set(warning.code, existing);
  }

  return [...grouped.entries()]
    .map(([code, activityIds]) => ({
      code,
      count: activityIds.length,
      affectedActivityIds: [...activityIds].sort(),
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function createPlanningDataService(options: {
  repo: PlanningDataRepository;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };

  return {
    getPlanningHistorySnapshot(
      userId: string,
    ): Effect.Effect<PlanningHistorySnapshot, Error> {
      return Effect.gen(function* () {
        const now = clock.now();
        const eightWeeksAgo = new Date(now);
        eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 56);
        const runs = yield* options.repo.getHistoryRuns(userId, eightWeeksAgo);
        const buckets = buildTrailingWeekBuckets(now, 8);

        const detailedCutoff = buckets[3]?.start ?? eightWeeksAgo;
        const detailedRuns = runs
          .filter((row) => row.startAt >= detailedCutoff && row.startAt <= now)
          .map(mapDetailedRun);
        const weeklyRollups = buckets
          .slice(4)
          .map((bucket) =>
            buildWeeklyRollup(
              runs.filter(
                (row) =>
                  row.startAt >= bucket.start && row.startAt < bucket.end,
              ),
              bucket.start,
              bucket.end,
            ),
          )
          .filter((rollup): rollup is PlanningWeeklyRollup => rollup !== null);

        return {
          generatedAt: toIsoString(now),
          detailedRuns,
          weeklyRollups,
          terrainSummary: aggregateTerrainSummary(
            runs.map((row) => ({
              distanceMeters: row.distanceMeters,
              elevationGainMeters: row.elevationGainMeters,
            })),
          ),
        };
      });
    },
    getHistoryQuality(
      userId: string,
    ): Effect.Effect<PlanningHistoryQuality, Error> {
      return Effect.gen(function* () {
        const now = clock.now();
        const stats = yield* options.repo.getHistoryStats(userId);
        const latestSync = yield* options.repo.getLatestSync(userId);
        const latestSuccessfulSync =
          yield* options.repo.getLatestSuccessfulSync(userId);
        const hasAnyHistory = stats.runCount > 0;
        const hasRecentSync =
          latestSuccessfulSync?.completedAt != null &&
          latestSuccessfulSync.completedAt.getTime() >=
            now.getTime() - 7 * 24 * 60 * 60 * 1000;

        return {
          hasAnyHistory,
          meetsSnapshotThreshold: meetsHistoryThreshold(stats),
          hasRecentSync,
          latestSyncWarnings: normalizeLatestSyncWarnings({
            hasRecentSync,
            hasAnyHistory,
            latestSync,
          }),
          availableDateRange: {
            start: stats.oldestStartAt
              ? toIsoString(stats.oldestStartAt)
              : null,
            end: stats.newestStartAt ? toIsoString(stats.newestStartAt) : null,
          },
        };
      });
    },
    getPlanningPerformanceSnapshot(
      userId: string,
    ): Effect.Effect<PlanningPerformanceSnapshot, Error> {
      return Effect.gen(function* () {
        const now = clock.now();
        const [allTimePrRows, recentPrRows, warningRows] = yield* Effect.all([
          options.repo.getAllTimePrs(userId),
          options.repo.getRecentPrs(userId),
          options.repo.getProcessingWarnings(userId),
        ]);
        const allTimeByDistance = new Map(
          allTimePrRows.map((row) => [row.distanceMeters, row]),
        );
        const allTimePrs = TARGET_EFFORT_DISTANCES_METERS.map(
          (distanceMeters) => allTimeByDistance.get(distanceMeters),
        )
          .filter((row): row is PlanningPrSource => row !== undefined)
          .map(mapPr);
        const recentPrs = trimRecentPrs(recentPrRows, now).map(mapPr);

        return {
          allTimePrs,
          recentPrs,
          processingWarnings: summarizeProcessingWarnings(warningRows),
        };
      });
    },
  };
}
