import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityInterval,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";

import {
  addDaysToDateKey,
  compareDateKeys,
  getLocalDateKey,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import { intervalsActivityDetailSchema } from "../intervals-sync/schemas";
import { aggregateTerrainSummary } from "../terrain/domain";
import type {
  AnalyticsDistanceTrendBucket,
  AnalyticsLongestRun,
  AnalyticsOverallPr,
  AnalyticsPrTrend,
  AnalyticsView,
} from "./contracts";
import {
  buildActiveMonthSummary,
  buildConsistency,
  calculateDeltaPercent,
  getAnalyticsYearContext,
} from "./overview";
import type { AnalyticsRepository } from "./service";
import {
  classifyTrainingMixActivity,
  summarizeTrainingMix,
} from "./training-mix";

type RunRow = {
  upstreamActivityId: string;
  name: string | null;
  rawDetail: unknown;
  startAt: Date;
  distanceMeters: number;
  totalElevationGainMeters: number | null;
};

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

function createMonthBuckets(year: number): AnalyticsDistanceTrendBucket[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const key = `${year}-${month}`;

    return {
      key,
      label: monthLabelFormatter.format(new Date(`${key}-01T00:00:00.000Z`)),
      distanceMeters: 0,
    };
  });
}

function createWeekBuckets(year: number): AnalyticsDistanceTrendBucket[] {
  const buckets: AnalyticsDistanceTrendBucket[] = [];
  const yearStartKey = `${year}-01-01`;
  const nextYearStartKey = `${year + 1}-01-01`;

  for (
    let currentStart = yearStartKey, index = 1;
    compareDateKeys(currentStart, nextYearStartKey) < 0;
    currentStart = addDaysToDateKey(currentStart, 7), index += 1
  ) {
    const currentEndExclusive = addDaysToDateKey(currentStart, 7);
    const currentEndInclusive = addDaysToDateKey(currentEndExclusive, -1);
    const monthDay = new Date(`${currentStart}T00:00:00.000Z`).toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      },
    );

    buckets.push({
      key: currentStart,
      label: `W${index} · ${monthDay}`,
      distanceMeters: 0,
    });

    if (compareDateKeys(currentEndInclusive, `${year}-12-31`) >= 0) {
      break;
    }
  }

  return buckets;
}

