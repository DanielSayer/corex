import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityStream,
  runProcessingWarning,
  syncEvent,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";
import { weeklyPlanActivityLink } from "@corex/db/schema/weekly-planning";

type PlanningDataFailure = Error;

export type PlanningHistorySourceRow = {
  activityId: string;
  startAt: Date;
  summaryDate?: string | null;
  distanceMeters: number;
  elapsedTimeSeconds: number | null;
  movingTimeSeconds: number;
  elevationGainMeters: number | null;
  averageHeartrate: number | null;
  averageSpeedMetersPerSecond: number | null;
  athleteMaxHr: number | null;
  normalizedActivityType: string;
  rawHeartrateStream: unknown | null;
};

export type PlanningHistoryStats = {
  runCount: number;
  oldestStartAt: Date | null;
  newestStartAt: Date | null;
};

export type PlanningSyncSummaryRow = {
  status: "in_progress" | "success" | "failure";
  completedAt: Date | null;
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  skippedInvalidCount: number;
  skippedNonRunningCount: number;
  unknownActivityTypes: string[];
};

export type PlanningPrRow = {
  distanceMeters: number;
  durationSeconds: number;
  activityId: string;
  startAt: Date;
  startSampleIndex: number;
  endSampleIndex: number;
};

export type PlanningProcessingWarningRow = {
  code: string;
  activityId: string;
};

export type PlanningDataRepository = {
  getHistoryRuns: (
    userId: string,
    since: Date,
  ) => Effect.Effect<PlanningHistorySourceRow[], PlanningDataFailure>;
  getHistoryStats: (
    userId: string,
  ) => Effect.Effect<PlanningHistoryStats, PlanningDataFailure>;
  getLatestSync: (
    userId: string,
  ) => Effect.Effect<PlanningSyncSummaryRow | null, PlanningDataFailure>;
  getLatestSuccessfulSync: (
    userId: string,
  ) => Effect.Effect<PlanningSyncSummaryRow | null, PlanningDataFailure>;
  getAllTimePrs: (
    userId: string,
  ) => Effect.Effect<PlanningPrRow[], PlanningDataFailure>;
  getRecentPrs: (
    userId: string,
  ) => Effect.Effect<PlanningPrRow[], PlanningDataFailure>;
  getProcessingWarnings: (
    userId: string,
  ) => Effect.Effect<PlanningProcessingWarningRow[], PlanningDataFailure>;
};

