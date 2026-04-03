import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";

import {
  addDaysToDateKey,
  compareDateKeys,
  getLocalDateKey,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import type {
  AnalyticsDistanceTrendBucket,
  AnalyticsOverallPr,
  AnalyticsPrTrend,
  AnalyticsView,
} from "./contracts";
import type { AnalyticsService } from "./service";

type RunRow = {
  startAt: Date;
  distanceMeters: number;
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
  rows: RunRow[],
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

export function createAnalyticsRepository(db: Database): AnalyticsService {
  return {
    getForUser(userId, input) {
      return Effect.tryPromise(async () => {
        const yearStartKey = `${input.year}-01-01`;
        const nextYearStartKey = `${input.year + 1}-01-01`;
        const rangeStart = localDateKeyToUtcStart(yearStartKey, input.timezone);
        const rangeEnd = localDateKeyToUtcStart(
          nextYearStartKey,
          input.timezone,
        );

        const [
          yearRuns,
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
          db.query.userAllTimePr.findMany({
            where: eq(userAllTimePr.userId, userId),
            columns: {
              distanceMeters: true,
              durationSeconds: true,
              upstreamActivityId: true,
              monthStart: true,
            },
            orderBy: asc(userAllTimePr.distanceMeters),
          }),
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

        const availableYears = [
          ...new Set([
            ...allRuns.map((row) => row.startAt.getUTCFullYear()),
            ...monthlyBestRows.map((row) => row.monthStart.getUTCFullYear()),
          ]),
        ].sort((left, right) => left - right);

        const overallPrs: AnalyticsOverallPr[] = overallPrRows.map((row) => ({
          distanceMeters: row.distanceMeters,
          durationSeconds: row.durationSeconds,
          activityId: row.upstreamActivityId,
          monthKey: row.monthStart.toISOString().slice(0, 7),
        }));

        return {
          availableYears,
          selectedYear: input.year,
          distanceTrends: buildDistanceTrends(
            yearRuns,
            input.year,
            input.timezone,
          ),
          prTrends: buildPrTrendSeries(input.year, monthlyBestRows),
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