function buildDistanceTrends(
  rows: Array<Pick<RunRow, "startAt" | "distanceMeters">>,
  year: number,
  timezone: string,
): AnalyticsView["distanceTrends"] {
  const monthBuckets = createMonthBuckets(year);
  const weekBuckets = createWeekBuckets(year);
  const monthByKey = new Map(
    monthBuckets.map((bucket) => [bucket.key, bucket]),
  );
  const weekByKey = new Map(weekBuckets.map((bucket) => [bucket.key, bucket]));
  const yearStartKey = `${year}-01-01`;

  for (const row of rows) {
    const localDateKey = getLocalDateKey(row.startAt, timezone);
    const monthKey = localDateKey.slice(0, 7);
    const monthBucket = monthByKey.get(monthKey);

    if (monthBucket) {
      monthBucket.distanceMeters += row.distanceMeters;
    }

    const diffDays = Math.floor(
      (new Date(`${localDateKey}T00:00:00.000Z`).getTime() -
        new Date(`${yearStartKey}T00:00:00.000Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const weekOffset = Math.floor(diffDays / 7) * 7;
    const weekKey = addDaysToDateKey(yearStartKey, weekOffset);
    const weekBucket = weekByKey.get(weekKey);

    if (weekBucket) {
      weekBucket.distanceMeters += row.distanceMeters;
    }
  }

  return {
    month: monthBuckets,
    week: weekBuckets,
  };
}

function buildPrTrendSeries(
  year: number,
  rows: Array<{
    distanceMeters: number;
    monthStart: Date;
    durationSeconds: number;
  }>,
): AnalyticsView["prTrends"] {
  const distances = [...new Set(rows.map((row) => row.distanceMeters))].sort(
    (left, right) => left - right,
  );
  const monthBuckets = createMonthBuckets(year);

  const series: AnalyticsPrTrend[] = distances.map((distanceMeters) => ({
    distanceMeters,
    months: monthBuckets.map((month) => ({
      monthKey: `${month.key}-01`,
      label: month.label,
      durationSeconds: null,
    })),
  }));

  const seriesByDistance = new Map(
    series.map((entry) => [entry.distanceMeters, entry]),
  );

  for (const row of rows) {
    const monthKey = row.monthStart.toISOString().slice(0, 7);
    const monthIndex = monthBuckets.findIndex(
      (month) => month.key === monthKey,
    );

    if (monthIndex === -1) {
      continue;
    }

    const trend = seriesByDistance.get(row.distanceMeters);

    if (!trend) {
      continue;
    }

    trend.months[monthIndex] = {
      monthKey: `${monthKey}-01`,
      label: monthBuckets[monthIndex]!.label,
      durationSeconds: row.durationSeconds,
    };
  }

  return {
    distances,
    series,
  };
}

function extractIntervalSummary(rawDetail: unknown) {
  const parsed = intervalsActivityDetailSchema.safeParse(rawDetail);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.interval_summary ?? null;
}

function sumDistanceThroughCutoff(
  rows: Array<Pick<RunRow, "startAt" | "distanceMeters">>,
  cutoffDateKey: string,
  timezone: string,
) {
  return rows.reduce((sum, row) => {
    const localDateKey = getLocalDateKey(row.startAt, timezone);

    return compareDateKeys(localDateKey, cutoffDateKey) <= 0
      ? sum + row.distanceMeters
      : sum;
  }, 0);
}

function toLongestRun(
  row:
    | Pick<RunRow, "upstreamActivityId" | "name" | "distanceMeters" | "startAt">
    | undefined,
): AnalyticsLongestRun {
  if (!row) {
    return null;
  }

  return {
    activityId: row.upstreamActivityId,
    activityName:
      typeof row.name === "string" && row.name.trim().length > 0
        ? row.name
        : "Untitled run",
    distanceMeters: row.distanceMeters,
    startAt: row.startAt.toISOString(),
  };
}

function findLongestRun(
  rows: RunRow[],
):
  | Pick<RunRow, "upstreamActivityId" | "name" | "distanceMeters" | "startAt">
  | undefined {
  return rows.reduce<
    | Pick<RunRow, "upstreamActivityId" | "name" | "distanceMeters" | "startAt">
    | undefined
  >((longest, row) => {
    if (!longest || row.distanceMeters > longest.distanceMeters) {
      return row;
    }

    return longest;
  }, undefined);
}

export function createAnalyticsRepository(db: Database): AnalyticsRepository {
  return {
    getForUserInTimezone(userId, input) {
      return Effect.tryPromise(async () => {
        const yearContext = getAnalyticsYearContext({
          selectedYear: input.year,
          timezone: input.timezone,
          now: input.now,
        });
        const yearStartKey = `${input.year}-01-01`;
        const nextYearStartKey = `${input.year + 1}-01-01`;
        const rangeStart = localDateKeyToUtcStart(yearStartKey, input.timezone);
        const rangeEnd = localDateKeyToUtcStart(
          nextYearStartKey,
          input.timezone,
        );
        const comparisonStart = localDateKeyToUtcStart(
          `${yearContext.comparisonYear}-01-01`,
          input.timezone,
        );
        const comparisonEnd = localDateKeyToUtcStart(
          addDaysToDateKey(yearContext.comparisonCutoffDateKey, 1),
          input.timezone,
        );

        const [
          yearRuns,
          comparisonRuns,
          longestRunRow,
          overallPrRows,
          monthlyBestRows,
          allRuns,
        ] = await Promise.all([
          db.query.importedActivity.findMany({
            where: and(
              eq(importedActivity.userId, userId),
              gte(importedActivity.startAt, rangeStart),
              lt(importedActivity.startAt, rangeEnd),
            ),
            columns: {
              upstreamActivityId: true,
              name: true,
              rawDetail: true,
              startAt: true,
              distanceMeters: true,
              totalElevationGainMeters: true,
            },
            orderBy: asc(importedActivity.startAt),
          }),
          db.query.importedActivity.findMany({
            where: and(
              eq(importedActivity.userId, userId),
              gte(importedActivity.startAt, comparisonStart),
              lt(importedActivity.startAt, comparisonEnd),
            ),
            columns: {
              startAt: true,
              distanceMeters: true,
            },
            orderBy: asc(importedActivity.startAt),
          }),
          db.query.importedActivity.findFirst({
            where: eq(importedActivity.userId, userId),
            columns: {
              upstreamActivityId: true,
              name: true,
              distanceMeters: true,
              startAt: true,
            },
            orderBy: desc(importedActivity.distanceMeters),
          }),
          db
            .select({
              distanceMeters: userAllTimePr.distanceMeters,
              durationSeconds: userAllTimePr.durationSeconds,
              activityId: userAllTimePr.upstreamActivityId,
              monthKey: userAllTimePr.monthStart,
              achievedAt: importedActivity.startAt,
            })
            .from(userAllTimePr)
            .innerJoin(
              importedActivity,
              and(
                eq(importedActivity.userId, userAllTimePr.userId),
                eq(
                  importedActivity.upstreamActivityId,
                  userAllTimePr.upstreamActivityId,
                ),
              ),
            )
            .where(eq(userAllTimePr.userId, userId))
            .orderBy(asc(userAllTimePr.distanceMeters)),
          db.query.userMonthlyBest.findMany({
            where: and(
              eq(userMonthlyBest.userId, userId),
              gte(
                userMonthlyBest.monthStart,
                new Date(`${input.year}-01-01T00:00:00.000Z`),
              ),
              lt(
                userMonthlyBest.monthStart,
                new Date(`${input.year + 1}-01-01T00:00:00.000Z`),
              ),
            ),
            columns: {
              distanceMeters: true,
              durationSeconds: true,
              monthStart: true,
            },
            orderBy: [
              asc(userMonthlyBest.distanceMeters),
              asc(userMonthlyBest.monthStart),
            ],
          }),
          db.query.importedActivity.findMany({
            where: eq(importedActivity.userId, userId),
            columns: {
              startAt: true,
            },
            orderBy: asc(importedActivity.startAt),
          }),
        ]);

        const yearDistanceTrends = buildDistanceTrends(
          yearRuns,
          input.year,
          input.timezone,
        );
        const intervalRows =
          yearRuns.length > 0
            ? await db.query.importedActivityInterval.findMany({
                where: and(
                  eq(importedActivityInterval.userId, userId),
                  inArray(
                    importedActivityInterval.upstreamActivityId,
                    yearRuns.map((row) => row.upstreamActivityId),
                  ),
                ),
                columns: {
                  upstreamActivityId: true,
                  intervalType: true,
                },
              })
            : [];
        const workIntervalCountByActivity = new Map<string, number>();

        for (const row of intervalRows) {
          if (row.intervalType?.toUpperCase() !== "WORK") {
            continue;
          }

          workIntervalCountByActivity.set(
            row.upstreamActivityId,
            (workIntervalCountByActivity.get(row.upstreamActivityId) ?? 0) + 1,
          );
        }

        const overallPrs: AnalyticsOverallPr[] = overallPrRows.map((row) => ({
          distanceMeters: row.distanceMeters,
          durationSeconds: row.durationSeconds,
          activityId: row.activityId,
          monthKey: row.monthKey.toISOString().slice(0, 7),
          achievedAt: row.achievedAt.toISOString(),
        }));
        const totalDistanceMeters = sumDistanceThroughCutoff(
          yearRuns,
          yearContext.cutoffDateKey,
          input.timezone,
        );
        const comparisonDistanceMeters = comparisonRuns.reduce(
          (sum, row) => sum + row.distanceMeters,
          0,
        );
        const deltaPercent = calculateDeltaPercent({
          currentDistanceMeters: totalDistanceMeters,
          comparisonDistanceMeters,
        });

        return {
          availableYears: [
            ...new Set(allRuns.map((row) => row.startAt.getUTCFullYear())),
          ].sort((left, right) => left - right),
          selectedYear: input.year,
          distanceTrends: yearDistanceTrends,
          prTrends: buildPrTrendSeries(input.year, monthlyBestRows),
          overview: {
            totalDistance: {
              distanceMeters: totalDistanceMeters,
              comparisonYear: yearContext.comparisonYear,
              comparisonDistanceMeters,
              deltaPercent:
                deltaPercent == null ? null : Number(deltaPercent.toFixed(2)),
              cutoffDateKey: yearContext.cutoffDateKey,
              isPartialYear: yearContext.isPartialYear,
            },
            longestRunInYear: toLongestRun(findLongestRun(yearRuns)),
            trackedPrDistanceCount: buildPrTrendSeries(
              input.year,
              monthlyBestRows,
            ).distances.length,
            allTimePrCount: overallPrs.length,
            activeMonths: buildActiveMonthSummary({
              monthBuckets: yearDistanceTrends.month,
              elapsedMonthCount: yearContext.elapsedMonthCount,
            }),
          },
          trainingMix: summarizeTrainingMix(
            yearRuns.map((row) => ({
              key: classifyTrainingMixActivity({
                name: row.name,
                intervalSummary: extractIntervalSummary(row.rawDetail),
                workIntervalCount:
                  workIntervalCountByActivity.get(row.upstreamActivityId) ?? 0,
              }),
              distanceMeters: row.distanceMeters,
            })),
          ),
          consistency: buildConsistency({
            monthBuckets: yearDistanceTrends.month,
            elapsedMonthCount: yearContext.elapsedMonthCount,
          }),
          terrainSummary: aggregateTerrainSummary(
            yearRuns.map((row) => ({
              distanceMeters: row.distanceMeters,
              elevationGainMeters: row.totalElevationGainMeters,
            })),
          ),
          overallPrs,
          longestRun: longestRunRow
            ? {
                activityId: longestRunRow.upstreamActivityId,
                activityName:
                  typeof longestRunRow.name === "string" &&
                  longestRunRow.name.trim().length > 0
                    ? longestRunRow.name
                    : "Untitled run",
                distanceMeters: longestRunRow.distanceMeters,
                startAt: longestRunRow.startAt.toISOString(),
              }
            : null,
        } satisfies AnalyticsView;
      });
    },
  };
}
