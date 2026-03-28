import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  runBestEffort,
  runProcessingWarning,
} from "@corex/db/schema/intervals-sync";

import { SyncPersistenceFailure } from "./errors";
import { reconcileDistance } from "./derived-performance-pr-reconcile";
import type { DerivedPerformanceRepository } from "./derived-performance-repository-types";

export type {
  DerivedPerformanceRepository,
  DerivedPerformanceWriteSummary,
  ImportedRunForDerivedPerformance,
} from "./derived-performance-repository-types";

export function createDerivedPerformanceRepository(
  db: Database,
): DerivedPerformanceRepository {
  return {
    replaceRunEfforts(input) {
      return Effect.tryPromise({
        try: async () => {
          const previousEffortRows = await db.query.runBestEffort.findMany({
            where: and(
              eq(runBestEffort.userId, input.userId),
              eq(runBestEffort.upstreamActivityId, input.upstreamActivityId),
            ),
          });
          const affectedDistances = [
            ...new Set([
              ...previousEffortRows.map((row) => row.distanceMeters),
              ...input.efforts.map((effort) => effort.distanceMeters),
            ]),
          ];

          return db.transaction(async (tx) => {
            await tx
              .delete(runProcessingWarning)
              .where(
                and(
                  eq(runProcessingWarning.userId, input.userId),
                  eq(
                    runProcessingWarning.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            await tx
              .delete(runBestEffort)
              .where(
                and(
                  eq(runBestEffort.userId, input.userId),
                  eq(
                    runBestEffort.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            if (input.efforts.length > 0) {
              await tx.insert(runBestEffort).values(
                input.efforts.map((effort) => ({
                  userId: input.userId,
                  upstreamActivityId: input.upstreamActivityId,
                  distanceMeters: effort.distanceMeters,
                  durationSeconds: effort.durationSeconds,
                  startSampleIndex: effort.startSampleIndex,
                  endSampleIndex: effort.endSampleIndex,
                })),
              );
            }

            let allTimePrCount = 0;
            let monthlyBestCount = 0;

            for (const distanceMeters of affectedDistances) {
              const result = await reconcileDistance(
                tx as unknown as Database,
                input.userId,
                distanceMeters,
              );

              allTimePrCount += result.allTimePrCount;
              monthlyBestCount += result.monthlyBestCount;
            }

            return {
              effortCount: input.efforts.length,
              warningCount: 0,
              allTimePrCount,
              monthlyBestCount,
            };
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to replace run best efforts",
            cause,
          }),
      });
    },
    replaceRunWarnings(input) {
      return Effect.tryPromise({
        try: async () => {
          const previousEffortRows = await db.query.runBestEffort.findMany({
            where: and(
              eq(runBestEffort.userId, input.userId),
              eq(runBestEffort.upstreamActivityId, input.upstreamActivityId),
            ),
          });
          const affectedDistances = [
            ...new Set(previousEffortRows.map((row) => row.distanceMeters)),
          ];

          return db.transaction(async (tx) => {
            await tx
              .delete(runBestEffort)
              .where(
                and(
                  eq(runBestEffort.userId, input.userId),
                  eq(
                    runBestEffort.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            await tx
              .delete(runProcessingWarning)
              .where(
                and(
                  eq(runProcessingWarning.userId, input.userId),
                  eq(
                    runProcessingWarning.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            if (input.warnings.length > 0) {
              await tx.insert(runProcessingWarning).values(
                input.warnings.map((warning) => ({
                  userId: input.userId,
                  upstreamActivityId: input.upstreamActivityId,
                  code: warning.code,
                  message: warning.message,
                  metadata: warning.metadata,
                })),
              );
            }

            let allTimePrCount = 0;
            let monthlyBestCount = 0;

            for (const distanceMeters of affectedDistances) {
              const result = await reconcileDistance(
                tx as unknown as Database,
                input.userId,
                distanceMeters,
              );

              allTimePrCount += result.allTimePrCount;
              monthlyBestCount += result.monthlyBestCount;
            }

            return {
              effortCount: 0,
              warningCount: input.warnings.length,
              allTimePrCount,
              monthlyBestCount,
            };
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to replace run processing warnings",
            cause,
          }),
      });
    },
  };
}