export function createPlanningDataRepository(
  db: Database,
): PlanningDataRepository {
  const normalizeDate = (value: Date | string | null) => {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value : new Date(value);
  };

  return {
    getHistoryRuns(userId, since) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              activityId: importedActivity.upstreamActivityId,
              startAt: importedActivity.startAt,
              summaryDate: weeklyPlanActivityLink.plannedDate,
              distanceMeters: importedActivity.distanceMeters,
              elapsedTimeSeconds: importedActivity.elapsedTimeSeconds,
              movingTimeSeconds: importedActivity.movingTimeSeconds,
              elevationGainMeters: importedActivity.totalElevationGainMeters,
              averageHeartrate: importedActivity.averageHeartrate,
              averageSpeedMetersPerSecond:
                importedActivity.averageSpeedMetersPerSecond,
              athleteMaxHr: importedActivity.athleteMaxHr,
              normalizedActivityType: importedActivity.normalizedActivityType,
              rawHeartrateStream: importedActivityStream.rawStream,
            })
            .from(importedActivity)
            .leftJoin(
              weeklyPlanActivityLink,
              and(
                eq(weeklyPlanActivityLink.userId, importedActivity.userId),
                eq(
                  weeklyPlanActivityLink.activityId,
                  importedActivity.upstreamActivityId,
                ),
              ),
            )
            .leftJoin(
              importedActivityStream,
              and(
                eq(importedActivityStream.userId, importedActivity.userId),
                eq(
                  importedActivityStream.upstreamActivityId,
                  importedActivity.upstreamActivityId,
                ),
                eq(importedActivityStream.streamType, "heartrate"),
              ),
            )
            .where(
              and(
                eq(importedActivity.userId, userId),
                gte(importedActivity.startAt, since),
              ),
            )
            .orderBy(desc(importedActivity.startAt));

          return rows satisfies PlanningHistorySourceRow[];
        },
        catch: (cause) =>
          new Error(
            `Failed to load planning history runs: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getHistoryStats(userId) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .select({
              runCount: sql<number>`count(*)`,
              oldestStartAt: sql<Date | null>`min(${importedActivity.startAt})`,
              newestStartAt: sql<Date | null>`max(${importedActivity.startAt})`,
            })
            .from(importedActivity)
            .where(eq(importedActivity.userId, userId));

          return {
            runCount: Number(row?.runCount ?? 0),
            oldestStartAt: normalizeDate(row?.oldestStartAt ?? null),
            newestStartAt: normalizeDate(row?.newestStartAt ?? null),
          };
        },
        catch: (cause) =>
          new Error(
            `Failed to load planning history stats: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getLatestSync(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.syncEvent.findFirst({
            where: eq(syncEvent.userId, userId),
            orderBy: desc(syncEvent.startedAt),
          });

          return row
            ? {
                status: row.status,
                completedAt: row.completedAt,
                failedDetailCount: row.failedDetailCount,
                failedMapCount: row.failedMapCount,
                failedStreamCount: row.failedStreamCount,
                skippedInvalidCount: row.skippedInvalidCount,
                skippedNonRunningCount: row.skippedNonRunningCount,
                unknownActivityTypes:
                  (row.unknownActivityTypes as string[] | null) ?? [],
              }
            : null;
        },
        catch: (cause) =>
          new Error(
            `Failed to load latest sync: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getLatestSuccessfulSync(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.syncEvent.findFirst({
            where: and(
              eq(syncEvent.userId, userId),
              eq(syncEvent.status, "success"),
            ),
            orderBy: desc(syncEvent.startedAt),
          });

          return row
            ? {
                status: row.status,
                completedAt: row.completedAt,
                failedDetailCount: row.failedDetailCount,
                failedMapCount: row.failedMapCount,
                failedStreamCount: row.failedStreamCount,
                skippedInvalidCount: row.skippedInvalidCount,
                skippedNonRunningCount: row.skippedNonRunningCount,
                unknownActivityTypes:
                  (row.unknownActivityTypes as string[] | null) ?? [],
              }
            : null;
        },
        catch: (cause) =>
          new Error(
            `Failed to load latest successful sync: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getAllTimePrs(userId) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              distanceMeters: userAllTimePr.distanceMeters,
              durationSeconds: userAllTimePr.durationSeconds,
              activityId: userAllTimePr.upstreamActivityId,
              startAt: importedActivity.startAt,
              startSampleIndex: userAllTimePr.startSampleIndex,
              endSampleIndex: userAllTimePr.endSampleIndex,
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
            .orderBy(asc(userAllTimePr.distanceMeters));

          return rows satisfies PlanningPrRow[];
        },
        catch: (cause) =>
          new Error(
            `Failed to load all-time PRs: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getRecentPrs(userId) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              distanceMeters: userMonthlyBest.distanceMeters,
              durationSeconds: userMonthlyBest.durationSeconds,
              activityId: userMonthlyBest.upstreamActivityId,
              startAt: importedActivity.startAt,
              startSampleIndex: userMonthlyBest.startSampleIndex,
              endSampleIndex: userMonthlyBest.endSampleIndex,
            })
            .from(userMonthlyBest)
            .innerJoin(
              importedActivity,
              and(
                eq(importedActivity.userId, userMonthlyBest.userId),
                eq(
                  importedActivity.upstreamActivityId,
                  userMonthlyBest.upstreamActivityId,
                ),
              ),
            )
            .where(eq(userMonthlyBest.userId, userId))
            .orderBy(
              desc(importedActivity.startAt),
              asc(userMonthlyBest.distanceMeters),
            );

          return rows satisfies PlanningPrRow[];
        },
        catch: (cause) =>
          new Error(
            `Failed to load recent PRs: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getProcessingWarnings(userId) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              code: runProcessingWarning.code,
              activityId: runProcessingWarning.upstreamActivityId,
            })
            .from(runProcessingWarning)
            .where(eq(runProcessingWarning.userId, userId))
            .orderBy(
              asc(runProcessingWarning.code),
              asc(runProcessingWarning.upstreamActivityId),
            );

          return rows satisfies PlanningProcessingWarningRow[];
        },
        catch: (cause) =>
          new Error(
            `Failed to load processing warnings: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
  };
}
